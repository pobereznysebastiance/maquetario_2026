// Cornisa y titulillo en el margen lateral: cuando su posición es izquierda, derecha, exterior o
// interior, se dibujan girados dentro del margen, con un selector de sentido de lectura (de abajo
// hacia arriba o al revés) en el inspector. También evita que el inspector se redibuje mientras
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
decorateInspector(() => {
  const host = $('#inspectorContent');
  for (const type of ['header', 'titulillo'] as const) {
    const selector = host.querySelector(`[data-bind="${type}.pos"]`);
    if (!selector) continue;
    const c = book[type],
      lateral = ['left', 'right', 'outer', 'inner'].includes(c.pos);
    if (!lateral) continue;
    const row = document.createElement('div');
    row.className = 'field-row';
    row.innerHTML = `<label>${bw('Lectura lateral', 'Side reading direction', 'Leitura lateral')}</label><select data-master-direction="${type}"><option value="up">↑ ${bw('De abajo hacia arriba', 'Bottom to top', 'De baixo para cima')}</option><option value="down">↓ ${bw('De arriba hacia abajo', 'Top to bottom', 'De cima para baixo')}</option></select>`;
    selector.closest('.field-row')!.after(row);
    const input = row.querySelector('select')!;
    input.value = c.sideDirection || 'up';
    input.onchange = () => commit(() => (c.sideDirection = input.value), false);
    const legacy = host.querySelector(`[data-bind="${type}.vertical"]`);
    if (legacy) legacy.closest('label')!.hidden = true;
    const hint = document.createElement('p');
    hint.className = 'help';
    hint.textContent = bw(
      'Se ubica dentro del margen lateral. Distancia al borde mueve el eje; X e Y permiten ajustes adicionales.',
      'Placed inside the side margin. Distance from edge moves the axis; X and Y provide additional adjustment.',
      'Fica na margem lateral. Distância da borda move o eixo; X e Y permitem ajustes adicionais.',
    );
    row.after(hint);
  }
}, 'master-refinement');
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
