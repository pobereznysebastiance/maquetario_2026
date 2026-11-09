// Los diálogos de React se dibujan sobre un <dialog> nativo abierto con showModal(): así quedan en
// la capa superior del navegador, por encima de #modal si está abierto (una confirmación desde
// dentro de una Hoja), y el resto de la página queda inerte como hasta ahora. Radix pone la
// semántica (role, aria-labelledby/describedby), el foco al abrir y al cerrar y la marca de
// "aria-hidden" sobre el resto; el <dialog> pone el fondo (::backdrop), la capa y Escape.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

/** Capa donde se montan los diálogos de React (raíz y contenedor de los portales de Radix). */
export const dialogLayer = document.createElement('div');
dialogLayer.id = 'dialogLayer';
document.body.append(dialogLayer);

/** Ref de un <dialog>: lo abre como modal apenas entra en la página. */
export const showModalOnMount = (element: HTMLDialogElement | null): void => {
  if (element?.isConnected && !element.open) element.showModal();
};
