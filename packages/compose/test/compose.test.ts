import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  breakLines,
  createParagraph,
  hyphenationPoints,
  type Line,
  loadFont,
  paragraphDemerits,
  shape,
  SOFT_HYPHEN,
} from '../src/index.ts';

// Fuente real del repo: la DM Sans que trae la app (OFL).
const font = loadFont(
  readFileSync(new URL('../../../LibroStudio/v3/app/fonts/DM-Sans-400.ttf', import.meta.url)),
);
const size = 10;
// Dominio público (Cervantes). Dos veces, para tener un párrafo largo.
const QUIJOTE =
  'En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivía un hidalgo de los de lanza en astillero, adarga antigua, rocín flaco y galgo corredor. Una olla de algo más vaca que carnero, salpicón las más noches, duelos y quebrantos los sábados, lantejas los viernes, algún palomino de añadidura los domingos, consumían las tres partes de su hacienda. El resto della concluían sayo de velarte, calzas de velludo para las fiestas, con sus pantuflos de lo mesmo, y los días de entresemana se honraba con su vellorí de lo más fino.';
const TEXT = QUIJOTE + ' ' + QUIJOTE;
const paragraph = createParagraph(font, TEXT, { size, language: 'es' });
const LETTER = /\p{L}/u;
const letters = (text: string) => [...text].filter((c) => LETTER.test(c)).length;

/** Centros de los espacios de una línea (huecos entre glifos más anchos que minWidth). */
function gaps(line: Line, minWidth: number): number[] {
  const centers: number[] = [];
  for (let i = 1; i < line.glyphs.length; i++) {
    const end = line.glyphs[i - 1]!.x + line.glyphs[i - 1]!.advance;
    const start = line.glyphs[i]!.x;
    if (start - end > minWidth) centers.push((start + end) / 2);
  }
  return centers;
}

/**
 * Río: espacios de líneas seguidas, uno debajo del otro (a menos de `reach` de distancia), todos
 * más anchos que `minWidth`. Devuelve cuántas líneas tiene el río más largo.
 */
function longestRiver(lines: Line[], reach: number, minWidth: number): number {
  let longest = 0;
  let previous = new Map<number, number>();
  for (const line of lines.filter((l) => !l.last)) {
    const current = new Map<number, number>();
    for (const x of gaps(line, minWidth)) {
      let length = 1;
      for (const [px, l] of previous)
        if (Math.abs(px - x) <= reach) length = Math.max(length, l + 1);
      current.set(x, length);
      longest = Math.max(longest, length);
    }
    previous = current;
  }
  return longest;
}

test('shape aplica ligaduras e interletraje de la fuente, con medidas en puntos', () => {
  const office = shape(font, 'office', { size });
  assert.ok(office.glyphs.length < 'office'.length, 'la DM Sans liga "ffi"');
  assert.deepEqual(
    office.glyphs.map((g) => g.cluster),
    [0, 1, 2, 4, 5],
  );
  const plain = shape(font, 'office', { size, features: ['-liga'] });
  assert.equal(plain.glyphs.length, 'office'.length, 'sin el rasgo liga no hay ligadura');
  const pair = shape(font, 'AV', { size }).width;
  const apart = shape(font, 'A', { size }).width + shape(font, 'V', { size }).width;
  assert.ok(pair < apart, `interletraje AV: ${pair} < ${apart}`);
  const double = shape(font, 'Mancha', { size: 2 * size }).width;
  assert.ok(Math.abs(double - 2 * shape(font, 'Mancha', { size }).width) < 1e-9);
  assert.throws(() => shape(font, 'a', { size, features: ['no es un rasgo'] }), /Rasgo OpenType/);
});

test('las líneas justificadas llenan el ancho y conservan el texto', () => {
  for (const width of [200, 260, 300]) {
    const { lines, fallback } = breakLines(paragraph, width);
    assert.equal(fallback, false);
    for (const line of lines) {
      const right = line.glyphs.at(-1)!.x + line.glyphs.at(-1)!.advance;
      if (line.last) {
        assert.equal(line.ratio, 0, 'la última línea queda con espacios naturales');
        assert.ok(right < width);
      } else assert.ok(Math.abs(right - width) < 1e-6, `${width}: "${line.text}" mide ${right}`);
      for (let i = 1; i < line.glyphs.length; i++)
        assert.ok(line.glyphs[i]!.x > line.glyphs[i - 1]!.x, 'glifos en orden');
      assert.ok(Math.abs(line.slack - (line.width - line.naturalWidth)) < 1e-9);
    }
    const rebuilt = lines.map((l) => (l.hyphenated ? l.text.slice(0, -1) : l.text + ' ')).join('');
    assert.equal(rebuilt.trim(), TEXT, 'sin guiones, el texto es el mismo');
    assert.equal(lines[0]!.start, 0);
    assert.equal(lines.at(-1)!.end, TEXT.length);
  }
});

