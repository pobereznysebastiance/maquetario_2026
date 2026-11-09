// Pruebas de panel-resize.js: sólo se cargan en la autoprueba (test-loader.js), no van en el instalador.

registerIntegrationTest(function (r) {
  const old = { ...panelSizes },
    before = JSON.stringify(maquetarioEditor.book),
    check = (v, m) => {
      if (!v) throw Error(m);
      r.checks.push(m);
    };
  try {
    check($$('.panel-resizer').length === 3, 'Tres separadores de panel disponibles');
    panelSizes = { left: 230, right: 390, templates: 210 };
    applyPanelSizes();
    check($('.app-layout').style.gridTemplateColumns.includes('230px'), 'Ancho de panel ajustable');
    check($('.template-panel').style.height === '210px', 'Altura de plantillas ajustable');
    check(JSON.stringify(maquetarioEditor.book) === before, 'Ajustar paneles no modifica el libro');
    coverEditor();
    check(
      !!$('.cover-image-actions #coverImage') &&
        !!$('.cover-image-actions #coverRemoveImage') &&
        document.querySelectorAll('#coverImage,#coverRemoveImage').length === 2,
      'Acciones de imagen junto a cubierta, una sola vez',
    );
    maquetarioEditor.coverPart = 'back';
    updateCoverPreview();
    check(
      $('#coverImageTarget').textContent === coverNames().back,
      'Imagen identifica zona elegida',
    );
    closeSheet();
  } finally {
    panelSizes = old;
    if (!old.templates) $('.template-panel').style.height = '';
    applyPanelSizes();
  }
  return r;
}, 'panel-resize');
