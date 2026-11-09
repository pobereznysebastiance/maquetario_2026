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
import { type ComposeFont, shape, type ShapedGlyph, type ShapeOptions } from './shape.ts';

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
  run: number;
  start: number;
  end: number;
}

/** Corte dentro de una palabra: por sílaba (se agrega un guion) o en el guion de una compuesta. */
export type WordBreak = 'syllable' | 'compound';

/**
 * Un tramo del párrafo con su propia fuente o formato: negrita, cursiva, otra fuente u otro
 * cuerpo. Lo que no dice lo toma del párrafo (ParagraphOptions).
 */
export interface TextRun {
  text: string;
  font: ComposeFont;
  size?: number;
  letterSpacing?: number;
  features?: string[];
}

/** Un tramo ya ubicado en el texto del párrafo, con lo que necesita para conformarse. */
export interface ParagraphRun {
  readonly font: ComposeFont;
  readonly shape: ShapeOptions;
  readonly start: number;
  readonly end: number;
  /** Ancho natural del espacio y cuánto se estira y se encoge, en puntos. */
  readonly spaceWidth: number;
  readonly stretch: number;
  readonly shrink: number;
}

export interface Paragraph {
  /** La fuente del primer tramo (la del párrafo, si tiene uno solo). */
  readonly font: ComposeFont;
  readonly text: string;
  readonly options: ParagraphOptions;
  readonly runs: readonly ParagraphRun[];
  readonly items: Item[];
  /** Para cada ítem caja, el trozo de texto y su tramo; para los demás, null. */
  readonly segments: (Segment | null)[];
  /** Para cada pegamento entre palabras, el tramo del espacio. */
  readonly glueRuns: ReadonlyMap<number, number>;
  /** Los cortes dentro de palabras, por índice de ítem (la penalización). */
  readonly wordBreaks: ReadonlyMap<number, WordBreak>;
  /** Dónde puede empezar una línea (índices del texto), además del comienzo. */
  readonly breakStarts: readonly number[];
  /** Espacio y guion del primer tramo. */
  readonly spaceWidth: number;
  readonly hyphenWidth: number;
}

const LETTER = /\p{L}/u;
const DASH_ONLY = /^[–—]+$/;
const countLetters = (text: string): number => [...text].filter((c) => LETTER.test(c)).length;

/** Arma un párrafo de un solo tramo (ver createRunParagraph). */
export function createParagraph(
  font: ComposeFont,
  text: string,
  options: ParagraphOptions,
): Paragraph {
  return createRunParagraph([{ text, font }], options);
}

/**
 * Arma el párrafo con sus tramos: cada trozo de palabra se conforma con la cara y el formato de
 * su tramo, y las cajas de Knuth-Plass llevan esos anchos. Un tramo no es un lugar de corte: una
 * palabra con una parte en cursiva sigue siendo una palabra. Cada espacio se estira según el
 * tramo al que pertenece. Los blancos seguidos cuentan como un espacio.
 *
 * Reglas de corte del castellano:
 * - dentro de una palabra sólo se corta por sílaba (con guion) o en el guion de una palabra
 *   compuesta, y entonces el guion se repite al comienzo de la línea siguiente (RAE);
 * - nunca después de una raya o un guion de rango pegados (—dijo—, 1990–2000): la raya de
 *   apertura no queda al final de línea ni la de cierre al comienzo;
 * - una raya suelta, entre espacios, queda pegada a sus vecinas;
 * - el espacio duro (U+00A0) no corta ni se estira: es parte de la palabra.
 */
