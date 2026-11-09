// Hoja y Ventana de trabajo (D4) en React: Radix Dialog sobre un <dialog> nativo (ver native.ts),
// con el mismo marcado y las mismas clases que #modal (ui/organisms/dialog.css):
//   <dialog data-kind="sheet|workspace" data-size> .dialog-frame
//     .modal-header (título + cruz) · .dialog-body (contenido) · .modal-actions (botones)
// - Hoja: formulario corto con Cancelar y el verbo (o un solo botón si sólo informa: single).
// - Ventana de trabajo: casi pantalla completa, sin pie; su acción va en la barra del título.
// La acción funciona como en modal(): si devuelve false, el diálogo queda abierto; si tira un
// error, el mensaje se muestra dentro (.inline-error) y el diálogo queda abierto.
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
   * No cerrar #modal al abrir: la Ventana queda encima de una Hoja que todavía es HTML y ocupa su
   * lugar (el explorador de fuentes abierto desde el estilo de párrafo). Quien abre se ocupa de
   * esconder el contenido de la Hoja mientras tanto.
   */
  keepModal?: boolean;
  /** Acción principal, en la barra del título (Guardar PDF…). Sin ella, sólo la cruz. */
  action?: DialogAction;
  variant?: string;
}

interface FrameProps {
  kind: 'sheet' | 'workspace';
  id?: string;
  title: string;
  size?: SheetSize;
  variant?: string;
  children: ReactNode;
  /** Botones del pie (o de la barra del título en la Ventana de trabajo). */
  actions: (run: (action: DialogAction) => void, close: () => void) => ReactNode;
  onClose: () => void;
}

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
  const close = () => dialog.current?.close();
  const run = async (action: DialogAction) => {
    try {
      setError('');
      if ((await action.run()) !== false) close();
    } catch (problem) {
      setError((problem as Error).message);
    }
  };
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Dialog.Portal container={dialogLayer}>
        <Dialog.Content asChild aria-describedby={undefined}>
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
              // lleva al primer control, como en una ventana de macOS.
              if (element && !element.open) {
                showModalOnMount(element);
                element.focus();
              }
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
                <Dialog.Close className="icon-btn" aria-label={bw('Cerrar', 'Close', 'Fechar')}>
                  <Icon name="close" />
                </Dialog.Close>
              </div>
              <div className="dialog-body">
                {children}
                {error ? <p className="inline-error">{LibroI18n.tr(error)}</p> : null}
              </div>
              <div className="modal-actions">{actions(run, close)}</div>
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
      actions={(run, close) => (
        <>
          {informs ? null : (
            <button type="button" className="btn" id="sheetCancel" onClick={close}>
              {cancelLabel ? LibroI18n.tr(cancelLabel) : bw('Cancelar', 'Cancel', 'Cancelar')}
            </button>
          )}
          <button
            type="button"
            id={action?.id || 'sheetApply'}
            className="btn primary"
            onClick={() => (action ? run(action) : close())}
          >
            {action?.label ? LibroI18n.tr(action.label) : bw('Listo', 'Done', 'Pronto')}
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
  const { id, title, action, variant } = options;
  return (
    <DialogFrame
      kind="workspace"
      id={id}
      title={title}
      variant={variant}
      onClose={onClose}
      actions={(run) =>
        action ? (
          <button type="button" id={action.id} className="btn primary" onClick={() => run(action)}>
            {LibroI18n.tr(action.label)}
          </button>
        ) : null
      }
    >
      {children}
    </DialogFrame>
  );
};
