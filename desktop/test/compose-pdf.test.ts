// PDF propio del motor de composición: fuentes recortadas (harfbuzz-subset), Type0 con
// ToUnicode y glifos donde los puso el motor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import {
  breakLines,
  createParagraph,
  loadFont,
  withVariations,
  type ComposeFont,
} from '../../packages/compose/src/index.ts';
import type { PdfLayout } from '../../LibroStudio/v3/app/src/contract/pdf-layout.ts';
import { buildComposedPdf } from '../src/main/compose-pdf.ts';
import { createSubsetter } from '../src/main/font-subset.ts';
import { pdfLibModule } from '../src/main/print-boxes.ts';

const DM_SANS = new URL('../../LibroStudio/v3/app/fonts/DM-Sans-400.ttf', import.meta.url);
const fontBytes = new Uint8Array(readFileSync(DM_SANS));
const wasmUrl = import.meta.resolve('harfbuzzjs').replace(/index\.mjs$/, 'harfbuzz-subset.wasm');
const subsetWasm = new Uint8Array(readFileSync(new URL(wasmUrl)));
const font = loadFont(fontBytes);
const TEXT =
  'En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivía un hidalgo de los de lanza en astillero, adarga antigua, rocín flaco y galgo corredor.';

/** Un layout como el de composePdfLayout, armado con el motor en Node. */
function layoutOf(f: ComposeFont, url: string, text: string, width: number): PdfLayout {
  const paragraph = createParagraph(f, text, { size: 10, hyphenate: true });
  const { lines } = breakLines(paragraph, width);
  const info = {
    key: url,
    url,
    variations: { ...f.variations },
    name: 'DMSans',
    upem: f.upem,
    ascender: f.ascender,
    descender: f.descender,
    italic: false,
    widths: {} as Record<number, number>,
    unicode: {} as Record<number, string>,
  };
  const use = (gid: number, chars: string) => {
    info.widths[gid] ??= f.hbFont.glyphHAdvance(gid);
    if (chars && !(gid in info.unicode)) info.unicode[gid] = chars;
  };
  const space = f.hbFont.glyph(32)!;
  const texts = lines.map((line, index) => {
    const glyphs: { gid: number; x: number }[] = [];
    line.glyphs.forEach((glyph, i) => {
      const next = line.glyphs[i + 1];
      let end = glyph.cluster + 1;
      while (end < text.length && text[end] !== ' ') end++;
      if (next && !next.hyphen && next.cluster > glyph.cluster) end = Math.min(end, next.cluster);
      use(glyph.id, glyph.hyphen ? '-' : text.slice(glyph.cluster, end));
      glyphs.push({ gid: glyph.id, x: 40 + glyph.x });
      if (next && !next.hyphen && text.slice(end, next.cluster).includes(' ')) {
        use(space, ' ');
        glyphs.push({ gid: space, x: 40 + glyph.x + glyph.advance });
      }
    });
    return {
      font: url,
      size: 10,
      color: [0, 0, 0] as [number, number, number],
      y: 60 + index * 14,
      glyphs,
    };
  });
  return {
    sheets: [{ width: 420, height: 595, texts, images: [], rects: [] }],
    fonts: [info],
    composedLines: lines.length,
    domWords: 0,
    notes: {},
  };
}

interface Dict {
  get(key: unknown): unknown;
}
const lib = pdfLibModule as {
  PDFDocument: { load(bytes: Uint8Array): Promise<any> };
  PDFName: { of(name: string): unknown };
};
const key = (n: string) => lib.PDFName.of(n);

/** Texto de cada Tm del contenido, decodificado con el ToUnicode de la fuente (como un lector). */
async function extract(bytes: Uint8Array) {
  const doc = await lib.PDFDocument.load(bytes);
  const page = doc.getPages()[0];
  const fontRef = (page.node.Resources().lookup(key('Font')) as Dict).get(key('F1'));
  const type0 = doc.context.lookup(fontRef) as Dict;
  const cmap = inflateSync(
    (
      doc.context.lookup(type0.get(key('ToUnicode'))) as { getContents(): Uint8Array }
    ).getContents(),
  ).toString('latin1');
  const map = new Map<string, string>();
  for (const m of cmap.matchAll(/<([0-9A-F]{4})> <([0-9A-F]+)>/g))
    map.set(m[1]!, Buffer.from(m[2]!, 'hex').swap16().toString('utf16le'));
  const contents = page.node.Contents();
  const stream = doc.context.lookup(contents.get ? contents.get(0) : contents);
  const ops = inflateSync(stream.getContents()).toString('latin1');
  const lines = ops
    .split(/\n(?=[\d.]+ [\d.]+ [\d.]+ rg)/)
    .filter((block) => block.includes('TJ'))
    .map((block) =>
      [...block.matchAll(/<([0-9A-F]+)>/g)]
        .map((m) =>
          m[1]!
            .match(/.{4}/g)!
            .map((gid) => map.get(gid) ?? '?')
            .join(''),
        )
        .join(''),
    );
  return { doc, type0, lines };
}

test('el PDF propio lleva la fuente recortada como Type0 con ToUnicode', async () => {
  const layout = layoutOf(font, '/fonts/dm-sans.ttf', TEXT, 200);
  const { bytes, report } = await buildComposedPdf(layout, {
    fontBytes: async () => fontBytes,
    subsetWasm,
    title: 'Prueba',
  });
  assert.equal(report.pages, 1);
  assert.ok(report.fonts[0]!.subsetBytes < report.fonts[0]!.originalBytes / 2, 'recortada');
  const { type0, lines } = await extract(bytes);
  assert.equal(String(type0.get(key('Subtype'))), '/Type0');
  assert.equal(String(type0.get(key('Encoding'))), '/Identity-H');
  // El texto se recupera igual que lo compuso el motor (con los espacios y el guion del corte).
  const paragraph = createParagraph(font, TEXT, { size: 10, hyphenate: true });
  const expected = breakLines(paragraph, 200).lines.map((line) => line.text);
  assert.deepEqual(lines, expected);
});

test('el recorte conserva los índices y los avances de los glifos', async () => {
  const subset = await createSubsetter(subsetWasm);
  const glyphs = [...'Maquetario'].map((c) => font.hbFont.glyph(c.codePointAt(0)!)!);
  const small = loadFont(subset(fontBytes, glyphs));
  for (const gid of glyphs)
    assert.equal(small.hbFont.glyphHAdvance(gid), font.hbFont.glyphHAdvance(gid));
});

const BAHNSCHRIFT = 'C:/Windows/Fonts/bahnschrift.ttf';
test(
  'una fuente variable queda fija en la instancia pedida',
  { skip: !existsSync(BAHNSCHRIFT) && 'falta una fuente variable del sistema (Bahnschrift)' },
  async () => {
    const bytes = new Uint8Array(readFileSync(BAHNSCHRIFT));
    const variable = loadFont(bytes);
    const narrow = withVariations(variable, { wdth: 75 });
    const gid = variable.hbFont.glyph('M'.codePointAt(0)!)!;
    const subset = await createSubsetter(subsetWasm);
    const fixed = loadFont(subset(bytes, [gid], { variations: { wdth: 75 } }));
    assert.deepEqual(Object.keys(fixed.axes), [], 'sin ejes: estática');
    assert.equal(fixed.hbFont.glyphHAdvance(gid), narrow.hbFont.glyphHAdvance(gid));
  },
);
