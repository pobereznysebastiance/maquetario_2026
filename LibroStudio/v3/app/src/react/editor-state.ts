// Estado del editor para los componentes de React (etapa 3): cómo se enteran de que algo cambió.
//
// El estado vive en el objeto editor (src/state/editor.ts; desde app se importa de core-api.ts).
// Un componente no copia ese estado: lo lee directamente al dibujarse y se suscribe a los avisos
// con useEditorState(), que devuelve un número de versión que cambia con cada aviso.
//
//   export const StatusBar = () => {
//     useEditorState(); // se redibuja cuando el núcleo avisa
//     useLanguage();    // y cuando cambia el idioma
//     return <span>{i18n.tr(`Página ${editor.active + 1} de ${editor.book.pages.length}`)}</span>;
//   };
//
// Quién avisa: las funciones del núcleo que antes escribían el DOM a mano, por extend.after
// (updateStatus — la llama render —, syncNative y checkOverflow; ese enganche y el global
// notifyEditorState están en editor-state-wiring.ts, así este archivo no tiene efectos al cargar).
// Si una pantalla nueva depende de otra función del núcleo, se suma allá su nombre; si un módulo
// cambia estado fuera de esas funciones, llama a notifyEditorState().
//
// notifyEditorState() redibuja en el acto (flushSync): al volver, el DOM ya está al día, igual
// que cuando se escribía a mano (las pruebas y otros módulos leen el DOM enseguida). Por eso no se
// llama desde el render de un componente ni desde sus efectos, sólo desde código imperativo o
// manejadores de eventos.
//
// Excepción: durante un arrastre en la página (drag, de studio.ts y frame-handles.ts) cada
// movimiento avisa dos veces (updateStatus y checkOverflow) y redibujar todo en el acto costaba
// unos 3 ms por movimiento. Mientras dura, los avisos se juntan y se redibuja una vez por cuadro
// (requestAnimationFrame): las barras y los campos que siguen al objeto se actualizan igual en
// cada cuadro. Al soltar (drag vuelve a null) el siguiente aviso redibuja en el acto y descarta el
// cuadro pendiente.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { editor } from '../core-api.ts';

let version = 0;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Cuadro pedido para redibujar los avisos juntados durante un arrastre (0: ninguno). */
let pendingFrame = 0;

function redraw(): void {
  pendingFrame = 0;
  flushSync(() => {
    for (const listener of listeners) listener();
  });
}

/**
 * Avisa a los componentes que el estado del editor cambió y los redibuja ya; durante un arrastre,
 * en el próximo cuadro (una sola vez por cuadro).
 */
export function notifyEditorState(): void {
  version += 1;
  if (!listeners.size) return;
  if (editor.drag) {
    if (!pendingFrame) pendingFrame = requestAnimationFrame(redraw);
    return;
  }
  if (pendingFrame) cancelAnimationFrame(pendingFrame);
  redraw();
}

/** Suscribe el componente a los avisos del núcleo; devuelve la versión del estado. */
export function useEditorState(): number {
  return useSyncExternalStore(subscribe, () => version);
}
