// Ir a una página del libro: termina la edición, la activa, muestra su pliego y deselecciona.
// Lo usan el armador, la revisión del libro, el asistente editorial y la estructura. No tiene
// efectos al cargar: se importa.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

/** Activa la página index (desde 0) y redibuja. */
export function goToBookPage(index: number): void {
  finishEditing();
  active = index;
  spread = Math.floor(index / (book.facing ? 2 : 1)) * (book.facing ? 2 : 1);
  selected = null;
  multiSelection.clear();
  render(true);
}
