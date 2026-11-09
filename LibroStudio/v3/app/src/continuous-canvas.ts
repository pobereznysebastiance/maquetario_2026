// Vista continua del lienzo: todas las páginas en una sola columna que se recorre con la rueda.
// Sólo se dibujan las filas cercanas a la vista; al desplazarse se marca la página visible.
// El botón "Continuo" va junto a "Ajustar" y el estado se recuerda en localStorage.
//
// continuousCanvas, continuousRows y continuousKey viven en globalThis porque la prueba de
// tests/document-view-tests.js los lee y los asigna.
//
// Fuente TypeScript: se compila a build/continuous-canvas.js (desktop/scripts/build.mjs).

/** Una fila de la vista continua: un pliego (una o dos páginas) con su posición en el lienzo. */
export interface ContinuousRow {
  element: HTMLElement;
  /** Índice de la primera página de la fila. */
  start: number;
  count: number;
  height: number;
  /** Distancia desde el borde superior del pliego, en píxeles de pantalla. */
  offset: number;
}

/**
 * Ancla del zoom (canvasAnchor de canvas-navigation.js): punto del pliego, en mm, bajo un punto de
 * la pantalla. En la vista continua, y es relativa a la fila que empieza en la página row.
 * Vive acá hasta que canvas-navigation.js pase a TypeScript.
 */
export interface CanvasAnchor {
  x: number;
  y: number;
  clientX: number;
  clientY: number;
  row?: number;
}

declare global {
  /** Vista continua activa. */
  var continuousCanvas: boolean;
  /** Filas dibujadas en la vista continua (vacío fuera de ella). */
  var continuousRows: ContinuousRow[];
  /** Clave del último armado; vacía obliga a volver a centrar en el pliego actual. */
  var continuousKey: string;
}

globalThis.continuousCanvas = localStorage.getItem('maquetario-continuous') === 'true';
globalThis.continuousRows = [];
let visibleRowFrame = 0;
globalThis.continuousKey = '';
let continuousSpread = -1;
const canvasGap = 38;
// En la vista continua, el ancla del zoom se guarda relativa a su fila de páginas.
extend.result(
  'canvasAnchor',
  (anchor: CanvasAnchor) => {
    if (continuousCanvas && continuousRows.length) {
      const position = anchor.y * scale;
      const row = continuousRows.findLast((item) => item.offset <= position) || continuousRows[0];
      anchor.row = row.start;
      anchor.y = (position - row.offset) / scale;
    }
    return anchor;
  },
  'continuous-canvas',
);
extend(
  'restoreCanvasAnchor',
  (restore) =>
    function (anchor: CanvasAnchor) {
      const row = continuousCanvas && continuousRows.find((item) => item.start === anchor.row);
      return restore(row ? { ...anchor, y: anchor.y + row.offset / scale } : anchor);
    },
  'continuous-canvas',
);
const continuousButton = UI.element(UI.quietButton({ id: 'continuousCanvas' }));
$('#fitZoom').before(continuousButton);

function labelContinuousCanvas(): void {
  continuousButton.textContent = bw('Continuo', 'Continuous', 'Contínuo');
  continuousButton.title = bw(
    'Recorrer todas las páginas con la rueda',
    'Scroll through all pages',
    'Rolar por todas as páginas',
  );
  continuousButton.setAttribute('aria-pressed', String(continuousCanvas));
}
continuousButton.onclick = () => {
  if (canvasUnavailable()) return;
  finishEditing();
  continuousCanvas = !continuousCanvas;
  localStorage.setItem('maquetario-continuous', String(continuousCanvas));
  canvasSpreadKey = continuousKey = '';
  renderPages();
  labelContinuousCanvas();
};

function paintContinuousRows(): void {
  const top = canvasStage.scrollTop,
    bottom = top + canvasStage.clientHeight;
  for (const row of continuousRows) {
    const y = canvasPadding + row.offset;
    const keep =
      y < bottom + canvasStage.clientHeight && y + row.height > top - canvasStage.clientHeight;
    if (keep && !row.element.children.length) {
      for (let i = row.start; i < row.start + row.count; i++) row.element.append(paper(i, scale));
    } else if (!keep && !drag && !row.element.contains(editing)) row.element.replaceChildren();
  }
  requestAnimationFrame(checkOverflow);
}

