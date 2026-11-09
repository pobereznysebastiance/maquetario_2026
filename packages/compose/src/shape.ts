// Conformado de texto con HarfBuzz (WASM, paquete harfbuzzjs): de texto y fuente a glifos con
// avances y desplazamientos. Aplica lo que la fuente define (ligaduras, interletraje, formas
// contextuales) igual que un programa de imprenta. Medidas en puntos tipográficos.
import * as hb from 'harfbuzzjs';

/** Un eje de una fuente variable (wght, wdth, opsz…). */
export interface FontAxis {
  min: number;
  default: number;
  max: number;
}

/** Una fuente cargada para conformar. Se crea una vez por archivo y se reutiliza. */
export interface ComposeFont {
  /** Unidades por eme de la fuente (avances de HarfBuzz sin escalar). */
  readonly upem: number;
  /** Ascendente y descendente en unidades de la fuente. */
  readonly ascender: number;
  readonly descender: number;
  /** Ejes variables de la fuente, por etiqueta; vacío si no es variable. */
  readonly axes: Readonly<Record<string, FontAxis>>;
  /** Valores de los ejes con que se conforma (los que no están van en su valor por defecto). */
  readonly variations: Readonly<Record<string, number>>;
  /** Lo que usa shape; no hace falta tocarlo desde afuera. */
  readonly hbFont: hb.Font;
  readonly hbFace: hb.Face;
}

/**
 * Carga una fuente OpenType/TrueType (TTF, OTF; en una colección .ttc, la cara `index`, desde 0).
 */
export function loadFont(data: Uint8Array | ArrayBuffer, index = 0): ComposeFont {
  const hbFace = new hb.Face(new hb.Blob(data), index);
  const hbFont = new hb.Font(hbFace);
  const extents = hbFont.hExtents();
  const axes: Record<string, FontAxis> = {};
  for (const [tag, info] of Object.entries(hbFace.getAxisInfos()))
    axes[tag] = { min: info.min, default: info.default, max: info.max };
  return {
    upem: hbFace.upem,
    ascender: extents.ascender,
    descender: extents.descender,
    axes,
    variations: {},
    hbFont,
    hbFace,
  };
}

const instances = new WeakMap<hb.Face, Map<string, ComposeFont>>();

/**
 * La misma fuente en otra instancia de sus ejes variables (como font-variation-settings). Los
 * ejes que la fuente no tiene se ignoran y los valores se limitan a su rango. Se guarda en caché.
 */
export function withVariations(font: ComposeFont, variations: Record<string, number>): ComposeFont {
  const values: Record<string, number> = {};
  for (const [tag, value] of Object.entries(variations)) {
    const axis = font.axes[tag];
    if (axis && Number.isFinite(value)) values[tag] = Math.min(axis.max, Math.max(axis.min, value));
  }
  const key = JSON.stringify(Object.entries(values).sort(([a], [b]) => (a < b ? -1 : 1)));
  if (key === '[]' && !Object.keys(font.variations).length) return font;
  let cache = instances.get(font.hbFace);
  if (!cache) instances.set(font.hbFace, (cache = new Map()));
  let instance = cache.get(key);
  if (!instance) {
    const hbFont = new hb.Font(font.hbFace);
    hbFont.setVariations(
      Object.entries(values).map(([tag, value]) => new hb.Variation(tag, value)),
    );
    instance = { ...font, variations: values, hbFont };
    cache.set(key, instance);
  }
  return instance;
}

export interface ShapeOptions {
  /** Cuerpo en puntos. */
  size: number;
  /** Idioma BCP 47 (es, en, pt): algunas fuentes cambian formas por idioma. Por defecto "es". */
  language?: string;
  /** Rasgos OpenType, por ejemplo ["kern", "liga", "-calt", "onum"]. */
  features?: string[];
  /**
   * Espacio que se agrega después de cada carácter, en puntos (como letter-spacing; el
   * "interletraje" del objeto en milésimas de eme es tracking / 1000 × cuerpo). Con un valor
   * distinto de cero se apagan las ligaduras optativas, como hacen los navegadores.
   */
  letterSpacing?: number;
}

/** Un glifo conformado. */
export interface ShapedGlyph {
  /** Índice del glifo en la fuente. */
  id: number;
  /** Índice (en unidades UTF-16) del primer carácter del texto que produjo este glifo. */
  cluster: number;
  /** Avance horizontal (con el espacio entre letras, si hay) y desplazamientos, en puntos. */
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
const NO_LIGATURES = ['-liga', '-clig', '-dlig', '-hlig'];

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
  const spacing = options.letterSpacing ?? 0;
  const requested = [...(spacing ? NO_LIGATURES : []), ...(options.features ?? [])];
  const features = requested.map((feature) => {
    const parsed = hb.Feature.fromString(feature);
    if (!parsed) throw new Error(`Rasgo OpenType inválido: ${feature}`);
    return parsed;
  });
  hb.shape(font.hbFont, buffer, features);
  const scale = options.size / font.upem;
  const raw = buffer.getGlyphInfosAndPositions();
  const glyphs = raw.map((g, i) => ({
    id: g.codepoint,
    cluster: g.cluster,
    // El espacio entre letras va después del último glifo de cada carácter.
    advance:
      (g.xAdvance ?? 0) * scale + (spacing && raw[i + 1]?.cluster !== g.cluster ? spacing : 0),
    xOffset: (g.xOffset ?? 0) * scale,
    yOffset: (g.yOffset ?? 0) * scale,
    unsafeToBreak: (g.flags & UNSAFE_TO_BREAK) !== 0,
  }));
  return { text, glyphs, width: glyphs.reduce((sum, g) => sum + g.advance, 0) };
}
