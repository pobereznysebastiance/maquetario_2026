// Plantillas de grilla (la tira #templates) y miniaturas de los pliegos (#thumbnails). No tiene
// efectos al cargar. Salió de studio.ts (grupo 5): core-wiring.ts registra renderTemplates y
// thumbs como extensibles y los publica. Lo que llaman del resto (commit, render, finishEditing,
// toast) va por el nombre global, así pasa por sus extensiones.
//
// Fuente TypeScript: viaja dentro de build/core.js (src/entries/core.ts).
import { $, esc, M } from './utils.ts';
import { verticalSpread } from './canvas.ts';

function templateMini(cols: number, lines = false): string {
  return Array.from(
    { length: 2 },
    () =>
      `<div class="mini-page">${Array.from({ length: cols }, () => '<div class="mini-col"></div>').join('')}</div>`,
  ).join('');
}
const templates: [string, number, number][] = [
  ['Libro (3 columnas)', 3, 6],
  ['Revista (2 columnas)', 2, 5],
  ['Folleto (2 columnas)', 2, 3],
  ['Simple (1 columna)', 1, 1],
  ['Cuaderno (1 columna)', 1, 12],
];
/** La tira de plantillas de grilla (#templates). Se publica extensible como renderTemplates. */
export function renderTemplatesBase(): void {
  const host = $('#templates');
  host.innerHTML =
    templates
      .map(([name, c, r], i) =>
        UI.templateCard({
          active: book.grid.cols === c && book.grid.rows === r,
          data: { template: i },
          art: templateMini(c),
          label: name,
        }),
      )
      .join('') +
    '<div class="template-tip"><strong>ⓘ &nbsp; Diseñá con intención</strong>La grilla ordena el espacio.<br>Tu composición le da carácter.</div>';
  host.querySelectorAll<UIElement>('[data-template]').forEach(
    (el) =>
      (el.onclick = () => {
        const [, cols, rows] = templates[Number(el.dataset.template)];
        commit(() => {
          book.grid.cols = cols;
          book.grid.rows = rows;
          if (!M.validateGrid(book)) {
            book.grid.gapX = 0;
            book.grid.gapY = 0;
          }
        }, true);
        toast('Grilla aplicada. Tus objetos conservan su posición.');
      }),
  );
}
/**
 * Las miniaturas del riel (#thumbnails), un botón por pliego. Se publica extensible como thumbs
 * (review-workspace y page-exceptions la extienden).
 */
export function thumbsBase(): void {
  const host = $('#thumbnails'),
    savedScroll = host.scrollTop;
  host.innerHTML = '';
  host.classList.toggle('thumbs-vertical', verticalSpread());
  let step = book.facing ? 2 : 1;
  for (let i = 0; i < book.pages.length; i += step) {
    const b = UI.element(
      UI.pageThumb({
        active: spread === i,
        title:
          'Ir a páginas ' +
          (i + 1) +
          (step === 2 && i + 1 < book.pages.length ? '–' + (i + 2) : ''),
        pages: Array.from(
          { length: Math.min(step, book.pages.length - i) },
          (_, j) =>
            `<div class="thumb-paper"><div class="thumb-grid"></div>${book.pages[i + j].objects.length ? `<div class="thumb-lines"></div><div class="thumb-head">${esc(M.sectionAt(book, i + j))}</div>` : ''}</div>`,
        ).join(''),
        label: `${i + 1}${step === 2 && i + 1 < book.pages.length ? ' - ' + (i + 2) : ''}`,
      }),
    );
    b.onclick = () => {
      finishEditing();
      active = spread = i;
      selected = null;
      render(true);
    };
    host.append(b);
  }
  host.scrollTop = savedScroll;
}
