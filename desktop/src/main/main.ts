// Proceso principal de Maquetario (Electron). Reemplaza a Host.cs.
import { app, BrowserWindow, Menu, session as electronSession, type MenuItemConstructorOptions } from 'electron';
import { join } from 'node:path';
import { attachBridge } from './bridge.ts';
import { APP_ORIGIN, argValue, isDev, isSelfTest, rendererDir } from './env.ts';
import { warmFontCatalog } from './fonts/catalog.ts';
import { checkLicense, licenseBlocks, licenseMessage } from './license.ts';
import { captureNotice, showNotice, type NoticeOptions } from './notice.ts';
import { handleScheme, registerScheme } from './protocol.ts';
import { runSelfTest } from './selftest.ts';
import { createSession, exec, type Session } from './session.ts';
import { windowChromeOptions } from './window-chrome.ts';

app.setName('Maquetario');
registerScheme();

// Una sola instancia: abrir otro .mqt con la app abierta lo lleva a la ventana existente.
if (!isSelfTest && !app.requestSingleInstanceLock()) app.quit();

let main: Session | null = null;

const LICENSE_NOTICE = (message: string): NoticeOptions => ({
  title: 'Maquetario necesita una licencia activa',
  message,
});

function applicationMenu(): void {
  if (process.platform !== 'darwin') {
    // Windows/Linux: sin barra de menú, como la versión anterior. Copiar/pegar funcionan igual.
    Menu.setApplicationMenu(null);
    return;
  }
  // macOS necesita el menú Edición para que funcionen ⌘C/⌘V en los campos de texto.
  const template: MenuItemConstructorOptions[] = [
    { role: 'appMenu' },
    { role: 'editMenu' },
    ...(isDev ? [{ role: 'viewMenu' } as MenuItemConstructorOptions] : []),
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function lockDown(): void {
  const ses = electronSession.defaultSession;
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-navigate', (event, url) => {
      if (!url.startsWith(`${APP_ORIGIN}/`)) event.preventDefault();
    });
    contents.on('will-attach-webview', (event) => event.preventDefault());
  });
}

function createWindow(): Session {
  const chrome = windowChromeOptions();
  const win = new BrowserWindow({
    width: 1536,
    height: 1024,
    minWidth: 1120,
    minHeight: 760,
    ...chrome.options,
    title: 'Maquetario · Maquetación y Diseño de Libros',
    icon: join(rendererDir(), 'maquetario.ico'),
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      // La interfaz necesita saber qué material y qué botones de ventana hay para acomodarse.
      additionalArguments: [`--maquetario-material=${chrome.material}`, `--maquetario-controls=${chrome.controls}`],
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
      devTools: isDev,
      // El self-test captura la ventana aunque no esté visible.
      backgroundThrottling: !isSelfTest,
    },
  });
  const session = createSession(win);
  attachBridge(session);

  // En la autoprueba la ventana también se muestra (sin robar el foco): con la página
  // oculta Chromium demora eventos como el cierre de <dialog> y las pruebas fallan.
  win.once('ready-to-show', () => (isSelfTest ? win.showInactive() : win.show()));
  // Evita que el título del documento HTML pise el que pone la app.
  win.on('page-title-updated', (event) => event.preventDefault());

  if (isDev) {
    win.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      if (input.key === 'F12') win.webContents.toggleDevTools();
      else if ((input.control || input.meta) && input.key.toLowerCase() === 'r') {
        event.preventDefault();
        win.webContents.reload();
      }
    });
  }

  win.on('close', (event) => onClose(session, event));
  win.webContents.on('did-fail-load', (_event, code, description, url) => {
    if (!url.startsWith(`${APP_ORIGIN}/`)) return;
    void showNotice({
      title: 'Maquetario no pudo iniciar',
      message: 'No se pudo cargar el editor. Reinstalá Maquetario desde Motiova; tus proyectos no se modificaron.',
      detail: `${description} (${code})`,
    }).then(() => app.quit());
  });
  void win.loadURL(`${APP_ORIGIN}/index.html`);
  return session;
}

/** Misma lógica que OnClosing en Host.cs: no perder trabajo sin guardar. */
function onClose(session: Session, event: Electron.Event): void {
  if (session.closingAllowed) return;
  if (session.busy || session.assistantWorking) {
    event.preventDefault();
    void exec(session, 'window.showBusyCloseNotice()').catch(() => undefined);
    return;
  }
  if (!session.dirty) return;
  event.preventDefault();
  if (session.closePromptShown) return;
  session.closePromptShown = true;
  const fallback = () => {
    session.closePromptShown = false;
    void showNotice({
      parent: session.win,
      title: 'Tu trabajo sigue abierto',
      message: 'Guardá la publicación antes de cerrar Maquetario.',
    });
  };
  exec<boolean>(session, "typeof window.requestCloseConfirmation==='function'?(window.requestCloseConfirmation(),true):false")
    .then((shown) => shown || fallback())
    .catch(fallback);
}

app.on('second-instance', () => {
  if (!main) return;
  if (main.win.isMinimized()) main.win.restore();
  main.win.focus();
});

app.on('window-all-closed', () => app.quit());

app.whenReady().then(async () => {
  lockDown();
  applicationMenu();
  handleScheme();

  const preview = app.isPackaged ? undefined : argValue('capture-notice');
  if (preview) {
    // Desarrollo: guarda una imagen del aviso de licencia para revisar el diseño.
    await captureNotice(LICENSE_NOTICE('Tu licencia venció. Abrí Maquetario desde Motiova para renovarla (necesita conexión).'), preview);
    app.exit(0);
    return;
  }

  checkLicense();
  if (licenseBlocks() && !isSelfTest) {
    await showNotice(LICENSE_NOTICE(licenseMessage()));
    app.quit();
    return;
  }
  void warmFontCatalog();
  main = createWindow();
  if (isSelfTest) {
    main.win.webContents.once('did-finish-load', () => {
      void runSelfTest(main!).then((ok) => {
        main!.closingAllowed = true;
        app.exit(ok ? 0 : 1);
      });
    });
  }
});
