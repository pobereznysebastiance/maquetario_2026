// Cornisa y titulillo en el margen lateral: cuando su posición es izquierda, derecha, exterior o
// interior, se dibujan girados dentro del margen; el selector de sentido de lectura (de abajo
// hacia arriba o al revés) está en sus paneles del inspector (MasterPanels.tsx). También evita que el inspector se redibuje mientras
// se ajusta un número de cornisa, titulillo o folio, y suma al validador del modelo el chequeo
// de la dirección lateral.
//
// liveMasterAdjustment es global porque tests/refinement-tests.js lo vuelve a false.
//
// Ojo con el orden: este archivo reemplaza M.validate envolviendo al anterior, al cargar (después
// de model.js y antes de shapes.js, que lo vuelve a envolver).
//
// Fuente TypeScript: se compila a build/master-refinement.js (desktop/scripts/build.mjs).
import type { AutoType, Book, LibroModelApi } from './model.ts';

declare global {
  /** Se está ajustando un número de cornisa, titulillo o folio: el inspector no se redibuja. */
  var liveMasterAdjustment: boolean;
}

globalThis.liveMasterAdjustment = false;
document.addEventListener(
  'change',
  (e) => {
    const el = e.target as HTMLInputElement,
      key = el.dataset?.bind;
    if (
      el.type === 'number' &&
      /^(header|titulillo|folio)\./.test(key || '') &&
      Number.isFinite(Number(el.value)) &&
      Number(el.value) >= Number(el.min) &&
      Number(el.value) <= Number(el.max)
    ) {
      liveMasterAdjustment = true;
      queueMicrotask(() => (liveMasterAdjustment = false));
    }
  },
  true,
);
pauseInspectorWhile(() => liveMasterAdjustment, 'master-refinement');
// La fila "Lectura lateral" del inspector la dibujan los paneles de Cornisa y Titulillo
// (src/components/inspector/MasterPanels.tsx).
extend.result(
  'autoElement',
  function (
    el: HTMLElement | null,
    i: number,
    type: AutoType,
    px: number,
    print = false,
  ): HTMLElement | null {
    const c = book[type];
    if (
      !el ||
      !['header', 'titulillo'].includes(type) ||
      !['left', 'right', 'outer', 'inner'].includes(c.pos)
    )
      return el;
    const m = M.margins(book, i),
      physical =
        c.pos === 'outer'
          ? i % 2 === 0
            ? 'left'
            : 'right'
          : c.pos === 'inner'
            ? i % 2 === 0
              ? 'right'
              : 'left'
            : c.pos,
      margin = physical === 'left' ? m.left : m.right,
      h = ((c.size * 25.4) / 72) * 1.3,
      axis = Math.min(Math.max(h / 2, margin - h / 2), Math.max(h / 2, c.distance)),
      x = physical === 'left' ? axis : book.width - axis,
      length = Math.max(1, book.height - book.margins.top - book.margins.bottom),
      y = book.margins.top + length / 2;
    Object.assign(el.style, {
      left: (x + c.offsetX) * px + 'px',
      top: (y + c.offsetY) * px + 'px',
      width: length * px + 'px',
      height: h * px + 'px',
      lineHeight: h * px + 'px',
      transform: `translate(-50%,-50%) rotate(${c.sideDirection === 'down' ? 90 : -90}deg)`,
      transformOrigin: 'center center',
      textAlign: c.align,
      whiteSpace: 'nowrap',
    });
    el.dataset.sideMargin = physical;
    return el;
  },
  'master-refinement',
);
const refineValidation: LibroModelApi['validate'] = M.validate;
M.validate = function (input: any): Book {
  const b = refineValidation(input);
  for (const type of ['header', 'titulillo'] as const)
    if (b[type].sideDirection !== undefined && !['up', 'down'].includes(b[type].sideDirection))
      throw Error('Dirección lateral inválida.');
  return b;
};

export {};
