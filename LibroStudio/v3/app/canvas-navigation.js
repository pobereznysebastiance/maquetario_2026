'use strict';
const canvasStage = $('#spreadStage'),
  canvasSurface = document.createElement('div');
canvasSurface.id = 'canvasSurface';
canvasStage.append(canvasSurface);
canvasSurface.append($('#spread'));
let canvasSpreadKey = '',
  spaceHand = false,
  canvasPan = null,
  lastCanvasPoint = null;
const canvasPadding = 240;
function canvasInputTarget(target) {
  return (
    target instanceof Element && !!target.closest('input,textarea,select,[contenteditable="true"]')
  );
}
function canvasUnavailable() {
  return welcomeVisible || !hasDocument || busy || !!document.querySelector('dialog[open]');
}
function handEnabled() {
  return spaceHand || tool === 'hand';
}
function updateCanvasCursor() {
  document.body.classList.toggle('canvas-hand', handEnabled());
  document.body.classList.toggle('canvas-panning', !!canvasPan);
  $('#handTool')?.classList.toggle('active', tool === 'hand');
}
function canvasAnchor(clientX, clientY) {
  const rect = $('#spread').getBoundingClientRect(),
    stage = canvasStage.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / Math.max(0.001, scale),
    y: (clientY - rect.top) / Math.max(0.001, scale),
    clientX: clientX - stage.left,
    clientY: clientY - stage.top,
  };
}
function restoreCanvasAnchor(anchor) {
  const spread = $('#spread');
  canvasStage.scrollLeft = spread.offsetLeft + anchor.x * scale - anchor.clientX;
  canvasStage.scrollTop = spread.offsetTop + anchor.y * scale - anchor.clientY;
}
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
function actualCanvasPercent() {
  return (scale / (96 / 25.4)) * 100;
}
function updateCanvasZoomDisplay() {
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
    bw('Zoom del documento · %', 'Document zoom · %', 'Zoom do documento · %'),
  );
}
function zoomCanvasTo(percent, point = null) {
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
function fitCanvas() {
  if (canvasUnavailable()) return;
  finishEditing();
  zoom = 1;
  canvasSpreadKey = '';
  renderPages();
}
const zoomValue = document.createElement('span');
zoomValue.id = 'canvasZoomValue';
zoomValue.setAttribute('aria-live', 'polite');
$('#fitZoom').before(zoomValue);
$('#zoom').min = 10;
$('#zoom').max = 800;
$('#zoom').step = 1;
$('#zoom').oninput = (e) => zoomCanvasTo(Number(e.target.value));
$('#zoomIn').onclick = () => zoomCanvasTo(actualCanvasPercent() * 1.2);
$('#zoomOut').onclick = () => zoomCanvasTo(actualCanvasPercent() / 1.2);
$('#fitZoom').onclick = fitCanvas;
setZoom = function (value) {
  zoomCanvasTo(value * 100);
};
const handTool = document.createElement('button');
handTool.type = 'button';
handTool.id = 'handTool';
handTool.className = 'tool';
handTool.dataset.tool = 'hand';
handTool.innerHTML =
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 12V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v8-4a2 2 0 0 1 3 0v7c0 4-3 6-7 6h-2c-3 0-5-2-7-5l-3-4c-1-2 1-3 2-2l2 2Z"/></svg><span>' +
  bw('Mano', 'Hand', 'Mão') +
  '</span><small class="shortcut">H</small>';
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
  function (name) {
    updateCanvasCursor();
  },
  'canvas-navigation',
);
function endCanvasPan(event) {
  if (!canvasPan) return;
  const pointer = canvasPan.pointer;
  canvasPan = null;
  if (canvasStage.hasPointerCapture(pointer)) canvasStage.releasePointerCapture(pointer);
  updateCanvasCursor();
}
function beginCanvasPan(event) {
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
const shortcutButton = document.createElement('button');
shortcutButton.type = 'button';
shortcutButton.id = 'canvasShortcuts';
shortcutButton.className = 'icon-btn';
shortcutButton.innerHTML = icon('help');
shortcutButton.title = bw('Atajos de navegación', 'Navigation shortcuts', 'Atalhos de navegação');
$('#fullscreen').before(shortcutButton);
shortcutButton.onclick = () =>
  modal(
    bw('Moverse por la maqueta', 'Navigate the layout', 'Navegar pela diagramação'),
    `<table class="canvas-shortcut-table">${[
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
      .map((row) => `<tr><th>${esc(bw(...row.slice(0, 3)))}</th><td>${row[3]}</td></tr>`)
      .join(
        '',
      )}</table><p class="help">${bw('Los atajos de navegación no se activan mientras escribís en un campo o editás texto. El 100% usa píxeles de pantalla y no calibra el tamaño físico de tu monitor.', 'Navigation shortcuts do not activate while typing in fields or editing text. 100% uses screen pixels and does not calibrate physical monitor size.', 'Atalhos de navegação não ativam ao digitar em campos ou editar texto. 100% usa pixels de tela e não calibra o tamanho físico do monitor.')}</p>`,
    () => true,
    bw('Cerrar', 'Close', 'Fechar'),
  );
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
