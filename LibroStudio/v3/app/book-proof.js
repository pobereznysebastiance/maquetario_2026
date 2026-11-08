'use strict';
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
