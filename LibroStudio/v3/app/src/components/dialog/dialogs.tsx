// Servicio de diálogos en React (D4 con Radix): confirmaciones, Hojas y Ventanas de trabajo.
//
//   const ok = await confirmAction({ title, message, confirmLabel, danger: true });
//   const choice = await askChoice({ title, message, actions: [{ id, label, variant }] });
//   await openSheet(<Contenido />, { title, action: { label: 'Guardar', run }, size: 'sm' });
//   await openWorkWindow(<Contenido />, { title, action: { label: 'Guardar PDF', run } });
//
// confirmAction y askChoice conservan la firma global de confirm.ts y su comportamiento: se
// abren al instante (el diálogo ya está en la página cuando vuelven), la respuesta llega al
// cerrar, Escape cancela, en acciones destructivas el foco arranca en Cancelar y, mientras la
// confirmación está abierta, ni el teclado ni los clics llegan a los atajos de la app. Durante la
// autoprueba (maquetarioSelfTest) no esperan: eligen la primera acción.
//
// Hojas y Ventanas: una sola a la vez. Abrir una cierra #modal (salvo keepModal: el explorador de
// fuentes ocupa el lugar de una Hoja HTML) y reemplaza la que esté abierta
// (nada de diálogo sobre diálogo); sólo una confirmación puede quedar por encima. Las pantallas
// que todavía arman HTML siguen con modal() (#modal); cuando una pase a React, modal.sheet,
// modal.info y modal.workspace aceptan un elemento de React en lugar del HTML y vienen acá.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { useSyncExternalStore, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { mount, useLanguage } from '../../react/mount.tsx';
import { ConfirmDialog, type ChoiceOptions, type ConfirmOptions } from './ConfirmDialog.tsx';
import { Sheet, WorkWindow, type SheetOptions, type WorkWindowOptions } from './Sheet.tsx';

declare global {
  var askChoice: (options: ChoiceOptions) => Promise<string | null>;
  var confirmAction: (options: ConfirmOptions) => Promise<boolean>;
  /** Hoja con contenido de React. Se resuelve al cerrarse. */
  var openSheet: (content: ReactNode, options: SheetOptions) => Promise<void>;
  /** Ventana de trabajo con contenido de React. Se resuelve al cerrarse. */
  var openWorkWindow: (content: ReactNode, options: WorkWindowOptions) => Promise<void>;
  /** Cierra la Hoja o Ventana de React abierta (si hay una). */
  var closeSheet: () => void;
  /** Contenido de la Hoja o Ventana de React abierta, o null (al instante, aunque React no haya redibujado). */
  var openSheetContent: () => ReactNode | null;
}

interface ConfirmRequest {
  id: number;
  options: ChoiceOptions;
  done: (choice: string | null) => void;
}
interface SheetRequest {
  id: number;
  kind: 'sheet' | 'workspace';
  content: ReactNode;
  options: SheetOptions | WorkWindowOptions;
  done: () => void;
}

// Estado: la confirmación y la Hoja/Ventana abiertas (a lo sumo una de cada una).
let confirmRequest: ConfirmRequest | null = null;
let sheetRequest: SheetRequest | null = null;
let snapshot: { confirm: ConfirmRequest | null; sheet: SheetRequest | null } = {
  confirm: null,
  sheet: null,
};
let nextId = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
/** Avisa del cambio; al abrir, dibuja antes de volver (el diálogo queda en la página al instante). */
const update = (sync: boolean) => {
  snapshot = { confirm: confirmRequest, sheet: sheetRequest };
  const notify = () => listeners.forEach((listener) => listener());
  if (sync) flushSync(notify);
  else notify();
};

const DialogHost = () => {
  const { confirm, sheet } = useSyncExternalStore(subscribe, () => snapshot);
  useLanguage();
  return (
    <>
      {sheet?.kind === 'sheet' ? (
        <Sheet key={sheet.id} options={sheet.options as SheetOptions} onClose={sheet.done}>
          {sheet.content}
        </Sheet>
      ) : null}
      {sheet?.kind === 'workspace' ? (
        <WorkWindow key={sheet.id} options={sheet.options} onClose={sheet.done}>
          {sheet.content}
        </WorkWindow>
      ) : null}
      {confirm ? (
        <ConfirmDialog key={confirm.id} options={confirm.options} onClose={confirm.done} />
      ) : null}
    </>
  );
};

/**
 * Muestra una pregunta con varias salidas. Devuelve el id elegido, o null si se canceló (Esc incluido).
 * variant: 'primary' | 'danger' | 'secondary'
 */
function askChoice(options: ChoiceOptions): Promise<string | null> {
  // La autoprueba no puede contestar diálogos: elige la primera acción.
  if (window.maquetarioSelfTest) return Promise.resolve(options.actions[0]?.id ?? null);
  // Una pregunta nueva reemplaza a la que estuviera abierta (que queda cancelada).
  if (confirmRequest) confirmRequest.done(null);
  return new Promise((resolve) => {
    const id = ++nextId;
    confirmRequest = {
      id,
      options,
      done: (choice) => {
        if (confirmRequest?.id === id) {
          confirmRequest = null;
          update(false);
        }
        resolve(choice);
      },
    };
    update(true);
  });
}

/** Sí/No para una acción. Con danger:true el botón es de peligro y el foco queda en Cancelar. */
async function confirmAction({
  title,
  message,
  confirmLabel,
  danger = false,
  cancelLabel,
}: ConfirmOptions): Promise<boolean> {
  const choice = await askChoice({
    title,
    message,
    cancelLabel,
    actions: [{ id: 'confirm', label: confirmLabel, variant: danger ? 'danger' : 'primary' }],
  });
  return choice === 'confirm';
}

function openDialog(
  kind: SheetRequest['kind'],
  content: ReactNode,
  options: SheetRequest['options'],
): Promise<void> {
  const modal = document.getElementById('modal') as HTMLDialogElement | null;
  if (modal?.open && !(options as WorkWindowOptions).keepModal) modal.close();
  if (sheetRequest) sheetRequest.done();
  return new Promise((resolve) => {
    const id = ++nextId;
    sheetRequest = {
      id,
      kind,
      content,
      options,
      done: () => {
        if (sheetRequest?.id === id) {
          sheetRequest = null;
          update(false);
        }
        resolve();
      },
    };
    update(true);
  });
}

export const openSheet = (content: ReactNode, options: SheetOptions) =>
  openDialog('sheet', content, options);
export const openWorkWindow = (content: ReactNode, options: WorkWindowOptions) =>
  openDialog('workspace', content, options);
/** Cierra la Hoja o Ventana abierta en el acto (el DOM queda al día al volver). */
export function closeSheet(): void {
  const request = sheetRequest;
  if (!request) return;
  sheetRequest = null;
  update(true);
  request.done();
}

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
globalThis.closeSheet = closeSheet;
// El centro de Ayuda (components/help/) lo usa para saber si su Ventana sigue abierta.
globalThis.openSheetContent = () => sheetRequest?.content ?? null;
