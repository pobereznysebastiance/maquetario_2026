// Conformado de texto con HarfBuzz (WASM, paquete harfbuzzjs): de texto y fuente a glifos con
// avances y desplazamientos. Aplica lo que la fuente define (ligaduras, interletraje, formas
// contextuales) igual que un programa de imprenta. Medidas en puntos tipográficos.
import * as hb from 'harfbuzzjs';

/** Una fuente cargada para conformar. Se crea una vez por archivo y se reutiliza. */
export interface ComposeFont {
  /** Unidades por eme de la fuente (avances de HarfBuzz sin escalar). */
  readonly upem: number;
  /** Ascendente y descendente en unidades de la fuente. */
  readonly ascender: number;
  readonly descender: number;
  /** Lo que usa shape; no hace falta tocarlo desde afuera. */
  readonly hbFont: hb.Font;
}

/** Carga una fuente OpenType/TrueType (TTF, OTF; en una colección, la cara `index`). */
export function loadFont(data: Uint8Array | ArrayBuffer, index = 0): ComposeFont {
  const face = new hb.Face(new hb.Blob(data), index);
  const hbFont = new hb.Font(face);
  const extents = hbFont.hExtents();
  return { upem: face.upem, ascender: extents.ascender, descender: extents.descender, hbFont };
}

export interface ShapeOptions {
  /** Cuerpo en puntos. */
  size: number;
  /** Idioma BCP 47 (es, en, pt): algunas fuentes cambian formas por idioma. Por defecto "es". */
  language?: string;
  /** Rasgos OpenType, por ejemplo ["kern", "liga", "-calt", "onum"]. */
  features?: string[];
}

/** Un glifo conformado. */
export interface ShapedGlyph {
  /** Índice del glifo en la fuente. */
  id: number;
  /** Índice (en unidades UTF-16) del primer carácter del texto que produjo este glifo. */
  cluster: number;
  /** Avance horizontal y desplazamientos, en puntos. */
  advance: number;
  xOffset: number;
  yOffset: number;
  /** HarfBuzz avisa que cortar justo antes de este glifo cambiaría el conformado (ligadura, interletraje). */
  unsafeToBreak: boolean;
}

export interface ShapedRun {
  text: string;
  glyphs: ShapedGlyph[];
  /** Suma de avances, en puntos. */
  width: number;
}

const UNSAFE_TO_BREAK = hb.GlyphFlag.UNSAFE_TO_BREAK;

/**
 * Conforma un texto de una sola línea y una sola dirección (izquierda a derecha). Los clusters
 * quedan en índices UTF-16 del texto, como los de String.prototype.slice.
 */
export function shape(font: ComposeFont, text: string, options: ShapeOptions): ShapedRun {
  const buffer = new hb.Buffer();
  buffer.addText(text);
  buffer.guessSegmentProperties();
  buffer.setDirection(hb.Direction.LTR);
  buffer.setLanguage(options.language ?? 'es');
  const features = (options.features ?? []).map((feature) => {
    const parsed = hb.Feature.fromString(feature);
    if (!parsed) throw new Error(`Rasgo OpenType inválido: ${feature}`);
    return parsed;
  });
  hb.shape(font.hbFont, buffer, features);
  const scale = options.size / font.upem;
  const glyphs = buffer.getGlyphInfosAndPositions().map((g) => ({
    id: g.codepoint,
    cluster: g.cluster,
    advance: (g.xAdvance ?? 0) * scale,
    xOffset: (g.xOffset ?? 0) * scale,
    yOffset: (g.yOffset ?? 0) * scale,
    unsafeToBreak: (g.flags & UNSAFE_TO_BREAK) !== 0,
  }));
  return { text, glyphs, width: glyphs.reduce((sum, g) => sum + g.advance, 0) };
}
