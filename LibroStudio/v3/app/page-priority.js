'use strict';
let showGridStrip = localStorage.getItem('maquetario-grid-strip') === 'open',
  showWorkflow = localStorage.getItem('maquetario-workflow') === 'open';
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
function applyPagePriority() {
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
  function (e, kind) {
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
  function (root = document) {
    for (const field of root.querySelectorAll('.font-search')) {
      const next = field.nextElementSibling;
      if (next?.querySelector('.font-visual-select')) field.remove();
    }
  },
  'page-priority',
);
applyPagePriority();
