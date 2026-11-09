// Avisos al cerrar Maquetario: la confirmación "¿Guardamos tu libro?" (guardar, cerrar sin
// guardar o cancelar; en React, modal.confirm → openConfirmSheet) y el aviso de que hay una
// operación en curso.
//
// requestCloseConfirmation y showBusyCloseNotice son globales porque los llama el proceso principal
// (desktop/src/main/main.ts) al cerrar la ventana; showClosePublicationDialog, por las pruebas
// (tests/app-notices-tests.js); prepareCloseNoticePreview, por las capturas de estilo.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

/** Qué hacer con cada salida del diálogo de cierre. save devuelve si se guardó. */
export interface CloseActions {
  save: () => Promise<boolean>;
  discard: () => unknown;
  cancel: () => unknown;
}

declare global {
  /** Abre el diálogo de cierre con cambios sin guardar. */
  var showClosePublicationDialog: (actions: CloseActions) => void;
  /** Pregunta antes de cerrar y le avisa al proceso principal qué se eligió. */
  var requestCloseConfirmation: () => void;
  /** Aviso de que hay que esperar a que termine una operación antes de cerrar. */
  var showBusyCloseNotice: () => void;
  /** Muestra el diálogo de cierre sin efectos (para capturas). */
  var prepareCloseNoticePreview: () => void;
}

/** Contenido del aviso: el libro, qué pasa si se guarda y qué si no. */
const CloseNotice = () => (
  <div className="close-publication-message">
    <div>
      <h2 className="user-content">{book.title}</h2>
      <p>
        {bw(
          'Tenés cambios sin guardar. Guardalos para retomar tu trabajo tal como está.',
          'You have unsaved changes. Save them to resume your work exactly as it is.',
          'Você tem alterações não salvas. Salve para retomar seu trabalho como está.',
        )}
      </p>
      <p className="help">
        {bw(
          'Si cerrás sin guardar, se descartan los cambios desde el último guardado.',
          'Closing without saving discards changes since the last save.',
          'Fechar sem salvar descarta as alterações desde o último salvamento.',
        )}
      </p>
    </div>
  </div>
);

/**
 * Confirmación de tres salidas: Cerrar sin guardar, Cancelar y Guardar y cerrar (con el foco en
 * Cancelar). Si guardar no se completa (save devuelve false), el aviso queda abierto; si tira un
 * error, se muestra dentro. Cerrar el aviso de cualquier otra forma es cancelar.
 */
function showClosePublicationDialog(actions: CloseActions): void {
  let settled = false;
  void modal
    .confirm(
      bw('¿Guardamos tu libro?', 'Save your book?', 'Vamos salvar seu livro?'),
      <CloseNotice />,
      async () => {
        const saved = await actions.save();
        if (!saved) return false;
        settled = true;
        return true;
      },
      bw('Guardar y cerrar', 'Save and close', 'Salvar e fechar'),
      {
        actionId: 'savePublication',
        variant: 'close-publication-modal',
        extra: {
          id: 'discardPublication',
          className: 'close-without-save',
          label: bw('Cerrar sin guardar', 'Close without saving', 'Fechar sem salvar'),
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
globalThis.showClosePublicationDialog = showClosePublicationDialog;
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
