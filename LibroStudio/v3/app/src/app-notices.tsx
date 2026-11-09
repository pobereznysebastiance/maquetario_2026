// Avisos de cambios sin guardar y de cierre.
//
// Un solo aviso para "hay cambios sin guardar" (askUnsaved), el mismo al cerrar Maquetario y al
// abrir, crear, armar o recuperar otro libro: el mismo título y texto, y los mismos botones en el
// mismo orden. A la izquierda, descartar (destructivo, con el verbo del caso: "Cerrar sin
// guardar", "Descartar y abrir"…); Cancelar, con el foco; y guardar como acción principal
// ("Guardar y cerrar", "Guardar y abrir"…). Es una confirmación con contenido (modal.confirm →
// openConfirmSheet): ids #discardPublication, #sheetCancel y #savePublication, clase
// close-publication-modal.
//
// askUnsaved, showClosePublicationDialog, requestCloseConfirmation y showBusyCloseNotice son
// globales: confirmChanges (src/core/project-file.ts) usa askUnsaved; el proceso principal llama a
// requestCloseConfirmation y showBusyCloseNotice al cerrar la ventana; las pruebas
// (tests/app-notices-tests.js), a showClosePublicationDialog; las capturas de estilo, a
// prepareCloseNoticePreview.
//
// Los textos van en castellano con su fila en src/i18n.ts y se traducen al dibujar.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { bw, i18n } from './i18n/language.ts';
import { editor } from './core-api.ts';
import { modal } from './components/dialog/modal.ts';

/** Qué hacer con cada salida del aviso. save devuelve si se guardó (si no, el aviso sigue abierto). */
export interface CloseActions {
  save: () => Promise<boolean>;
  discard: () => unknown;
  cancel: () => unknown;
}

declare global {
  /** Aviso de cambios sin guardar antes de cerrar, abrir, crear, armar o recuperar. */
  var askUnsaved: (intent: UnsavedIntent, actions: CloseActions) => void;
  /** Abre el aviso de cambios sin guardar al cerrar Maquetario. */
  var showClosePublicationDialog: (actions: CloseActions) => void;
  /** Pregunta antes de cerrar y le avisa al proceso principal qué se eligió. */
  var requestCloseConfirmation: () => void;
  /** Aviso de que hay que esperar a que termine una operación antes de cerrar. */
  var showBusyCloseNotice: () => void;
  /** Muestra el aviso de cierre sin efectos (para capturas). */
  var prepareCloseNoticePreview: () => void;
}

const tr = (text: string): string => i18n.tr(text);

/** Los verbos de cada caso: [descartar, guardar]. */
const VERBS: Record<UnsavedIntent, [string, string]> = {
  close: ['Cerrar sin guardar', 'Guardar y cerrar'],
  open: ['Descartar y abrir', 'Guardar y abrir'],
  new: ['Descartar y crear', 'Guardar y crear'],
  build: ['Descartar y armar', 'Guardar y armar'],
  recover: ['Descartar y recuperar', 'Guardar y recuperar'],
  continue: ['Descartar cambios', 'Guardar y continuar'],
};

/** Contenido del aviso: el libro, qué pasa si se guarda y qué si no. */
const UnsavedNotice = ({ closing }: { closing: boolean }) => (
  <div className="close-publication-message">
    <div>
      <h2 className="user-content">{editor.book.title}</h2>
      <p>{tr('Tenés cambios sin guardar. Guardalos para retomar tu trabajo tal como está.')}</p>
      <p className="help">
        {tr(
          closing
            ? 'Si cerrás sin guardar, se descartan los cambios desde el último guardado.'
            : 'Si seguís sin guardar, se descartan los cambios desde el último guardado.',
        )}
      </p>
    </div>
  </div>
);

/**
 * El aviso: descartar · Cancelar (con el foco) · guardar. Si guardar no se completa (save devuelve
 * false), el aviso queda abierto; si tira un error, se muestra dentro. Cerrarlo de cualquier otra
 * forma es cancelar.
 */
function askUnsaved(intent: UnsavedIntent, actions: CloseActions): void {
  const [discardLabel, saveLabel] = VERBS[intent] || VERBS.continue;
  let settled = false;
  void modal
    .confirm(
      '¿Guardamos los cambios de tu libro?',
      <UnsavedNotice closing={intent === 'close'} />,
      async () => {
        const saved = await actions.save();
        if (!saved) return false;
        settled = true;
        return true;
      },
      saveLabel,
      {
        actionId: 'savePublication',
        variant: 'close-publication-modal',
        extra: {
          id: 'discardPublication',
          className: 'danger close-without-save',
          label: discardLabel,
          run: () => {
            settled = true;
            actions.discard();
          },
        },
      },
    )
    .then(() => {
      if (!settled) actions.cancel();
    });
}
globalThis.askUnsaved = askUnsaved;
globalThis.showClosePublicationDialog = (actions) => askUnsaved('close', actions);
globalThis.requestCloseConfirmation = function () {
  showClosePublicationDialog({
    save: async () => {
      const ok = await saveProject();
      if (ok) nativeCall('closeSaved').catch(() => {});
      return ok;
    },
    discard: () => nativeCall('closeDiscard').catch((e) => toast(e.message, 'error')),
    cancel: () => nativeCall('closeCancelled').catch(() => {}),
  });
};
globalThis.showBusyCloseNotice = function () {
  toast(
    bw(
      'Esperá a que termine la operación antes de cerrar Maquetario.',
      'Wait for the operation to finish before closing Maquetario.',
      'Aguarde a operação terminar antes de fechar o Maquetario.',
    ),
    'warning',
  );
};
globalThis.prepareCloseNoticePreview = function () {
  hideWelcome();
  showClosePublicationDialog({ save: async () => false, discard: () => {}, cancel: () => {} });
};

export {};
