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

    // Todas las filas de la planilla, con las que el libro no usa marcadas.
    check(
      document.querySelectorAll('[data-pauta-style], [data-pauta-empty]').length === 13 &&
        !!document.querySelector('[data-pauta-empty="subtitle-variant-a"]'),
      'La pauta tiene todas las filas de la planilla, también las variables del subtítulo',
    );
    check(
      document.querySelector('[data-guide-legend] strong').textContent === 'Pautas tipográficas' &&
        !!document.querySelector('[data-guide-legend] .guide-logo'),
      'La leyenda va en dos renglones, con el logo de la cátedra',
    );

    // La descarga: PDF, imagen y planilla.
    const files = [];
    globalThis.download = (blob, name) => files.push({ blob, name });
    document.querySelector('#guideDownloadCsv').click();
    document.querySelector('#guideDownloadPng').click();
    await until(() => files.length >= 2);
    document.querySelector('#guideDownloadPdf').click();
    await until(() => files.length >= 3);
    const csv = await files[0].blob.text(),
      png = new Uint8Array(await files[1].blob.arrayBuffer()),
      pdf = await files[2].blob.text();
    check(
      files[0].name.endsWith('.csv') &&
        csv.includes('Texto principal') &&
        csv.includes('Pautas tipográficas') &&
        csv.includes('Cátedra de Tipografía I'),
      'La planilla CSV lleva los roles y la leyenda',
    );
    check(
      files[1].name.endsWith('.png') && png[1] === 0x50 && png[2] === 0x4e && png.length > 20000,
      'La imagen PNG sale con la pauta dibujada',
    );
    check(
      files[2].name.endsWith('.pdf') && pdf.startsWith('%PDF') && files[2].blob.size > 20000,
      'El PDF sale con la pauta',
    );

    // Editar en la tabla cambia el rol en todo el libro.
    field('body', 'size').value = '12';
    field('body', 'leading').value = '16';
    field('body', 'operation').value = 'Sangría de primera línea';
    field('chapter', 'align').value = 'center';
    field('chapter', 'textCase').value = 'uppercase';
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
        chapter.properties.textCase === 'uppercase' &&
        ed.book.editorialPautas.body.operation === 'Sangría de primera línea',
      'La alineación, la escritura y la operación tipográfica se guardan',
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