export function createRunParagraph(input: TextRun[], options: ParagraphOptions): Paragraph {
  if (!input.length) throw new Error('Un párrafo necesita al menos un tramo.');
  const runs: ParagraphRun[] = [];
  let offset = 0;
  for (const run of input) {
    const shapeOptions: ShapeOptions = {
      ...options,
      size: run.size ?? options.size,
      letterSpacing: run.letterSpacing ?? options.letterSpacing,
      features: run.features ?? options.features,
    };
    const spaceWidth = shape(run.font, ' ', shapeOptions).width;
    runs.push({
      font: run.font,
      shape: shapeOptions,
      start: offset,
      end: offset + run.text.length,
      spaceWidth,
      stretch: spaceWidth * (options.spaceStretch ?? 1 / 2),
      shrink: spaceWidth * (options.spaceShrink ?? 1 / 3),
    });
    offset += run.text.length;
  }
  const text = input.map((run) => run.text).join('');
  const runAt = (index: number): number => {
    const found = runs.findIndex((run) => index >= run.start && index < run.end);
    return found < 0 ? runs.length - 1 : found;
  };
  const hyphenWidths = runs.map((run) => shape(run.font, '-', run.shape).width);
  const hyphenPenalty = options.hyphenPenalty ?? 50;
  const leftMin = options.leftMin ?? 2;
  const rightMin = options.rightMin ?? 3;
  const items: Item[] = [];
  const segments: (Segment | null)[] = [];
  const glueRuns = new Map<number, number>();
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
      // El espacio es del tramo del blanco que precede a la palabra.
      const space = runs[runAt(start - 1)]!;
      glueRuns.set(items.length, runAt(start - 1));
      push({ type: 'glue', width: space.spaceWidth, stretch: space.stretch, shrink: space.shrink });
    }
    previousDashOnly = dashOnly;
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
    // Cada trozo de la palabra que cae en un tramo se conforma con la cara de ese tramo.
    const pieces: { from: number; to: number; run: number; glyphs: ShapedGlyph[] }[] = [];
    for (let from = 0; from < token.length;) {
      const run = runAt(start + from);
      const to = Math.min(token.length, runs[run]!.end - start);
      const shaped = shape(runs[run]!.font, token.slice(from, to), runs[run]!.shape);
      pieces.push({ from, to, run, glyphs: shaped.glyphs });
      from = to;
    }
    const bounds = [
      ...new Set([0, ...cuts.map((c) => c.at), ...pieces.map((p) => p.from), token.length]),
    ].sort((a, b) => a - b);
    for (let i = 0; i < bounds.length - 1; i++) {
      const from = bounds[i]!;
      const to = bounds[i + 1]!;
      const piece = pieces.find((p) => from >= p.from && from < p.to)!;
      const width = piece.glyphs
        .filter((g) => g.cluster + piece.from >= from && g.cluster + piece.from < to)
        .reduce((sum, g) => sum + g.advance, 0);
      const cut = cuts.find((c) => c.at === from);
      if (cut) {
        wordBreaks.set(items.length, cut.kind);
        breakStarts.push(start + from);
        // En la compuesta el guion ya está en el texto: cortar no agrega ancho.
        push({
          type: 'penalty',
          width: cut.kind === 'syllable' ? hyphenWidths[runAt(start + from - 1)]! : 0,
          penalty: hyphenPenalty,
          flagged: true,
        });
      }
      push({ type: 'box', width }, { word, run: piece.run, start: start + from, end: start + to });
    }
    word++;
  }
  // Fin de párrafo: la última línea queda corta (pegamento que se estira sin límite) y se corta sí o sí.
  push({ type: 'glue', width: 0, stretch: INFINITY_PENALTY * runs[0]!.spaceWidth, shrink: 0 });
  push({ type: 'penalty', width: 0, penalty: -INFINITY_PENALTY, flagged: false });
  return {
    font: runs[0]!.font,
    text,
    options,
    runs,
    items,
    segments,
    glueRuns,
    wordBreaks,
    breakStarts,
    spaceWidth: runs[0]!.spaceWidth,
    hyphenWidth: hyphenWidths[0]!,
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
  /** Tramo del párrafo al que pertenece (su fuente y cuerpo). */
  run: number;
  /** El guion agregado al cortar la palabra. */
  hyphen?: boolean;
}

/** Un trozo de la línea con un mismo tramo: lo que el dibujo pone con una sola fuente. */
export interface LineSegment {
  run: number;
  /** Texto, con los espacios entre palabras y el guion si corta. */
  text: string;
  /** Lo que se suma a cada espacio del trozo por la justificación, en puntos. */
  spaceExtra: number;
}

