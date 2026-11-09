// Hoja y Ventana de trabajo (D4) en React: Radix Dialog sobre un <dialog> nativo (ver native.ts),
// con el mismo marcado y las mismas clases que #modal (ui/organisms/dialog.css):
//   <dialog data-kind="sheet|workspace" data-size> .dialog-frame
//     .modal-header (título + cruz) · .dialog-body (contenido) · .modal-actions (botones)
// - Hoja: formulario corto con Cancelar y el verbo (o un solo botón si sólo informa: single).
// - Ventana de trabajo: casi pantalla completa, sin pie; su acción va en la barra del título.
// - Confirmación con contenido propio (ConfirmSheet, data-kind="confirm"): sin cruz, el verbo en el
//   botón, el foco en Cancelar y, si hace falta, una tercera salida a la izquierda (el aviso de
//   cierre: "Cerrar sin guardar").
// La acción funciona como en modal(): si devuelve false, el diálogo queda abierto; si tira un
// error, el mensaje se muestra dentro (.inline-error) y el diálogo queda abierto. Mientras corre
// (una acción async), los botones quedan deshabilitados, el principal puede mostrar busyLabel
// ("Componiendo…") y el diálogo no se cierra con Escape ni con la cruz.
// Se abren con openSheet / openWorkWindow (dialogs.tsx), o con modal.sheet/info/workspace
// pasándoles un elemento de React en lugar de HTML.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { useRef, useState, type ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import { Icon } from '../Icon.tsx';
import { useLanguage } from '../../react/mount.tsx';
import { dialogLayer, showModalOnMount } from './native.ts';

export type SheetSize = 'sm' | 'md' | 'lg';

export interface DialogAction {
  label: string;
  /** id del botón, para quien tenga que habilitarlo o deshabilitarlo (por ejemplo, #outputApply). */
  id?: string;
  /** Devuelve false (o una promesa de false) para dejar el diálogo abierto. */
  run: () => unknown;
  /** Texto del botón mientras la acción corre (por ejemplo, "Componiendo…"). */
  busyLabel?: string;
}

export interface ConfirmSheetOptions {
  title: string;
  id?: string;
  /** El verbo (Guardar y cerrar…). */
  action: DialogAction;
  /** Otra salida, a la izquierda (Cerrar sin guardar). className le da su aspecto. */
  extra?: DialogAction & { className?: string };
  /** Texto del botón secundario en lugar de "Cancelar". */
  cancelLabel?: string;
  variant?: string;
}

export interface SheetOptions {
  title: string;
  /** id del <dialog> (para las pruebas y la autoprueba). */
  id?: string;
  /** Verbo del botón principal (Aplicar, Guardar…). Sin action, la Hoja sólo informa. */
  action?: DialogAction;
  /** Hoja que sólo informa: un único botón (action.label, o "Listo"), sin Cancelar. */
  single?: boolean;
  /** Texto del botón secundario en lugar de "Cancelar". */
  cancelLabel?: string;
  size?: SheetSize;
  /** Clase de la pantalla (estilos propios de su contenido, no su tamaño). */
  variant?: string;
}

export interface WorkWindowOptions {
  title: string;
  /** id del <dialog> (para las pruebas y la autoprueba). */
  id?: string;
  /**
   * No cerrar la Hoja abierta (#modal o una Hoja de React): la Ventana queda alojada encima y ocupa
   * su lugar (el explorador de fuentes abierto desde el estilo de párrafo). Quien abre se ocupa de
   * esconder el contenido de la Hoja mientras tanto (data-hosting en su <dialog>).
   */
  keepModal?: boolean;
  /** Acción principal, en la barra del título (Guardar PDF…). Sin ella, sólo la cruz. */
  action?: DialogAction;
  /** Otros botones de la barra del título, antes de la acción principal (cubierta: exportar, imprimir). */
  extraActions?: ReactNode;
  variant?: string;
}

/** Botones de la barra: run corre una acción; running dice si hay una en curso. */
type ActionsRenderer = (
  run: (action: DialogAction) => void,
  close: () => void,
  running: boolean,
) => ReactNode;

interface FrameProps {
  kind: 'sheet' | 'workspace' | 'confirm';
  id?: string;
  title: string;
  size?: SheetSize;
  variant?: string;
  children: ReactNode;
  /** Botones del pie (o de la barra del título en la Ventana de trabajo). */
  actions: ActionsRenderer;
  onClose: () => void;
}

/** Texto del botón de una acción: el de mientras corre, si lo tiene. */
const actionLabel = (action: DialogAction, running: boolean) =>
  LibroI18n.tr(running && action.busyLabel ? action.busyLabel : action.label);

