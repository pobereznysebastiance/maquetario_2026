// Diálogos en la página: monta la raíz de React (DialogHost, dialogs.tsx), corta el teclado mientras
// hay una confirmación abierta y publica las funciones del servicio como globales para quien
// todavía no las importa (el núcleo, el lienzo, las pruebas y la autoprueba).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts, en el lugar que tenía
// dialogs.tsx).

import { mount } from '../../react/mount.tsx';
import { modal } from './modal.ts';
import {
  DialogHost,
  closeSheet,
  confirmAction,
  openConfirmSheet,
  openSheet,
  openWorkWindow,
} from './dialogs.tsx';

// La raíz no dibuja nada propio: los diálogos van por portales a la capa (native.ts).
const root = document.createElement('div');
root.id = 'dialogRoot';
document.body.append(root);
mount(root, <DialogHost />, { sync: true });

// Mientras la confirmación está abierta, ni el teclado ni los clics llegan a los atajos de la app
// (Escape, Enter, Suprimir, letras de herramientas…). Lo propio del diálogo sigue funcionando:
// Tab, Enter sobre el botón con foco y Escape para cancelar son acciones nativas, no oyentes.
// (Los clics se cortan en el mismo diálogo: ConfirmDialog.tsx.)
window.addEventListener(
  'keydown',
  (event) => {
    if ((document.getElementById('confirmDialog') as HTMLDialogElement | null)?.open)
      event.stopImmediatePropagation();
  },
  true,
);

// Las usan el núcleo (src/core/) y la autoprueba (por el contrato); los módulos las importan.
globalThis.confirmAction = confirmAction;
globalThis.openSheet = openSheet;
globalThis.openWorkWindow = openWorkWindow;
globalThis.openConfirmSheet = openConfirmSheet;
globalThis.closeSheet = closeSheet;
// modal() (modal.ts): lo siguen llamando por el nombre global editorial.ts y shapes.ts (lienzo).
declare global {
  var modal: typeof import('./modal.ts').modal;
}
globalThis.modal = modal;
