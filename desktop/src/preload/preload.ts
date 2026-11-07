// Puente mínimo entre la interfaz y el proceso principal.
// La interfaz no tiene acceso a Node: sólo puede mandar mensajes {id, action, payload}
// y recibir respuestas {id, result, error}, igual que con WebView2.
import { contextBridge, ipcRenderer } from 'electron';

type Reply = { id: string; result?: unknown; error?: string | null };

contextBridge.exposeInMainWorld('maquetarioNative', {
  platform: process.platform,
  postMessage(message: unknown): void {
    ipcRenderer.send('host:message', message);
  },
  onMessage(callback: (reply: Reply) => void): void {
    ipcRenderer.on('host:reply', (_event, reply: Reply) => callback(reply));
  },
});
