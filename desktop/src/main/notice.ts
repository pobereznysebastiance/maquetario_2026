// Avisos de sistema con la identidad de Maquetario (licencia, errores al abrir,
// trabajo sin guardar). Reemplaza a ThemedNotice de HostNotices.cs.
import { BrowserWindow, ipcMain, type IpcMainEvent } from 'electron';
import { join } from 'node:path';
import { NOTICE_ORIGIN } from './env.ts';

export interface NoticeButton {
  id: string;
  label: string;
  primary?: boolean;
}

export interface NoticeOptions {
  title: string;
  message: string;
  /** Texto técnico opcional (motivo, ruta), en gris. */
  detail?: string;
  buttons?: NoticeButton[];
  parent?: BrowserWindow;
  lang?: string;
}

const WIDTH = 680;
const HEIGHT = 380;

/** Muestra el aviso y devuelve el id del botón elegido, o null si se cerró. */
export function showNotice(options: NoticeOptions): Promise<string | null> {
  return openNotice(options).choice;
}

/** Igual que showNotice, pero también se puede cerrar desde afuera (p. ej. "Seguí en el navegador…"). */
export function openNotice(options: NoticeOptions): {
  choice: Promise<string | null>;
  close: () => void;
} {
  const buttons = options.buttons?.length
    ? options.buttons
    : [{ id: 'close', label: 'Cerrar', primary: true }];
  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    parent: options.parent,
    modal: !!options.parent,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: !!options.parent,
    show: false,
    backgroundColor: '#10212a',
    title: options.title,
    webPreferences: {
      preload: join(__dirname, 'notice-preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: false,
    },
  });
  const payload = encodeURIComponent(
    JSON.stringify({
      title: options.title,
      message: options.message,
      detail: options.detail,
      buttons,
      lang: options.lang,
    }),
  );

  let finish: (choice: string | null) => void = () => undefined;
  const choice = new Promise<string | null>((resolve) => {
    let settled = false;
    finish = (picked: string | null) => {
      if (settled) return;
      settled = true;
      ipcMain.removeListener('notice:choose', onChoose);
      resolve(picked);
      if (!win.isDestroyed()) win.close();
    };
    const onChoose = (event: IpcMainEvent, id: unknown) => {
      if (event.sender !== win.webContents) return;
      if (typeof id === 'string' && buttons.some((b) => b.id === id)) finish(id);
    };
    ipcMain.on('notice:choose', onChoose);
    win.once('closed', () => finish(null));
    win.once('ready-to-show', () => win.show());
    void win.loadURL(`${NOTICE_ORIGIN}/notice.html#${payload}`);
  });
  return { choice, close: () => finish(null) };
}

/** Para revisar el diseño sin provocar el error real (sólo en desarrollo). */
export async function captureNotice(options: NoticeOptions, file: string): Promise<void> {
  const { writeFile } = await import('node:fs/promises');
  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    frame: false,
    show: false,
    webPreferences: { preload: join(__dirname, 'notice-preload.cjs'), sandbox: true },
  });
  const payload = encodeURIComponent(JSON.stringify({ ...options, buttons: options.buttons }));
  await win.loadURL(`${NOTICE_ORIGIN}/notice.html#${payload}`);
  await new Promise((r) => setTimeout(r, 300));
  await writeFile(file, (await win.webContents.capturePage()).toPNG());
  win.destroy();
}
