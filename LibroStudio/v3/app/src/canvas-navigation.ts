// Navegación del lienzo: superficie con margen alrededor del pliego, zoom real de pantalla
// (Ctrl + rueda, Ctrl +/−, Ctrl 0, Ctrl 1), herramienta mano (H, Espacio + arrastrar, botón
// central) y diálogo de atajos.
//
// Globales: los que leen continuous-canvas.js, placed-artwork.ts y las pruebas
// (tests/navigation-tests.js, tests/document-view-tests.js) se publican con globalThis.
// - canvasSpreadKey y spaceHand viven en globalThis porque continuous-canvas.js y las pruebas
//   les asignan valores: este archivo los usa siempre por el global.
// - canvasAnchor y restoreCanvasAnchor se definen sólo en globalThis: continuous-canvas.js los
//   extiende por nombre y las llamadas de acá tienen que pasar por esa versión extendida.
//
// Fuente TypeScript: se compila a build/canvas-navigation.js (desktop/scripts/build.mjs).
import { shortcutsHelpSection } from './components/help/sections.tsx';
import { refreshCanvasBar } from './components/canvas-bar/canvas-bar-state.ts';

/** Punto del lienzo: posición en el pliego (sin escala) y en la mesa (relativa al visor). */
export interface CanvasAnchor {
  x: number;
  y: number;
  clientX: number;
  clientY: number;
  /** Primera página de la fila (lo agrega la vista continua, continuous-canvas.js). */
  row?: number;
}

declare global {
  /** La mesa que se desplaza (#spreadStage). */
  var canvasStage: HTMLElement;
  /** Superficie dentro de la mesa que contiene al pliego, con margen alrededor. */
  var canvasSurface: HTMLDivElement;
  /** Margen de la superficie alrededor del pliego, en px. */
  var canvasPadding: number;
  /** Pliego dibujado la última vez (vacío: volver a centrar en el próximo dibujo). */
  var canvasSpreadKey: string;
  /** Espacio apretado: mano temporal. */
  var spaceHand: boolean;
  /** Si el evento viene de un campo de texto (input, textarea, select o contenteditable). */
  var canvasInputTarget: (target: EventTarget | null) => boolean;
  /** El lienzo no acepta acciones (bienvenida, sin documento, ocupado o con un diálogo abierto). */
  var canvasUnavailable: () => boolean;
  /** La mano está activa (herramienta o Espacio). */
  var handEnabled: () => boolean;
  var updateCanvasCursor: () => void;
  /** Punto del lienzo bajo una posición de pantalla. */
  var canvasAnchor: (clientX: number, clientY: number) => CanvasAnchor;
  /** Desplaza la mesa para que el punto vuelva a quedar donde estaba en pantalla. */
  var restoreCanvasAnchor: (anchor: CanvasAnchor) => void;
  /** Zoom real de pantalla, en % (100: un milímetro mide un milímetro de pantalla a 96 ppp). */
  var actualCanvasPercent: () => number;
  var updateCanvasZoomDisplay: () => void;
  /** Zoom a un porcentaje real, alrededor de un punto de pantalla (por defecto, el centro). */
  var zoomCanvasTo: (percent: number, point?: { x: number; y: number } | null) => void;
  /** Ajustar el pliego a la ventana. */
  var fitCanvas: () => void;
  var endCanvasPan: (event?: Event) => void;
}

const canvasStage: HTMLElement = $('#spreadStage'),
  canvasSurface = document.createElement('div');
globalThis.canvasStage = canvasStage;
globalThis.canvasSurface = canvasSurface;
canvasSurface.id = 'canvasSurface';
canvasStage.append(canvasSurface);
canvasSurface.append($('#spread'));
globalThis.canvasSpreadKey = '';
globalThis.spaceHand = false;
let canvasPan: { pointer: number; x: number; y: number; left: number; top: number } | null = null,
  lastCanvasPoint: { x: number; y: number } | null = null;
