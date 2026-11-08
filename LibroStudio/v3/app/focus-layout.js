'use strict';
function updateFocusControl() {
  const focused = document.body.classList.contains('focused'),
    b = $('#fullscreen'),
    text = bw(
      focused ? 'Restaurar paneles' : 'Ampliar área',
      focused ? 'Restore panels' : 'Expand workspace',
      focused ? 'Restaurar painéis' : 'Ampliar área',
    );
  b.innerHTML = icon('expand') + '<span>' + text + '</span>';
  b.title = focused
    ? bw('Restaurar paneles · Escape', 'Restore panels · Escape', 'Restaurar painéis · Escape')
    : text;
  b.setAttribute('aria-label', b.title);
  b.setAttribute('aria-pressed', String(focused));
}
extend.after(
  'applyPanelSizes',
  function () {
    if (document.body.classList.contains('focused'))
      $('.app-layout').style.gridTemplateColumns = 'minmax(0,1fr)';
    requestAnimationFrame(renderPages);
  },
  'focus-layout',
);
$('#fullscreen').onclick = () => {
  finishEditing();
  document.body.classList.toggle('focused');
  applyPanelSizes();
  updateFocusControl();
  requestAnimationFrame(renderPages);
};
document.addEventListener(
  'keydown',
  (e) => {
    if (
      e.key === 'Escape' &&
      document.body.classList.contains('focused') &&
      !$('#modal').open &&
      !fontBrowser.open
    ) {
      e.preventDefault();
      document.body.classList.remove('focused');
      applyPanelSizes();
      updateFocusControl();
    }
  },
  true,
);
updateFocusControl();
registerIntegrationTest(function (r) {
  const prior = { ...panelSizes },
    check = (ok, msg) => {
      if (!ok) throw Error(msg);
      r.checks.push(msg);
    };
  try {
    panelSizes = { left: 240, right: 410, templates: 210 };
    applyPanelSizes();
    $('#fullscreen').click();
    const layout = $('.app-layout').getBoundingClientRect(),
      center = $('.center').getBoundingClientRect();
    check(document.body.classList.contains('focused'), 'Modo ampliado activado');
    check(center.width > layout.width * 0.95, 'Lienzo ampliado usa más del 95% del ancho');
    check(
      $('#fullscreen').textContent.includes('Restaurar'),
      'Botón para restaurar paneles visible',
    );
    $('#fullscreen').click();
    check(
      !document.body.classList.contains('focused') &&
        $('.leftpanel').getBoundingClientRect().width > 200,
      'Restaurar recupera anchos de panel',
    );
    $('#fullscreen').click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    check(!document.body.classList.contains('focused'), 'Escape sale del modo ampliado');
  } finally {
    document.body.classList.remove('focused');
    panelSizes = prior;
    applyPanelSizes();
    updateFocusControl();
  }
  return r;
}, 'focus-layout');
window.prepareFocusPreview = function () {
  hideWelcome();
  if ($('#modal').open) $('#modal').close();
  if (fontBrowser.open) fontBrowser.close();
  window.prepareNovelProof();
  document.body.classList.add('focused');
  applyPanelSizes();
  updateFocusControl();
};
