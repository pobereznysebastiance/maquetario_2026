// Vista continua del lienzo: todas las páginas en una sola columna que se recorre con la rueda.
// La dibuja components/canvas/Spread.tsx (sólo las filas cercanas a la vista; al desplazarse se
// marca la página visible). Acá quedan el estado, el botón y lo que elige el pliego.
// El botón "Continuo" va junto a "Ajustar" y el estado se recuerda en localStorage.
//
// continuousCanvas, continuousRows y continuousKey viven en globalThis porque la prueba de
// tests/document-view-tests.js los lee y los asigna.
//
// Fuente TypeScript: se compila a build/continuous-canvas.js (desktop/scripts/build.mjs).
import { refreshCanvasBar } from './components/canvas-bar/canvas-bar-state.ts';

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
  /** Entra o sale de la vista continua y lo recuerda (el botón #continuousCanvas de la barra). */
  var toggleContinuousCanvas: () => void;
}

globalThis.continuousCanvas = localStorage.getItem('maquetario-continuous') === 'true';
globalThis.continuousRows = [];
globalThis.continuousKey = '';
// El botón Continuo (#continuousCanvas) está en la barra del lienzo (React,
// components/canvas-bar/): muestra continuousCanvas y llama a toggleContinuousCanvas.
function labelContinuousCanvas(): void {
  refreshCanvasBar();
}
globalThis.toggleContinuousCanvas = function () {
  if (canvasUnavailable()) return;
  finishEditing();
  continuousCanvas = !continuousCanvas;
  localStorage.setItem('maquetario-continuous', String(continuousCanvas));
  canvasSpreadKey = continuousKey = '';
  renderPages();
  refreshCanvasBar(true);
};

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

labelContinuousCanvas();
