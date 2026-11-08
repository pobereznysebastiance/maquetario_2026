// Pruebas de fonts.js: sólo se cargan en la autoprueba (test-loader.js), no van en el instalador.

window.runFontIntegrationTests = async function () {
  await fontCatalogPromise;
  const checks = [],
    assert = (v, m) => {
      if (!v) throw Error(m);
      checks.push(m);
    };
  assert(nativeFaces.length > 0, 'Fuentes locales detectadas');
  const variable = nativeFaces.find((f) => f.axes.some((a) => a.tag === 'wght'));
  assert(!!variable, 'Fuente variable real detectada');
  const families = new Set(nativeFaces.map((f) => f.family));
  assert(families.size > 0, 'Familias agrupadas');
  const face = variable || nativeFaces[0];
  await ensureFace(face);
  const collectionFace = nativeFaces.find((f) => f.family === 'Cambria Math');
  if (collectionFace) {
    await ensureFace(collectionFace);
    assert(
      document.fonts.check('16px \"MQT_' + collectionFace.id + '\"'),
      'Colección TTC cargada correctamente',
    );
  }
  assert(document.fonts.check('16px "MQT_' + face.id + '"'), 'Archivo local cargado por Chromium');
  let original = M.clone(book);
  active = 0;
  selected = book.pages[0].objects.find((o) => o.type === 'text').id;
  await applyFace(selectObject(), face, face.instances[0]);
  const saved = M.validate(JSON.parse(JSON.stringify(book)));
  assert(saved.pages[0].objects[0].fontFaceId === face.id, 'Peso y estilo conservados al guardar');
  if (face.axes.length) {
    assert(
      Object.keys(saved.pages[0].objects[0].fontAxes).length === face.axes.length,
      'Ejes variables conservados',
    );
  }
  showTab('text');
  assert(!!$('#fontVariant') && !!$('#addFontFolder'), 'Selector de estilos y carpetas visible');
  renderPages();
  assert(
    $('#spread .paper-object.text').style.fontFamily.includes('MQT_'),
    'Estilo real aplicado a la página',
  );
  window.fontTestBook = M.clone(book);
  book = original;
  selected = null;
  dirty = false;
  syncNative();
  render(true);
  return {
    checks,
    families: families.size,
    faces: nativeFaces.length,
    variableFonts: nativeFaces.filter((f) => f.axes.length).length,
    variableTestFamily: face.family,
    axes: face.axes,
  };
};

window.prepareFontPdfTest = async function () {
  await ensureFace(
    nativeFaces.find((f) => f.id === window.fontTestBook.pages[0].objects[0].fontFaceId),
  );
  book = M.clone(window.fontTestBook);
  preparePrint();
  await ensureBookFonts();
  return true;
};
