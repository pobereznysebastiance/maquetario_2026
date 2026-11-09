// Foco al abrir y cerrar diálogos.
// Al cerrarse un diálogo, el navegador devuelve el foco al botón que lo abrió. Si se abrió con
// el mouse, ese foco queda marcado (anillo dorado) y parece una marca suelta. Acá se recuerda cómo
// se abrió: con mouse, el foco vuelve sin marca; con teclado, la marca se mantiene (accesibilidad).
// Antes de la primera interacción ('none') vale lo mismo que con mouse: un diálogo que se abre solo
// al arrancar no muestra el anillo en su primer control. Con la primera tecla (Tab incluido) la
// marca vuelve a verse como siempre.
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

type InputKind = 'keyboard' | 'pointer' | 'none';
let lastInput: InputKind = 'none';
window.addEventListener('pointerdown', () => (lastInput = 'pointer'), true);
window.addEventListener(
  'keydown',
  (event) => {
    if (event.key !== 'Escape') lastInput = 'keyboard';
  },
  true,
);

const openedBy = new WeakMap<HTMLDialogElement, InputKind>();

/** Deja el foco donde está, pero sin el anillo de :focus-visible. */
function focusWithoutRing(el: Element | null): void {
  if (!(el instanceof HTMLElement) || el === document.body) return;
  el.blur();
  el.focus({ focusVisible: false, preventScroll: true } as FocusOptions);
}

// Momento de apertura: quién abrió (mouse, teclado o nadie todavía).
function opened(dialog: HTMLDialogElement): void {
  openedBy.set(dialog, lastInput);
  // showModal() ya movió el foco adentro: sin teclado de por medio, va sin anillo.
  if (lastInput !== 'keyboard' && dialog.contains(document.activeElement))
    focusWithoutRing(document.activeElement);
}
const observer = new MutationObserver((records) => {
  for (const record of records) {
    const dialog = record.target;
    if (dialog instanceof HTMLDialogElement && dialog.open) opened(dialog);
  }
});
const watch = (dialog: HTMLDialogElement) =>
  observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
document.querySelectorAll('dialog').forEach(watch);
// También los diálogos de React (src/components/dialog/): entran en #dialogLayer ya abiertos
// (showModal() en el mismo momento en que se agregan), así que se miran al llegar.
const added = new MutationObserver((records) => {
  for (const r of records)
    r.addedNodes.forEach((n) => {
      if (n instanceof HTMLElement && n.id === 'dialogLayer') added.observe(n, { childList: true });
      if (!(n instanceof HTMLDialogElement)) return;
      watch(n);
      if (n.open) opened(n);
    });
});
added.observe(document.body, { childList: true });
const layer = document.getElementById('dialogLayer');
if (layer) added.observe(layer, { childList: true });

// "close" no burbujea: se escucha en captura.
document.addEventListener(
  'close',
  (event) => {
    if (!(event.target instanceof HTMLDialogElement) || openedBy.get(event.target) === 'keyboard')
      return;
    focusWithoutRing(document.activeElement);
  },
  true,
);
export {};
