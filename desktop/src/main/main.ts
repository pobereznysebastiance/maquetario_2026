// Proceso principal de Maquetario (Electron).
import {
  app,
  BrowserWindow,
  Menu,
  screen,
  session as electronSession,
  shell,
  type MenuItemConstructorOptions,
} from 'electron';
import { join } from 'node:path';
import { attachBridge } from './bridge.ts';
import {
  APP_ORIGIN,
  args,
  argValue,
  isDev,
  isSelfTest,
  NOTICE_ORIGIN,
  rendererDir,
} from './env.ts';
import { warmFontCatalog } from './fonts/catalog.ts';
import { describeFailure } from '@maquetario/license';
import { checkLicense, licenseBlocks, licenseMessage } from './license.ts';
import { gateButtons, WAITING_NOTICE } from './license-gate.ts';
import { CONNECT_TIMEOUT_MS, MotiovaError } from './motiova/client.ts';
import {
  accountPageUrl,
  cancelConnect,
  connectAccount,
  renewAtStartup,
  requestLicenseAgain,
} from './motiova/desktop.ts';
import { captureNotice, openNotice, showNotice, type NoticeOptions } from './notice.ts';
import {
  hasRequestedProject,
  OPEN_REQUESTED_SCRIPT,
  projectPathFromArgv,
  RENDERER_READY,
  requestProject,
} from './open-file.ts';
import { handleScheme, registerScheme } from './protocol.ts';
import { runSelfTest } from './selftest.ts';
import { createSession, exec, waitFor, type Session } from './session.ts';
import { windowChromeOptions } from './window-chrome.ts';
import { windowSize } from './window-size.ts';

app.setName('Maquetario');
// Todas las páginas (editor y avisos) corren aisladas, sin depender de configurarlo en cada ventana.
app.enableSandbox();
// La autoprueba usa su propio perfil: ni hereda las preferencias de quien usa la app, ni comparte
// el perfil de Chromium con una ventana abierta.
if (isSelfTest) app.setPath('userData', `${app.getPath('userData')}-autoprueba`);
registerScheme();

// Una sola instancia: abrir otro .mqt con la app abierta lo abre en la ventana existente
// (second-instance, más abajo).
if (!isSelfTest && !app.requestSingleInstanceLock()) app.quit();

let main: Session | null = null;
/** La interfaz terminó de arrancar: los proyectos pedidos por el sistema se abren enseguida. */
let rendererReady = false;

// Proyecto con el que se abrió la app (doble clic en un .mqt en Windows/Linux).
if (!isSelfTest) {
  const path = projectPathFromArgv(process.argv, process.cwd());
  if (path) requestProject(path);
}
// macOS: doble clic en un .mqt o arrastrarlo al ícono. Puede llegar antes de ready.
app.on('open-file', (event, path) => {
  event.preventDefault();
  if (isSelfTest) return;
  requestProject(path);
  if (main) {
    showWindow(main);
    if (rendererReady) void openRequestedProject(main);
  }
});

const LICENSE_NOTICE = (message: string): NoticeOptions => ({
  title: 'Maquetario necesita una licencia activa',
  message,
});
/** "Seguí en el navegador": barra de espera, tiempo que queda y Cancelar. */
const waitingNotice = (until: number): NoticeOptions => ({
  title: WAITING_NOTICE.title,
  message: WAITING_NOTICE.message,
  progress: { until, label: WAITING_NOTICE.progressLabel },
  buttons: [{ id: 'cancel', label: 'Cancelar' }],
});

/** Login en el navegador mostrando la espera; Cancelar corta la conexión. */
async function connectWithProgress(): Promise<void> {
  const waiting = openNotice(waitingNotice(Date.now() + CONNECT_TIMEOUT_MS));
  void waiting.choice.then((choice) => choice === 'cancel' && cancelConnect());
  try {
    await connectAccount({ timeoutMs: CONNECT_TIMEOUT_MS });
  } finally {
    waiting.close();
  }
}

