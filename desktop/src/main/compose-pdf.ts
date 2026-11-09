// PDF propio del motor de composición (etapa 4, paso 6). Lo escribe el proceso principal a partir
// de lo que arma la página (composePdfLayout, src/modules/compose.ts; forma de los datos en
// LibroStudio/v3/app/src/contract/pdf-layout.ts), sin pasar por Chromium:
// - texto glifo por glifo, con las posiciones del motor, en fuentes Type0/CIDFontType2 (o
//   CIDFontType0 si la fuente es CFF) recortadas con harfbuzz-subset y con ToUnicode, para que el
//   texto se pueda copiar y buscar;
// - imágenes PNG y JPEG recortadas a su caja, y filetes.
// Las cajas (print-boxes.ts) y el PDF/X-4 (pdfx.ts) se aplican después, como al de Chromium.
// Sólo con la llave del motor prendida: el PDF de siempre sigue siendo el de Chromium.
//
// Usa la copia de pdf-lib de la interfaz (print-boxes.ts) en sus piezas de bajo nivel.
import type {
  PdfFont,
  PdfLayout,
  PdfText,
} from '../../../LibroStudio/v3/app/src/contract/pdf-layout.ts';
import { createSubsetter } from './font-subset.ts';
import { pdfLibModule } from './print-boxes.ts';

// ── Lo que se usa de pdf-lib (la copia minificada no trae tipos) ──
interface PdfObject {
  toString(): string;
}
interface PdfRef extends PdfObject {}
interface PdfName extends PdfObject {}
interface PdfContext {
  obj(value: unknown): PdfObject;
  register(object: PdfObject): PdfRef;
  flateStream(contents: Uint8Array | string, dict?: Record<string, unknown>): PdfObject;
}
interface PdfPageNode {
  setFontDictionary(name: PdfName, ref: PdfRef): void;
  setXObject(name: PdfName, ref: PdfRef): void;
  addContentStream(ref: PdfRef): void;
}
interface PdfImageObject {
  ref: PdfRef;
}
interface PdfDoc {
  context: PdfContext;
  addPage(size: [number, number]): { node: PdfPageNode };
  embedPng(bytes: Uint8Array): Promise<PdfImageObject>;
  embedJpg(bytes: Uint8Array): Promise<PdfImageObject>;
  setProducer(text: string): void;
  setCreator(text: string): void;
  setTitle(text: string): void;
  save(options?: { useObjectStreams?: boolean }): Promise<Uint8Array>;
}
interface LowLevel {
  PDFDocument: { create(): Promise<PdfDoc> };
  PDFName: { of(name: string): PdfName };
  PDFHexString: { of(hex: string): PdfObject };
}
const lib = pdfLibModule as LowLevel;
const name = (n: string) => lib.PDFName.of(n);

export interface ComposedPdfOptions {
  /** Bytes de la fuente de una dirección del layout ("/__fonts/<id>.ttf", "archivo.ttc#2"). */
  fontBytes(url: string): Promise<Uint8Array>;
  /** harfbuzz-subset.wasm. */
  subsetWasm: Uint8Array;
  title?: string;
  creator?: string;
}

export interface ComposedPdfReport {
  pages: number;
  fonts: { name: string; glyphs: number; originalBytes: number; subsetBytes: number }[];
  texts: number;
  images: number;
  rects: number;
  /** Líneas del motor y palabras ubicadas por Chromium (las agrega handlers/output.ts). */
  lines?: number;
  words?: number;
}

const num = (n: number) => (Math.round(n * 1000) / 1000).toString();
const hex4 = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');
const utf16Hex = (text: string) =>
  [...text]
    .map((char) => {
      const code = char.codePointAt(0)!;
      if (code < 0x10000) return hex4(code);
      const v = code - 0x10000;
      return hex4(0xd800 + (v >> 10)) + hex4(0xdc00 + (v & 0x3ff));
    })
    .join('');

/** Seis letras de prefijo para el nombre de una fuente recortada (ABCDEF+Nombre), como pide el PDF. */
const subsetTag = (index: number): string =>
  Array.from({ length: 6 }, (_, i) =>
    String.fromCharCode(65 + (Math.floor(((index + 1) * 7919) / 26 ** i) % 26)),
  ).join('');

