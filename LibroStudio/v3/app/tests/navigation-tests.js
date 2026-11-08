'use strict';
window.runNavigationTests = async function () {
  const checks = [],
    check = (ok, msg) => {
      if (!ok) throw Error(msg);
      checks.push(msg);
    },
    prior = M.clone(book),
    priorZoom = zoom,
    priorTool = tool;
  try {
    hideWelcome();
    if ($('#modal').open) $('#modal').close();
    if (fontBrowser.open) fontBrowser.close();
    hasDocument = true;
    book = M.create();
    active = spread = 0;
    selected = null;
    tool = 'select';
    render(true);
    fitCanvas();
    const original = JSON.stringify(book),
      fitted = actualCanvasPercent();
    zoomCanvasTo(100);
    check(Math.abs(actualCanvasPercent() - 100) < 0.01, 'Zoom real de pantalla al 100%');
    const rect = canvasStage.getBoundingClientRect(),
      point = {
        x: rect.left + canvasStage.clientWidth * 0.43,
        y: rect.top + canvasStage.clientHeight * 0.45,
      },
      before = canvasAnchor(point.x, point.y);
    zoomCanvasTo(180, point);
    const after = canvasAnchor(point.x, point.y);
    check(
      Math.abs(before.x - after.x) < 1 && Math.abs(before.y - after.y) < 1,
      'Zoom conserva punto bajo el puntero',
    );
    const beforeWheel = actualCanvasPercent();
    canvasStage.dispatchEvent(
      new WheelEvent('wheel', {
        ctrlKey: true,
        deltaY: -120,
        clientX: point.x,
        clientY: point.y,
        bubbles: true,
        cancelable: true,
      }),
    );
    check(actualCanvasPercent() > beforeWheel, 'Ctrl + rueda acerca el lienzo');
    canvasStage.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: '0',
        code: 'Digit0',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    check(Math.abs(actualCanvasPercent() - fitted) < 1, 'Ctrl + 0 ajusta el pliego');
    canvasStage.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: '1',
        code: 'Digit1',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    check(Math.abs(actualCanvasPercent() - 100) < 0.01, 'Ctrl + 1 restaura 100%');
    canvasStage.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true }),
    );
    check(
      spaceHand && document.body.classList.contains('canvas-hand'),
      'Espacio activa mano temporal',
    );
    canvasStage.dispatchEvent(
      new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true }),
    );
    check(
      !spaceHand && !document.body.classList.contains('canvas-hand'),
      'Soltar Espacio vuelve a la herramienta',
    );
    const input = document.createElement('input');
    document.body.append(input);
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true }),
    );
    check(!spaceHand, 'Espacio en campos no activa mano');
    input.remove();
    const scroll = canvasStage.scrollLeft;
    canvasStage.scrollLeft += 70;
    check(canvasStage.scrollLeft > scroll + 60, 'Lienzo permite desplazamiento horizontal');
    check(JSON.stringify(book) === original, 'Navegación no modifica objetos ni contenido');
    book.folio.enabled = book.header.enabled = book.titulillo.enabled = true;
    active = 1;
    showTab('pages');
    check(
      !!$('[data-page-visible="hideFolio"]') && !!$('[data-page-visible="hideHeader"]'),
      'Controles individuales de folio y cornisa visibles',
    );
    const checkbox = $('[data-page-visible="hideFolio"]');
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    check(
      book.pages[1].hideFolio && !book.pages[0].hideFolio,
      'Ocultar número afecta solo a página elegida',
    );
    check(
      !M.auto(book, 1, 'folio') && !!M.auto(book, 0, 'folio'),
      'Salida respeta excepción individual de folio',
    );
    $('#pageHideAutomatic').click();
    check(
      !M.auto(book, 1, 'header') && !M.auto(book, 1, 'titulillo') && !!M.auto(book, 0, 'header'),
      'Ocultar los tres conserva otras páginas',
    );
    const loaded = M.validate(JSON.parse(JSON.stringify(book)));
    check(
      loaded.pages[1].hideHeader && loaded.pages[1].hideFolio,
      'Excepciones persisten al guardar',
    );
    check(M.folio(book, 1) === '2', 'Ocultar folio no reinicia numeración');
    $('#pageShowAutomatic').click();
    check(
      !!M.auto(book, 1, 'header') && !!M.auto(book, 1, 'folio'),
      'Volver a mostrar elementos individuales',
    );
    $('#modal').close();
    return { ok: true, checks };
  } finally {
    spaceHand = false;
    endCanvasPan();
    book = prior;
    zoom = priorZoom;
    tool = priorTool;
    active = spread = 0;
    selected = null;
    canvasSpreadKey = '';
    render(true);
  }
};
window.prepareNavigationPreview = function () {
  hideWelcome();
  if ($('#modal').open) $('#modal').close();
  if (fontBrowser.open) fontBrowser.close();
  document.body.classList.remove('focused');
  window.prepareNovelProof();
  book.header.enabled = book.folio.enabled = book.titulillo.enabled = true;
  active = 8;
  spread = 8;
  book.pages[active].hideFolio = true;
  book.pages[active].hideHeader = true;
  selected = null;
  showTab('pages');
  render(true);
  fitCanvas();
  updateFocusControl();
};
