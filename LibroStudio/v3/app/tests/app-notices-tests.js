// Pruebas de app-notices.js: sólo se cargan en la autoprueba (test-loader.js), no van en el instalador.

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