export interface Line {
  /** Texto de la línea, con el guion si corta una palabra. */
  text: string;
  /** La línea por tramos, en orden. */
  segments: LineSegment[];
  /** Tramo del texto del párrafo que ocupa la línea. */
  start: number;
  end: number;
  glyphs: LineGlyph[];
  /** Ancho pedido y ancho natural (con espacios sin estirar), en puntos. */
  width: number;
  naturalWidth: number;
  /** Holgura: ancho pedido menos ancho natural (negativa si hubo que encoger). */
  slack: number;
  /** Ancho final de cada espacio del primer tramo. */
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
  const { items, segments, runs, text } = paragraph;
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
    // Trozos de la línea (unidos por palabra y tramo) y los espacios entre palabras.
    const parts: { word: number; run: number; start: number; end: number; gap?: number }[] = [];
    let pendingGap: number | undefined;
    for (let i = from; i < position; i++) {
      const item = items[i]!;
      if (item.type === 'glue' && paragraph.glueRuns.has(i)) pendingGap = i;
      const segment = segments[i];
      if (!segment) continue;
      const previous = parts.at(-1);
      if (previous && previous.word === segment.word && previous.run === segment.run)
        previous.end = segment.end;
      else
        parts.push({
          ...segment,
          ...(previous && previous.word !== segment.word ? { gap: pendingGap } : {}),
        });
      pendingGap = undefined;
    }
    const pieces = parts.map((part, i) => {
      const prefix = repeatHyphen && i === 0 ? '-' : '';
      const suffix = wordBreak === 'syllable' && i === parts.length - 1 ? '-' : '';
      const run = runs[part.run]!;
      return {
        ...part,
        prefix,
        shaped: shape(run.font, prefix + text.slice(part.start, part.end) + suffix, run.shape),
      };
    });
    repeatHyphen = wordBreak === 'compound';
    const gaps = pieces.flatMap((piece) => {
      if (piece.gap === undefined) return [];
      const glue = items[piece.gap]!;
      return glue.type === 'glue' ? [{ piece, glue, run: paragraph.glueRuns.get(piece.gap)! }] : [];
    });
    const naturalWidth =
      pieces.reduce((sum, p) => sum + p.shaped.width, 0) +
      gaps.reduce((sum, g) => sum + g.glue.width, 0);
    const slack = width - naturalWidth;
    const stretch = gaps.reduce((sum, g) => sum + g.glue.stretch, 0);
    const shrink = gaps.reduce((sum, g) => sum + g.glue.shrink, 0);
    let ratio = 0;
    if (gaps.length && (slack < 0 || (justify && !last)))
      ratio = slack >= 0 ? slack / stretch : slack / shrink;
    const extraFor = (run: ParagraphRun) => (ratio >= 0 ? ratio * run.stretch : ratio * run.shrink);

    const glyphs: LineGlyph[] = [];
    const chunks: { run: number; text: string }[] = [];
    let x = lineIndex === 0 ? indent : 0;
    for (const piece of pieces) {
      const gap = gaps.find((g) => g.piece === piece);
      if (gap) {
        x += gap.glue.width + extraFor(runs[gap.run]!);
        chunks.push({ run: gap.run, text: ' ' });
      }
      const length = piece.end - piece.start;
      for (const g of piece.shaped.glyphs) {
        const inPiece = g.cluster - piece.prefix.length;
        const isHyphen = inPiece < 0 || inPiece >= length;
        glyphs.push({
          id: g.id,
          x: x + g.xOffset,
          y: g.yOffset,
          advance: g.advance,
          cluster: piece.start + Math.min(Math.max(inPiece, 0), length),
          run: piece.run,
          ...(isHyphen ? { hyphen: true } : {}),
        });
        x += g.advance;
      }
      chunks.push({ run: piece.run, text: piece.shaped.text });
    }
    const lineSegments: LineSegment[] = [];
    for (const chunk of chunks) {
      const previous = lineSegments.at(-1);
      if (previous?.run === chunk.run) previous.text += chunk.text;
      else
        lineSegments.push({
          run: chunk.run,
          text: chunk.text,
          spaceExtra: extraFor(runs[chunk.run]!),
        });
    }
    const start = pieces[0]?.start ?? 0;
    const end = pieces.at(-1)?.end ?? start;
    lines.push({
      text: lineSegments.map((segment) => segment.text).join(''),
      segments: lineSegments,
      start,
      end,
      glyphs,
      width,
      naturalWidth,
      slack,
      spaceWidth: runs[0]!.spaceWidth + extraFor(runs[0]!),
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
