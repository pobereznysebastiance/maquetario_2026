// Pruebas de cover-actions.js: sólo se cargan en la autoprueba (test-loader.js), no van en el instalador.

registerIntegrationTest(function (r) {
  const prior = M.clone(book),
    check = (v, m) => {
      if (!v) throw Error(m);
      r.checks.push(m);
    };
  try {
    settingsNew(true);
    const a5 = $('[data-format="A5"]'),
      a4 = $('[data-format="A4"]');
    a4.click();
    a5.click();
    check(
      a5.classList.contains('active') && !a4.classList.contains('active'),
      'Formato A5 queda marcado al seleccionarlo',
    );
    check(
      $('#newWidth').value === '148' && $('#newHeight').value === '210',
      'Formato seleccionado actualiza medidas',
    );
    closeSheet();
    book.cover = defaultCover();
    coverEditor();
    check(
      !!$('#exportCoverVisible') && !!$('#printCoverVisible'),
      'Exportar e imprimir cubierta visibles en pie fijo',
    );
    $('#modal').close();
    check(!$('#modal').open, 'Ventana de cubierta cerrada');
    let out = prepareOutput({ kind: 'cover', crop: true, paper: 'A3', fit: true });
    check(
      out.width === 420 && out.height === 297 && out.scale < 1,
      'Prueba de cubierta reducida a papel A3',
    );
    clearPrint();
    let rejected = false;
    try {
      prepareOutput({ kind: 'cover', crop: true, paper: 'A4', fit: false });
    } catch {
      rejected = true;
    }
    check(rejected, 'No permite cortar cubierta grande en papel A4 a tamaño real');
  } finally {
    clearPrint();
    book = prior;
    render(true);
  }
  return r;
}, 'cover-actions');
