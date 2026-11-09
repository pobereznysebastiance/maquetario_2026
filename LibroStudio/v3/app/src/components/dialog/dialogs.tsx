// Servicio de diálogos en React (D4 con Radix): confirmaciones, Hojas y Ventanas de trabajo.
//
//   const ok = await confirmAction({ title, message, confirmLabel, danger: true });
//   const choice = await askChoice({ title, message, actions: [{ id, label, variant }] });
//   await openSheet(<Contenido />, { title, action: { label: 'Guardar', run }, size: 'sm' });
//   await openWorkWindow(<Contenido />, { title, action: { label: 'Guardar PDF', run } });
//   await openConfirmSheet(<Contenido />, { title, action, extra }); // confirmación con contenido
//
// confirmAction y askChoice conservan la firma global de confirm.ts y su comportamiento: se
// abren al instante (el diálogo ya está en la página cuando vuelven), la respuesta llega al
// cerrar, Escape cancela, en acciones destructivas el foco arranca en Cancelar y, mientras la
// confirmación está abierta, ni el teclado ni los clics llegan a los atajos de la app. Durante la
// autoprueba (maquetarioSelfTest) no esperan: eligen la primera acción.
//
// Hojas y Ventanas: una sola a la vez. Abrir una reemplaza a la que esté abierta
// (nada de diálogo sobre diálogo); sólo una confirmación puede quedar por encima. La excepción es
// keepModal (el explorador de fuentes abierto desde el estilo de párrafo): la Ventana queda
// "alojada" encima de la Hoja, que sigue montada debajo con lo que
// se escribió; al cerrar la Ventana vuelve la Hoja, y si se cierra la Hoja se va la Ventana.
// modal(), modal.sheet, modal.info, modal.workspace y modal.confirm (modal.ts) son la fachada de
// estas funciones.
//
// Este archivo no tiene efectos al cargar: se importa (import { openSheet } from …/dialogs.tsx).
// El montaje en la página, el bloqueo del teclado y la publicación de los globales están en
// dialog-host.tsx, que importa src/entries/app.ts en su lugar.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { useSyncExternalStore, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useLanguage } from '../../react/mount.tsx';
import { ConfirmDialog, type ChoiceOptions, type ConfirmOptions } from './ConfirmDialog.tsx';
import {
  ConfirmSheet,
  Sheet,
  WorkWindow,
  type ConfirmSheetOptions,
  type SheetOptions,
  type WorkWindowOptions,
} from './Sheet.tsx';

declare global {
  var confirmAction: (options: ConfirmOptions) => Promise<boolean>;
  /** Hoja con contenido de React. Se resuelve al cerrarse. */
  var openSheet: (content: ReactNode, options: SheetOptions) => Promise<void>;
  /** Ventana de trabajo con contenido de React. Se resuelve al cerrarse. */
  var openWorkWindow: (content: ReactNode, options: WorkWindowOptions) => Promise<void>;
  /** Confirmación con contenido propio (el aviso de cierre). Se resuelve al cerrarse. */
  var openConfirmSheet: (content: ReactNode, options: ConfirmSheetOptions) => Promise<void>;
  /** Cierra la Hoja o Ventana de React abierta (si hay una). */
  var closeSheet: () => void;
}

interface ConfirmRequest {
  id: number;
  options: ChoiceOptions;
  done: (choice: string | null) => void;
}
interface SheetRequest {
  id: number;
  kind: 'sheet' | 'workspace' | 'confirm';
  content: ReactNode;
  options: SheetOptions | WorkWindowOptions | ConfirmSheetOptions;
  done: () => void;
}

// Estado: la confirmación, la Hoja/Ventana abierta y la Ventana alojada sobre ella (keepModal).
let confirmRequest: ConfirmRequest | null = null;
let sheetRequest: SheetRequest | null = null;
let hostedRequest: SheetRequest | null = null;
let snapshot: {
  confirm: ConfirmRequest | null;
  sheet: SheetRequest | null;
  hosted: SheetRequest | null;
} = {
  confirm: null,
  sheet: null,
  hosted: null,
};
let nextId = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
/** Avisa del cambio; al abrir, dibuja antes de volver (el diálogo queda en la página al instante). */
const update = (sync: boolean) => {
  snapshot = { confirm: confirmRequest, sheet: sheetRequest, hosted: hostedRequest };
  const notify = () => listeners.forEach((listener) => listener());
  if (sync) flushSync(notify);
  else notify();
};

export const DialogHost = () => {
  const { confirm, sheet, hosted } = useSyncExternalStore(subscribe, () => snapshot);
  useLanguage();
  return (
    <>
      {sheet?.kind === 'sheet' ? (
        <Sheet key={sheet.id} options={sheet.options as SheetOptions} onClose={sheet.done}>
          {sheet.content}
        </Sheet>
      ) : null}
      {sheet?.kind === 'workspace' ? (
        <WorkWindow
          key={sheet.id}
          options={sheet.options as WorkWindowOptions}
          onClose={sheet.done}
        >
          {sheet.content}
        </WorkWindow>
      ) : null}
      {sheet?.kind === 'confirm' ? (
        <ConfirmSheet
          key={sheet.id}
          options={sheet.options as ConfirmSheetOptions}
          onClose={sheet.done}
        >
          {sheet.content}
        </ConfirmSheet>
      ) : null}
      {hosted ? (
        <WorkWindow
          key={hosted.id}
          options={hosted.options as WorkWindowOptions}
          onClose={hosted.done}
        >
          {hosted.content}
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
export function askChoice(options: ChoiceOptions): Promise<string | null> {
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
export async function confirmAction({
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
  const keep = kind === 'workspace' && !!(options as WorkWindowOptions).keepModal;
  // Alojada sobre una Hoja de React: la Hoja sigue abierta debajo.
  if (keep && sheetRequest?.kind === 'sheet') {
    if (hostedRequest) hostedRequest.done();
    return new Promise((resolve) => {
      const id = ++nextId;
      hostedRequest = {
        id,
        kind,
        content,
        options,
        done: () => {
          if (hostedRequest?.id === id) {
            hostedRequest = null;
            update(false);
          }
          resolve();
        },
      };
      update(true);
    });
  }
  if (hostedRequest) hostedRequest.done();
  if (sheetRequest) sheetRequest.done();
  return new Promise((resolve) => {
    const id = ++nextId;
    sheetRequest = {
      id,
      kind,
      content,
      options,
      done: () => {
        // Si se cierra la Hoja, la Ventana alojada encima se va con ella.
        if (hostedRequest) hostedRequest.done();
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
export const openConfirmSheet = (content: ReactNode, options: ConfirmSheetOptions) =>
  openDialog('confirm', content, options);
/** Cierra la Hoja o Ventana abierta (y la alojada encima) en el acto: el DOM queda al día al volver. */
export function closeSheet(): void {
  const request = sheetRequest,
    hosted = hostedRequest;
  if (!request && !hosted) return;
  sheetRequest = hostedRequest = null;
  update(true);
  hosted?.done();
  request?.done();
}

/** Contenido de la Hoja o Ventana abierta, o null (al instante, aunque React no haya redibujado). */
export const openSheetContent = (): ReactNode | null => sheetRequest?.content ?? null;
