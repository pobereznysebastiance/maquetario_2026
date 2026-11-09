// Pruebas de las notas al pie (src/footnote-model.ts, src/footnotes.ts y
// components/inspector/FootnotePanels.tsx): sólo se cargan en la autoprueba (test-loader.js).

registerIntegrationTest(function (result) {
  const checks = result.checks,
    assert = (v, m) => {
      if (!v) throw Error(m);
      checks.push(m);
    };
  const ed = maquetarioEditor,
    original = M.clone(ed.book),
    previous = { active: ed.active, spread: ed.spread, selected: ed.selected },
    A = '\uE000',
    B = '\uE001',
    C = '\uE002';
  try {
    const b = ed.book,
      first = b.pages[0].objects.find((o) => o.type === 'text' && !o.toc),
      later = b.pages.findIndex(
        (p, i) => i > 0 && p.objects.some((o) => o.type === 'text' && !o.toc),
      ),
      second = b.pages[later]?.objects.find((o) => o.type === 'text' && !o.toc);
    assert(first && second, 'Notas: hay texto en la primera página y en otra');
    // Sin notas, el libro no lleva bloque ni llamadas.
    ed.active = ed.spread = 0;
    renderPages();
    assert(!$('#spread .footnotes, #spread .note-ref'), 'Un libro sin notas no dibuja notas');

    // Dos notas en la página 1 y una en la 2; la caja de la 1 llega al margen inferior.
    first.text = 'Primera línea con nota' + A + '\nOtra frase' + B + ' y sigue.';
    first.paragraphMap = [];
    first.h = b.height - b.margins.bottom - first.y;
    second.text = 'Segunda página' + C;
    b.footnotes = {
      font: 'Georgia',
      size: 8,
      leading: 10,
      space: 4,
      rule: true,
      restart: 'book',
      notes: { e000: 'Texto de la primera nota.', e001: 'Segunda nota.', e002: 'Tercera.' },
    };
    assert(!!M.validate(b), 'Un proyecto con notas válidas se valida');
    const broken = M.clone(b);
    broken.footnotes.notes = { zz: 'x' };
    let rejected = false;
    try {
      M.validate(broken);
    } catch {
      rejected = true;
    }
    assert(rejected, 'Una clave de nota inválida se rechaza');
    assert(
      M.withoutNoteMarks(b, first.text) === 'Primera línea con nota\nOtra frase y sigue.',
      'withoutNoteMarks saca las llamadas',
    );

    renderPages();
    const page = $('#spread .page[data-page="0"]'),
      notes = [...page.querySelectorAll('.footnotes .footnote')];
    assert(notes.length === 2, 'La página 1 dibuja sus dos notas');
    assert(
      notes.map((n) => n.querySelector('.footnote-number').textContent).join() === '1,2' &&
        notes[0].textContent.includes('Texto de la primera nota.'),
      'Las notas van numeradas y con su texto',
    );
    assert(!!page.querySelector('.footnotes .footnote-rule'), 'El filete se dibuja');
    const refs = [...page.querySelectorAll(`[data-id="${first.id}"] .note-ref`)];
    assert(
      refs.length === 2 &&
        refs.map((r) => r.querySelector('.note-number').textContent).join() === '1,2',
      'Las llamadas muestran su número en el texto',
    );
    const box = page.querySelector(`[data-id="${first.id}"]`);
    assert(
      parseFloat(box.style.height) < first.h * ed.scale - 1,
      'La caja que llega a las notas se achica en el dibujo',
    );
    assert(
      first.h === b.height - b.margins.bottom - first.y,
      'El alto de la caja en el libro no cambia',
    );
    const pageTwo = paper(later, 96 / 25.4, true);
    assert(
      pageTwo.querySelector('.footnote-number')?.textContent === '3',
      'La numeración sigue en la página siguiente (y sale en la impresión)',
    );
    b.footnotes.restart = 'page';
    assert(
      paper(later, 96 / 25.4, true).querySelector('.footnote-number')?.textContent === '1',
      'Con numeración por página vuelve a empezar',
    );
    b.footnotes.restart = 'book';

    // Al editar, lo que se lee de la caja son las marcas, no los números.
    ed.selected = first.id;
    renderPages();
    const element = $(`#spread [data-id="${first.id}"]`),
      content = element.querySelector('.text-content'),
      before = first.text;
    startEditing(element);
    assert(
      content.querySelectorAll('.note-ref').length === 2,
      'Las llamadas siguen dibujadas al editar',
    );
    content.dispatchEvent(new Event('input', { bubbles: true }));
    assert(first.text === before, 'Escribir en la caja conserva las llamadas en el texto');

    // Ctrl+Alt+F con el cursor al final: nota nueva ahí, sin texto, y la edición termina.
    const range = document.createRange();
    range.selectNodeContents(content.querySelector('.mqt-paragraph:last-child'));
    range.collapse(false);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    document.dispatchEvent(
      new KeyboardEvent('keydown', { ctrlKey: true, altKey: true, code: 'KeyF', key: 'f' }),
    );
    const keys = Object.keys(b.footnotes.notes);
    assert(keys.length === 4 && !ed.editing, 'Ctrl+Alt+F inserta una nota y termina la edición');
    const added = keys.find((k) => !['e000', 'e001', 'e002'].includes(k));
    assert(
      first.text.endsWith(String.fromCharCode(parseInt(added, 16))),
      'La nota nueva va donde estaba el cursor',
    );

    // El panel de Selección lista las notas de la caja; quitar una saca su llamada.
    showTab('text');
    inspector();
    const areas = [...document.querySelectorAll('[data-footnote-text]')];
    assert(
      areas.length === 3 && areas[0].value === 'Texto de la primera nota.',
      'El panel lista las notas de la caja en orden',
    );
    areas[1].value = 'Segunda nota, corregida.';
    areas[1].dispatchEvent(new Event('change', { bubbles: true }));
    assert(b.footnotes.notes.e001 === 'Segunda nota, corregida.', 'Escribir una nota la guarda');
    document.querySelector(`[data-footnote-remove="${added}"]`).click();
    assert(
      b.footnotes.notes[added] === undefined &&
        !first.text.includes(String.fromCharCode(parseInt(added, 16))),
      'Quitar una nota saca su texto y su llamada',
    );
    undo();
    assert(ed.book.footnotes.notes[added] !== undefined, 'Deshacer devuelve la nota quitada');
    showTab('design');
    assert(
      !!document.querySelector('[data-footnote-setting="size"]'),
      'Libro muestra el formato de las notas',
    );
  } finally {
    if (ed.editing) finishEditing();
    ed.book = original;
    Object.assign(ed, previous);
    render(true);
  }
  return result;
}, 'footnotes-tests');
