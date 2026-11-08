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
window.prepareFocusPreview = function () {
  hideWelcome();
  if ($('#modal').open) $('#modal').close();
  if (fontBrowser.open) fontBrowser.close();
  window.prepareNovelProof();
  document.body.classList.add('focused');
  applyPanelSizes();
  updateFocusControl();
};
