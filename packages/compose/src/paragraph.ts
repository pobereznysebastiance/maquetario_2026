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

/** Corte dentro de una palabra: por sílaba (se agrega un guion) o en el guion de una compuesta. */
export type WordBreak = 'syllable' | 'compound';

export interface Paragraph {
  readonly font: ComposeFont;
  readonly text: string;
  readonly options: ParagraphOptions;
  readonly items: Item[];
  /** Para cada ítem caja, el trozo de texto; para los demás, null. */
  readonly segments: (Segment | null)[];
  /** Los cortes dentro de palabras, por índice de ítem (la penalización). */
  readonly wordBreaks: ReadonlyMap<number, WordBreak>;
  /** Dónde puede empezar una línea (índices del texto), además del comienzo. */
  readonly breakStarts: readonly number[];
  readonly spaceWidth: number;
  readonly hyphenWidth: number;
}

const LETTER = /\p{L}/u;
const DASH_ONLY = /^[\u2013\u2014]+$/;
const countLetters = (text: string): number => [...text].filter((c) => LETTER.test(c)).length;

/**
 * Arma el párrafo: los blancos seguidos cuentan como un espacio. Reglas de corte del castellano:
 * - dentro de una palabra sólo se corta por sílaba (con guion) o en el guion de una palabra
 *   compuesta, y entonces el guion se repite al comienzo de la línea siguiente (RAE);
 * - nunca después de una raya o un guion de rango pegados (—dijo—, 1990–2000): la raya de
 *   apertura no queda al final de línea ni la de cierre al comienzo;
 * - una raya suelta, entre espacios, queda pegada a sus vecinas.
 */
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
  const leftMin = options.leftMin ?? 2;
  const rightMin = options.rightMin ?? 3;
  const items: Item[] = [];
  const segments: (Segment | null)[] = [];
  const wordBreaks = new Map<number, WordBreak>();
  const breakStarts: number[] = [];
  const push = (item: Item, segment: Segment | null = null) => {
    items.push(item);
    segments.push(segment);
  };

  let word = 0;
  let previousDashOnly = false;
  // Las palabras se separan sólo en blancos comunes: el espacio duro (U+00A0) no corta, como en
  // el navegador.
  for (const match of text.matchAll(/[^ \t\n\r\f\v]+/g)) {
    const start = match.index;
    const token = match[0];
    const dashOnly = DASH_ONLY.test(token);
    if (word > 0) {
      if (dashOnly || previousDashOnly)
        push({ type: 'penalty', width: 0, penalty: INFINITY_PENALTY, flagged: false });
      else breakStarts.push(start);
      push({ type: 'glue', width: spaceWidth, stretch, shrink });
    }
    previousDashOnly = dashOnly;
    const shaped = shape(font, token, options);
    // Cortes dentro de la palabra: el guion de cada compuesta y las sílabas de cada parte.
    const cuts: { at: number; kind: WordBreak }[] = [];
    let partStart = 0;
    for (let i = 0; i <= token.length; i++) {
      const compound =
        i < token.length &&
        token[i] === '-' &&
        LETTER.test(token[i - 1] ?? '') &&
        LETTER.test(token[i + 1] ?? '');
      if (i < token.length && !compound) continue;
      const part = token.slice(partStart, i);
      if (options.hyphenate !== false)
        for (const point of hyphenationPoints(part, options))
          cuts.push({ at: partStart + point, kind: 'syllable' });
      if (
        compound &&
        countLetters(token.slice(0, i)) >= leftMin &&
        countLetters(token.slice(i + 1)) >= rightMin
      )
        cuts.push({ at: i + 1, kind: 'compound' });
      partStart = i + 1;
    }
    const bounds = [0, ...cuts.map((c) => c.at), token.length];
    for (let i = 0; i < bounds.length - 1; i++) {
      const from = bounds[i]!;
      const to = bounds[i + 1]!;
      const width = shaped.glyphs
        .filter((g) => g.cluster >= from && g.cluster < to)
        .reduce((sum, g) => sum + g.advance, 0);
      if (i > 0) {
        const kind = cuts[i - 1]!.kind;
        wordBreaks.set(items.length, kind);
        breakStarts.push(start + from);
        // En la compuesta el guion ya está en el texto: cortar no agrega ancho.
        push({
          type: 'penalty',
          width: kind === 'syllable' ? hyphenWidth : 0,
          penalty: hyphenPenalty,
          flagged: true,
        });
      }
      push({ type: 'box', width }, { word, start: start + from, end: start + to });
    }
    word++;
  }
  // Fin de párrafo: la última línea queda corta (pegamento que se estira sin límite) y se corta sí o sí.
  push({ type: 'glue', width: 0, stretch: INFINITY_PENALTY * spaceWidth, shrink: 0 });
  push({ type: 'penalty', width: 0, penalty: -INFINITY_PENALTY, flagged: false });
  return {
    font,
    text,
    options,
    items,
    segments,
    wordBreaks,
    breakStarts,
    spaceWidth,
    hyphenWidth,
  };
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
  /**
   * El tope de guiones seguidos o el largo mínimo de la última línea no se pudieron cumplir y se
   * compuso sin ellos (antes de llegar al corte voraz).
   */
  relaxed: boolean;
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
  let relaxed = false;
  if (algorithm === 'knuth-plass') {
    const tolerances = options.tolerance ? [options.tolerance, ...TOLERANCES] : TOLERANCES;
    const constrained = options.maxConsecutiveHyphens !== undefined || !!options.minLastLine;
    // Primero con las reglas pedidas; si no hay solución con ninguna tolerancia, sin ellas.
    const passes = constrained
      ? [options, { ...options, maxConsecutiveHyphens: undefined, minLastLine: 0 }]
      : [options];
    for (const [pass, rules] of passes.entries()) {
      for (const tolerance of tolerances) {
        const breaks: Break[] | null = knuthPlass(paragraph.items, {
          ...rules,
          tolerance,
          lineWidth: widthAt,
        });
        if (breaks) {
          positions = breaks.map((b) => b.position);
          relaxed = pass > 0;
          break;
        }
      }
      if (positions) break;
    }
  }
  const fallback = algorithm === 'knuth-plass' && !positions;
  positions ??= greedyBreaks(paragraph.items, widthAt);
  return {
    lines: buildLines(paragraph, positions, widthAt, indent, options.justify ?? true),
    algorithm,
    fallback,
    relaxed,
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
  // La línea anterior cortó en el guion de una compuesta: éste se repite al comienzo (RAE).
  let repeatHyphen = false;
  positions.forEach((position, lineIndex) => {
    const last = lineIndex === positions.length - 1;
    const width = widthAt(lineIndex);
    const breakItem = items[position];
    const hyphenated = breakItem?.type === 'penalty' && breakItem.flagged;
    const wordBreak = paragraph.wordBreaks.get(position);
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
      const prefix = repeatHyphen && i === 0 ? '-' : '';
      const suffix = wordBreak === 'syllable' && i === words.length - 1 ? '-' : '';
      return {
        ...w,
        prefix,
        run: shape(font, prefix + text.slice(w.start, w.end) + suffix, options),
      };
    });
    repeatHyphen = wordBreak === 'compound';
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
        const inWord = g.cluster - piece.prefix.length;
        const isHyphen = inWord < 0 || inWord >= wordLength;
        glyphs.push({
          id: g.id,
          x: x + g.xOffset,
          y: g.yOffset,
          advance: g.advance,
          cluster: piece.start + Math.min(Math.max(inWord, 0), wordLength),
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