/** Marco común: <dialog> nativo + Radix Dialog, cabecera con cruz, cuerpo y barra de acciones. */
const DialogFrame = ({
  kind,
  id,
  title,
  size,
  variant,
  children,
  actions,
  onClose,
}: FrameProps) => {
  // Los textos que pasa quien llama llegan en castellano: se traducen acá (el traductor del DOM no
  // entra en lo que dibuja React).
  useLanguage();
  const dialog = useRef<HTMLDialogElement | null>(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  // También en una ref: el clic siguiente llega antes de que React vuelva a dibujar.
  const busy = useRef(false);
  const close = () => {
    if (!busy.current) dialog.current?.close();
  };
  const run = async (action: DialogAction) => {
    if (busy.current) return;
    busy.current = true;
    setRunning(true);
    let done = false;
    try {
      setError('');
      done = (await action.run()) !== false;
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      busy.current = false;
      setRunning(false);
    }
    if (done) close();
  };
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Dialog.Portal container={dialogLayer}>
        <Dialog.Content
          asChild
          aria-describedby={undefined}
          // Con una acción en curso no se cierra (Escape).
          onEscapeKeyDown={(event) => {
            if (busy.current) event.preventDefault();
          }}
        >
          <dialog
            tabIndex={-1}
            id={id}
            data-kind={kind}
            data-size={kind === 'sheet' ? size || 'md' : undefined}
            className={variant}
            ref={(element) => {
              dialog.current = element;
              // showModal() deja el foco en el primer control (la cruz) y Radix no lo mueve si ya
              // está adentro. Va al diálogo: no se ve un anillo de foco sin motivo y el primer Tab
              // lleva al primer control, como en una ventana de macOS. En una confirmación va a
              // Cancelar ([data-initial-focus]): Enter nunca descarta por accidente.
              if (element && !element.open) {
                showModalOnMount(element);
                (element.querySelector<HTMLElement>('[data-initial-focus]') || element).focus();
              }
            }}
            // Escape del <dialog> nativo: con una acción en curso, tampoco.
            onCancel={(event) => {
              if (busy.current) event.preventDefault();
            }}
            onClose={onClose}
          >
            <div className="dialog-frame">
              <div className="modal-header">
                <div>
                  <Dialog.Title asChild>
                    <h1>{LibroI18n.tr(title)}</h1>
                  </Dialog.Title>
                </div>
                {kind === 'confirm' ? null : (
                  <Dialog.Close
                    className="icon-btn"
                    aria-label={bw('Cerrar', 'Close', 'Fechar')}
                    disabled={running}
                  >
                    <Icon name="close" />
                  </Dialog.Close>
                )}
              </div>
              <div className="dialog-body">
                {children}
                {error ? <p className="inline-error">{LibroI18n.tr(error)}</p> : null}
              </div>
              <div className="modal-actions">{actions(run, close, running)}</div>
            </div>
          </dialog>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export const Sheet = ({
  options,
  children,
  onClose,
}: {
  options: SheetOptions;
  children: ReactNode;
  onClose: () => void;
}) => {
  const { id, title, action, single, cancelLabel, size, variant } = options;
  const informs = single || !action;
  return (
    <DialogFrame
      kind="sheet"
      id={id}
      title={title}
      size={size}
      variant={variant}
      onClose={onClose}
      actions={(run, close, running) => (
        <>
          {informs ? null : (
            <button
              type="button"
              className="btn"
              id="sheetCancel"
              disabled={running}
              onClick={close}
            >
              {cancelLabel ? LibroI18n.tr(cancelLabel) : bw('Cancelar', 'Cancel', 'Cancelar')}
            </button>
          )}
          <button
            type="button"
            id={action?.id || 'sheetApply'}
            className="btn primary"
            disabled={running}
            onClick={() => (action ? run(action) : close())}
          >
            {action?.label ? actionLabel(action, running) : bw('Listo', 'Done', 'Pronto')}
          </button>
        </>
      )}
    >
      {children}
    </DialogFrame>
  );
};

export const WorkWindow = ({
  options,
  children,
  onClose,
}: {
  options: WorkWindowOptions;
  children: ReactNode;
  onClose: () => void;
}) => {
  const { id, title, action, extraActions, variant } = options;
  return (
    <DialogFrame
      kind="workspace"
      id={id}
      title={title}
      variant={variant}
      onClose={onClose}
      actions={(run, _close, running) => (
        <>
          {extraActions}
          {action ? (
            <button
              type="button"
              id={action.id}
              className="btn primary"
              disabled={running}
              onClick={() => run(action)}
            >
              {actionLabel(action, running)}
            </button>
          ) : null}
        </>
      )}
    >
      {children}
    </DialogFrame>
  );
};

/** Confirmación con contenido propio: sin cruz, Cancelar con el foco, el verbo y otra salida opcional. */
export const ConfirmSheet = ({
  options,
  children,
  onClose,
}: {
  options: ConfirmSheetOptions;
  children: ReactNode;
  onClose: () => void;
}) => {
  const { id, title, action, extra, cancelLabel, variant } = options;
  return (
    <DialogFrame
      kind="confirm"
      id={id}
      title={title}
      variant={variant}
      onClose={onClose}
      actions={(run, close, running) => (
        <>
          {extra ? (
            <button
              type="button"
              id={extra.id}
              className={extra.className ? 'btn ' + extra.className : 'btn'}
              disabled={running}
              onClick={() => run(extra)}
            >
              {actionLabel(extra, running)}
            </button>
          ) : null}
          <button
            type="button"
            className="btn"
            id="sheetCancel"
            data-initial-focus=""
            disabled={running}
            onClick={close}
          >
            {cancelLabel ? LibroI18n.tr(cancelLabel) : bw('Cancelar', 'Cancel', 'Cancelar')}
          </button>
          <button
            type="button"
            id={action.id || 'sheetApply'}
            className="btn primary"
            disabled={running}
            onClick={() => run(action)}
          >
            {actionLabel(action, running)}
          </button>
        </>
      )}
    >
      {children}
    </DialogFrame>
  );
};
