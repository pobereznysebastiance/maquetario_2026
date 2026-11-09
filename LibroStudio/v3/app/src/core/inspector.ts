// La fachada del inspector y cómo los paneles graban sus campos en el libro. No tiene efectos al
// cargar. core-wiring.ts registra inspector() como extensible
// (inspector-registry, tutorial, review-workspace e inspector-views la extienden) y publica todo.
//
// commitBinding y commitObjectField llaman a inspector() y commit() por su nombre global, así
// pasan por sus extensiones.
//
// Fuente TypeScript: viaja dentro de build/core.js (src/entries/core.ts).
import { M } from './utils.ts';
import { selectObject, set } from './book-paths.ts';

/**
 * Redibuja el inspector. Es una fachada: el inspector es un componente de React
 * (src/components/inspector/Inspector.tsx, montado por inspector-views.tsx) que se entera por el
 * aviso del estado del editor y cambia sólo lo que cambió. Se publica extensible como inspector
 * (core-wiring.ts): inspector-registry.ts la pausa (pauseInspectorWhile) y otros módulos hacen
 * algo después (extend.after).
 */
export function inspectorFacade(): void {
  // Antes de que cargue la entrada de la app (editor-state.ts) no hay nada que avisar.
  globalThis.notifyEditorState?.();
}
/**
 * Graba en el libro el valor de un control con data-bind (casilla, número o texto), con la misma
 * validación para todos. La usan los paneles de React del inspector.
 */
export function commitBinding(el: UIElement): void {
  let value =
    el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
  const key = el.dataset.bind!;
  if (
    el.type === 'number' &&
    (!Number.isFinite(value) || value < Number(el.min) || value > Number(el.max))
  ) {
    toast('Revisá el valor ingresado.', 'warning');
    inspector();
    return;
  }
  commit(() => {
    set(key, value);
    if (key.startsWith('grid.') || key.startsWith('margins.')) {
      if (
        !M.validateGrid(book) ||
        book.margins.inside + book.margins.outside > book.width - 10 ||
        book.margins.top + book.margins.bottom > book.height - 10
      )
        throw Error('La grilla no cabe: reducí márgenes, medianiles o cantidad de módulos.');
    }
  }, false);
}
/**
 * Graba en el objeto seleccionado el valor de un control con data-object (medidas, cuerpo,
 * interlineado, color…), con el aviso de rango. La usan los paneles de React.
 */
export function commitObjectField(el: UIElement): void {
  const o = selectObject();
  if (!o) return;
  let value = el.type === 'number' ? Number(el.value) : el.value;
  if (
    el.type === 'number' &&
    (!Number.isFinite(value) || value < Number(el.min) || value > Number(el.max))
  ) {
    toast('El valor está fuera del rango permitido.', 'warning');
    inspector();
    return;
  }
  commit(() => {
    o[el.dataset.object!] = value;
    if (['x', 'y', 'w', 'h'].includes(el.dataset.object!)) {
      o.x = Math.max(0, Math.min(o.x, book.width - 3));
      o.y = Math.max(0, Math.min(o.y, book.height - 3));
      o.w = Math.min(o.w, book.width - o.x);
      o.h = Math.min(o.h, book.height - o.y);
    }
  }, false);
}
