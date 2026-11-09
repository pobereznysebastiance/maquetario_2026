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
  assert(!!$('#insertToc') && !!$('#indexTool'), 'Sección Índice visible');
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
