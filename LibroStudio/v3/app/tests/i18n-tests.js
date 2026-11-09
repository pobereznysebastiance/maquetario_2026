// Pruebas de i18n.js: sólo se cargan en la autoprueba (test-loader.js), no van en el instalador.

registerIntegrationTest(function (result) {
  const originalBook = JSON.stringify(maquetarioEditor.book);
  for (const lang of ['en', 'pt', 'es']) {
    LibroI18n.set(lang);
    showTab('index');
    LibroI18n.translate();
    // La vista Índice del riel es un botón de ícono: se verifica su nombre accesible traducido.
    const label = $('#railTab-index').getAttribute('aria-label'),
      expected = { es: 'Índice', en: 'Contents', pt: 'Sumário' }[lang];
    if (label !== expected) throw Error('Idioma ' + lang + ': ' + label);
    if (JSON.stringify(maquetarioEditor.book) !== originalBook)
      throw Error('El cambio de idioma modificó el libro');
    result.checks.push('Interfaz ' + lang + ' sin modificar contenido');
  }
  showTab('index');
  LibroI18n.translate();
  showRailView('pages');
  return result;
}, 'i18n');
