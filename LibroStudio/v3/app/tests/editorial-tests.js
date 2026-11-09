// Pruebas de editorial.js: sólo se cargan en la autoprueba (test-loader.js), no van en el instalador.

registerIntegrationTest(function (result) {
  const assert = (v, m) => {
    if (!v) throw Error(m);
    result.checks.push(m);
  };
  let b = M.create();
  b.pages[2].section = 'Segundo capítulo';
  b.toc = {
    title: 'Índice',
    includeSections: true,
    includeHeadings: true,
    entries: [{ id: M.uid(), label: 'Entrada manual', pageId: b.pages[2].id }],
  };
  assert(
    M.tocEntries(b).find((e) => e.label === 'Entrada manual').folio === '3',
    'Índice con referencia a página',
  );
  [b.pages[1], b.pages[2]] = [b.pages[2], b.pages[1]];
  assert(
    M.tocEntries(b).find((e) => e.label === 'Entrada manual').folio === '2',
    'Índice actualizado al mover página',
  );
  assert(M.validate(b).toc.entries.length === 1, 'Guardado compatible del índice');
  showTab('index');
  assert(!!$('#insertToc') && !!$('#railTab-index'), 'Sección Índice visible');
  const saved = M.clone(maquetarioEditor.book);
  ensureToc();
  const toc = M.text('', 20, 20, 108, 170);
  toc.toc = true;
  maquetarioEditor.book.pages[0].objects.push(toc);
  renderPages();
  assert(!!$('.toc-paper-row'), 'Índice colocado en la página');
  maquetarioEditor.book = saved;
  showTab('design');
  showRailView('pages');
  render(true);
  return result;
}, 'editorial');

// Guías desde las reglas (src/ruler-guides.ts): sacar una de la regla, moverla y quitarla
// soltándola fuera de las páginas.
registerIntegrationTest(function (result) {
  const assert = (v, m) => {
    if (!v) throw Error(m);
    result.checks.push(m);
  };
  const editor = maquetarioEditor,
    before = M.clone(editor.book.guides || []),
    priorTool = editor.tool;
  editor.tool = 'select';
  editor.book.guides = [];
  render(true);
  const page = $('#spread .page'),
    rect = page.getBoundingClientRect(),
    px = rect.width / editor.book.width,
    at = (mm) => rect.top + mm * px,
    x = rect.left + rect.width / 2,
    pointer = (type, target, clientY) =>
      target.dispatchEvent(
        new PointerEvent(type, { bubbles: true, button: 0, pointerId: 1, clientX: x, clientY }),
      );
  try {
    pointer('pointerdown', $('#rulerX'), at(40));
    pointer('pointermove', window, at(50));
    pointer('pointerup', window, at(50));
    const made = editor.book.guides[0];
    assert(
      editor.book.guides.length === 1 && made.axis === 'h' && Math.abs(made.position - 50) < 0.6,
      'Arrastrar desde la regla de arriba deja una guía horizontal donde se suelta',
    );
    render(true);
    pointer('pointerdown', $('#spread .page'), at(50));
    pointer('pointermove', window, at(80));
    pointer('pointerup', window, at(80));
    assert(
      editor.book.guides.length === 1 && Math.abs(editor.book.guides[0].position - 80) < 0.6,
      'Una guía se agarra y se mueve con Seleccionar',
    );
    render(true);
    pointer('pointerdown', $('#spread .page'), at(80));
    pointer('pointermove', window, rect.top - 30);
    pointer('pointerup', window, rect.top - 30);
    assert(editor.book.guides.length === 0, 'Soltar la guía fuera de la página la quita');
    assert(!$('.guide-drag'), 'La línea del arrastre no queda en pantalla');
  } finally {
    editor.book.guides = before;
    editor.tool = priorTool;
    render(true);
  }
  return result;
}, 'ruler-guides');