/** CMap ToUnicode: de cada glifo (CID = índice de glifo) a su texto. */
function toUnicodeCMap(unicode: Record<number, string>): string {
  const entries = Object.entries(unicode).filter(([, text]) => text);
  const blocks: string[] = [];
  for (let i = 0; i < entries.length; i += 100) {
    const chunk = entries.slice(i, i + 100);
    blocks.push(
      `${chunk.length} beginbfchar\n` +
        chunk.map(([gid, text]) => `<${hex4(Number(gid))}> <${utf16Hex(text)}>`).join('\n') +
        '\nendbfchar',
    );
  }
  return [
    '/CIDInit /ProcSet findresource begin',
    '12 dict begin',
    'begincmap',
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
    '/CMapName /Adobe-Identity-UCS def',
    '/CMapType 2 def',
    '1 begincodespacerange',
    '<0000> <FFFF>',
    'endcodespacerange',
    ...blocks,
    'endcmap',
    'CMapName currentdict /CMap defineresource pop',
    'end',
    'end',
  ].join('\n');
}

/** Una fuente del layout como Type0 con su descendiente recortada. Devuelve la referencia. */
async function embedFont(
  doc: PdfDoc,
  font: PdfFont,
  index: number,
  options: ComposedPdfOptions,
  subset: Awaited<ReturnType<typeof createSubsetter>>,
  report: ComposedPdfReport,
): Promise<PdfRef> {
  const context = doc.context;
  const [, face] = font.url.split('#');
  const original = await options.fontBytes(font.url);
  const glyphs = Object.keys(font.widths).map(Number);
  const bytes = subset(original, glyphs, {
    index: Number(face) || 0,
    variations: font.variations,
  });
  const cff = String.fromCharCode(...bytes.subarray(0, 4)) === 'OTTO';
  report.fonts.push({
    name: font.name,
    glyphs: glyphs.length,
    originalBytes: original.length,
    subsetBytes: bytes.length,
  });
  const scale = 1000 / font.upem;
  const baseName = `${subsetTag(index)}+${font.name}`;
  const fontFile = context.register(
    context.flateStream(bytes, cff ? { Subtype: 'OpenType' } : { Length1: bytes.length }),
  );
  const ascent = font.ascender * scale;
  const descent = font.descender * scale;
  const descriptor = context.register(
    context.obj({
      Type: 'FontDescriptor',
      FontName: baseName,
      // 4: simbólica (los glifos se nombran por índice); 64: cursiva.
      Flags: 4 | (font.italic ? 64 : 0),
      FontBBox: [-1000, Math.round(descent * 1.5), 2000, Math.round(ascent * 1.5)],
      ItalicAngle: font.italic ? -12 : 0,
      Ascent: Math.round(ascent),
      Descent: Math.round(descent),
      CapHeight: Math.round(ascent * 0.7),
      StemV: 80,
      [cff ? 'FontFile3' : 'FontFile2']: fontFile,
    }),
  );
  const widths: unknown[] = [];
  for (const gid of glyphs.sort((a, b) => a - b))
    widths.push(gid, [Math.round(font.widths[gid]! * scale)]);
  const cidFont = context.register(
    context.obj({
      Type: 'Font',
      Subtype: cff ? 'CIDFontType0' : 'CIDFontType2',
      BaseFont: baseName,
      CIDSystemInfo: {
        Registry: lib.PDFHexString.of('41646F6265'),
        Ordering: lib.PDFHexString.of('4964656E74697479'),
        Supplement: 0,
      },
      FontDescriptor: descriptor,
      W: widths,
      ...(cff ? {} : { CIDToGIDMap: 'Identity' }),
    }),
  );
  const toUnicode = context.register(context.flateStream(toUnicodeCMap(font.unicode)));
  return context.register(
    context.obj({
      Type: 'Font',
      Subtype: 'Type0',
      BaseFont: baseName,
      Encoding: 'Identity-H',
      DescendantFonts: [cidFont],
      ToUnicode: toUnicode,
    }),
  );
}

/**
 * Un tramo de texto en una línea: Tm en el primer glifo y TJ con los desplazamientos que hacen
 * falta para que cada glifo caiga donde lo puso el motor.
 */
function textOperators(text: PdfText, resource: string, font: PdfFont, pageHeight: number): string {
  if (!text.glyphs.length) return '';
  const scale = 1000 / font.upem;
  const parts: string[] = [];
  let run = '';
  text.glyphs.forEach((glyph, i) => {
    run += hex4(glyph.gid);
    const next = text.glyphs[i + 1];
    if (!next) return;
    const advance = (font.widths[glyph.gid]! * scale * text.size) / 1000;
    // TJ resta: un número positivo corre el glifo siguiente a la izquierda (en milésimas de cuerpo).
    const adjust = ((glyph.x + advance - next.x) * 1000) / text.size;
    if (Math.abs(adjust) > 0.01) {
      parts.push(`<${run}>`, num(adjust));
      run = '';
    }
  });
  if (run) parts.push(`<${run}>`);
  const [r, g, b] = text.color;
  const color = `${num(r)} ${num(g)} ${num(b)}`;
  // Negrita sintética: el contorno se rellena y además se traza (como engrosa Skia, ~1/25 del
  // cuerpo). Cursiva sintética: sesgo de unos 11°, como Chromium.
  const fake = text.fakeBold ? [`${color} RG`, `${num(text.size / 25)} w`, '2 Tr'] : [];
  return [
    `${color} rg`,
    ...fake,
    `/${resource} ${num(text.size)} Tf`,
    `1 0 ${text.fakeItalic ? '0.2' : '0'} 1 ${num(text.glyphs[0]!.x)} ${num(pageHeight - text.y)} Tm`,
    `[${parts.join(' ')}] TJ`,
    ...(text.fakeBold ? ['0 Tr'] : []),
  ].join('\n');
}

