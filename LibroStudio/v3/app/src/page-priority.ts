// Prioridad de las páginas: las plantillas se pliegan para dar lugar al lienzo. El botón va en
// el título de las plantillas y el estado (abierto o plegado) se recuerda en localStorage.
// (El recorrido del libro ya no ocupa lugar sobre el lienzo: está en el centro de Ayuda.)
//
// showGridStrip y applyPagePriority son globales porque la prueba de
// tests/refinement-tests.js los cambia y vuelve a aplicar.
//
// Fuente TypeScript: se compila a build/page-priority.js (desktop/scripts/build.mjs).

declare global {
  /** Plantillas desplegadas. */
  var showGridStrip: boolean;
  /** Aplica el estado de las plantillas a la interfaz y redibuja las páginas. */
  var applyPagePriority: () => void;
}

globalThis.showGridStrip = localStorage.getItem('maquetario-grid-strip') === 'open';
const templateToggle = UI.element(UI.quietButton({ id: 'toggleGridStrip' }));
const templateLabel = $('.template-heading>span');
templateLabel.firstChild?.remove();
templateLabel.prepend(templateToggle);
function applyPagePriority(): void {
  document.body.classList.add('page-priority');
  document.body.classList.toggle('templates-collapsed', !showGridStrip);
  templateToggle.textContent =
    (showGridStrip ? '▾ ' : '▸ ') + bw('Plantillas', 'Templates', 'Grades');
  templateToggle.setAttribute('aria-expanded', String(showGridStrip));
  requestAnimationFrame(renderPages);
}
globalThis.applyPagePriority = applyPagePriority;
templateToggle.onclick = () => {
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
