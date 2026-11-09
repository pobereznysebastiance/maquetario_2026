// Panel del objeto (pasada 'object' de la pestaña Selección): geometría, alineación,
// distribución, orden y bloqueo del elemento seleccionado. Las secciones son de React
// (src/components/inspector/ObjectPanel.tsx), en la tabla de Inspector.tsx. Acá quedan las
// acciones (alinear, distribuir) y los atajos de herramientas (grilla, foliado, cornisa), que
// llevan a su sección por nombre, no por posición.
//
// distributeObjects es global porque la usa tests/inspector-organization-tests.js.
//
// Fuente TypeScript: se compila a build/inspector-organization.js (desktop/scripts/build.mjs).
import type { BookObject } from './model.ts';

declare global {
  /** Iguala los espacios entre tres o más objetos seleccionados, conservando los extremos. */
  var distributeObjects: (axis: 'x' | 'y') => void;
}

/** Lo seleccionado que se puede mover: sin bloquear ni ocultar. */
export function editableObjectSelection(): BookObject[] {
  return book.pages[active].objects.filter(
    (o) =>
      (multiSelection.size ? multiSelection.has(o.id) : selected === o.id) &&
      !o.locked &&
      !o.hidden,
  );
}
function distributeObjects(axis: 'x' | 'y'): void {
  const objects = editableObjectSelection();
  if (objects.length < 3) return;
  const horizontal = axis === 'x',
    size = horizontal ? 'w' : 'h',
    sorted = objects.slice().sort((a, b) => a[axis] - b[axis]);
  const start = sorted[0][axis],
    end = sorted.at(-1)![axis] + sorted.at(-1)![size],
    total = sorted.reduce((n, o) => n + o[size], 0),
    gap = (end - start - total) / (sorted.length - 1);
  commit(() => {
    let pos = start;
    for (const o of sorted) {
      o[axis] = pos;
      pos += o[size] + gap;
    }
  }, false);
}
globalThis.distributeObjects = distributeObjects;
// Los atajos de herramientas buscan su sección por nombre, no por una posición numérica frágil.
extend.instead(
  'setTool',
  (name: string) => ['grid', 'folio', 'header'].includes(name),
  function (name: 'grid' | 'folio' | 'header') {
    finishEditing();
    showTab('design');
    const key = { grid: 'Grilla', folio: 'Foliado', header: 'Cornisa' }[name];
    $(`#inspectorContent [data-section="${key}"]`)?.scrollIntoView({
      block: 'start',
      behavior: 'smooth',
    });
    tool = 'select';
  },
  'inspector-organization',
);
extend.after(
  'setTool',
  function (name: string) {
    if (name === 'image' || name === 'frame') showTab('object');
  },
  'inspector-organization',
);
extend.before(
  'objectDown',
  function (e: PointerEvent, o: BookObject) {
    if (o.type !== 'text' && tab === 'text' && !o.locked) showTab('object');
  },
  'inspector-organization',
);
document.addEventListener('maquetario:language', () => {
  inspector();
});
const alignLesson = guideLessons.find((l) => l.id === 'align-objects');
if (alignLesson) {
  alignLesson.tab = 'object';
  alignLesson.body = alignLesson.body.map((text, i) =>
    text.replace(
      ['Texto y Capas', 'Text and Layers', 'Texto e Camadas'][i],
      ['Objeto', 'Object', 'Objeto'][i],
    ),
  );
}
inspector();
