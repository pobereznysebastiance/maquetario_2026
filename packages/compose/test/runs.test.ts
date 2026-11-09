// Varios estilos dentro de un párrafo (tramos) y el espacio duro.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { breakLines, createParagraph, createRunParagraph, loadFont, shape } from '../src/index.ts';

const fontFile = (weight: number) =>
  loadFont(
    readFileSync(
      new URL(`../../../LibroStudio/v3/app/fonts/DM-Sans-${weight}.ttf`, import.meta.url),
    ),
  );
const regular = fontFile(400);
const bold = fontFile(700);
const size = 10;
const QUIJOTE =
  'En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivía un hidalgo de los de lanza en astillero, adarga antigua, rocín flaco y galgo corredor. Una olla de algo más vaca que carnero, salpicón las más noches, duelos y quebrantos los sábados, lantejas los viernes, algún palomino de añadidura los domingos, consumían las tres partes de su hacienda.';
// El mismo texto en tres tramos: normal, negrita (desde la mitad de "hidalgo") y más grande.
const cut1 = QUIJOTE.indexOf('dalgo');
const cut2 = QUIJOTE.indexOf('Una olla');
const RUNS = [
  { text: QUIJOTE.slice(0, cut1), font: regular },
  { text: QUIJOTE.slice(cut1, cut2), font: bold },
  { text: QUIJOTE.slice(cut2), font: regular, size: 12 },
];

test('cada tramo se conforma con su cara y su cuerpo', () => {
  const runs = createRunParagraph(RUNS, { size });
  const single = createParagraph(regular, QUIJOTE, { size });
  assert.equal(runs.text, QUIJOTE);
  const width = (p: typeof runs) =>
    p.items.reduce((sum, item) => sum + (item.type === 'box' ? item.width : 0), 0);
  assert.ok(width(runs) > width(single), 'negrita y cuerpo 12 ocupan más');
  // Los mismos tramos con la misma cara dan lo mismo que un tramo solo (cortados entre palabras).
  const at = QUIJOTE.indexOf(' Una olla') + 1;
  const plain = createRunParagraph(
    [
      { text: QUIJOTE.slice(0, at), font: regular },
      { text: QUIJOTE.slice(at), font: regular },
    ],
    { size },
  );
  assert.ok(Math.abs(width(plain) - width(single)) < 1e-9);
  assert.throws(() => createRunParagraph([], { size }), /al menos un tramo/);
});

test('un cambio de tramo dentro de una palabra no es un lugar de corte', () => {
  const paragraph = createRunParagraph(RUNS, { size, hyphenate: false });
  for (const width of [120, 160, 200, 240, 280]) {
    for (const algorithm of ['knuth-plass', 'greedy'] as const) {
      const { lines } = breakLines(paragraph, width, { algorithm });
      assert.ok(!lines.some((line) => line.start === cut1), `${width}: corta en "hi|dalgo"`);
      assert.equal(lines.map((l) => l.text).join(' '), QUIJOTE);
    }
  }
});

test('las líneas conservan los tramos y la justificación reparte por tramo', () => {
  const paragraph = createRunParagraph(RUNS, { size });
  for (const width of [180, 240, 300]) {
    const { lines } = breakLines(paragraph, width);
    for (const line of lines) {
      assert.equal(line.segments.map((s) => s.text).join(''), line.text);
      for (const glyph of line.glyphs) {
        const run = paragraph.runs[glyph.run]!;
        assert.ok(glyph.cluster >= run.start && glyph.cluster <= run.end, 'glifo de su tramo');
      }
      if (line.last) continue;
      const right = line.glyphs.at(-1)!.x + line.glyphs.at(-1)!.advance;
      assert.ok(Math.abs(right - width) < 1e-6, `${width}: "${line.text}" mide ${right}`);
      // Cada espacio se estira en proporción a su ancho: la misma fracción en todos los tramos.
      const fractions = line.segments
        .filter((s) => s.text.includes(' '))
        .map((s) => s.spaceExtra / paragraph.runs[s.run]!.spaceWidth);
      for (const f of fractions) assert.ok(Math.abs(f - fractions[0]!) < 1e-9);
    }
    const runsUsed = new Set(lines.flatMap((l) => l.segments.map((s) => s.run)));
    assert.deepEqual([...runsUsed].sort(), [0, 1, 2]);
  }
});

const NBSP = ' ';
test('el espacio duro no corta ni se estira', () => {
  const text = QUIJOTE.replaceAll(' de ', ` de${NBSP}`);
  const paragraph = createParagraph(regular, text, { size });
  const natural = shape(regular, NBSP, { size }).width;
  let checked = 0;
  for (const width of [150, 200, 250, 300]) {
    const { lines } = breakLines(paragraph, width);
    for (const line of lines) {
      assert.ok(text[line.start - 1] !== NBSP, `${width}: una línea empieza después de un duro`);
      if (line.last || line.ratio <= 0) continue;
      line.glyphs.forEach((glyph) => {
        if (text[glyph.cluster] !== NBSP) return;
        checked++;
        assert.ok(Math.abs(glyph.advance - natural) < 1e-9, 'el duro mantiene su ancho');
      });
      assert.ok(line.segments[0]!.spaceExtra > 0, 'los espacios comunes sí se estiran');
    }
  }
  assert.ok(checked > 0, 'hubo espacios duros en líneas estiradas');
});