/**
 * Sin licencia válida (modo "enforce"): en vez de cerrarse, ofrece conectar la cuenta de Motiova.
 * Si Motiova dice que se llegó al tope de equipos, ofrece Mis programas (para liberar una
 * computadora) y volver a pedir la licencia, no conectar otra vez.
 * Devuelve true cuando ya hay licencia; false si la persona eligió salir.
 */
async function licenseGate(): Promise<boolean> {
  let message = licenseMessage();
  let failure: string | null = null;
  let accountOpened = false;
  for (;;) {
    const pick = await showNotice({
      ...LICENSE_NOTICE(message),
      buttons: gateButtons(failure, accountOpened),
    });
    if (pick === 'account') {
      void shell.openExternal(accountPageUrl());
      accountOpened = true;
      continue;
    }
    if (pick !== 'connect' && pick !== 'retry') return false;
    try {
      if (pick === 'retry') await requestLicenseAgain();
      else await connectWithProgress();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
      failure = error instanceof MotiovaError ? error.code : null;
      continue;
    }
    if (!licenseBlocks()) return true;
    message = licenseMessage();
    failure = null;
  }
}

/** Desarrollo: imagen de un aviso de licencia (--capture-notice=archivo.png --notice=variante). */
function previewNotice(variant: string | undefined): NoticeOptions {
  if (variant === 'waiting') return waitingNotice(Date.now() + CONNECT_TIMEOUT_MS);
  if (variant === 'device-limit')
    return {
      ...LICENSE_NOTICE(
        'Ya usás Maquetario en todas las computadoras permitidas. Liberá una desde Mi cuenta, en Mis programas, y volvé a intentar.',
      ),
      buttons: gateButtons('device-limit'),
    };
  return { ...LICENSE_NOTICE(describeFailure('expired')), buttons: gateButtons(null) };
}

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
    const allowed = (url: string) =>
      url.startsWith(`${APP_ORIGIN}/`) || url.startsWith(`${NOTICE_ORIGIN}/`);
    contents.on('will-navigate', (event, url) => {
      if (!allowed(url)) event.preventDefault();
    });
    contents.on('will-redirect', (event, url) => {
      if (!allowed(url)) event.preventDefault();
    });
    contents.on('will-frame-navigate', (details) => {
      if (!allowed(details.url)) details.preventDefault();
    });
    contents.on('will-attach-webview', (event) => event.preventDefault());
  });
}

/** Trae la ventana adelante (segunda instancia, archivo abierto desde el sistema). */
function showWindow(session: Session): void {
  if (session.win.isMinimized()) session.win.restore();
  session.win.focus();
}

/** Abre en la interfaz el proyecto que pidió el sistema, con la confirmación de siempre. */
async function openRequestedProject(session: Session): Promise<void> {
  if (!hasRequestedProject()) return;
  try {
    await exec(session, OPEN_REQUESTED_SCRIPT);
  } catch (error) {
    console.warn('[abrir proyecto]', error);
  }
}

/**
 * Al arrancar: espera a que la interfaz responda y a que aparezca la bienvenida (si no, la
 * bienvenida taparía el libro recién abierto); después abre lo que haya pedido el sistema.
 */
async function whenRendererReady(session: Session): Promise<void> {
  await waitFor(session, RENDERER_READY, 300, 100);
  if (hasRequestedProject()) await waitFor(session, 'globalThis.welcomeVisible===true', 50, 100);
  rendererReady = true;
  await openRequestedProject(session);
}

