// Quién avisa a useEditorState() (editor-state.ts, que no tiene efectos al cargar): las funciones del
// núcleo que antes escribían el DOM a mano, por extend.after, y el global notifyEditorState para
// quien no lo importa. Lo importa src/entries/app.ts justo antes de layout-tools.ts, donde se evaluaba antes
// editor-state.ts: así el orden de las extensiones (MaquetarioExtensions.list()) no cambia.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { notifyEditorState } from './editor-state.ts';

declare global {
  /** Avisa a los componentes de React que el estado del editor cambió (busy, preview…). */
  var notifyEditorState: () => void;
}
globalThis.notifyEditorState = notifyEditorState;

// Los cambios de hasDocument (review-workspace → refreshEmptyCanvas) y de busy (salida) avisan
// con notifyEditorState() directamente.
for (const name of ['updateStatus', 'syncNative', 'checkOverflow'])
  extend.after(name, () => notifyEditorState(), 'editor-state');
