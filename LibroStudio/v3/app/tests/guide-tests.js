// Pruebas de la pauta de uso tipográfico por rol (src/editorial-rules.tsx): sólo se cargan en la
// autoprueba (test-loader.js). Es asíncrona: la Hoja aplica al confirmar.

registerNavigationTest(async function (result) {
  const check = (condition, message) => {
    if (!condition) throw Error(message);
    result.checks.push(message);
  };
  const ed = maquetarioEditor,
    previous = {
      book: ed.book,
      active: ed.active,
      spread: ed.spread,
      selected: ed.selected,
      hasDocument: ed.hasDocument,
    },
    realDownload = globalThis.download,
    wait = () => new Promise((resolve) => setTimeout(resolve, 60)),
    until = async (condition) => {
      for (let i = 0; i < 40 && !condition(); i++) await wait();
      return condition();
    },
    row = (id) => document.querySelector(`[data-pauta-style="${id}"]`),
    field = (id, name) => row(id).querySelector(`[data-pauta="${name}"]`);
  try {
    // La novela armada desde el manuscrito, con dos de sus estilos como roles.
    ed.book = composeNovel(novelSample());
    ed.hasDocument = true;
    ed.active = ed.spread = 0;
    ed.selected = null;
    const styles = ed.book.paragraphStyles,
      body = styles.find((s) => s.id === 'body'),
      chapter = styles.find((s) => s.id === 'chapter');
    body.role = 'body';
    chapter.role = 'title';
    // Una excepción: un párrafo del cuerpo con otro cuerpo.
    const odd = ed.book.pages
      .flatMap((p) => p.objects)
      .find((o) => o.paragraphMap?.some((m) => m?.styleId === 'body'));
    odd.paragraphMap.find((m) => m?.styleId === 'body').overrides.size = 13;
    render(true);

    editorialRulesDialog();
    await until(() => row('body'));
    const rows = [...document.querySelectorAll('[data-pauta-style]')].map(
      (r) => r.dataset.pautaStyle,
    );
    check(
      rows.join() === 'chapter,body',
      'La pauta tiene una fila por rol, en el orden de la planilla',
    );
    check(
      row('body').querySelector('th').textContent.startsWith('Texto principal') &&
        row('chapter').querySelector('th').textContent.startsWith('Título'),
      'Cada fila lleva el nombre del rol de la planilla',
    );
    check(
      document.querySelector('[data-pauta-other]').textContent.includes('Folio'),
      'Folio y cornisa van en Otros',
    );
    const zones = row('body').querySelectorAll('.guide-spread').length;
    check(zones >= 1 && zones <= 3, 'Las zonas activas se muestran en hasta tres dobles páginas');
    check(
      Number(row('body').querySelector('[data-pauta-exceptions]').dataset.pautaExceptions) > 0 &&
        !!row('body').querySelector('[data-guide-page]'),
      'Marca las excepciones del rol, con sus páginas',
    );
    check(
      field('body', 'leadingClass').options[0].textContent.startsWith('Normal'),
      'El interlineado dice si es amplio, normal o ajustado (11/15: normal)',
    );
    check(
      document
        .querySelector('.guide-legend')
        .textContent.includes('Cátedra de Tipografía I de la UNNE'),
      'La leyenda de la cátedra está en la vista',
    );

    // La descarga lleva la pauta y la leyenda.
    const files = [];
    globalThis.download = (blob, name) => files.push({ blob, name });
    document.querySelector('#guideDownloadCsv').click();
    document.querySelector('#guideDownloadHtml').click();
    const csv = await files[0].blob.text(),
      html = await files[1].blob.text();
    check(
      files[0].name.endsWith('.csv') &&
        csv.includes('Texto principal') &&
        csv.includes('Cátedra de Tipografía I'),
      'La planilla CSV lleva los roles y la leyenda',
    );
    check(
      html.includes('<table') && html.includes('<svg') && html.includes('Cátedra de Tipografía I'),
      'El HTML para imprimir lleva la tabla, las zonas y la leyenda',
    );

    // Editar en la tabla cambia el rol en todo el libro.
    field('body', 'size').value = '12';
    field('body', 'leading').value = '16';
    field('body', 'operation').value = 'Sangría de primera línea';
    field('chapter', 'align').value = 'center';
    document.querySelector('#sheetApply').click();
    await until(() => body.properties.size === 12);
    // Un párrafo del rol sin ajustes locales de cuerpo.
    const plain = (m) => m?.styleId === 'body' && m.overrides?.size === undefined,
      someBody = ed.book.pages.flatMap((p) => p.objects).find((o) => o.paragraphMap?.some(plain)),
      i = someBody.paragraphMap.findIndex(plain);
    check(
      body.properties.size === 12 &&
        body.properties.leading === 16 &&
        paragraphFormat(ed.book, someBody, i).size === 12,
      'Cambiar el cuerpo en la pauta cambia todo el rol',
    );
    check(
      chapter.properties.align === 'center' &&
        ed.book.editorialPautas.body.operation === 'Sangría de primera línea',
      'La alineación y la operación tipográfica se guardan',
    );
    check(!!M.validate(M.clone(ed.book)), 'El libro con la pauta editada se valida');
  } finally {
    globalThis.download = realDownload;
    closeSheet();
    Object.assign(ed, previous);
    render(true);
  }
  return result;
}, 'guide-tests');
