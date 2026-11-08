// Avisos al cerrar Maquetario: el diálogo "¿Guardamos tu publicación?" (guardar, cerrar sin
// guardar o cancelar) y el aviso de que hay una operación en curso.
//
// requestCloseConfirmation y showBusyCloseNotice son globales porque los llama el proceso principal
// (desktop/src/main/main.ts) al cerrar la ventana; showClosePublicationDialog, por las pruebas
// (tests/app-notices-tests.js); prepareCloseNoticePreview, por las capturas de estilo.
//
// Fuente TypeScript: se compila a build/app-notices.js (desktop/scripts/build.mjs).

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

function showClosePublicationDialog(actions: CloseActions): void {
  if ($('#modal').open) $('#modal').close();
  let settled = false,
    saving = false;
  modal(
    bw('¿Guardamos tu publicación?', 'Save your publication?', 'Vamos salvar sua publicação?'),
    `<div class="close-publication-message"><div class="close-publication-symbol">${icon('save')}</div><div><h2 class="user-content">${esc(book.title)}</h2><p>${bw('Tenés cambios sin guardar. Guardalos para retomar tu trabajo tal como está.', 'You have unsaved changes. Save them to resume your work exactly as it is.', 'Você tem alterações não salvas. Salve para retomar seu trabalho como está.')}</p><p class="help">${bw('Si cerrás sin guardar, se descartan los cambios desde el último guardado.', 'Closing without saving discards changes since the last save.', 'Fechar sem salvar descarta as alterações desde o último salvamento.')}</p></div></div><p id="closePublicationError" class="inline-error"></p>`,
    async () => {
      if (saving) return false;
      saving = true;
      $('#modalApply').disabled = true;
      $('#discardPublication').disabled = true;
      try {
        const saved = await actions.save();
        if (!saved) return false;
        settled = true;
        return true;
      } catch (e) {
        $('#closePublicationError').textContent = (e as Error).message;
        return false;
      } finally {
        saving = false;
        $('#modalApply').disabled = false;
        if ($('#discardPublication')) $('#discardPublication').disabled = false;
      }
    },
    bw('Guardar y cerrar', 'Save and close', 'Salvar e fechar'),
    'MAQUETARIO · ' + bw('TU TRABAJO', 'YOUR WORK', 'SEU TRABALHO'),
  );
  dialogVariant('close-publication-modal');
  const discard = document.createElement('button');
  discard.type = 'button';
  discard.id = 'discardPublication';
  discard.className = 'btn close-without-save';
  discard.textContent = bw('Cerrar sin guardar', 'Close without saving', 'Fechar sem salvar');
  discard.onclick = () => {
    if (saving) return;
    settled = true;
    actions.discard();
    $('#modal').close();
  };
  $('#modal .modal-actions').prepend(discard);
  onDialogClose(() => {
    discard.remove();
    if (!settled) actions.cancel();
  });
  const cancel = $('#modal .modal-actions button[value="cancel"]');
  if (cancel) {
    cancel.textContent = bw('Cancelar', 'Cancel', 'Cancelar');
    cancel.focus();
  }
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
  if ($('#modal').open) $('#modal').close();
  showClosePublicationDialog({ save: async () => false, discard: () => {}, cancel: () => {} });
};

export {};
