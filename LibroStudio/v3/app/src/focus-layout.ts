// Modo ampliado: el botón #fullscreen esconde los paneles y deja el lienzo a todo el ancho.
// Escape vuelve a los paneles (salvo con un diálogo o el explorador de fuentes abiertos).
//
// updateFocusControl es global porque lo llaman shapes.js y las pruebas (focus-layout-tests,
// navigation-tests).
//
// Fuente TypeScript: se compila a build/focus-layout.js (desktop/scripts/build.mjs).

declare global {
  /** Actualiza texto, título y estado del botón según el modo ampliado. */
  var updateFocusControl: () => void;
}

function updateFocusControl(): void {
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
globalThis.updateFocusControl = updateFocusControl;
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

export {};