function markVisiblePage(): void {
  const center = canvasStage.scrollTop + canvasStage.clientHeight / 2 - canvasPadding;
  const visible = continuousRows.findLast((row) => row.offset <= center) || continuousRows[0];
  if (!visible || visible.start === spread || editing || drag || selected) return;
  active = spread = visible.start;
  continuousSpread = spread;
  for (const page of $$('#spread .page')) {
    const current = Number(page.dataset.page) === active;
    page.classList.toggle('active-page', current);
    page.classList.toggle('is-page-active', current);
  }
  $$('#thumbnails .thumb').forEach((thumb, index) =>
    thumb.classList.toggle('active', index === Math.floor(spread / (book.facing ? 2 : 1))),
  );
  updateStatus();
  if (tab === 'pages') inspector();
}
canvasStage.addEventListener(
  'scroll',
  () => {
    if (!continuousCanvas || !continuousRows.length || visibleRowFrame) return;
    visibleRowFrame = requestAnimationFrame(() => {
      visibleRowFrame = 0;
      if (!continuousCanvas) return;
      markVisiblePage();
      paintContinuousRows();
    });
  },
  { passive: true },
);
canvasStage.addEventListener(
  'pointerdown',
  (event: PointerEvent) => {
    if (!continuousCanvas || canvasUnavailable() || event.button !== 0 || handEnabled() || preview)
      return;
    const page = (event.target as Element).closest<HTMLElement>('#spread .page');
    if (page)
      spread =
        Math.floor(Number(page.dataset.page) / (book.facing ? 2 : 1)) * (book.facing ? 2 : 1);
  },
  true,
);
$('#thumbnails').addEventListener(
  'click',
  () => {
    if (continuousCanvas) continuousKey = '';
  },
  true,
);

extend(
  'renderPages',
  (normalPages) =>
    function () {
      labelContinuousCanvas();
      const host = $('#spread');
      host.classList.toggle('canvas-continuous', continuousCanvas);
      if (!continuousCanvas) {
        continuousRows = [];
        continuousKey = '';
        return normalPages();
      }
      const stage = canvasStage.getBoundingClientRect();
      const key = [book.pages[0]?.id, book.facing, verticalSpread()].join(':');
      const oldAnchor =
        continuousKey === key && continuousRows.length && continuousSpread === spread
          ? canvasAnchor(
              stage.left + canvasStage.clientWidth / 2,
              stage.top + canvasStage.clientHeight / 2,
            )
          : null;
      const step = book.facing ? 2 : 1,
        vertical = verticalSpread();
      const referenceWidth = book.width * (vertical ? 1 : step);
      const referenceHeight = book.height * (vertical ? step : 1);
      scale =
        Math.max(
          0.15,
          Math.min(
            (canvasStage.clientWidth - 58) / referenceWidth,
            (canvasStage.clientHeight - 56) / referenceHeight,
          ),
        ) * zoom;
      host.replaceChildren();
      host.classList.remove('spread-vertical');
      continuousRows = [];
      const width = referenceWidth * scale + (!vertical && step === 2 ? 2 : 0);
      let height = 0;
      for (let start = 0; start < book.pages.length; start += step) {
        const count = Math.min(step, book.pages.length - start),
          element = document.createElement('section');
        element.className = 'continuous-row' + (vertical ? ' continuous-row-vertical' : '');
        const rowHeight =
          book.height * scale * (vertical ? count : 1) + (vertical && count === 2 ? 2 : 0);
        element.style.height = rowHeight + 'px';
        host.append(element);
        continuousRows.push({
          element,
          start,
          count,
          height: rowHeight,
          offset: height + (start ? canvasGap : 0),
        });
        height += rowHeight + (start ? canvasGap : 0);
      }
      const surfaceWidth = Math.max(canvasStage.clientWidth, width) + 2 * canvasPadding;
      Object.assign(canvasSurface.style, {
        width: surfaceWidth + 'px',
        height: Math.max(canvasStage.clientHeight, height) + 2 * canvasPadding + 'px',
      });
      Object.assign(host.style, {
        width: width + 'px',
        height: height + 'px',
        left: (surfaceWidth - width) / 2 + 'px',
        top: canvasPadding + 'px',
      });
      continuousKey = key;
      continuousSpread = spread;
      if (oldAnchor) restoreCanvasAnchor(oldAnchor);
      else {
        canvasStage.scrollLeft = (surfaceWidth - canvasStage.clientWidth) / 2;
        const row = continuousRows.find((item) => item.start === spread) || continuousRows[0];
        canvasStage.scrollTop =
          canvasPadding + (row?.offset || 0) + ((row?.height || 0) - canvasStage.clientHeight) / 2;
      }
      paintContinuousRows();
      $('#rulerX').innerHTML = Array.from(
        { length: 10 },
        (_, i) => `<span>${displayMeasure((i * referenceWidth) / 10)}</span>`,
      ).join('');
      $('#rulerY').innerHTML = Array.from(
        { length: 8 },
        (_, i) => `<span>${displayMeasure((i * referenceHeight) / 8)}</span>`,
      ).join('');
      updateCanvasZoomDisplay();
      updateCanvasCursor();
    },
  'continuous-canvas',
);
labelContinuousCanvas();
