// Aviso propio de la barra del lienzo (zoom y franja de plantillas): cambia seguido (cada
// renderPages actualiza el porcentaje) y sólo redibuja esa barra, no toda la interfaz.
//
// refreshCanvasBar() redibuja después (sirve desde cualquier lado, también desde renderPages);
// refreshCanvasBar(true) redibuja en el acto (flushSync), para quien lee el DOM enseguida
// (pruebas, clics): no se llama desde el render de un componente ni desde sus efectos.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';

let version = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** La barra del lienzo vuelve a leer su estado (zoom, continuo, ampliado, plantillas). */
export function refreshCanvasBar(sync = false): void {
  version += 1;
  if (!listeners.size) return;
  const notify = () => listeners.forEach((listener) => listener());
  if (sync) flushSync(notify);
  else notify();
}

export function useCanvasBar(): number {
  return useSyncExternalStore(subscribe, () => version);
}
