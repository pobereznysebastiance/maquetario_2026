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
  $('#handTool')?.classList.toggle('active', tool === 'hand');
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
function updateCanvasZoomDisplay(): void {
  const percent = Math.max(10, Math.min(800, actualCanvasPercent()));
  $('#zoom').value = percent;
  $('#canvasZoomValue').textContent = Math.round(actualCanvasPercent()) + '%';
  $('#fitZoom').textContent = bw('Ajustar', 'Fit', 'Ajustar');
  $('#fitZoom').title = bw(
    'Ajustar pliego · Ctrl+0',
    'Fit spread · Ctrl+0',
    'Ajustar páginas · Ctrl+0',
  );
  $('#zoom').setAttribute(
    'aria-label',
    bw('Zoom del lienzo · %', 'Canvas zoom · %', 'Zoom da tela · %'),
  );
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
const zoomValue = document.createElement('span');
zoomValue.id = 'canvasZoomValue';
zoomValue.setAttribute('aria-live', 'polite');
$('#fitZoom').before(zoomValue);
$('#zoom').min = 10;
$('#zoom').max = 800;
$('#zoom').step = 1;
$('#zoom').oninput = (e: Event) => zoomCanvasTo(Number((e.target as HTMLInputElement).value));
$('#zoomIn').onclick = () => zoomCanvasTo(actualCanvasPercent() * 1.2);
$('#zoomOut').onclick = () => zoomCanvasTo(actualCanvasPercent() / 1.2);
$('#fitZoom').onclick = fitCanvas;
extend.replace(
  'setZoom',
  function (value: number) {
    zoomCanvasTo(value * 100);
  },
  'canvas-navigation',
);
const handTool = UI.element(
  UI.tool({
    id: 'handTool',
    tool: 'hand',
    icon: 'hand',
    label: bw('Mano', 'Hand', 'Mão'),
    shortcut: 'H',
  }),
);
handTool.title = bw(
  'Mano · H / Espacio + arrastrar',
  'Hand · H / Space + drag',
  'Mão · H / Espaço + arrastar',
);
handTool.onclick = () => {
  finishEditing();
  setTool('hand');
  updateCanvasCursor();
};
$('[data-tool="select"]').after(handTool);
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
const shortcutButton = UI.element(
  UI.iconButton({
    id: 'canvasShortcuts',
    icon: 'help',
    label: bw('Atajos de navegación', 'Navigation shortcuts', 'Atalhos de navegação'),
  }),
);
$('#fullscreen').before(shortcutButton);
// Atajos: sección del centro de Ayuda; el "?" de la barra del zoom la abre directo.
shortcutButton.onclick = () => openHelp('shortcuts');
registerHelpSection({
  id: 'shortcuts',
  label: 'Atajos',
  order: 3,
  render(host) {
    host.innerHTML = `<h2 class="help-heading">${bw('Moverse por la maqueta', 'Navigate the layout', 'Navegar pela diagramação')}</h2><table class="canvas-shortcut-table">${[
      [
        'Espacio + arrastrar',
        'Space + drag',
        'Espaço + arrastar',
        bw(
          'Mano temporal · soltá Espacio para volver a tu herramienta.',
          'Temporary hand · release Space to return to your tool.',
          'Mão temporária · solte Espaço para voltar à ferramenta.',
        ),
      ],
      [
        'Botón central + arrastrar',
        'Middle button + drag',
        'Botão central + arrastar',
        bw('Desplazar el lienzo.', 'Pan the canvas.', 'Deslocar a área de trabalho.'),
      ],
      [
        'Ctrl + rueda',
        'Ctrl + wheel',
        'Ctrl + roda',
        bw('Zoom alrededor del puntero.', 'Zoom around the pointer.', 'Zoom em torno do ponteiro.'),
      ],
      [
        'Ctrl + / Ctrl −',
        'Ctrl + / Ctrl −',
        'Ctrl + / Ctrl −',
        bw('Acercar / alejar.', 'Zoom in / out.', 'Aproximar / afastar.'),
      ],
      [
        'Ctrl + 0',
        'Ctrl + 0',
        'Ctrl + 0',
        bw(
          'Ajustar el pliego a la ventana.',
          'Fit the spread to the window.',
          'Ajustar as páginas à janela.',
        ),
      ],
      ['Ctrl + 1', 'Ctrl + 1', 'Ctrl + 1', bw('Zoom al 100%.', 'Zoom to 100%.', 'Zoom em 100%.')],
      ['H / V', 'H / V', 'H / V', bw('Mano / Seleccionar.', 'Hand / Select.', 'Mão / Selecionar.')],
      [
        'Shift + rueda',
        'Shift + wheel',
        'Shift + roda',
        bw('Desplazamiento horizontal.', 'Horizontal scrolling.', 'Deslocamento horizontal.'),
      ],
    ]
      .map(
        (row) =>
          `<tr><th>${esc(bw(...(row.slice(0, 3) as [string, string, string])))}</th><td>${row[3]}</td></tr>`,
      )
      .join(
        '',
      )}</table><p class="help">${bw('Los atajos de navegación no se activan mientras escribís en un campo o editás texto. El 100% usa píxeles de pantalla y no calibra el tamaño físico de tu monitor.', 'Navigation shortcuts do not activate while typing in fields or editing text. 100% uses screen pixels and does not calibrate physical monitor size.', 'Atalhos de navegação não ativam ao digitar em campos ou editar texto. 100% usa pixels de tela e não calibra o tamanho físico do monitor.')}</p>`;
  },
});
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
