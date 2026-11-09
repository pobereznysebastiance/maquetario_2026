'use strict';
const publicationValidate = M.validate;
M.validate = function (input) {
  const b = publicationValidate(input);
  if (b.publicationType && !publicationTypes[b.publicationType])
    throw Error('Producto editorial inválido.');
  if (b.cover) {
    const prior = book;
    try {
      book = b;
      validateCover(b.cover);
    } finally {
      book = prior;
    }
  }
  return b;
};
registerIntegrationTest(function (r) {
  const prior = M.clone(book),
    check = (v, m) => {
      if (!v) throw Error(m);
      r.checks.push(m);
    };
  try {
    const c = defaultCover(),
      g = coverGeometry(c);
    check(g.width === 448 && g.parts.length === 5, 'Cubierta A5 de cinco zonas y 448 mm');
    const noFlaps = { ...c, leftFlap: 0, rightFlap: 0, spine: 0 };
    check(
      coverGeometry(noFlaps).width === 296 && coverGeometry(noFlaps).parts.length === 2,
      'Cubierta sin lomo ni solapas',
    );
    book.cover = c;
    check(
      M.validate(JSON.parse(JSON.stringify(book))).cover.spine === 12,
      'Cubierta persiste en proyecto nativo',
    );
    let rejected = false;
    try {
      validateCover({ ...c, spine: -2 });
    } catch {
      rejected = true;
    }
    check(rejected, 'Medidas negativas rechazadas');
    check(!coverOverflow(c), 'Textos de cubierta de prueba caben');
    const over = M.clone(c);
    over.parts.front.text = 'Texto '.repeat(500);
    over.parts.front.size = 80;
    check(coverOverflow(over), 'Detecta texto sobrante en cubierta');
    let info = prepareOutput({ kind: 'cover', crop: true });
    check(
      info.width === 468 && info.height === 230 && info.faces === 1,
      'Cubierta PDF con sangrado y espacio de marcas',
    );
    check(
      !$('#printRoot .guides') && $('#printRoot [data-cover-part="frontFlap"]'),
      'Solapas en PDF sin guías de edición',
    );
    clearPrint();
    check(Object.keys(publicationTypes).length === 6, 'Seis productos editoriales disponibles');
    settingsNew(true);
    $('#publicationType').value = 'newspaper';
    $('#publicationType').dispatchEvent(new Event('change'));
    check(
      $('#newWidth').value === '280' && $('#newHeight').value === '430',
      'Plantilla de diario configura formato',
    );
    closeSheet();
  } finally {
    book = prior;
    render(true);
  }
  return r;
}, 'publications-tests');
window.prepareCoverProof = function () {
  book.cover = defaultCover();
  coverEditor();
};
