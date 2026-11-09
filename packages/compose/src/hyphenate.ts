// Separación silábica: dónde se puede cortar una palabra con guion. El motor no trae patrones
// propios: usa la misma biblioteca que la app (LibroStudio/v3/app/hyphenation: hyphen.js de
// Yevhen Tiurin, ISC, con patrones de TeX para español, inglés de EE. UU. y portugués).
// - En Node (pruebas), hyphenate-node.ts la carga desde esa carpeta (src/index.ts lo importa).
// - En la app, la página ya la tiene cargada (createHyphenator, hyphenationPatternsEs…): se pasa
//   como opción `hyphenator` o con setHyphenatorLoader (src/browser.ts no carga nada de Node).

/** Devuelve la palabra con guiones discrecionales (U+00AD) donde se puede cortar. */
export type Hyphenator = (word: string) => string;
export type HyphenLanguage = 'es' | 'en' | 'pt';

/** U+00AD, el guion discrecional (escrito así para que no se pierda al editar el archivo). */
export const SOFT_HYPHEN = String.fromCharCode(0xad);

let loader: ((language: HyphenLanguage) => Hyphenator) | null = null;
const hyphenators = new Map<HyphenLanguage, Hyphenator>();

/** De dónde sale el separador de cada idioma cuando no se pasa `hyphenator`. */
export function setHyphenatorLoader(load: (language: HyphenLanguage) => Hyphenator): void {
  loader = load;
  hyphenators.clear();
}

function hyphenatorFor(language: HyphenLanguage): Hyphenator {
  let hyphenator = hyphenators.get(language);
  if (!hyphenator) {
    if (!loader)
      throw new Error('Falta la separación silábica: pasá `hyphenator` o usá setHyphenatorLoader.');
    hyphenator = loader(language);
    hyphenators.set(language, hyphenator);
  }
  return hyphenator;
}

export interface HyphenationOptions {
  language?: HyphenLanguage;
  /** Separador a usar en lugar del del idioma (por ejemplo, el mismo que usa la página). */
  hyphenator?: Hyphenator;
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
  const marked = (options.hyphenator ?? hyphenatorFor(options.language ?? 'es'))(word);
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
