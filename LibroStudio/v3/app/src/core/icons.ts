// Íconos de la interfaz: los trazos SVG por nombre (paths, que category-design.ts amplía con los
// suyos), el marcado de un ícono (icon) y el dibujo de los [data-icon] (icons). No tiene efectos
// al cargar. Los publica core-wiring.ts.
//
// Fuente TypeScript: viaja dentro de build/core.js (src/entries/core.ts).
import { $$ } from './utils.ts';

/** Trazos SVG de los íconos, por nombre. */
export const paths: Record<string, string> = {
  file: 'M6 3h8l4 4v14H6z M14 3v5h5',
  folder: 'M3 7h7l2-3h7v5 M2 9h20l-3 12H3z',
  save: 'M4 3h14l3 3v15H3V3z M7 3v6h10V3 M7 21v-8h10v8',
  undo: 'M8 5L3 10l5 5 M3 10h10a7 7 0 0 1 7 7',
  redo: 'M16 5l5 5-5 5 M21 10h-10a7 7 0 0 0-7 7',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  eyeOff:
    'M3 3l18 18 M10.6 5.1A9.7 9.7 0 0 1 12 5c6 0 10 7 10 7a17.6 17.6 0 0 1-3.2 3.9 M6.6 6.6C3.8 8.4 2 12 2 12s4 7 10 7a9.7 9.7 0 0 0 5-1.4 M9.9 9.9a3 3 0 0 0 4.2 4.2',
  lock: 'M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4',
  unlock: 'M5 11h14v10H5z M8 11V7a4 4 0 0 1 7.5-1.9',
  export: 'M8 8V3h9l3 3v15H8v-5 M3 12h10 M10 9l3 3-3 3 M16 3v5h4',
  select: 'M5 2l15 12-8 1-3 7z',
  text: 'M3 4h18 M12 4v17 M8 21h8 M3 4v3 M21 4v3',
  image: 'M3 3h18v18H3z M3 17l6-6 5 5 3-3 4 4 M14 7h.01',
  frame: 'M3 3h18v18H3z M3 3l18 18 M21 3L3 21',
  grid: 'M3 3h18v18H3z M9 3v18 M15 3v18 M3 9h18 M3 15h18',
  folio: 'M10 2L6 22 M18 2l-4 20 M3 8h19 M2 16h19',
  header: 'M12 2v20 M2 12h20 M5 5l14 14 M19 5L5 19',
  box: 'M3 3h18v18H3z M7 7h10 M12 7v10 M9 17h6 M2 2h2v2H2z M20 20h2v2h-2z',
  plus: 'M12 5v14 M5 12h14',
  settings: 'M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6',
  expand: 'M8 3H3v5 M16 3h5v5 M3 16v5h5 M16 21h5v-5',
  info: 'M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  print: 'M6 8V3h12v5 M6 17H3V8h18v9h-3 M6 13h12v8H6z M17 10h1',
  left: 'M4 5h16 M4 10h10 M4 15h16 M4 20h10',
  center: 'M4 5h16 M7 10h10 M4 15h16 M7 20h10',
  right: 'M4 5h16 M10 10h10 M4 15h16 M10 20h10',
  justify: 'M4 5h16 M4 10h16 M4 15h16 M4 20h16',
  pages: 'M4 5h12v16H4z M8 2h12v16',
  toc: 'M9 6h11 M9 12h11 M9 18h11 M4 6h1 M4 12h1 M4 18h1',
  layers: 'M12 4 3 9l9 5 9-5z M3 14l9 5 9-5',
  trash: 'M3 6h18 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7',
  link: 'M9 9L6 12a4 4 0 0 0 6 6l3-3 M15 15l3-3a4 4 0 0 0-6-6L9 9 M8 16l8-8',
  chevron: 'M6 9l6 6 6-6',
  // Paginadores (revisión de salida, glifos): primera, anterior, siguiente y última.
  first: 'M7 6v12 M17 6l-6 6 6 6',
  previous: 'M15 6l-6 6 6 6',
  next: 'M9 6l6 6-6 6',
  last: 'M17 6v12 M7 6l6 6-6 6',
  close: 'M6 6l12 12 M18 6L6 18',
  check: 'M5 12l5 5L20 7',
  alert:
    'M12 9v4 M12 17h.01 M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  error: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M15 9l-6 6 M9 9l6 6',
  layout: 'M3 3h18v18H3z M9 3v18 M9 9h12',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7 M20 4v7h-7',
  help: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4 M12 17h.01',
  grip: 'M9 6h.01 M9 12h.01 M9 18h.01 M15 6h.01 M15 12h.01 M15 18h.01',
  hand: 'M7 12V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v8-4a2 2 0 0 1 3 0v7c0 4-3 6-7 6h-2c-3 0-5-2-7-5l-3-4c-1-2 1-3 2-2l2 2Z',
};
/** Marcado de un ícono (si no existe el nombre, el de archivo). */
export function icon(name: string): string {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.file}"/></svg>`;
}
/** Dibuja los íconos de los [data-icon]. */
export function icons(): void {
  $$('[data-icon]').forEach((e) => (e.innerHTML = icon(e.dataset.icon!)));
}
