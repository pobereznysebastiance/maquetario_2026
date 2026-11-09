/**
 * Motor de composición de Maquetario (etapa 4) para Node: lo mismo que src/browser.ts, con la
 * separación silábica cargada desde LibroStudio/v3/app/hyphenation.
 *
 *   const font = loadFont(readFileSync('DM-Sans-400.ttf'));
 *   const { lines } = breakLines(createParagraph(font, texto, { size: 10 }), 300);
 */
import './hyphenate-node.ts';

export * from './browser.ts';
