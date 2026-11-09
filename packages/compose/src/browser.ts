/**
 * Motor de composición de Maquetario (etapa 4) para la página: todo menos la carga de la
 * separación silábica desde disco, que es de Node. La app lo carga a pedido desde
 * LibroStudio/v3/app/src/modules/compose.ts y le pasa su propio separador (`hyphenator`).
 *
 *   const font = loadFont(bytes);
 *   const run = shape(font, 'oficina', { size: 10 });            // glifos con avances
 *   const paragraph = createParagraph(font, texto, { size: 10, language: 'es' });
 *   const { lines } = breakLines(paragraph, 300);                 // Knuth-Plass, justificado
 *
 * Plan para conectarlo: docs/MOTOR_09-nov_composicion.md.
 */
export {
  type ComposeFont,
  type FontAxis,
  loadFont,
  shape,
  type ShapedGlyph,
  type ShapedRun,
  type ShapeOptions,
  withVariations,
} from './shape.ts';
export {
  type HyphenationOptions,
  type Hyphenator,
  type HyphenLanguage,
  hyphenationPoints,
  setHyphenatorLoader,
  SOFT_HYPHEN,
} from './hyphenate.ts';
export {
  badnessOf,
  type Box,
  type Break,
  type BreakOptions,
  type Glue,
  INFINITY_PENALTY,
  type Item,
  knuthPlass,
  type Penalty,
} from './knuth-plass.ts';
export {
  breakLines,
  type ComposedParagraph,
  createParagraph,
  createRunParagraph,
  greedyBreaks,
  type LayoutOptions,
  type Line,
  type LineGlyph,
  type LineSegment,
  type Paragraph,
  paragraphDemerits,
  type ParagraphOptions,
  type ParagraphRun,
  type TextRun,
  type WordBreak,
} from './paragraph.ts';
