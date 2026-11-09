// Reglas del castellano, interletraje, ejes variables, colecciones y opciones de Knuth-Plass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  breakLines,
  createParagraph,
  type Line,
  loadFont,
  shape,
  withVariations,
} from '../src/index.ts';

const font = loadFont(
  readFileSync(new URL('../../../LibroStudio/v3/app/fonts/DM-Sans-400.ttf', import.meta.url)),
);
const size = 10;
const QUIJOTE =
  'En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivía un hidalgo de los de lanza en astillero, adarga antigua, rocín flaco y galgo corredor. Una olla de algo más vaca que carnero, salpicón las más noches, duelos y quebrantos los sábados, lantejas los viernes, algún palomino de añadidura los domingos, consumían las tres partes de su hacienda. El resto della concluían sayo de velarte, calzas de velludo para las fiestas, con sus pantuflos de lo mesmo, y los días de entresemana se honraba con su vellorí de lo más fino.';
const widths = Array.from({ length: 45 }, (_, i) => 60 + i * 6);
const tokens = (line: Line) => line.text.split(' ');

test('interletraje: suma después de cada carácter y apaga las ligaduras', () => {
  const plain = shape(font, 'Mancha', { size });
  const spaced = shape(font, 'Mancha', { size, letterSpacing: 1 });
  assert.ok(Math.abs(spaced.width - (plain.width + 6)) < 1e-9);
  assert.equal(shape(font, 'office', { size }).glyphs.length, 5, 'con ligadura "ffi"');
  assert.equal(shape(font, 'office', { size, letterSpacing: 0.5 }).glyphs.length, 6);
  const paragraph = createParagraph(font, 'una prueba', { size, letterSpacing: 1 });
  assert.ok(paragraph.spaceWidth > createParagraph(font, 'una prueba', { size }).spaceWidth);
});

const BAHNSCHRIFT = 'C:/Windows/Fonts/bahnschrift.ttf';
test(
  'ejes variables: la instancia cambia las medidas y se limita al rango del eje',
  { skip: !existsSync(BAHNSCHRIFT) && 'falta una fuente variable del sistema (Bahnschrift)' },
  () => {
    const variable = loadFont(readFileSync(BAHNSCHRIFT));
    assert.ok(variable.axes.wght && variable.axes.wdth, 'tiene ejes wght y wdth');
    // En Bahnschrift el peso no cambia los avances; el ancho (wdth) sí.
    const narrow = withVariations(variable, { wdth: variable.axes.wdth!.min });
    const width = (f: typeof variable) => shape(f, 'Maquetario', { size }).width;
    assert.ok(width(narrow) < width(variable), 'la angosta es más angosta');
    const bold = withVariations(variable, { wght: variable.axes.wght!.max, nada: 1 });
    assert.deepEqual(Object.keys(bold.variations), ['wght'], 'los ejes que no tiene se ignoran');
    assert.equal(
      withVariations(variable, { wght: 99999 }).variations.wght,
      variable.axes.wght!.max,
    );
    assert.equal(withVariations(variable, { wght: variable.axes.wght!.max }), bold, 'en caché');
    assert.equal(withVariations(variable, {}), variable);
  },
);

const CAMBRIA = 'C:/Windows/Fonts/cambria.ttc';
test(
  'colecciones .ttc: cada índice es una cara',
  { skip: !existsSync(CAMBRIA) && 'falta una colección del sistema (Cambria)' },
  () => {
    const data = readFileSync(CAMBRIA);
    // Cambria y Cambria Math: la segunda cubre muchos más caracteres.
    const first = loadFont(data, 0).hbFace.collectUnicodes().length;
    const second = loadFont(data, 1).hbFace.collectUnicodes().length;
    assert.ok(first > 0 && second > first, `${first} y ${second} caracteres`);
  },
);

const DIALOGUE =
  '—Podés presentar observaciones hasta el viernes —dijo—. Pero tienen que venir con documentación, y las rayas — sueltas — también cuentan.';

test('rayas de diálogo: la de apertura no cierra línea ni la de cierre la abre', () => {
  const paragraph = createParagraph(font, DIALOGUE, { size, hyphenate: false });
  for (const algorithm of ['knuth-plass', 'greedy'] as const)
    for (const width of widths) {
      const { lines } = breakLines(paragraph, width, { algorithm });
      for (const line of lines) {
        const words = tokens(line);
        const first = words[0]!;
        const last = words.at(-1)!;
        assert.ok(!/^[.,;:]/.test(first), `${width}: "${line.text}" empieza con puntuación`);
        assert.ok(
          first !== '—' && last !== '—',
          `${width}: raya suelta en el borde de "${line.text}"`,
        );
        // Termina en raya sólo si es la de cierre, pegada a una palabra ("dijo—").
        if (last.endsWith('—')) assert.ok(/\p{L}—\.?$/u.test(last), `${width}: "${last}"`);
      }
      assert.equal(lines.map((l) => l.text).join(' '), DIALOGUE);
    }
});

test('palabras compuestas: se cortan en el guion y el guion se repite en la línea siguiente', () => {
  const text = 'El acuerdo franco-argentino se firmó en la sala histórico-artística.';
  const paragraph = createParagraph(font, text, { size, hyphenate: false });
  let seen = 0;
  for (const width of widths) {
    const { lines } = breakLines(paragraph, width, { algorithm: 'greedy' });
    lines.forEach((line, i) => {
      if (!line.text.endsWith('-')) return;
      seen++;
      assert.ok(line.hyphenated);
      assert.match(lines[i + 1]!.text, /^-\p{L}/u, `${width}: "${lines[i + 1]!.text}"`);
      assert.equal(lines[i + 1]!.glyphs[0]!.hyphen, true, 'el guion repetido es un glifo de guion');
    });
  }
  assert.ok(seen > 0, 'en alguna medida corta en la compuesta');
});

const longestHyphenRun = (lines: Line[]) => {
  let run = 0;
  let longest = 0;
  for (const line of lines) {
    run = line.hyphenated ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return longest;
};

test('tope de guiones seguidos', () => {
  const paragraph = createParagraph(font, QUIJOTE + ' ' + QUIJOTE, { size });
  let limited = 0;
  for (const width of [170, 180, 190, 200, 210]) {
    const free = breakLines(paragraph, width).lines;
    const capped = breakLines(paragraph, width, { maxConsecutiveHyphens: 2 });
    if (!capped.relaxed) assert.ok(longestHyphenRun(capped.lines) <= 2, `${width}`);
    if (longestHyphenRun(free) > 2 && !capped.relaxed) limited++;
  }
  assert.ok(limited > 0, 'en alguna medida el tope cambia la composición');
});

test('largo mínimo de la última línea', () => {
  const paragraph = createParagraph(font, QUIJOTE, { size });
  let changed = 0;
  for (const width of [180, 200, 220, 240, 260, 280, 300]) {
    const minLastLine = width / 3;
    const free = breakLines(paragraph, width).lines.at(-1)!;
    const result = breakLines(paragraph, width, { minLastLine });
    assert.equal(result.relaxed, false, `${width}: hay solución`);
    assert.ok(result.lines.at(-1)!.naturalWidth >= minLastLine, `${width}`);
    if (free.naturalWidth < minLastLine) changed++;
  }
  assert.ok(changed > 0, 'en alguna medida la última línea era corta');
  const one = breakLines(createParagraph(font, 'Fin.', { size }), 300, { minLastLine: 200 });
  assert.equal(one.lines.length, 1, 'un párrafo de una línea no se mide');
  assert.equal(one.relaxed, false);
});
