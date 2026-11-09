// Puente con lo que carga core (build/core.js es otro bundle): el modelo (M), los componentes de
// marcado (UI) y el estado del editor. Importarlos directo desde un módulo de app los duplicaría
// (dos modelos, dos estados); este archivo los toma de los globales que publica core, que ya
// cargó cuando corre cualquier módulo de app. No tiene efectos al cargar.
//
//   import { M, UI, editor } from '../core-api.ts';
//
// Cuando la interfaz tenga un solo punto de entrada, esto pasa a ser un re-export directo.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import type { LibroModelApi } from './model.ts';
import type { EditorState } from './state/editor.ts';

/** El modelo del libro (LibroModel, el global M). */
export const M: LibroModelApi = globalThis.LibroModel;
/** Marcado de los componentes en HTML (src/ui/components.ts). */
export const UI: typeof globalThis.UI = globalThis.UI;
/** El estado del editor (src/state/editor.ts). */
export const editor: EditorState = globalThis.maquetarioEditor;
