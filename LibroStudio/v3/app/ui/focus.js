// Foco al cerrar diálogos.
// Al cerrarse un diálogo, el navegador devuelve el foco al botón que lo abrió. Si se abrió con
// el mouse, ese foco queda marcado (anillo dorado) y parece una marca suelta. Acá se recuerda cómo
// se abrió: con mouse, el foco vuelve sin marca; con teclado, la marca se mantiene (accesibilidad).
(function () {
  'use strict';

  let lastInput = 'keyboard';
  window.addEventListener('pointerdown', () => (lastInput = 'pointer'), true);
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') lastInput = 'keyboard';
  }, true);

  const openedBy = new WeakMap();

  // Momento de apertura: quién abrió (mouse o teclado).
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      const dialog = record.target;
      if (dialog instanceof HTMLDialogElement && dialog.open) openedBy.set(dialog, lastInput);
    }
  });
  const watch = (dialog) => observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
  document.querySelectorAll('dialog').forEach(watch);
  new MutationObserver((records) => {
    for (const r of records) r.addedNodes.forEach((n) => n instanceof HTMLDialogElement && watch(n));
  }).observe(document.body, { childList: true });

  // "close" no burbujea: se escucha en captura.
  document.addEventListener(
    'close',
    (event) => {
      if (!(event.target instanceof HTMLDialogElement) || openedBy.get(event.target) !== 'pointer') return;
      const el = document.activeElement;
      if (el instanceof HTMLElement && el !== document.body) {
        el.blur();
        el.focus({ focusVisible: false, preventScroll: true });
      }
    },
    true,
  );
})();
