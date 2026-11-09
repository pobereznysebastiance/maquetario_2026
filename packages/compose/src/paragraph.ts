// Párrafo: del texto a cajas, pegamentos y penalizaciones (con la separación silábica de la app),
// y de los cortes a líneas con la posición de cada glifo, ya justificadas.
//
// Las palabras se conforman enteras (así valen las ligaduras y el interletraje de la palabra). Una
// palabra con puntos de corte se parte en cajas por sílaba con los anchos de ese conformado; al
// armar las líneas, cada trozo se vuelve a conformar tal cual queda (con su guion), porque cortar
// puede deshacer una ligadura o cambiar el interletraje. Por eso la medida final de cada línea
// sale del conformado real y no del ancho estimado.
import { type HyphenationOptions, hyphenationPoints } from './hyphenate.ts';
import {
  badnessOf,
  type Break,
  type BreakOptions,
  INFINITY_PENALTY,
  type Item,
  knuthPlass,
} from './knuth-plass.ts';
import { type ComposeFont, shape, type ShapeOptions } from './shape.ts';

export interface ParagraphOptions extends Omit<ShapeOptions, 'language'>, HyphenationOptions {
  /** Partir palabras con guion. Por defecto true. */
  hyphenate?: boolean;
  /** Costo de cada guion (TeX: \hyphenpenalty). Por defecto 50. */
  hyphenPenalty?: number;
  /** Cuánto se puede estirar y encoger un espacio, como fracción de su ancho. Por defecto 1/2 y 1/3. */
  spaceStretch?: number;
  spaceShrink?: number;
}

/** De qué parte del texto sale cada caja (índices UTF-16 del texto del párrafo). */
interface Segment {
  word: number;
  start: number;
  end: number;
}

export interface Paragraph {
  readonly font: ComposeFont;
  readonly text: string;
  readonly options: ParagraphOptions;
  readonly items: Item[];
  /** Para cada ítem caja, el trozo de texto; para los demás, null. */
  readonly segments: (Segment | null)[];
  readonly spaceWidth: number;
  readonly hyphenWidth: number;
}

/** Arma el párrafo: los blancos seguidos cuentan como un espacio. */
export function createParagraph(
  font: ComposeFont,
  text: string,
  options: ParagraphOptions,
): Paragraph {
  const spaceWidth = shape(font, ' ', options).width;
  const hyphenWidth = shape(font, '-', options).width;
  const stretch = spaceWidth * (options.spaceStretch ?? 1 / 2);
  const shrink = spaceWidth * (options.spaceShrink ?? 1 / 3);
  const hyphenPenalty = options.hyphenPenalty ?? 50;
  const items: Item[] = [];
  const segments: (Segment | null)[] = [];
  const push = (item: Item, segment: Segment | null = null) => {
    items.push(item);
    segments.push(segment);
  };

  let word = 0;
  // Las palabras se separan sólo en blancos comunes: el espacio duro (U+00A0) no corta, como en
  // el navegador.
  for (const match of text.matchAll(/[^ \t\n\r\f\v]+/g)) {
    const start = match.index;
    const token = match[0];
    if (word > 0) push({ type: 'glue', width: spaceWidth, stretch, shrink });
    const shaped = shape(font, token, options);
    const points = options.hyphenate === false ? [] : hyphenationPoints(token, options);
    const bounds = [0, ...points, token.length];
    for (let i = 0; i < bounds.length - 1; i++) {
      const from = bounds[i]!;
      const to = bounds[i + 1]!;
      const width = shaped.glyphs
        .filter((g) => g.cluster >= from && g.cluster < to)
        .reduce((sum, g) => sum + g.advance, 0);
      if (i > 0)
        push({ type: 'penalty', width: hyphenWidth, penalty: hyphenPenalty, flagged: true });
      push({ type: 'box', width }, { word, start: start + from, end: start + to });
    }
    word++;
  }
  // Fin de párrafo: la última línea queda corta (pegamento que se estira sin límite) y se corta sí o sí.
  push({ type: 'glue', width: 0, stretch: INFINITY_PENALTY * spaceWidth, shrink: 0 });
  push({ type: 'penalty', width: 0, penalty: -INFINITY_PENALTY, flagged: false });
  return { font, text, options, items, segments, spaceWidth, hyphenWidth };
}

