// Separación silábica en Node: carga hyphen.js y los patrones de la app con require (los archivos
// son UMD). Si un día se mueven a un paquete, cambia sólo esta ruta. En la página no se usa: allí
// ya están cargados como scripts globales.
import { createRequire } from 'node:module';
import {
  type HyphenLanguage,
  type Hyphenator,
  setHyphenatorLoader,
  SOFT_HYPHEN,
} from './hyphenate.ts';

const require = createRequire(import.meta.url);
const HYPHENATION_DIR = '../../../LibroStudio/v3/app/hyphenation/';
const PATTERN_FILES: Record<HyphenLanguage, string> = { es: 'es.js', en: 'en-us.js', pt: 'pt.js' };

type CreateHyphenator = (patterns: unknown, options?: Record<string, unknown>) => Hyphenator;

setHyphenatorLoader((language) => {
  const createHyphenator = require(HYPHENATION_DIR + 'hyphen.js') as CreateHyphenator;
  const patterns: unknown = require(HYPHENATION_DIR + 'patterns/' + PATTERN_FILES[language]);
  // minWordLength 1: el mínimo de letras a cada lado lo decide hyphenationPoints.
  return createHyphenator(patterns, { hyphenChar: SOFT_HYPHEN, minWordLength: 1 });
});
