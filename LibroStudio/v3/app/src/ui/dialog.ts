// Diálogo general (#modal): variantes y limpieza al cerrar.
// El evento "close" llega tarde (en otra tarea) y, con el hilo ocupado (vista previa del PDF) o la
// ventana sin foco, puede tardar segundos. Si un diálogo se cierra y enseguida se abre otro, el
// "close" atrasado del primero disparaba la limpieza del segundo (le sacaba su clase o sus botones),
// o la limpieza no corría a tiempo y las clases se acumulaban. Acá la limpieza corre en
// "beforetoggle", que es sincrónico: dentro del mismo close(), antes de que se abra otro diálogo.
//
//   dialogVariant('output-modal')        → clase del diálogo mientras dure esta apertura
//   onDialogClose(() => actions.remove()) → algo que deshacer al cerrar esta apertura
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

const dialog = document.getElementById('modal') as HTMLDialogElement;
let opened = 0;
let pending: { opening: number; fn: () => void }[] = [];

dialog.addEventListener('beforetoggle', (event) => {
  // ToggleEvent: newState es 'open' o 'closed'.
  if ((event as ToggleEvent).newState === 'open') {
    opened += 1;
    return;
  }
  // Se cierra la apertura actual: corre lo registrado para ella (y para cualquier anterior).
  const due = pending.filter((task) => task.opening <= opened);
  pending = pending.filter((task) => task.opening > opened);
  due.forEach((task) => task.fn());
});

/** Registra algo que deshacer cuando se cierre la apertura actual (o la próxima, si está cerrado). */
declare global {
  /** Registra algo que deshacer cuando se cierre la apertura actual (o la próxima, si está cerrado). */
  var onDialogClose: (fn: () => void) => void;
  /** Clase de variante del diálogo (tamaño, disposición) mientras dure esta apertura. */
  var dialogVariant: (name: string) => void;
}

globalThis.onDialogClose = (fn) => {
  pending.push({ opening: dialog.open ? opened : opened + 1, fn });
};

/** Clase de variante del diálogo (tamaño, disposición) mientras dure esta apertura. */
globalThis.dialogVariant = (name) => {
  dialog.classList.add(name);
  globalThis.onDialogClose(() => dialog.classList.remove(name));
};

export {};
