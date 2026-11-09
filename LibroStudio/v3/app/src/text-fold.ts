// Texto para buscar sin distinguir acentos ni mayúsculas ("Tipografía" → "tipografia"). Lo usan
// el explorador de fuentes y el glosario. No tiene efectos al cargar: se importa.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

/** El texto sin acentos y en minúsculas. */
export const foldEditorial = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
