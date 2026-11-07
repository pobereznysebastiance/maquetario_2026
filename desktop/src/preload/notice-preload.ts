// Preload de la ventana de aviso: sólo puede informar qué botón se eligió.
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('noticeBridge', {
  choose(id: unknown): void {
    if (typeof id === 'string') ipcRenderer.send('notice:choose', id);
  },
});
