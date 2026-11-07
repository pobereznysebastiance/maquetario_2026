// Puente mínimo entre la interfaz y el proceso principal.
// La interfaz no tiene acceso a Node: sólo puede mandar mensajes {id, action, payload}
// y recibir respuestas {id, result, error}, igual que con WebView2.
import { contextBridge, ipcRenderer } from 'electron';

type Reply = { id: string; result?: unknown; error?: string | null };

const argument = (name: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

contextBridge.exposeInMainWorld('maquetarioNative', {
  platform: process.platform,
  /** Material de la ventana: "mica", "vibrancy" o "none". */
  material: argument('maquetario-material') ?? 'none',
  /** Botones de la ventana: "overlay-right" (Windows/Linux) o "inset-left" (macOS). */
  windowControls: argument('maquetario-controls') ?? 'overlay-right',
  postMessage(message: unknown): void {
    ipcRenderer.send('host:message', message);
  },
  onMessage(callback: (reply: Reply) => void): void {
    ipcRenderer.on('host:reply', (_event, reply: Reply) => callback(reply));
  },
});
