'use strict';
registerIntegrationTest(function (result) {
  const old = M.clone(book),
    check = (ok, msg) => {
      if (!ok) throw Error(msg);
      result.checks.push(msg);
    };
  try {
    book.header.rule = true;
    book.header.ruleLength = 55;
    book.header.ruleWidth = 0.5;
    book.header.ruleGap = 3;
    book.header.ruleColor = '#775566';
    check(
      autoElement(0, 'header', 2, true).querySelector('.mqt-rule').style.width === '55%',
      'Miscelánea personalizable en salida',
    );
    book.header.rule = false;
    check(
      !autoElement(0, 'header', 2, true).querySelector('.mqt-rule'),
      'Miscelánea opcional sin línea residual',
    );
    const b = composeNovel(novelSample());
    check(b.pages.length > 12, 'Novela compuesta en más de doce páginas');
    check(
      b.pages.some((p) => p.partName === 'Legales') &&
        b.pages.some((p) => p.partName === 'Colofón') &&
        b.pages.some((p) => p.partName === 'Dedicatoria'),
      'Partes preliminares y finales presentes',
    );
    check(b.toc.entries.length === 7, 'Índice vinculado a prólogo, cinco capítulos y epílogo');
    const source = manuscriptParts(novelSample().source)
        .flatMap((c) => c.paragraphs)
        .join(' ')
        .replace(/\s+/g, ' '),
      rendered = b.pages
        .flatMap((p) =>
          p.objects.filter((o) => o.paragraphMap?.[0]?.styleId === 'body').map((o) => o.text),
        )
        .join(' ')
        .replace(/\s+/g, ' ');
    check(source === rendered, 'Paginación conserva cada palabra del manuscrito en orden');
    book = b;
    check(preflightBook().length === 0, 'Revisión completa sin desbordamientos');
    book.pages[8].objects.push(M.text('Prueba '.repeat(500), 20, 20, 30, 5, 12));
    check(
      preflightBook().some((i) => i.kind === 'overflow' && i.page === 8),
      'Control detecta desbordamiento en página fuera de la vista',
    );
    M.validate(JSON.parse(JSON.stringify(b)));
  } finally {
    book = old;
    active = spread = 0;
    selected = null;
    render(true);
  }
  return result;
}, 'book-proof');
window.prepareNovelProof = function () {
  hideWelcome();
  closeTutorial();
  if ($('#modal').open) $('#modal').close();
  installNovel(composeNovel(novelSample()));
  const report = {
    title: book.title,
    pages: book.pages.length,
    words: novelSample().source.split(/\s+/).length,
    issues: preflightBook(),
    parts: book.pages.map((p, i) => ({ page: i + 1, name: p.partName })).filter((p) => p.name),
  };
  window.novelProofReport = report;
  goToBookPage(book.pages.findIndex((p) => p.section.startsWith('I ·')));
  showTab('structure');
  return JSON.stringify(report);
};
window.novelProofContent = () => JSON.stringify(book, null, 2);
window.prepareNovelPdf = function () {
  prepareOutput({
    mode: 'reading',
    paper: 'book',
    fit: false,
    crop: false,
    grid: false,
    guides: false,
    margins: false,
    headers: true,
    folios: true,
  });
};
