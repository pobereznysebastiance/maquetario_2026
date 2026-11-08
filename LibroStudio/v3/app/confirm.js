// Confirmaciones: "¿Seguro que querés…?" para acciones que pierden trabajo.
// Diálogo propio (no #modal), para poder confirmar también desde dentro de otro diálogo.
//
//   const ok = await confirmAction({ title, message, confirmLabel, danger: true });
//   const choice = await askChoice({ title, message, actions: [{ id, label, variant }] });
//
// En acciones destructivas el foco arranca en "Cancelar": Enter nunca borra por accidente.
(function () {
  'use strict';

  const dialog = document.createElement('dialog');
  dialog.id = 'confirmDialog';
  dialog.className = 'confirm-dialog';
  dialog.innerHTML =
    '<form method="dialog" class="confirm-form"><h2 class="confirm-title"></h2><p class="confirm-message"></p><div class="confirm-actions"></div></form>';
  document.body.append(dialog);

  // Mientras la confirmación está abierta, ni el teclado ni los clics llegan a los atajos de la app
  // (Escape, Enter, Suprimir, letras de herramientas…). Lo propio del diálogo sigue funcionando:
  // Tab, Enter sobre el botón con foco y Escape para cancelar son acciones nativas, no oyentes.
  window.addEventListener(
    'keydown',
    (event) => {
      if (dialog.open) event.stopImmediatePropagation();
    },
    true,
  );
  for (const type of ['click', 'pointerdown', 'mousedown', 'mouseup', 'dblclick']) {
    dialog.addEventListener(type, (event) => event.stopPropagation());
  }

  const cancelText = () => bw('Cancelar', 'Cancel', 'Cancelar');

  /**
   * Muestra una pregunta con varias salidas. Devuelve el id elegido, o null si se canceló (Esc incluido).
   * variant: 'primary' | 'danger' | 'secondary'
   */
  function askChoice({ title, message, actions, cancelLabel }) {
    // La autoprueba no puede contestar diálogos: elige la primera acción.
    if (window.maquetarioSelfTest) return Promise.resolve(actions[0]?.id ?? null);
    if (dialog.open) dialog.close('');
    dialog.querySelector('.confirm-title').textContent = title;
    dialog.querySelector('.confirm-message').textContent = message || '';
    dialog.querySelector('.confirm-message').hidden = !message;
    const bar = dialog.querySelector('.confirm-actions');
    bar.replaceChildren();
    const cancel = document.createElement('button');
    cancel.value = '';
    cancel.className = 'btn';
    cancel.textContent = cancelLabel || cancelText();
    bar.append(cancel);
    for (const action of actions) {
      const button = document.createElement('button');
      button.value = action.id;
      button.className =
        `btn ${action.variant === 'danger' ? 'danger' : action.variant === 'primary' ? 'primary' : ''}`.trim();
      button.textContent = action.label;
      bar.append(button);
    }
    return new Promise((resolve) => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue || null), { once: true });
      dialog.returnValue = '';
      dialog.showModal();
      const destructive = actions.some((a) => a.variant === 'danger');
      (destructive ? cancel : bar.lastElementChild).focus();
    });
  }

  /** Sí/No para una acción. Con danger:true el botón es de peligro y el foco queda en Cancelar. */
  async function confirmAction({ title, message, confirmLabel, danger = false, cancelLabel }) {
    const choice = await askChoice({
      title,
      message,
      cancelLabel,
      actions: [{ id: 'confirm', label: confirmLabel, variant: danger ? 'danger' : 'primary' }],
    });
    return choice === 'confirm';
  }

  window.askChoice = askChoice;
  window.confirmAction = confirmAction;
})();
