'use strict';
function showClosePublicationDialog(actions) {
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
        $('#closePublicationError').textContent = e.message;
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
window.requestCloseConfirmation = function () {
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
window.showBusyCloseNotice = function () {
  toast(
    bw(
      'Esperá a que termine la operación antes de cerrar Maquetario.',
      'Wait for the operation to finish before closing Maquetario.',
      'Aguarde a operação terminar antes de fechar o Maquetario.',
    ),
    'warning',
  );
};
window.runNoticeTests = async function () {
  const checks = [],
    check = (ok, msg) => {
      if (!ok) throw Error(msg);
      checks.push(msg);
    };
  let saved = 0,
    discarded = 0,
    cancelled = 0;
  const actions = {
    save: async () => {
      saved++;
      return false;
    },
    discard: () => discarded++,
    cancel: () => cancelled++,
  };
  hideWelcome();
  if ($('#modal').open) $('#modal').close();
  showClosePublicationDialog(actions);
  check(
    $('#modal').classList.contains('close-publication-modal'),
    'Aviso de cierre usa ventana glass',
  );
  check(
    !!$('#discardPublication') && $('#modalApply').textContent.includes('Guardar'),
    'Tres decisiones de cierre disponibles',
  );
  await $('#modalApply').onclick();
  check($('#modal').open && saved === 1, 'Cancelar el guardado conserva el aviso y la publicación');
  $('#modal').close();
  await new Promise((r) => setTimeout(r, 30));
  check(cancelled === 1 && !discarded, 'Cancelar aviso no descarta cambios');
  showClosePublicationDialog(actions);
  $('#discardPublication').click();
  await new Promise((r) => setTimeout(r, 30));
  check(discarded === 1 && cancelled === 1, 'Cerrar sin guardar requiere elección explícita');
  return { ok: true, checks };
};
window.prepareCloseNoticePreview = function () {
  hideWelcome();
  if ($('#modal').open) $('#modal').close();
  showClosePublicationDialog({ save: async () => false, discard: () => {}, cancel: () => {} });
};
