// Prueba del libro completo: arma la novela de muestra, la revisa y la deja lista para el PDF.
//
// prepareNovelProof, novelProofContent y prepareNovelPdf son globales porque los llama la
// autoprueba (desktop/src/main/selftest.ts) y, prepareNovelProof, también otros módulos y pruebas
// para partir de un libro conocido.
//
// Fuente TypeScript: se compila a build/book-proof.js (desktop/scripts/build.mjs).

import { goToBookPage } from './book-navigation.ts';

/** Informe de la prueba: tamaño del libro, problemas de la revisión y partes con nombre. */
export interface NovelProofReport {
  title: string;
  pages: number;
  words: number;
  issues: { page: number; kind: string }[];
  parts: { page: number; name: string }[];
}

declare global {
  /** Instala la novela de muestra, la revisa y devuelve el informe en JSON. */
  var prepareNovelProof: () => string;
  /** El libro actual en JSON (lo guarda la autoprueba). */
  var novelProofContent: () => string;
  /** Prepara la salida de lectura (formato libro, con cornisas y folios) para el PDF de prueba. */
  var prepareNovelPdf: () => void;
}

globalThis.prepareNovelProof = function () {
  hideWelcome();
  closeTutorial();
  installNovel(composeNovel(novelSample()));
  const report: NovelProofReport = {
    title: book.title,
    pages: book.pages.length,
    words: novelSample().source.split(/\s+/).length,
    issues: preflightBook(),
    parts: book.pages.map((p, i) => ({ page: i + 1, name: p.partName })).filter((p) => p.name),
  };
  goToBookPage(book.pages.findIndex((p) => p.section.startsWith('I ·')));
  showTab('structure');
  return JSON.stringify(report);
};
globalThis.novelProofContent = () => JSON.stringify(book, null, 2);
globalThis.prepareNovelPdf = function () {
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

export {};
