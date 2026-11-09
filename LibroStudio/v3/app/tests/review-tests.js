'use strict';
extend.instead(
  'saveProject',
  () => !maquetarioEditor.hasDocument,
  async () => {
    settings(true);
    return false;
  },
  'review-tests',
);
$('#save').onclick = saveProject;
$('#documentSettings').onclick = () => settings(!maquetarioEditor.hasDocument);
extend.instead(
  'outputDialog',
  () => !maquetarioEditor.hasDocument,
  () => {
    settings(true);
  },
  'review-tests',
);
extend.before(
  'runIntegrationTests',
  () => {
    maquetarioEditor.hasDocument = true;
    refreshEmptyCanvas();
  },
  'review-tests',
);
registerIntegrationTest(function (result) {
  const check = (ok, msg) => {
    if (!ok) throw Error(msg);
    result.checks.push(msg);
  };
  const original = M.clone(maquetarioEditor.book),
    priorActive = maquetarioEditor.active,
    priorSpread = maquetarioEditor.spread;
  maquetarioEditor.hasDocument = true;
  maquetarioEditor.active = 1;
  maquetarioEditor.spread = 0;
  render(true);
  check(!!$('#spread .page[data-page="1"].is-page-active'), 'Página individual activa resaltada');
  check(
    !!$('.thumb-paper[data-individual-page="1"].thumb-page-active'),
    'Miniatura individual resaltada',
  );
  showTab('pages');
  check(
    $('.active-page-notice strong').textContent.includes('2'),
    'Panel identifica página activa 2',
  );
  maquetarioEditor.active = 0;
  maquetarioEditor.selected = maquetarioEditor.book.pages[0].objects.find(
    (o) => o.type === 'text',
  ).id;
  objectAlignReference = 'margins';
  alignSelection('right');
  const object = selectObject(),
    m = M.margins(maquetarioEditor.book, 0);
  check(
    Math.abs(object.x + object.w - (maquetarioEditor.book.width - m.right)) < 1e-6,
    'Alineación de objetos al margen derecho',
  );
  maquetarioEditor.book = M.clone(original);
  maquetarioEditor.active = 0;
  maquetarioEditor.selected = maquetarioEditor.book.pages[0].objects.find(
    (o) => o.type === 'text',
  ).id;
  const target = selectObject();
  target.text = 'Primer párrafo\nSegundo párrafo';
  maquetarioEditor.paragraphScope = { id: target.id, index: 0 };
  maquetarioEditor.book.paragraphStyles = [
    {
      id: 'style-test',
      name: 'Prueba de estilo',
      properties: { align: 'justify', size: 18, leading: 24, firstIndent: 3, spaceAfter: 2 },
    },
  ];
  applyParagraphStyle('style-test');
  check(
    paragraphFormat(maquetarioEditor.book, target, 0).size === 18 &&
      paragraphFormat(maquetarioEditor.book, target, 1).size === target.size,
    'Estilo aplicado solo al párrafo elegido',
  );
  maquetarioEditor.book.paragraphStyles[0].properties.size = 20;
  check(
    paragraphFormat(maquetarioEditor.book, target, 0).size === 20,
    'Cambiar estilo actualiza párrafo vinculado',
  );
  paragraphPatch({ align: 'center' });
  check(
    paragraphFormat(maquetarioEditor.book, target, 0).align === 'center',
    'Ajuste local de alineación',
  );
  const secondLeading = paragraphFormat(maquetarioEditor.book, target, 1).leading;
  commit(() => (target.leading = 30), false);
  check(
    paragraphFormat(maquetarioEditor.book, target, 0).leading === 30 &&
      paragraphFormat(maquetarioEditor.book, target, 1).leading === secondLeading,
    'Formato directo afecta solo al párrafo elegido',
  );
  const roundTrip = M.validate(JSON.parse(JSON.stringify(maquetarioEditor.book)));
  check(
    roundTrip.paragraphStyles[0].name === 'Prueba de estilo' &&
      roundTrip.pages[0].objects[0].paragraphMap[0].styleId === 'style-test',
    'Estilos y vínculos guardados en el proyecto',
  );
  const p = paper(0, 2, true);
  check(p.querySelectorAll('.mqt-paragraph').length >= 2, 'Párrafos separados en salida');
  check(
    p.querySelector('.mqt-paragraph').style.textAlign === 'center',
    'Alineación de párrafo en salida',
  );
  let map = syncParagraphMap('A\nB', 'A\nX\nB', [{ styleId: 'a' }, { styleId: 'b' }]);
  check(map[2].styleId === 'b', 'Edición conserva estilo del párrafo posterior');
  maquetarioEditor.book = M.clone(original);
  maquetarioEditor.active = 0;
  maquetarioEditor.spread = 0;
  maquetarioEditor.selected = null;
  maquetarioEditor.paragraphScope = { id: null, index: -1 };
  maquetarioEditor.hasDocument = true;
  outputDialog('pdf');
  check(
    !!$('#reviewNext') && $('#reviewFaceInput').max === '6',
    'Navegación en seis páginas de lectura',
  );
  $('#reviewNext').click();
  check($('#reviewFaceInput').value === '2', 'Flecha avanza la previsualización');
  $('#reviewLast').click();
  check(
    $('#reviewFaceInput').value === '6' && $('#reviewNext').disabled,
    'Última página y límite de navegación',
  );
  $('#outMode').value = 'booklet';
  $('#outPaper').value = 'A4';
  outputPreview();
  check($('#reviewFaceInput').max === '4', 'Navegación de caras de cuadernillo');
  closeOutputWindow();
  maquetarioEditor.book = original;
  maquetarioEditor.active = priorActive;
  maquetarioEditor.spread = priorSpread;
  maquetarioEditor.selected = null;
  maquetarioEditor.multiSelection.clear();
  maquetarioEditor.paragraphScope = { id: null, index: -1 };
  maquetarioEditor.hasDocument = true;
  maquetarioEditor.dirty = false;
  maquetarioEditor.undoStack = [];
  maquetarioEditor.redoStack = [];
  syncNative();
  render(true);
  return result;
}, 'review-tests');
window.prepareOutputReviewPreview = function () {
  closeTutorial();
  maquetarioEditor.hasDocument = true;
  outputDialog('pdf');
  $('#outMode').value = 'booklet';
  $('#outPaper').value = 'A4';
  outputPreview();
  reviewFace = 1;
  outputPreview();
};

window.prepareParagraphPdfTest = function () {
  const original = M.clone(maquetarioEditor.book),
    o = M.text('Estilo vinculado\nSegundo párrafo', 20, 40, 108, 100, 12);
  maquetarioEditor.book.paragraphStyles = [
    {
      id: 'pdf-style',
      name: 'Estilo de prueba PDF',
      properties: { font: 'Georgia', size: 22, leading: 28, align: 'right', spaceAfter: 3 },
    },
  ];
  o.paragraphMap = [
    { styleId: 'pdf-style', overrides: {} },
    { styleId: null, overrides: { font: 'Georgia', size: 10, leading: 14, align: 'left' } },
  ];
  maquetarioEditor.book.pages[2].objects = [o];
  preparePrint();
  maquetarioEditor.book = original;
};
