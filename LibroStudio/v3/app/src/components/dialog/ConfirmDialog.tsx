// Confirmación (D4): una pregunta, el verbo en el botón, sin cruz. Radix AlertDialog sobre un
// <dialog> nativo (ver native.ts). Es #confirmDialog, con data-kind="confirm" (ui/organisms/dialog.css).
//
// Los botones son de un <form method="dialog">: al tocarlos, el <dialog> se cierra con su value
// (el id de la acción; "" es Cancelar) y Escape lo cierra con "". La respuesta sale del evento
// close. Mientras está abierta, ni el teclado ni los clics llegan a los atajos de la app (lo hace
// el servicio, dialogs.tsx).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { useRef } from 'react';
import { AlertDialog } from 'radix-ui';
import { useLanguage } from '../../react/mount.tsx';
import { dialogLayer, showModalOnMount } from './native.ts';
import { bw, i18n } from '../../i18n/language.ts';

export type ChoiceVariant = 'primary' | 'danger' | 'secondary';

export interface ChoiceAction {
  id: string;
  label: string;
  variant?: ChoiceVariant;
}

export interface ChoiceOptions {
  title: string;
  message?: string;
  actions: ChoiceAction[];
  cancelLabel?: string;
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  danger?: boolean;
  cancelLabel?: string;
}

/** Los clics no salen de la confirmación (los atajos y el lienzo escuchan más arriba). */
const isolate = (element: HTMLDialogElement | null): void => {
  if (!element || element.dataset.isolated) return;
  element.dataset.isolated = '';
  for (const type of ['click', 'pointerdown', 'mousedown', 'mouseup', 'dblclick'])
    element.addEventListener(type, (event) => event.stopPropagation());
};

export const ConfirmDialog = ({
  options,
  onClose,
}: {
  options: ChoiceOptions;
  /** El id elegido, o null si se canceló (Escape incluido). */
  onClose: (choice: string | null) => void;
}) => {
  // Los textos llegan en castellano desde el resto de la app; el traductor del DOM no entra en
  // lo que dibuja React (data-react), así que se traducen acá.
  useLanguage();
  const tr = (text: string) => i18n.tr(text);
  const { title, message, actions, cancelLabel } = options;
  const dialog = useRef<HTMLDialogElement | null>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const last = useRef<HTMLButtonElement>(null);
  // En acciones destructivas el foco arranca en Cancelar: Enter nunca borra por accidente.
  const destructive = actions.some((action) => action.variant === 'danger');
  return (
    <AlertDialog.Root
      open
      onOpenChange={(open) => {
        if (!open) dialog.current?.close('');
      }}
    >
      <AlertDialog.Portal container={dialogLayer}>
        <AlertDialog.Content
          asChild
          // Sin mensaje no hay descripción: se lo decimos a Radix para que no la reclame.
          {...(message ? {} : { 'aria-describedby': undefined })}
          // El foco inicial lo pone el ref (abajo): showModal() ya lo deja dentro del diálogo y
          // Radix no lo mueve.
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <dialog
            id="confirmDialog"
            className="confirm-dialog"
            data-kind="confirm"
            ref={(element) => {
              dialog.current = element;
              isolate(element);
              if (element && !element.open) {
                showModalOnMount(element);
                (destructive ? cancel : last).current?.focus();
              }
            }}
            onClose={(event) => onClose(event.currentTarget.returnValue || null)}
          >
            <form method="dialog" className="confirm-form">
              <AlertDialog.Title className="confirm-title">{tr(title)}</AlertDialog.Title>
              {message ? (
                <AlertDialog.Description className="confirm-message">
                  {message && tr(message)}
                </AlertDialog.Description>
              ) : null}
              <div className="confirm-actions">
                <button value="" className="btn" ref={cancel}>
                  {cancelLabel ? tr(cancelLabel) : bw('Cancelar', 'Cancel', 'Cancelar')}
                </button>
                {actions.map((action, index) => (
                  <button
                    key={action.id}
                    value={action.id}
                    className={
                      action.variant === 'danger'
                        ? 'btn danger'
                        : action.variant === 'primary'
                          ? 'btn primary'
                          : 'btn'
                    }
                    ref={index === actions.length - 1 ? last : undefined}
                  >
                    {tr(action.label)}
                  </button>
                ))}
              </div>
            </form>
          </dialog>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};