const dataUrlBytes = (src: string) =>
  Uint8Array.from(Buffer.from(src.slice(src.indexOf(',') + 1), 'base64'));

/** Escribe el PDF del layout. Devuelve los bytes y un resumen (fuentes recortadas, objetos). */
export async function buildComposedPdf(
  layout: PdfLayout,
  options: ComposedPdfOptions,
): Promise<{ bytes: Uint8Array; report: ComposedPdfReport }> {
  const doc = await lib.PDFDocument.create();
  const context = doc.context;
  const subset = await createSubsetter(options.subsetWasm);
  const report: ComposedPdfReport = { pages: 0, fonts: [], texts: 0, images: 0, rects: 0 };
  const fonts = new Map<string, { ref: PdfRef; resource: string; info: PdfFont }>();
  for (const [index, font] of layout.fonts.entries())
    fonts.set(font.key, {
      ref: await embedFont(doc, font, index, options, subset, report),
      resource: `F${index + 1}`,
      info: font,
    });
  const images = new Map<string, { ref: PdfRef; resource: string }>();
  for (const sheet of layout.sheets) {
    const page = doc.addPage([sheet.width, sheet.height]);
    const operators: string[] = [];
    for (const rect of sheet.rects) {
      const [r, g, b] = rect.color;
      const color = `${num(r)} ${num(g)} ${num(b)}`;
      if (rect.dotted) {
        // Puntos redondos del grosor del filete, separados por otro tanto, por el medio del filete.
        const horizontal = rect.width >= rect.height;
        const thickness = horizontal ? rect.height : rect.width;
        const [x1, y1, x2, y2] = horizontal
          ? [rect.x, rect.y + thickness / 2, rect.x + rect.width, rect.y + thickness / 2]
          : [rect.x + thickness / 2, rect.y, rect.x + thickness / 2, rect.y + rect.height];
        operators.push(
          `q ${color} RG ${num(thickness)} w 1 J [0 ${num(thickness * 2)}] 0 d ${num(x1)} ${num(sheet.height - y1)} m ${num(x2)} ${num(sheet.height - y2)} l S Q`,
        );
      } else
        operators.push(
          `${color} rg ${num(rect.x)} ${num(sheet.height - rect.y - rect.height)} ${num(rect.width)} ${num(rect.height)} re f`,
        );
      report.rects++;
    }
    for (const image of sheet.images) {
      let embedded = images.get(image.src);
      if (!embedded) {
        const bytes = dataUrlBytes(image.src);
        const object = image.src.startsWith('data:image/png')
          ? await doc.embedPng(bytes)
          : await doc.embedJpg(bytes);
        embedded = { ref: object.ref, resource: `Im${images.size + 1}` };
        images.set(image.src, embedded);
      }
      page.node.setXObject(name(embedded.resource), embedded.ref);
      const clip = image.clip;
      operators.push(
        `q ${num(clip.x)} ${num(sheet.height - clip.y - clip.height)} ${num(clip.width)} ${num(clip.height)} re W n`,
        `${num(image.width)} 0 0 ${num(image.height)} ${num(image.x)} ${num(sheet.height - image.y - image.height)} cm /${embedded.resource} Do Q`,
      );
      report.images++;
    }
    const used = new Set<string>();
    const texts = sheet.texts
      .map((text) => {
        const font = fonts.get(text.font);
        if (!font) return '';
        used.add(text.font);
        report.texts++;
        return textOperators(text, font.resource, font.info, sheet.height);
      })
      .filter(Boolean);
    for (const key of used) {
      const font = fonts.get(key)!;
      page.node.setFontDictionary(name(font.resource), font.ref);
    }
    if (texts.length) operators.push('BT', ...texts, 'ET');
    page.node.addContentStream(context.register(context.flateStream(operators.join('\n'))));
    report.pages++;
  }
  doc.setProducer('Maquetario · motor de composición (PDF propio)');
  if (options.creator) doc.setCreator(options.creator);
  if (options.title) doc.setTitle(options.title);
  return { bytes: await doc.save({ useObjectStreams: false }), report };
}
