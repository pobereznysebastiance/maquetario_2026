// Separadores para cambiar el ancho de los paneles laterales y la altura de las plantillas
// (arrastre, teclado y doble clic para restablecer). Las medidas se recuerdan en localStorage.
// También acomoda las acciones de imagen del editor de cubierta.
//
// panelSizes, applyPanelSizes y beginPanelResize son globales: las pruebas cambian panelSizes y
// vuelven a aplicar, focus-layout.js extiende applyPanelSizes y page-priority.ts extiende
// beginPanelResize. Por eso las llamadas que corren después de cargar pasan por globalThis
// (así incluyen esas extensiones, como cuando eran funciones globales).
//
// Fuente TypeScript: se compila a build/panel-resize.js (desktop/scripts/build.mjs).

import { bw } from './i18n/language.ts';

declare global {
  /** Medidas elegidas (px): left, right y templates. Vacío = las de la hoja de estilos. */
  var panelSizes: Record<string, number>;
  /** Aplica panelSizes a la grilla de la app y a la altura de las plantillas. */
  var applyPanelSizes: () => void;
  /** Empieza a arrastrar un separador (kind: 'left', 'right' o 'templates'). */
  var beginPanelResize: (event: PointerEvent, kind: string, handle: HTMLElement) => void;
}

globalThis.panelSizes = {};
try {
  panelSizes = JSON.parse(localStorage.getItem('maquetario-panels') || '{}');
} catch {}
function applyPanelSizes(): void {
  const layout = $('.app-layout'),
    available = layout.clientWidth,
    gap = 18;
  let left = Number(panelSizes.left) || 0,
    right = Number(panelSizes.right) || 0;
  if (left || right) {
    left = Math.min(320, Math.max(160, left || 210));
    right = Math.min(520, Math.max(290, right || 356));
    if (left + right + gap > available - 220) {
      const reduce = left + right + gap - (available - 220);
      right = Math.max(290, right - reduce);
      left = Math.max(150, Math.min(left, available - right - gap - 220));
    }
    layout.style.gridTemplateColumns = `${left}px minmax(200px,1fr) ${right}px`;
  } else layout.style.gridTemplateColumns = '';
  if (panelSizes.templates)
    $('.template-panel').style.height =
      Math.min(
        Math.max(125, panelSizes.templates),
        Math.max(125, $('.center').clientHeight * 0.42),
      ) + 'px';
  requestAnimationFrame(renderPages);
}
globalThis.applyPanelSizes = applyPanelSizes;
function beginPanelResize(event: PointerEvent, kind: string, handle: HTMLElement): void {
  if (event.button !== 0) return;
  event.preventDefault();
  finishEditing();
  const start = {
    x: event.clientX,
    y: event.clientY,
    left: $('.leftpanel').getBoundingClientRect().width,
    right: $('.inspector').getBoundingClientRect().width,
    templates: $('.template-panel').getBoundingClientRect().height,
  };
  handle.setPointerCapture(event.pointerId);
  document.body.classList.add('panel-resizing');
  handle.onpointermove = (e) => {
    if (kind === 'left') {
      panelSizes.left = start.left + (e.clientX - start.x);
      panelSizes.right = start.right;
    }
    if (kind === 'right') {
      panelSizes.right = start.right - (e.clientX - start.x);
      panelSizes.left = start.left;
    }
    if (kind === 'templates') panelSizes.templates = start.templates - (e.clientY - start.y);
    globalThis.applyPanelSizes();
  };
  const end = (e: PointerEvent) => {
    if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
    handle.onpointermove = null;
    document.body.classList.remove('panel-resizing');
    localStorage.setItem('maquetario-panels', JSON.stringify(panelSizes));
  };
  handle.onpointerup = end;
  handle.onpointercancel = end;
}
globalThis.beginPanelResize = beginPanelResize;
// Nombre y ayuda de cada borde en el idioma actual. Se vuelven a poner al cambiar de idioma: el
// traductor del DOM no conoce el título compuesto ("nombre · Arrastrá…").
const resizerLabels: [HTMLElement, [string, string, string]][] = [];
function labelResizers(): void {
  const hint = bw(
    'Arrastrá para ajustar; doble clic para restablecer',
    'Drag to resize; double-click to reset',
    'Arraste para ajustar; clique duplo para redefinir',
  );
  for (const [handle, names] of resizerLabels) {
    const label = bw(...names);
    handle.setAttribute('aria-label', label);
    handle.title = label + ' · ' + hint;
  }
}
for (const [kind, parent, names] of [
  [
    'left',
    '.leftpanel',
    ['Ancho del panel de herramientas', 'Tools panel width', 'Largura do painel de ferramentas'],
  ],
  [
    'right',
    '.inspector',
    [
      'Ancho del panel de propiedades',
      'Properties panel width',
      'Largura do painel de propriedades',
    ],
  ],
  [
    'templates',
    '.template-panel',
    ['Altura de las plantillas', 'Template area height', 'Altura das grades'],
  ],
] as [string, string, [string, string, string]][]) {
  const handle = document.createElement('div');
  handle.className = 'panel-resizer resize-' + kind;
  handle.tabIndex = 0;
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', kind === 'templates' ? 'horizontal' : 'vertical');
  resizerLabels.push([handle, names]);
  handle.onpointerdown = (e) => globalThis.beginPanelResize(e, kind, handle);
  handle.ondblclick = () => {
    if (kind === 'templates') {
      delete panelSizes.templates;
      $('.template-panel').style.height = '';
    } else {
      delete panelSizes.left;
      delete panelSizes.right;
    }
    localStorage.setItem('maquetario-panels', JSON.stringify(panelSizes));
    globalThis.applyPanelSizes();
  };
  handle.onkeydown = (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const step = e.shiftKey ? 30 : 10;
    if (kind === 'templates')
      panelSizes.templates =
        $('.template-panel').clientHeight + (e.key === 'ArrowUp' ? step : -step);
    else {
      panelSizes.left = $('.leftpanel').clientWidth;
      panelSizes.right = $('.inspector').clientWidth;
      panelSizes[kind] += (kind === 'left' ? e.key === 'ArrowRight' : e.key === 'ArrowLeft')
        ? step
        : -step;
    }
    globalThis.applyPanelSizes();
    localStorage.setItem('maquetario-panels', JSON.stringify(panelSizes));
  };
  $(parent).append(handle);
}
labelResizers();
document.addEventListener('maquetario:language', labelResizers);
// Como antes: el oyente se queda con la función tal como está al cargar (sin las extensiones
// que se registren después).
window.addEventListener('resize', applyPanelSizes);
applyPanelSizes();
extend.after(
  'updateCoverPreview',
  function () {
    if ($('#coverImageTarget')) $('#coverImageTarget').textContent = coverNames()[coverPart];
  },
  'panel-resize',
);

export {};
