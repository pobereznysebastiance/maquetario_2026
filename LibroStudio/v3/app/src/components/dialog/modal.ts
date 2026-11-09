// Los tres tipos de diálogo (D4, docs/INTERFAZ_08-nov_decisiones-etapa3.md), con la forma de
// siempre. No tiene efectos al cargar: se importa (import { modal } from …/dialog/modal.ts).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
//   modal.sheet(título, <Contenido />, aplicar, 'Verbo', { size })  Hoja: formulario corto, Cancelar + verbo
//   modal.info(título, <Contenido />, 'Listo', { size })            Hoja que sólo informa: un solo botón
//   modal.workspace(título, <Contenido />, { action })              Ventana de trabajo: casi pantalla
//                                                                  completa; su acción va arriba, junto a la cruz
//   modal.confirm(título, <Contenido />, aplicar, 'Verbo', { extra }) Confirmación con contenido propio
//   confirmAction / askChoice (components/dialog/dialogs.tsx)       Confirmación simple
//
// Todas son React: modal() es la fachada de openSheet / openWorkWindow / openConfirmSheet
// (components/dialog/), así se llaman igual que cuando armaban HTML. Nada de diálogo
// sobre diálogo: abrir una reemplaza a la que esté abierta. modal(título, cuerpo, aplicar,
// etiqueta) sin más es una Hoja mediana con Cancelar.

import type { ReactNode } from 'react';
import type { DialogAction } from './Sheet.tsx';
import { openConfirmSheet, openSheet, openWorkWindow } from './dialogs.tsx';

/** Ancho de la Hoja: sm (formularios de dos o tres campos), md (por defecto), lg (dos columnas). */
type SheetSize = 'sm' | 'md' | 'lg';
export interface DialogOptions {
  /** Ancho de la Hoja (las otras clases tienen el suyo). */
  size?: SheetSize;
  /** Clase del contenido mientras dure la apertura: estilos propios de esa pantalla, no su tamaño. */
  variant?: string;
  /** Texto del botón secundario en lugar de "Cancelar" (por ejemplo, "Ahora no"). */
  cancelLabel?: string;
}
/** Acción de un diálogo: label, run (false lo deja abierto), id y busyLabel (mientras corre). */
type DialogActionOptions = DialogAction;
export interface WorkspaceOptions extends Omit<DialogOptions, 'size' | 'cancelLabel'> {
  /** Acción principal de la ventana (Guardar PDF, Crear libro…), en la barra del título. */
  action?: DialogActionOptions;
  /** id del <dialog> (para las pruebas). */
  id?: string;
}
export interface ConfirmSheetOptions extends Omit<DialogOptions, 'size'> {
  /** Otra salida, a la izquierda (Cerrar sin guardar). */
  extra?: DialogActionOptions & { className?: string };
  /** id del botón del verbo. */
  actionId?: string;
}
/** Cuerpo de un diálogo: un elemento de React. */
export type DialogBody = ReactNode;

/** Hoja: formulario corto con Cancelar y el verbo de la acción. */
const sheet = function (
  title: string,
  body: DialogBody,
  apply: () => unknown,
  label: string,
  options: DialogOptions = {},
): void {
  if (busy) return;
  finishEditing();
  void openSheet(body, { title, action: { label, run: apply }, ...options });
};
/** Hoja que sólo informa (o elige y se cierra sola): un único botón, sin Cancelar. */
const info = function (
  title: string,
  body: DialogBody,
  label: string,
  options: DialogOptions = {},
): void {
  if (busy) return;
  finishEditing();
  void openSheet(body, { title, single: true, action: { label, run: () => true }, ...options });
};
/** Ventana de trabajo: casi pantalla completa, sin pie; se cierra con la cruz. */
const workspace = function (title: string, body: DialogBody, options: WorkspaceOptions = {}): void {
  if (busy) return;
  finishEditing();
  void openWorkWindow(body, { title, ...options });
};
/** Confirmación con contenido propio (el aviso de cierre): sin cruz, el foco en Cancelar. */
const confirm = function (
  title: string,
  body: DialogBody,
  apply: () => unknown,
  label: string,
  options: ConfirmSheetOptions = {},
): Promise<void> {
  finishEditing();
  const { extra, actionId, cancelLabel, variant } = options;
  return openConfirmSheet(body, {
    title,
    action: { label, run: apply, id: actionId },
    extra,
    cancelLabel,
    variant,
  });
};
/** Hoja mediana con Cancelar (la forma de siempre). */
function mediumSheet(
  title: string,
  body: DialogBody,
  apply: () => unknown,
  label = 'Aplicar',
): void {
  modal.sheet(title, body, apply, label);
}
/** modal(título, cuerpo, aplicar, etiqueta) y modal.sheet / .info / .workspace / .confirm. */
export const modal = Object.assign(mediumSheet, { sheet, info, workspace, confirm });
