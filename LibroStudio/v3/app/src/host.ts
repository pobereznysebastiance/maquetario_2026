// Capa de host: la única parte de la interfaz que sabe en qué programa corre.
// - Electron: el preload expone window.maquetarioNative.
// - WebView2 (Maquetario.exe en C#, versión anterior): window.chrome.webview.
// - Navegador común: sin funciones de escritorio.
// El resto del código usa sólo window.MaquetarioHost.
//
// Fuente TypeScript: se compila a build/host.js (desktop/scripts/build.mjs).

/** Respuesta del proceso principal a un mensaje {id, action, payload}. */
export interface HostReply {
  id: string;
  result?: unknown;
  error?: string | null;
}

/** Lo que expone el preload de Electron (desktop/src/preload/preload.ts). */
export interface MaquetarioNative {
  platform: string;
  /** Material de la ventana: "mica", "vibrancy" o "none". */
  material: string;
  /** Botones de la ventana: "overlay-right" (Windows/Linux) o "inset-left" (macOS). */
  windowControls: string;
  /** Autoprueba: la interfaz carga sus pruebas de integración (test-loader.js). */
  selfTest: boolean;
  postMessage(message: unknown): void;
  onMessage(callback: (reply: HostReply) => void): void;
}

export type HostKind = 'electron' | 'webview2' | 'browser';

export interface MaquetarioHostApi {
  readonly kind: HostKind;
  /** Hay programa de escritorio detrás (Electron o WebView2). */
  readonly available: boolean;
  readonly platform: string;
  readonly selfTest: boolean;
  postMessage(message: unknown): void;
  onMessage(callback: (reply: HostReply) => void): void;
  /** Dirección de una fuente del catálogo para @font-face. */
  fontUrl(id: string): string;
}

declare global {
  var maquetarioNative: MaquetarioNative | undefined;
  var MaquetarioHost: MaquetarioHostApi;
}

const electron = window.maquetarioNative;
const webview = window.chrome && window.chrome.webview;
const kind: HostKind = electron ? 'electron' : webview ? 'webview2' : 'browser';
const host = {
  kind,
  available: kind !== 'browser',
  platform: electron ? electron.platform : webview ? 'win32' : 'browser',
  selfTest: !!(electron && electron.selfTest),
  postMessage(message: unknown): void {
    if (electron) electron.postMessage(message);
    else if (webview) webview.postMessage(message);
    else throw new Error('Esta función requiere la app de escritorio de Maquetario.');
  },
  onMessage(callback: (reply: HostReply) => void): void {
    if (electron) electron.onMessage(callback);
    else if (webview)
      webview.addEventListener('message', (event: { data: HostReply }) => callback(event.data));
  },
  fontUrl(id: string): string {
    const file = encodeURIComponent(id) + '.ttf';
    return electron ? '/__fonts/' + file : 'https://fonts.maquetario.local/' + file;
  },
};
globalThis.MaquetarioHost = Object.freeze(host);

// El sistema de diseño se acomoda a la ventana: material translúcido y lugar de los botones.
const root = document.documentElement;
root.dataset.host = kind;
root.dataset.platform = host.platform;
root.dataset.material = electron ? electron.material : 'none';
if (electron) root.dataset.windowControls = electron.windowControls;

export {};
