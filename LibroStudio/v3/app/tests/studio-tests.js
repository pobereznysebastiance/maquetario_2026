// Pruebas del núcleo (src/core/): sólo se cargan en la autoprueba (test-loader.js), no van en el instalador.

window.runIntegrationTests = function () {
  const checks = [];
  const assert = (v, msg) => {
    if (!v) throw Error(msg);
    checks.push(msg);
  };
  assert(M.validate(M.create()).pages.length === 6, 'Proyecto demo válido');
  assert(
    JSON.stringify(M.impose(16)) === '[[15,0],[1,14],[13,2],[3,12],[11,4],[5,10],[9,6],[7,8]]',
    'Imposición de 16 páginas',
  );
  let b = M.create();
  b.grid.fit = 'page';
  assert(M.gridRect(b, 0).w === 148, 'Grilla al borde');
  b.grid.fit = 'margins';
  assert(M.gridRect(b, 0).w === 108, 'Grilla a márgenes');
  b.pages[2].section = 'Segundo capítulo';
  assert(M.sectionAt(b, 5) === 'Segundo capítulo', 'Sección propagada automáticamente');
  b.pages[2].hideHeader = true;
  assert(M.auto(b, 2, 'header') === null, 'Excepción de cornisa');
  const old = maquetarioEditor.book.grid.cols;
  snapshot();
  maquetarioEditor.book.grid.cols = 2;
  undo();
  assert(maquetarioEditor.book.grid.cols === old, 'Deshacer configuración');
  redo();
  assert(maquetarioEditor.book.grid.cols === 2, 'Rehacer configuración');
  undo();
  maquetarioEditor.dirty = false;
  syncNative();
  maquetarioEditor.undoStack = [];
  maquetarioEditor.redoStack = [];
  render(true);
  // En el riel sólo van las herramientas que actúan sobre la página.
  const railTools = $$('#tools .tool')
    .map((b) => b.dataset.tool)
    .join(',');
  assert(
    railTools === 'select,hand,text,image,frame,shape',
    'Riel con las seis herramientas del lienzo (sin grilla, foliado, cornisa, índice, capas ni cubierta)',
  );
  assert(!!$('.documentbar #coverTool'), 'Cubierta en la barra del documento');
  assert($$('.page').length === 2, 'Páginas enfrentadas');
  assert($$('.auto-folio').length === 2, 'Foliado en ambas páginas');
  let serialized = JSON.stringify(maquetarioEditor.book);
  assert(
    M.validate(JSON.parse(serialized)).pages[1].objects[0].src.startsWith('data:image/'),
    'Imagen conservada al guardar',
  );
  return JSON.stringify({ ok: true, checks, version: 3 });
};
