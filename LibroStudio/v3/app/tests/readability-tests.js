'use strict';
registerIntegrationTest(function (result) {
  const prior = M.clone(maquetarioEditor.book),
    old = localStorage.getItem('maquetario-readability'),
    check = (ok, label) => {
      if (!ok) throw Error(label);
      result.checks.push(label);
    };
  try {
    check(!!$('#saveAs') && $('#saveAs').title.includes('Ctrl'), 'Guardar como visible con atajo');
    const content = JSON.stringify(maquetarioEditor.book);
    setReadability('large');
    check(
      document.body.classList.contains('ui-large') &&
        JSON.stringify(maquetarioEditor.book) === content,
      'Modo grande no altera tipografía del libro',
    );
    setReadability('standard');
    showTab('design');
    // Rol de subtítulo de macOS (D3): el cuerpo de texto (13 px) en semibold, no un tamaño más grande.
    const heading = getComputedStyle($('.section-heading'));
    check(
      parseFloat(heading.fontSize) >= 13 && Number(heading.fontWeight) >= 600,
      'Categorías con el rol de subtítulo (13 px semibold)',
    );
    check(parseFloat(getComputedStyle($('.help')).fontSize) >= 12, 'Ayudas de al menos 12 px');
    const originalObjects = JSON.stringify(maquetarioEditor.book.pages.map((p) => p.objects));
    for (const p of gridPresets) {
      applyGridPreset(p.id);
      check(
        M.validateGrid(maquetarioEditor.book) &&
          maquetarioEditor.book.grid.enabled &&
          maquetarioEditor.book.grid.cols === p.c &&
          maquetarioEditor.book.grid.rows === p.r,
        'Grilla válida: ' + p.id,
      );
    }
    check(
      JSON.stringify(maquetarioEditor.book.pages.map((p) => p.objects)) === originalObjects,
      'Cambiar grilla conserva contenido y posiciones',
    );
    check(
      $('#templates .grid-mini-page').querySelectorAll('i').length === 1,
      'Miniaturas muestran módulos reales',
    );
    applyGridPreset('five-ten');
    check(
      $('#spread .grid-svg g').querySelectorAll('rect').length === 50,
      'Grilla 5 por 10 visible en la página',
    );
    gridGallery();
    check($$('[data-grid-card]').length === 10, 'Biblioteca de diez grillas');
    closeSheet();
  } finally {
    maquetarioEditor.book = prior;
    setReadability(old || 'standard');
    if (old === null) localStorage.removeItem('maquetario-readability');
    render(true);
  }
  return result;
}, 'readability-tests');
window.gridGallery = gridGallery;