function createWindow(): Session {
  const chrome = windowChromeOptions();
  // Que entre en la pantalla donde abre (notebooks de 1366 × 768 o 1920 × 1080 al 150 %).
  // Centrada en el área de trabajo de esa misma pantalla (sin la barra de tareas).
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const size = windowSize(workArea);
  const win = new BrowserWindow({
    x: workArea.x + Math.round((workArea.width - size.initial.width) / 2),
    y: workArea.y + Math.round((workArea.height - size.initial.height) / 2),
    width: size.initial.width,
    height: size.initial.height,
    minWidth: size.minimum.width,
    minHeight: size.minimum.height,
    ...chrome.options,
    title: 'Maquetario · Maquetación y diseño de libros',
    icon: join(rendererDir(), 'maquetario.ico'),
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      // La interfaz necesita saber qué material y qué botones de ventana hay para acomodarse.
      additionalArguments: [
        `--maquetario-material=${chrome.material}`,
        `--maquetario-controls=${chrome.controls}`,
        ...(isSelfTest ? ['--maquetario-selftest=1'] : []),
      ],
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
      devTools: isDev,
      // El self-test captura la ventana aunque no esté visible. En desarrollo, --no-throttle hace lo
      // mismo para las herramientas que miden la interfaz por CDP (scripts/app-cdp.mjs) con la ventana minimizada.
      backgroundThrottling: !isSelfTest && !(isDev && args.includes('--no-throttle')),
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
      message:
        'No se pudo cargar el editor. Reinstalá Maquetario desde Motiova; tus proyectos no se modificaron.',
      detail: `${description} (${code})`,
    }).then(() => app.quit());
  });
  void win.loadURL(`${APP_ORIGIN}/index.html`);
  return session;
}

/** Al cerrar la ventana: no perder trabajo sin guardar. */
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
      message: 'Guardá el libro antes de cerrar Maquetario.',
    });
  };
  exec<boolean>(
    session,
    "typeof window.requestCloseConfirmation==='function'?(window.requestCloseConfirmation(),true):false",
  )
    .then((shown) => shown || fallback())
    .catch(fallback);
}

app.on('second-instance', (_event, argv, workingDirectory) => {
  // Doble clic en otro .mqt con la app abierta: la ruta viene en el argv de la segunda instancia.
  // Se guarda aunque la ventana todavía no exista (aviso de licencia): se abre al arrancar.
  const path = projectPathFromArgv(argv, workingDirectory);
  if (path) requestProject(path);
  if (!main) return;
  showWindow(main);
  if (path && rendererReady) void openRequestedProject(main);
});

app.on('window-all-closed', () => app.quit());

app.whenReady().then(async () => {
  lockDown();
  applicationMenu();
  handleScheme();

  const preview = app.isPackaged ? undefined : argValue('capture-notice');
  if (preview) {
    // Desarrollo: guarda una imagen del aviso de licencia para revisar el diseño.
    await captureNotice(previewNotice(argValue('notice')), preview);
    app.exit(0);
    return;
  }

  checkLicense();
  let renewed = false;
  if (licenseBlocks() && !isSelfTest) {
    // Con sesión y conexión, la licencia vencida se renueva sola antes de pedir nada.
    await renewAtStartup().catch(() => null);
    renewed = true;
    if (licenseBlocks() && !(await licenseGate())) {
      app.quit();
      return;
    }
  }
  void warmFontCatalog();
  main = createWindow();
  if (!isSelfTest) {
    // Al abrir con conexión: renueva la licencia (dura 7 días sin conexión) y avisa si hay versión nueva.
    const session = main;
    session.win.webContents.once('did-finish-load', () => {
      void (renewed ? Promise.resolve(null) : renewAtStartup())
        .then(
          (update) =>
            update &&
            exec(session, `window.maquetarioUpdateAvailable?.(${JSON.stringify(update)})`),
        )
        .catch((error) => console.warn('[motiova]', error));
    });
  }
  if (!isSelfTest) {
    const session = main;
    session.win.webContents.once('did-finish-load', () => {
      void whenRendererReady(session).catch((error) => console.warn('[abrir proyecto]', error));
    });
  }
  if (isSelfTest) {
    main.win.webContents.once('did-finish-load', () => {
      void runSelfTest(main!).then((ok) => {
        main!.closingAllowed = true;
        app.exit(ok ? 0 : 1);
      });
    });
  }
});