test('párrafo justificado en una medida de libro: espacios parejos y sin ríos obvios', () => {
  // ~55 a 65 caracteres por línea a 10 pt, como la caja de un A5.
  for (const width of [300, 340]) {
    const knuthPlass = breakLines(paragraph, width).lines;
    const greedy = breakLines(paragraph, width, { algorithm: 'greedy' }).lines;
    const maxRatio = Math.max(...knuthPlass.map((l) => l.ratio));
    assert.ok(maxRatio <= 1, `${width}: ningún espacio se estira más de lo previsto (${maxRatio})`);
    // Río obvio: espacios agrandados (25 % o más) alineados en 3 o más líneas seguidas.
    const river = (lines: Line[]) =>
      longestRiver(lines, paragraph.spaceWidth, paragraph.spaceWidth * 1.25);
    assert.ok(river(knuthPlass) < 3, `${width}: río de ${river(knuthPlass)} líneas`);
    assert.ok(river(knuthPlass) <= river(greedy));
  }
});

test('los guiones respetan el mínimo de letras a cada lado', () => {
  assert.deepEqual(hyphenationPoints('caballero'), [2, 4], 'ca-ba-llero (llero: 5 letras)');
  assert.deepEqual(hyphenationPoints('caballero', { leftMin: 1, rightMin: 1 }), [2, 4, 7]);
  assert.deepEqual(hyphenationPoints('año'), []);
  assert.deepEqual(hyphenationPoints('franco-argentino'), [], 'con guion propio no se parte');
  for (const [leftMin, rightMin] of [
    [2, 3],
    [3, 3],
  ] as const) {
    const narrow = createParagraph(font, TEXT, { size, leftMin, rightMin });
    const { lines } = breakLines(narrow, 180);
    const hyphenated = lines.filter((l) => l.hyphenated);
    assert.ok(hyphenated.length > 0, 'en una columna angosta hay guiones');
    lines.forEach((line, i) => {
      if (!line.hyphenated) return;
      assert.equal(line.glyphs.at(-1)!.hyphen, true, 'el último glifo es el guion');
      const before = line.text.slice(0, -1).split(' ').at(-1)!;
      const after = lines[i + 1]!.text.split(' ')[0]!;
      assert.ok(letters(before) >= leftMin, `"${before}-" tiene menos de ${leftMin} letras`);
      assert.ok(letters(after) >= rightMin, `"-${after}" tiene menos de ${rightMin} letras`);
    });
  }
  const none = breakLines(createParagraph(font, TEXT, { size, hyphenate: false }), 180).lines;
  assert.ok(
    none.every((l) => !l.hyphenated),
    'sin separación silábica no hay guiones',
  );
});

test('Knuth-Plass tiene menos maldad que el corte voraz', () => {
  for (const width of [180, 200, 230, 260, 300, 340]) {
    const knuthPlass = breakLines(paragraph, width).lines;
    const greedy = breakLines(paragraph, width, { algorithm: 'greedy' }).lines;
    const kp = paragraphDemerits(knuthPlass);
    const gr = paragraphDemerits(greedy);
    assert.ok(kp < gr, `${width}: deméritos ${kp} contra ${gr} del voraz`);
    const worst = (lines: Line[]) => Math.max(...lines.map((l) => l.badness));
    assert.ok(worst(knuthPlass) <= worst(greedy), `${width}: peor línea`);
  }
});

test('una palabra que no entra no rompe el corte', () => {
  const long = createParagraph(font, 'Desoxirribonucleico es larguísima para tres centímetros.', {
    size,
    hyphenate: false,
  });
  const result = breakLines(long, 60);
  assert.equal(result.fallback, true, 'sin solución, se usa el corte voraz');
  assert.ok(result.lines.length >= 2);
  assert.equal(result.lines.map((l) => l.text).join(' '), long.text);
});

test('sangría de primera línea y separador propio (el de la página)', () => {
  const indent = 20;
  for (const algorithm of ['knuth-plass', 'greedy'] as const) {
    const { lines } = breakLines(paragraph, 300, { algorithm, indent });
    assert.equal(lines[0]!.glyphs[0]!.x, indent, 'la primera línea empieza en la sangría');
    assert.equal(lines[0]!.width, 300 - indent);
    const right = lines[0]!.glyphs.at(-1)!.x + lines[0]!.glyphs.at(-1)!.advance;
    assert.ok(Math.abs(right - 300) < 1e-6, `${algorithm}: la primera línea llega al borde`);
    assert.equal(lines[1]!.glyphs[0]!.x, 0);
  }
  // Un separador que sólo deja cortar "caballero" como "caba-llero".
  const own = createParagraph(font, 'caballero', {
    size,
    hyphenator: (word) => (word === 'caballero' ? 'caba' + SOFT_HYPHEN + 'llero' : word),
  });
  assert.equal(own.items.filter((item) => item.type === 'penalty' && item.flagged).length, 1);
});
