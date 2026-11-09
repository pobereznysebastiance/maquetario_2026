// Estado "sin libro" (hasDocument en falso: la mesa vacía de review-workspace.ts). Las barras no
// muestran datos del libro en blanco que queda detrás (página, formato, imán, capas) y los
// controles que necesitan un libro quedan deshabilitados con este motivo en su title.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

/** Motivo de un control deshabilitado porque no hay libro abierto. */
export const noBookReason = (): string =>
  bw(
    'Creá o abrí un libro para usar esta opción.',
    'Create or open a book to use this.',
    'Crie ou abra um livro para usar esta opção.',
  );

/** title de un control que necesita libro: el suyo con libro; sin libro, el motivo. */
export const bookTitle = (title: string | undefined): string | undefined =>
  hasDocument ? title : noBookReason();
