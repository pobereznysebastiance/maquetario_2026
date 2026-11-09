// Puente interfaz ↔ escritorio. Forma de los mensajes:
//   pedido:    { id, action, payload }
//   respuesta: { id, result, error }
// Cada acción está en su módulo de handlers/. Esta tabla es la lista completa
// de lo que la interfaz le puede pedir al sistema.
import { ipcMain, type IpcMainEvent } from 'electron';
import { APP_ORIGIN, isSelfTest } from './env.ts';
import { familyNames, fontCatalog } from './fonts/catalog.ts';
import { assistantReview, assistantStatus, configureAssistant } from './handlers/assistant.ts';
import { readClipboardSvg } from './handlers/clipboard.ts';
import { chooseFontFolder, fontGlyphs } from './handlers/fonts.ts';
import { legacyExport, outputDocument, printers, savePdf } from './handlers/output.ts';
import { packageProject } from './handlers/package.ts';
import {
  appInfo,
  newProject,
  openProject,
  openRecent,
  openRequested,
  saveProject,
  setDirty,
} from './handlers/project.ts';
import {
  accountStatus,
  cancelConnect,
  connectAccount,
  downloadUpdate,
  releaseAccount,
} from './motiova/desktop.ts';
import type { Session } from './session.ts';

type Payload = Record<string, unknown>;
type Handler = (session: Session, payload: Payload) => unknown;

/** Cierra la ventana después de responder (para que la respuesta llegue). */
const closeSoon = (session: Session) => setImmediate(() => session.win.close());

const handlers: Record<string, Handler> = {
  ready: async () => ({ fonts: await familyNames(), native: true, selftest: isSelfTest }),
  appInfo: () => appInfo(),
  dirty: (s, p) => setDirty(s, p),
  locale: (s, p) => {
    s.language = String(p.language ?? 'es');
    return true;
  },

  newProject: (s) => newProject(s),
  open: (s) => openProject(s),
  openRecent: (s, p) => openRecent(s, String(p.path ?? '')),
  // Proyecto abierto desde el sistema (open-file.ts): sin ruta, la guarda el proceso principal.
  openRequested: (s) => openRequested(s),
  save: (s, p) => saveProject(s, String(p.json ?? ''), String(p.name ?? ''), false),
  saveAs: (s, p) => saveProject(s, String(p.json ?? ''), String(p.name ?? ''), true),

  fontCatalog: () => fontCatalog(false),
  refreshFonts: () => fontCatalog(true),
  chooseFontFolder: (s) => chooseFontFolder(s),
  fontGlyphs: (_s, p) => fontGlyphs(String(p.fontId ?? '')),

  printers: (s) => printers(s),
  print: (s, p) => outputDocument(s, p, true),
  outputPdf: (s, p) => outputDocument(s, p, false),
  export: (s, p) => legacyExport(s, p),
  savePdf: (s, p) => savePdf(s, p),
  packageProject: (s, p) => packageProject(s, p),
  clipboardSvg: () => readClipboardSvg(),

  assistantStatus: () => assistantStatus(),
  assistantConfigure: (_s, p) => configureAssistant(p),
  assistantReview: (s, p) => assistantReview(s, p),

  // Cuenta de Motiova: licencia de este equipo y versiones nuevas (motiova/desktop.ts).
  motiovaStatus: () => accountStatus(),
  motiovaConnect: () => connectAccount(),
  motiovaCancel: () => cancelConnect(),
  motiovaRelease: () => releaseAccount(),
  motiovaDownloadUpdate: () => downloadUpdate(),

  closeSaved: (s) => {
    if (s.dirty) return false;
    s.closingAllowed = true;
    closeSoon(s);
    return true;
  },
  closeDiscard: (s) => {
    if (!s.closePromptShown) return false;
    s.closingAllowed = true;
    closeSoon(s);
    return true;
  },
  closeCancelled: (s) => {
    s.closePromptShown = false;
    return true;
  },
};

export function attachBridge(session: Session): void {
  const contents = session.win.webContents;
  const reply = (id: string, result: unknown, error: string | null = null) => {
    if (!contents.isDestroyed()) contents.send('host:reply', { id, result: result ?? null, error });
  };
  const listener = async (event: IpcMainEvent, message: unknown) => {
    // Sólo se atiende a la página propia de esta ventana.
    if (event.sender !== contents || !event.senderFrame?.url.startsWith(`${APP_ORIGIN}/`)) return;
    if (!message || typeof message !== 'object') return;
    const { id, action, payload } = message as {
      id?: unknown;
      action?: unknown;
      payload?: unknown;
    };
    if (typeof id !== 'string' || typeof action !== 'string') return;
    const handler = Object.hasOwn(handlers, action) ? handlers[action] : undefined;
    try {
      if (!handler) throw new Error(`Acción desconocida: ${action}`);
      const data = payload && typeof payload === 'object' ? (payload as Payload) : {};
      reply(id, await handler(session, data));
    } catch (error) {
      reply(id, null, error instanceof Error ? error.message : String(error));
    }
  };
  ipcMain.on('host:message', listener);
  session.win.once('closed', () => ipcMain.removeListener('host:message', listener));
}
