// Estado del editor para los componentes de React (etapa 3): cómo se enteran de que algo cambió.
//
// El estado sigue viviendo en los globales del núcleo (book, active, selected, dirty, tool… de
// studio.ts). Un componente no copia ese estado: lo lee directamente al dibujarse y se suscribe a
// los avisos con useEditorState(), que devuelve un número de versión que cambia con cada aviso.
//
//   export const StatusBar = () => {
//     useEditorState(); // se redibuja cuando el núcleo avisa
//     useLanguage();    // y cuando cambia el idioma
//     return <span>{LibroI18n.tr(`Página ${active + 1} de ${book.pages.length}`)}</span>;
//   };
//
// Quién avisa: las funciones del núcleo que antes escribían el DOM a mano, por extend.after
// (updateStatus — la llama render —, syncNative y checkOverflow). Si una pantalla nueva depende de
// otra función del núcleo, se suma acá su nombre; si un módulo cambia estado fuera de esas
// funciones, llama a notifyEditorState().
//
// notifyEditorState() redibuja en el acto (flushSync): al volver, el DOM ya está al día, igual
// que cuando se escribía a mano (las pruebas y otros módulos leen el DOM enseguida). Por eso no se
// llama desde el render de un componente ni desde sus efectos, sólo desde código imperativo o
// manejadores de eventos.
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

/** Avisa a los componentes que el estado del editor cambió (y los redibuja ya). */
export function notifyEditorState(): void {
  version += 1;
  if (!listeners.size) return;
  flushSync(() => {
    for (const listener of listeners) listener();
  });
}

/** Suscribe el componente a los avisos del núcleo; devuelve la versión del estado. */
export function useEditorState(): number {
  return useSyncExternalStore(subscribe, () => version);
}

for (const name of ['updateStatus', 'syncNative', 'checkOverflow'])
  extend.after(name, () => notifyEditorState(), 'editor-state');
