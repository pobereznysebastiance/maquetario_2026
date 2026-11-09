// Separación silábica: la misma biblioteca y los mismos patrones que usa la app hoy
// (LibroStudio/v3/app/hyphenation: hyphen.js de Yevhen Tiurin, ISC, con patrones de TeX para
// español, inglés de EE. UU. y portugués). En la app se cargan como scripts globales
// (createHyphenator, hyphenationPatternsEs…; src/hyphenation-controls.ts); acá se cargan con
// require, porque los archivos son UMD. Si un día se mueven a un paquete, cambia sólo esta ruta.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HYPHENATION_DIR = '../../../LibroStudio/v3/app/hyphenation/';

type Hyphenator = (text: string) => string;
type CreateHyphenator = (patterns: unknown, options?: Record<string, unknown>) => Hyphenator;

const PATTERN_FILES = { es: 'es.js', en: 'en-us.js', pt: 'pt.js' } as const;
export type HyphenLanguage = keyof typeof PATTERN_FILES;

const SOFT_HYPHEN = '­';
const hyphenators = new Map<HyphenLanguage, Hyphenator>();

function hyphenatorFor(language: HyphenLanguage): Hyphenator {
  let hyphenator = hyphenators.get(language);
  if (!hyphenator) {
    const createHyphenator = require(HYPHENATION_DIR + 'hyphen.js') as CreateHyphenator;
    const patterns: unknown = require(HYPHENATION_DIR + 'patterns/' + PATTERN_FILES[language]);
    // minWordLength 1: el mínimo de letras a cada lado lo decide hyphenationPoints.
    hyphenator = createHyphenator(patterns, { hyphenChar: SOFT_HYPHEN, minWordLength: 1 });
    hyphenators.set(language, hyphenator);
  }
  return hyphenator;
}

export interface HyphenationOptions {
  language?: HyphenLanguage;
  /** Mínimo de letras antes del guion (en la línea que corta). Por defecto 2. */
  leftMin?: number;
  /** Mínimo de letras después del guion (en la línea siguiente). Por defecto 3. */
  rightMin?: number;
}

const LETTER = /\p{L}/u;
const countLetters = (text: string): number => [...text].filter((c) => LETTER.test(c)).length;

/**
 * Dónde se puede cortar una palabra con guion: índices UTF-16 dentro de `word` (el guion va antes
 * del carácter de ese índice), respetando el mínimo de letras a cada lado.
 */
export function hyphenationPoints(word: string, options: HyphenationOptions = {}): number[] {
  const leftMin = options.leftMin ?? 2;
  const rightMin = options.rightMin ?? 3;
  if (word.includes('-') || countLetters(word) < leftMin + rightMin) return [];
  const marked = hyphenatorFor(options.language ?? 'es')(word);
  const points: number[] = [];
  let index = 0;
  for (const char of marked) {
    if (char === SOFT_HYPHEN) {
      const before = word.slice(0, index);
      const after = word.slice(index);
      if (countLetters(before) >= leftMin && countLetters(after) >= rightMin) points.push(index);
    } else index += char.length;
  }
  return points;
}
