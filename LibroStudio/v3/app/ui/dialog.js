// Diálogo general (#modal): variantes y limpieza al cerrar.
// El evento "close" llega tarde (en otra vuelta del navegador). Si un diálogo se cierra y enseguida se
// abre otro, el "close" atrasado del primero disparaba la limpieza que acababa de registrar el segundo:
// le sacaba su clase (Preparar PDF y Cubierta quedaban angostos) o sus botones. Acá cada limpieza queda
// atada a la apertura en la que se registró y corre sólo cuando se cierra esa apertura.
//
//   dialogVariant('output-modal')        → clase del diálogo mientras dure esta apertura
//   onDialogClose(() => actions.remove()) → algo que deshacer al cerrar esta apertura
(function () {
  'use strict';

  const dialog = document.getElementById('modal');
  let opened = 0;
  let closed = 0;
  let pending = [];

  // "beforetoggle" es sincrónico: la apertura queda contada antes de que el módulo registre nada.
  dialog.addEventListener('beforetoggle', (event) => {
    if (event.newState === 'open') opened += 1;
  });
  dialog.addEventListener('close', () => {
    closed += 1;
    const due = pending.filter((task) => task.opening <= closed);
    pending = pending.filter((task) => task.opening > closed);
    due.forEach((task) => task.fn());
  });

  /** Registra algo que deshacer cuando se cierre la apertura actual (o la próxima, si está cerrado). */
  window.onDialogClose = (fn) => {
    pending.push({ opening: dialog.open ? opened : opened + 1, fn });
  };

  /** Clase de variante del diálogo (tamaño, disposición) mientras dure esta apertura. */
  window.dialogVariant = (name) => {
    dialog.classList.add(name);
    window.onDialogClose(() => dialog.classList.remove(name));
  };
})();