export interface LineGlyph {
  id: number;
  /** Posición del glifo desde el comienzo de la línea, en puntos (ya con los espacios justificados). */
  x: number;
  y: number;
  advance: number;
  /** Índice en el texto del párrafo del carácter que lo produjo. */
  cluster: number;
  /** El guion agregado al cortar la palabra. */
  hyphen?: boolean;
}

export interface Line {
  /** Texto de la línea, con el guion si corta una palabra. */
  text: string;
  /** Tramo del texto del párrafo que ocupa la línea. */
  start: number;
  end: number;
  glyphs: LineGlyph[];
  /** Ancho pedido y ancho natural (con espacios sin estirar), en puntos. */
  width: number;
  naturalWidth: number;
  /** Holgura: ancho pedido menos ancho natural (negativa si hubo que encoger). */
  slack: number;
  /** Ancho final de cada espacio. */
  spaceWidth: number;
  /** Relación de ajuste y maldad, medidas sobre el conformado final. */
  ratio: number;
  badness: number;
  hyphenated: boolean;
  last: boolean;
}

export interface LayoutOptions extends Omit<BreakOptions, 'lineWidth'> {
  /** "knuth-plass" (por defecto) o "greedy": llenar cada línea lo más posible, como un navegador. */
  algorithm?: 'knuth-plass' | 'greedy';
  /** Justificar (por defecto true); sin justificar, los espacios quedan con su ancho natural. */
  justify?: boolean;
  /** Sangría de la primera línea, en puntos: esa línea es más corta y sus glifos empiezan ahí. */
  indent?: number;
}

export interface ComposedParagraph {
  lines: Line[];
  algorithm: 'knuth-plass' | 'greedy';
  /** Knuth-Plass no encontró solución ni con la tolerancia más alta y se usó el corte voraz. */
  fallback: boolean;
}

/** Corte voraz: cada línea toma todo lo que entra con los espacios a su ancho natural. */
export function greedyBreaks(items: Item[], widths: number | ((line: number) => number)): number[] {
  const widthAt = (line: number) => (typeof widths === 'function' ? widths(line) : widths);
  const breaks: number[] = [];
  let width = widthAt(0);
  let lineStart = 0;
  let lineWidth = 0;
  let lastFit = -1;
  for (let index = 0; index < items.length; index++) {
    const item = items[index]!;
    const legal =
      (item.type === 'penalty' && item.penalty < INFINITY_PENALTY) ||
      (item.type === 'glue' && index > lineStart && items[index - 1]!.type === 'box');
    if (legal && index > lineStart) {
      const extra = item.type === 'penalty' ? item.width : 0;
      if (lineWidth + extra <= width || lastFit < 0) lastFit = index;
      if (item.type === 'penalty' && item.penalty === -INFINITY_PENALTY) {
        breaks.push(index);
        break;
      }
    }
    if (item.type !== 'penalty') lineWidth += item.width;
    if (item.type === 'box' && lineWidth > width && lastFit >= 0) {
      breaks.push(lastFit);
      width = widthAt(breaks.length);
      lineStart = lastFit + 1;
      // La línea nueva empieza después del corte, salteando espacios y penalizaciones.
      while (lineStart < items.length && items[lineStart]!.type !== 'box') lineStart++;
      lastFit = -1;
      lineWidth = 0;
      index = lineStart - 1;
    }
  }
  return breaks;
}

const TOLERANCES = [200, 1000, INFINITY_PENALTY];

/** Corta el párrafo en líneas de `width` puntos. */
export function breakLines(
  paragraph: Paragraph,
  width: number,
  options: LayoutOptions = {},
): ComposedParagraph {
  const algorithm = options.algorithm ?? 'knuth-plass';
  const indent = options.indent ?? 0;
  const widthAt = (line: number) => (line === 0 ? width - indent : width);
  let positions: number[] | null = null;
  if (algorithm === 'knuth-plass') {
    const tolerances = options.tolerance ? [options.tolerance, ...TOLERANCES] : TOLERANCES;
    for (const tolerance of tolerances) {
      const breaks: Break[] | null = knuthPlass(paragraph.items, {
        ...options,
        tolerance,
        lineWidth: widthAt,
      });
      if (breaks) {
        positions = breaks.map((b) => b.position);
        break;
      }
    }
  }
  const fallback = algorithm === 'knuth-plass' && !positions;
  positions ??= greedyBreaks(paragraph.items, widthAt);
  return {
    lines: buildLines(paragraph, positions, widthAt, indent, options.justify ?? true),
    algorithm,
    fallback,
  };
}

