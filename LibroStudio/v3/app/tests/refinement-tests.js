'use strict';
registerIntegrationTest(function (r) {
  const prior = M.clone(book),
    grids = showGridStrip,
    check = (ok, label) => {
      if (!ok) throw Error(label);
      r.checks.push(label);
    };
  try {
    showTab('design');
    const input = $('[data-bind="header.distance"]'),
      details = input.closest('details');
    details.open = true;
    input.value = '9';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    check(
      $('[data-bind="header.distance"]').closest('details').open,
      'Personalizar cornisa permanece abierto al ajustar',
    );
    check($('[data-bind="header.distance"]') === input, 'Ajuste numérico conserva control y foco');
    liveMasterAdjustment = false;
    inspector();
    check(
      $('[data-bind="header.distance"]').closest('details').open,
      'Estado de desplegable persiste al reconstruir panel',
    );
    book.header.pos = 'left';
    book.header.enabled = true;
    book.header.offsetX = book.header.offsetY = 0;
    book.header.distance = 8;
    book.header.sideDirection = 'up';
    let el = autoElement(0, 'header', 2, true);
    check(
      el.dataset.sideMargin === 'left' && el.style.transform.includes('-90deg'),
      'Cornisa en margen lateral con lectura ascendente',
    );
    check(
      parseFloat(el.style.left) > 0 && parseFloat(el.style.left) < M.margins(book, 0).left * 2,
      'Eje de cornisa dentro del margen izquierdo',
    );
    book.header.sideDirection = 'down';
    check(
      autoElement(0, 'header', 2, true).style.transform.includes('90deg'),
      'Lectura descendente en cornisa lateral',
    );
    check(
      M.validate(JSON.parse(JSON.stringify(book))).header.sideDirection === 'down',
      'Dirección de cornisa persiste en proyecto',
    );
    showGridStrip = true;
    applyPagePriority();
    const before = $('#workarea').getBoundingClientRect().height;
    showGridStrip = false;
    applyPagePriority();
    const after = $('#workarea').getBoundingClientRect().height;
    check(after > before + 100, 'Plegar plantillas gana más de 100 px para páginas');
    check(
      !$('.center .book-route') && getComputedStyle($('#templates')).display === 'none',
      'Vista inicial prioriza páginas (el recorrido está en la Ayuda)',
    );
  } finally {
    liveMasterAdjustment = false;
    book = prior;
    showGridStrip = grids;
    applyPagePriority();
    render(true);
  }
  return r;
}, 'refinement-tests');
