// Prioridad de las páginas: plantillas y recorrido se pliegan para dar lugar al lienzo.
// Los botones van en la barra del documento (recorrido) y en el título de las plantillas.
// El estado (abierto o plegado) se recuerda en localStorage.
//
// showGridStrip, showWorkflow y applyPagePriority son globales porque la prueba de
// tests/refinement-tests.js los cambia y vuelve a aplicar.
//
// Fuente TypeScript: se compila a build/page-priority.js (desktop/scripts/build.mjs).

declare global {
  /** Plantillas desplegadas. */
  var showGridStrip: boolean;
  /** Recorrido desplegado. */
  var showWorkflow: boolean;
  /** Aplica el estado de plantillas y recorrido a la interfaz y redibuja las páginas. */
  var applyPagePriority: () => void;
}

globalThis.showGridStrip = localStorage.getItem('maquetario-grid-strip') === 'open';
globalThis.showWorkflow = localStorage.getItem('maquetario-workflow') === 'open';
const workflowToggle = document.createElement('button');
workflowToggle.type = 'button';
workflowToggle.id = 'toggleWorkflow';
workflowToggle.className = 'quiet';
$('.documentbar').append(workflowToggle);
const templateToggle = document.createElement('button');
templateToggle.type = 'button';
templateToggle.id = 'toggleGridStrip';
templateToggle.className = 'quiet';
const templateLabel = $('.template-heading>span');
templateLabel.firstChild?.remove();
templateLabel.prepend(templateToggle);
function applyPagePriority(): void {
  document.body.classList.add('page-priority');
  document.body.classList.toggle('templates-collapsed', !showGridStrip);
  document.body.classList.toggle('workflow-collapsed', !showWorkflow);
  templateToggle.textContent =
    (showGridStrip ? '▾ ' : '▸ ') + bw('Plantillas', 'Templates', 'Grades');
  templateToggle.setAttribute('aria-expanded', String(showGridStrip));
  workflowToggle.textContent =
    bw('Recorrido', 'Workflow', 'Percurso') + (showWorkflow ? ' ▴' : ' ▾');
  workflowToggle.setAttribute('aria-expanded', String(showWorkflow));
  for (const b of $$('#tools .tool')) {
    const label = b.querySelector('span')?.textContent;
    if (label && !b.title) b.title = label;
  }
  requestAnimationFrame(renderPages);
}
globalThis.applyPagePriority = applyPagePriority;
templateToggle.onclick = () => {
  showGridStrip = !showGridStrip;
  localStorage.setItem('maquetario-grid-strip', showGridStrip ? 'open' : 'closed');
  applyPagePriority();
};
workflowToggle.onclick = () => {
  showWorkflow = !showWorkflow;
  localStorage.setItem('maquetario-workflow', showWorkflow ? 'open' : 'closed');
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
