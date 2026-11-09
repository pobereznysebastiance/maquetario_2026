// Diálogos en la página: monta la raíz de React (DialogHost, dialogs.tsx), corta el teclado mientras
// hay una confirmación abierta y publica las funciones del servicio como globales para quien
// todavía no las importa (studio.ts, las pruebas y la autoprueba).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts, en el lugar que tenía
// dialogs.tsx).

import { mount } from '../../react/mount.tsx';
import {
  DialogHost,
  askChoice,
  closeSheet,
  confirmAction,
  openConfirmSheet,
  openSheet,
  openSheetContent,
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

// Las usan studio.ts, settings-panel.ts y la autoprueba (desktop/src/main/selftest.ts).
globalThis.askChoice = askChoice;
globalThis.confirmAction = confirmAction;
globalThis.openSheet = openSheet;
globalThis.openWorkWindow = openWorkWindow;
globalThis.openConfirmSheet = openConfirmSheet;
globalThis.closeSheet = closeSheet;
// El centro de Ayuda (components/help/) lo usa para saber si su Ventana sigue abierta.
globalThis.openSheetContent = openSheetContent;
