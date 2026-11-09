// Prioridad de las páginas: las plantillas se pliegan para dar lugar al lienzo. El botón va en
// el título de las plantillas y el estado (abierto o plegado) se recuerda en localStorage.
// (El recorrido del libro ya no ocupa lugar sobre el lienzo: está en el centro de Ayuda.)
//
// showGridStrip y applyPagePriority son globales porque la prueba de
// tests/refinement-tests.js los cambia y vuelve a aplicar.
//
// Fuente TypeScript: se compila a build/page-priority.js (desktop/scripts/build.mjs).

import { refreshCanvasBar } from './components/canvas-bar/canvas-bar-state.ts';

declare global {
  /** Plantillas desplegadas. */
  var showGridStrip: boolean;
  /** Aplica el estado de las plantillas a la interfaz y redibuja las páginas. */
  var applyPagePriority: () => void;
  /** Abre o pliega las plantillas y lo recuerda (el botón #toggleGridStrip de la barra). */
  var toggleGridStrip: () => void;
}

globalThis.showGridStrip = localStorage.getItem('maquetario-grid-strip') === 'open';
// El botón (#toggleGridStrip) lo dibuja la barra del lienzo (React, components/canvas-bar/) a
// partir de showGridStrip: acá se aplica el estado y se le avisa.
function applyPagePriority(): void {
  document.body.classList.add('page-priority');
  document.body.classList.toggle('templates-collapsed', !showGridStrip);
  refreshCanvasBar(true);
  requestAnimationFrame(renderPages);
}
globalThis.applyPagePriority = applyPagePriority;
globalThis.toggleGridStrip = () => {
  showGridStrip = !showGridStrip;
  localStorage.setItem('maquetario-grid-strip', showGridStrip ? 'open' : 'closed');
  applyPagePriority();
};
extend.before(
  'beginPanelResize',
  function (e: PointerEvent, kind: string) {
    if (kind === 'templates' && !showGridStrip) {
      showGridStrip = true;
      localStorage.setItem('maquetario-grid-strip', 'open');
      applyPagePriority();
    }
  },
  'page-priority',
);
extend.after(
  'render',
  function (full = true) {
    applyPagePriority();
  },
  'page-priority',
);
extend.after(
  'decorateFontBrowsers',
  function (root: ParentNode = document) {
    for (const field of root.querySelectorAll('.font-search')) {
      const next = field.nextElementSibling;
      if (next?.querySelector('.font-visual-select')) field.remove();
    }
  },
  'page-priority',
);
applyPagePriority();

export {};
