/**
 * Motor de composición de Maquetario (prototipo de la etapa 4, todavía sin conectar a la app).
 *
 *   const font = loadFont(readFileSync('DM-Sans-400.ttf'));
 *   const run = shape(font, 'oficina', { size: 10 });            // glifos con avances
 *   const paragraph = createParagraph(font, texto, { size: 10, language: 'es' });
 *   const { lines } = breakLines(paragraph, 300);                 // Knuth-Plass, justificado
 *
 * Plan para conectarlo: docs/MOTOR_09-nov_composicion.md.
 */
export {
  type ComposeFont,
  loadFont,
  shape,
  type ShapedGlyph,
  type ShapedRun,
  type ShapeOptions,
} from './shape.ts';
export { type HyphenationOptions, type HyphenLanguage, hyphenationPoints } from './hyphenate.ts';
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
  greedyBreaks,
  type LayoutOptions,
  type Line,
  type LineGlyph,
  type Paragraph,
  paragraphDemerits,
  type ParagraphOptions,
} from './paragraph.ts';