const canvasPadding = 240;
globalThis.canvasPadding = canvasPadding;
function canvasInputTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element && !!target.closest('input,textarea,select,[contenteditable="true"]')
  );
}
globalThis.canvasInputTarget = canvasInputTarget;
function canvasUnavailable(): boolean {
  return welcomeVisible || !hasDocument || busy || !!document.querySelector('dialog[open]');
}
globalThis.canvasUnavailable = canvasUnavailable;
function handEnabled(): boolean {
  return spaceHand || tool === 'hand';
}
globalThis.handEnabled = handEnabled;
function updateCanvasCursor(): void {
  document.body.classList.toggle('canvas-hand', handEnabled());
  document.body.classList.toggle('canvas-panning', !!canvasPan);
}
globalThis.updateCanvasCursor = updateCanvasCursor;
globalThis.canvasAnchor = function (clientX: number, clientY: number): CanvasAnchor {
  const rect = $('#spread').getBoundingClientRect(),
    stage = canvasStage.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / Math.max(0.001, scale),
    y: (clientY - rect.top) / Math.max(0.001, scale),
    clientX: clientX - stage.left,
    clientY: clientY - stage.top,
  };
};
globalThis.restoreCanvasAnchor = function (anchor: CanvasAnchor): void {
  const spread = $('#spread');
  canvasStage.scrollLeft = spread.offsetLeft + anchor.x * scale - anchor.clientX;
  canvasStage.scrollTop = spread.offsetTop + anchor.y * scale - anchor.clientY;
};
extend(
  'renderPages',
  (pagesBeforeCanvas) =>
    function () {
      const stageRect = canvasStage.getBoundingClientRect(),
        anchor = canvasSpreadKey
          ? canvasAnchor(
              stageRect.left + canvasStage.clientWidth / 2,
              stageRect.top + canvasStage.clientHeight / 2,
            )
          : null,
        key =
          String(verticalSpread()) +
          ':' +
          book.pages
            .slice(spread, spread + (book.facing ? 2 : 1))
            .map((p) => p.id)
            .join('|');
      pagesBeforeCanvas();
      const art = $('#spread'),
        width = parseFloat(art.style.width) || 1,
        height = parseFloat(art.style.height) || 1,
        surfaceWidth = Math.max(canvasStage.clientWidth, width) + canvasPadding * 2,
        surfaceHeight = Math.max(canvasStage.clientHeight, height) + canvasPadding * 2;
      Object.assign(canvasSurface.style, {
        width: surfaceWidth + 'px',
        height: surfaceHeight + 'px',
      });
      Object.assign(art.style, {
        position: 'absolute',
        left: (surfaceWidth - width) / 2 + 'px',
        top: (surfaceHeight - height) / 2 + 'px',
      });
      if (anchor && key === canvasSpreadKey) restoreCanvasAnchor(anchor);
      else {
        canvasStage.scrollLeft = (surfaceWidth - canvasStage.clientWidth) / 2;
        canvasStage.scrollTop = (surfaceHeight - canvasStage.clientHeight) / 2;
      }
      canvasSpreadKey = key;
      updateCanvasZoomDisplay();
      updateCanvasCursor();
    },
  'canvas-navigation',
);
function actualCanvasPercent(): number {
  return (scale / (96 / 25.4)) * 100;
}
globalThis.actualCanvasPercent = actualCanvasPercent;
/** El porcentaje y el deslizador de la barra (React: components/canvas-bar/) se ponen al día. */
function updateCanvasZoomDisplay(): void {
  refreshCanvasBar();
}
globalThis.updateCanvasZoomDisplay = updateCanvasZoomDisplay;
function zoomCanvasTo(percent: number, point: { x: number; y: number } | null = null): void {
  if (canvasUnavailable() || drag || canvasPan) return;
  finishEditing();
  const rect = canvasStage.getBoundingClientRect(),
    at = point || {
      x: rect.left + canvasStage.clientWidth / 2,
      y: rect.top + canvasStage.clientHeight / 2,
    },
    anchor = canvasAnchor(at.x, at.y),
    base = scale / Math.max(0.001, zoom),
    next = Math.max(10, Math.min(800, percent));
  zoom = ((96 / 25.4) * (next / 100)) / Math.max(0.001, base);
  renderPages();
  restoreCanvasAnchor(anchor);
  updateCanvasZoomDisplay();
}
globalThis.zoomCanvasTo = zoomCanvasTo;
function fitCanvas(): void {
  if (canvasUnavailable()) return;
  finishEditing();
  zoom = 1;
  canvasSpreadKey = '';
  renderPages();
}
globalThis.fitCanvas = fitCanvas;
// Los botones del zoom (−, +, Ajustar, el deslizador y el "?" de atajos) los dibuja la barra
// del lienzo (src/components/canvas-bar/CanvasBar.tsx) y llaman a estas funciones.
extend.replace(
  'setZoom',
  function (value: number) {
    zoomCanvasTo(value * 100);
  },
  'canvas-navigation',
);
registerTool({
  tool: 'hand',
  id: 'handTool',
  icon: 'hand',
  label: () => bw('Mano', 'Hand', 'Mão'),
  title: () =>
    bw('Mano · H / Espacio + arrastrar', 'Hand · H / Space + drag', 'Mão · H / Espaço + arrastar'),
  shortcut: 'H',
  after: 'select',
  onSelect: () => {
    finishEditing();
    setTool('hand');
    updateCanvasCursor();
  },
});
extend.after(
  'setTool',
  function (name: string) {
    updateCanvasCursor();
  },
  'canvas-navigation',
);
function endCanvasPan(event?: Event): void {
  if (!canvasPan) return;
  const pointer = canvasPan.pointer;
  canvasPan = null;
  if (canvasStage.hasPointerCapture(pointer)) canvasStage.releasePointerCapture(pointer);
  updateCanvasCursor();
}
globalThis.endCanvasPan = endCanvasPan;
function beginCanvasPan(event: PointerEvent): void {
  if (canvasUnavailable() || drag || !(event.button === 1 || (event.button === 0 && handEnabled())))
    return;
  event.preventDefault();
  event.stopImmediatePropagation();
  finishEditing();
  canvasPan = {
    pointer: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    left: canvasStage.scrollLeft,
    top: canvasStage.scrollTop,
  };
  canvasStage.setPointerCapture(event.pointerId);
  updateCanvasCursor();
}
canvasStage.addEventListener('pointerdown', beginCanvasPan, true);
canvasStage.addEventListener('pointermove', (e) => {
  lastCanvasPoint = { x: e.clientX, y: e.clientY };
  if (!canvasPan || e.pointerId !== canvasPan.pointer) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  canvasStage.scrollLeft = canvasPan.left - (e.clientX - canvasPan.x);
  canvasStage.scrollTop = canvasPan.top - (e.clientY - canvasPan.y);
});
canvasStage.addEventListener(
  'pointerup',
  (e) => {
    if (canvasPan) {
      e.preventDefault();
      e.stopImmediatePropagation();
      endCanvasPan(e);
    }
  },
  true,
);
canvasStage.addEventListener('pointercancel', endCanvasPan, true);
canvasStage.addEventListener('auxclick', (e) => {
  if (e.button === 1) e.preventDefault();
});
canvasStage.addEventListener(
  'wheel',
  (e) => {
    if (canvasUnavailable()) return;
    if (e.ctrlKey) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const delta =
        e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvasStage.clientHeight : 1);
      zoomCanvasTo(
        actualCanvasPercent() * Math.exp(-Math.max(-500, Math.min(500, delta)) * 0.0018),
        { x: e.clientX, y: e.clientY },
      );
    } else if (e.shiftKey && e.deltaY && !e.deltaX) {
      e.preventDefault();
      canvasStage.scrollLeft += e.deltaY;
    }
  },
  { passive: false },
);
document.addEventListener(
  'keydown',
  (e) => {
    if (canvasUnavailable() || canvasInputTarget(e.target)) return;
    const key = e.key.toLowerCase();
    if (e.code === 'Space' || key === ' ') {
      if (drag) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      spaceHand = true;
      updateCanvasCursor();
      return;
    }
    if (!e.ctrlKey && !e.altKey && !e.metaKey && key === 'h') {
      e.preventDefault();
      e.stopImmediatePropagation();
      finishEditing();
      setTool('hand');
      return;
    }
    if (e.ctrlKey && !e.altKey) {
      if (['+', '='].includes(key) || e.code === 'NumpadAdd') {
        e.preventDefault();
        e.stopImmediatePropagation();
        zoomCanvasTo(actualCanvasPercent() * 1.2);
        return;
      }
      if (key === '-' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        e.stopImmediatePropagation();
        zoomCanvasTo(actualCanvasPercent() / 1.2);
        return;
      }
      if (key === '0') {
        e.preventDefault();
        e.stopImmediatePropagation();
        fitCanvas();
        return;
      }
      if (key === '1') {
        e.preventDefault();
        e.stopImmediatePropagation();
        zoomCanvasTo(100);
        return;
      }
    }
    if (key === 'escape') {
      spaceHand = false;
      endCanvasPan();
      if (tool === 'hand') setTool('select');
      updateCanvasCursor();
    }
  },
  true,
);
document.addEventListener(
  'keyup',
  (e) => {
    if (e.code === 'Space' || e.key === ' ') {
      spaceHand = false;
      updateCanvasCursor();
    }
  },
  true,
);
window.addEventListener('blur', () => {
  spaceHand = false;
  endCanvasPan();
  updateCanvasCursor();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    spaceHand = false;
    endCanvasPan();
    updateCanvasCursor();
  }
});
// Atajos: sección del centro de Ayuda (React, components/help/sections.tsx); el "?" de la barra
// del zoom (#canvasShortcuts, components/canvas-bar/) la abre directo.
registerHelpSection(shortcutsHelpSection);
extend.after(
  'updateStatus',
  function () {
    $('#canvasHint').textContent = bw(
      'Espacio + arrastrar: mano · Ctrl + rueda: zoom · Ctrl + 0: ajustar',
      'Space + drag: hand · Ctrl + wheel: zoom · Ctrl + 0: fit',
      'Espaço + arrastar: mão · Ctrl + roda: zoom · Ctrl + 0: ajustar',
    );
  },
  'canvas-navigation',
);
renderPages();

export {};
