// Separación silábica por párrafo: el texto con guiones discrecionales que se muestra en la página
// y la lectura de los controles (activar e idioma del texto) del inspector y los estilos de
// párrafo. No tiene efectos al cargar: se importa. Lo que pasa mientras se escribe está en
// hyphenation-controls.ts.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

/** Formato efectivo de un párrafo (lo que devuelve paragraphFormat). */
type ParagraphFormat = Record<string, any>;

/** Separadores por idioma (es, en, pt): cada uno se arma la primera vez que se usa. */
const paragraphHyphenators: Record<string, (text: string) => string> = {};
const hyphenatorFor = (language: string): ((text: string) => string) => {
  const patterns = {
    es: hyphenationPatternsEs,
    en: hyphenationPatternsEnUs,
    pt: hyphenationPatternsPt,
  };
  if (Object.hasOwn(patterns, language))
    paragraphHyphenators[language] ??= createHyphenator(
      patterns[language as keyof typeof patterns],
    );
  return paragraphHyphenators[language];
};

/** Pone el texto en el elemento, con guiones discrecionales si el formato lo pide. */
export function setHyphenatedText(
  element: HTMLElement,
  text: string,
  format: ParagraphFormat,
): void {
  const language = format.hyphenLanguage || 'es';
  element.lang = language;
  element.style.hyphens = format.hyphenate ? 'manual' : 'none';
  element.textContent = (format.hyphenate ? hyphenatorFor(language)(text) : text) || ' ';
}

/** Lee los controles de separación silábica (#<prefix>Enabled y #<prefix>Language). */
export function readHyphenationFields(prefix: string): {
  hyphenate: boolean;
  hyphenLanguage: string;
} {
  return {
    hyphenate: $('#' + prefix + 'Enabled').checked,
    hyphenLanguage: $('#' + prefix + 'Language').value,
  };
}