function buildLines(
  paragraph: Paragraph,
  positions: number[],
  widthAt: (line: number) => number,
  indent: number,
  justify: boolean,
): Line[] {
  const { items, segments, font, options, text } = paragraph;
  const glue = items.find((item) => item.type === 'glue');
  const stretch = glue?.type === 'glue' ? glue.stretch : 0;
  const shrink = glue?.type === 'glue' ? glue.shrink : 0;
  const lines: Line[] = [];
  let from = 0;
  positions.forEach((position, lineIndex) => {
    const last = lineIndex === positions.length - 1;
    const width = widthAt(lineIndex);
    const breakItem = items[position];
    const hyphenated = breakItem?.type === 'penalty' && breakItem.flagged;
    // Trozos de palabra de la línea, unidos por palabra.
    const words: { start: number; end: number }[] = [];
    let previousWord = -1;
    for (let i = from; i < position; i++) {
      const segment = segments[i];
      if (!segment) continue;
      if (segment.word === previousWord) words[words.length - 1]!.end = segment.end;
      else words.push({ start: segment.start, end: segment.end });
      previousWord = segment.word;
    }
    const pieces = words.map((w, i) => {
      const pieceText =
        text.slice(w.start, w.end) + (hyphenated && i === words.length - 1 ? '-' : '');
      return { ...w, run: shape(font, pieceText, options) };
    });
    const gaps = Math.max(pieces.length - 1, 0);
    const naturalWidth =
      pieces.reduce((sum, p) => sum + p.run.width, 0) + gaps * paragraph.spaceWidth;
    const slack = width - naturalWidth;
    let ratio = 0;
    if (gaps > 0 && (slack < 0 || (justify && !last)))
      ratio = slack >= 0 ? slack / (gaps * stretch) : slack / (gaps * shrink);
    const spaceWidth = paragraph.spaceWidth + (ratio >= 0 ? ratio * stretch : ratio * shrink);

    const glyphs: LineGlyph[] = [];
    let x = lineIndex === 0 ? indent : 0;
    pieces.forEach((piece, i) => {
      if (i > 0) x += spaceWidth;
      const wordLength = piece.end - piece.start;
      for (const g of piece.run.glyphs) {
        const isHyphen = g.cluster >= wordLength;
        glyphs.push({
          id: g.id,
          x: x + g.xOffset,
          y: g.yOffset,
          advance: g.advance,
          cluster: piece.start + Math.min(g.cluster, wordLength),
          ...(isHyphen ? { hyphen: true } : {}),
        });
        x += g.advance;
      }
    });
    const start = pieces[0]?.start ?? 0;
    const end = pieces[pieces.length - 1]?.end ?? start;
    lines.push({
      text: pieces.map((p) => p.run.text).join(' '),
      start,
      end,
      glyphs,
      width,
      naturalWidth,
      slack,
      spaceWidth,
      ratio,
      badness: last && ratio >= 0 ? 0 : badnessOf(ratio),
      hyphenated,
      last,
    });
    from = position + 1;
  });
  return lines;
}

/**
 * Deméritos de un párrafo ya armado, con la fórmula de Knuth-Plass: sirve para comparar dos
 * cortes del mismo párrafo (por ejemplo, Knuth-Plass contra el voraz). Menos es mejor.
 */
export function paragraphDemerits(
  lines: Line[],
  options: Pick<ParagraphOptions, 'hyphenPenalty'> & LayoutOptions = {},
): number {
  const linePenalty = options.linePenalty ?? 10;
  const hyphenPenalty = options.hyphenPenalty ?? 50;
  const flaggedDemerits = options.flaggedDemerits ?? 10000;
  const fitnessDemerits = options.fitnessDemerits ?? 10000;
  const fitness = (ratio: number) => (ratio < -0.5 ? 0 : ratio <= 0.5 ? 1 : ratio <= 1 ? 2 : 3);
  let total = 0;
  lines.forEach((line, i) => {
    const badness = Math.min(line.badness, INFINITY_PENALTY);
    let demerits = (linePenalty + badness) ** 2;
    if (line.hyphenated) demerits += hyphenPenalty ** 2;
    const previous = lines[i - 1];
    if (previous?.hyphenated && line.hyphenated) demerits += flaggedDemerits;
    if (previous && Math.abs(fitness(line.ratio) - fitness(previous.ratio)) > 1)
      demerits += fitnessDemerits;
    total += demerits;
  });
  return total;
}
