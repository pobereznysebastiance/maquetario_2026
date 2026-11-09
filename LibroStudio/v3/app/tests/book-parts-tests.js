// Pruebas del punto 4 del pedido de la cátedra: partes del libro para tildar (src/book-parts.ts y
// la vista Estructura), el conmutador Interior | Cubierta y Aprender con la Bibliografía. Sólo se
// cargan en la autoprueba (test-loader.js). Es asíncrona: quitar una parte pide confirmación.

registerNavigationTest(async function (result) {
  const check = (condition, message) => {
    if (!condition) throw Error(message);
    result.checks.push(message);
  };
  const selfTest = window.maquetarioSelfTest,
    ed = maquetarioEditor,
    previous = {
      book: ed.book,
      active: ed.active,
      spread: ed.spread,
      selected: ed.selected,
      hasDocument: ed.hasDocument,
    },
    wait = () => new Promise((resolve) => setTimeout(resolve, 60)),
    // Espera hasta que la condición se cumpla (el diálogo de confirmación tarda unos cuadros).
    until = async (condition) => {
      for (let i = 0; i < 40 && !condition(); i++) await wait();
      return condition();
    },
    openDialog = () => document.querySelector('#dialogLayer dialog[open]'),
    box = (id) => document.querySelector(`[data-book-part="${id}"]`),
    toggle = (id, on) => {
      const input = box(id);
      input.checked = on;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
  try {
    // La novela armada desde el manuscrito: las partes se reconocen por su nombre.
    ed.book = composeNovel(novelSample());
    ed.hasDocument = true;
    ed.active = ed.spread = 0;
    ed.selected = null;
    showTab('structure');
    render(true);
    const checked = () =>
      [...document.querySelectorAll('[data-book-part]')]
        .filter((i) => i.checked)
        .map((i) => i.dataset.bookPart);
    check(
      [
        'half-title',
        'title-page',
        'copyright',
        'dedication',
        'contents',
        'prologue',
        'body',
        'colophon',
      ].every((id) => checked().includes(id)) && !checked().includes('introduction'),
      'Estructura reconoce las partes de un libro armado desde el manuscrito',
    );
    check(box('body').disabled, 'El cuerpo no se puede quitar');

    // Tildar: la parte entra en su lugar, con su blanco detrás (lo que sigue no cambia de lado).
    const firstChapter = () =>
      ed.book.pages.findIndex((p, i) => i > 0 && p.section && !p.part && !/^Pr/.test(p.section));
    const chapterBefore = firstChapter(),
      pagesBefore = ed.book.pages.length;
    toggle('introduction', true);
    const intro = ed.book.pages.findIndex((p) => p.part === 'introduction');
    check(
      intro > 0 &&
        intro < firstChapter() &&
        intro > ed.book.pages.findIndex((p) => /^Prólogo/.test(p.section || '')) &&
        ed.book.pages.length === pagesBefore + 2 &&
        firstChapter() === chapterBefore + 2,
      'Tildar Introducción la pone antes del cuerpo, con su blanco: el capítulo sigue del mismo lado',
    );
    check(
      box('introduction').checked && ed.active === intro,
      'La parte nueva queda tildada y a la vista',
    );
    check(!!M.validate(M.clone(ed.book)), 'El libro con la parte nueva se valida');
    toggle('bibliography', true);
    const bibliography = ed.book.pages.findIndex((p) => p.part === 'bibliography');
    check(
      bibliography > firstChapter() &&
        bibliography < ed.book.pages.findIndex((p) => p.partName === 'Agradecimientos'),
      'La bibliografía va después del cuerpo y antes de los agradecimientos',
    );

    // Destildar: pide confirmación y quita sus páginas; cancelar no toca nada. En la autoprueba los
    // diálogos se contestan solos (maquetarioSelfTest): acá se contestan con los botones.
    window.maquetarioSelfTest = false;
    toggle('introduction', false);
    await until(openDialog);
    let dialog = openDialog();
    check(
      !!dialog && dialog.textContent.includes('Introducción') && box('introduction').checked,
      'Destildar pide confirmación antes de quitar',
    );
    [...dialog.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Cancelar').click();
    await until(() => !openDialog());
    check(
      ed.book.pages.some((p) => p.part === 'introduction'),
      'Cancelar deja la parte',
    );
    toggle('introduction', false);
    await until(openDialog);
    dialog = openDialog();
    [...dialog.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Quitar').click();
    await until(() => !ed.book.pages.some((p) => p.part === 'introduction'));
    check(
      !ed.book.pages.some((p) => p.part === 'introduction') && firstChapter() === chapterBefore,
      'Quitar la parte saca sus dos páginas y el capítulo vuelve a su lugar',
    );
    undo();
    check(
      ed.book.pages.some((p) => p.part === 'introduction'),
      'Quitar una parte se deshace',
    );

    // Interior | Cubierta.
    check(
      $('#interiorTool').classList.contains('active') && !!$('.documentbar #coverTool'),
      'La barra del documento muestra Interior | Cubierta',
    );
    $('#coverTool').click();
    await until(() => $('#coverPieceTool'));
    check(
      $('#coverPieceTool')?.classList.contains('active'),
      'En la cubierta, el conmutador marca Cubierta',
    );
    $('#coverInteriorTool').click();
    await until(() => !openDialog());
    check(!document.querySelector('#dialogLayer dialog[open]'), 'Interior vuelve a las páginas');

    // Aprender: siempre con su nombre, con la Bibliografía.
    check(
      $('#helpCenter').textContent.trim() === 'Aprender' &&
        getComputedStyle($('#helpCenter > span')).display !== 'none',
      'Aprender está a la vista en la barra superior',
    );
    openHelp('bibliography');
    await until(() => document.querySelector('.help-bibliography'));
    check(
      document.querySelectorAll('.help-bibliography li').length >= 5,
      'Aprender tiene la Bibliografía',
    );
  } finally {
    window.maquetarioSelfTest = selfTest;
    closeSheet();
    Object.assign(ed, previous);
    render(true);
  }
  return result;
}, 'book-parts-tests');
