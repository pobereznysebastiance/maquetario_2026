// Pruebas de focus-layout.js: sólo se cargan en la autoprueba (test-loader.js), no van en el instalador.

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
