// Separación silábica por párrafo: controles (activar e idioma del texto) para el inspector y los
// estilos de párrafo, y el texto con guiones discrecionales que se muestra en la página.
// Mientras se escribe, el párrafo muestra el manuscrito original (sin guiones); al terminar de
// editar se vuelve a separar.
//
// setHyphenatedText, hyphenationFields, readHyphenationFields y bindParagraphHyphenation son
// globales porque los usa paragraphs.js.
//
// Fuente TypeScript: se compila a build/hyphenation-controls.js (desktop/scripts/build.mjs).

import type { BookObject } from './model.ts';

/** Formato efectivo de un párrafo (lo que devuelve paragraphFormat). */
type ParagraphFormat = Record<string, any>;

declare global {
  /** Pone el texto en el elemento, con guiones discrecionales si el formato lo pide. */
  var setHyphenatedText: (element: HTMLElement, text: string, format: ParagraphFormat) => void;
  /** Marcado de los controles (casilla e idioma); formats marca la casilla como mezclada. */
  var hyphenationFields: (
    format: ParagraphFormat,
    prefix: string,
    formats?: ParagraphFormat[],
  ) => string;
  /** Lee los controles de hyphenationFields. */
  var readHyphenationFields: (prefix: string) => { hyphenate: boolean; hyphenLanguage: string };
  /** Conecta los controles del inspector de párrafo con paragraphPatch. */
  var bindParagraphHyphenation: (object: BookObject, formats: ParagraphFormat[]) => void;
}

const paragraphHyphenators: Record<string, (text: string) => string> = {
  es: createHyphenator(hyphenationPatternsEs),
  en: createHyphenator(hyphenationPatternsEnUs),
  pt: createHyphenator(hyphenationPatternsPt),
};

function setHyphenatedText(element: HTMLElement, text: string, format: ParagraphFormat): void {
  const language = format.hyphenLanguage || 'es';
  element.lang = language;
  element.style.hyphens = format.hyphenate ? 'manual' : 'none';
  element.textContent = (format.hyphenate ? paragraphHyphenators[language](text) : text) || ' ';
}
globalThis.setHyphenatedText = setHyphenatedText;

function hyphenationFields(
  format: ParagraphFormat,
  prefix: string,
  formats: ParagraphFormat[] = [format],
): string {
  const mixed = formats.some((item) => !!item.hyphenate !== !!format.hyphenate);
  return `<div class="control full hyphenation-controls">
    <label class="check-line"><input type="checkbox" id="${prefix}Enabled" ${format.hyphenate && !mixed ? 'checked' : ''}>
    ${bw('Separación silábica', 'Hyphenation', 'Separação silábica')}</label>
    <label for="${prefix}Language">${bw('Idioma del texto', 'Text language', 'Idioma do texto')}</label>
    <select id="${prefix}Language">${[
      ['es', 'Español'],
      ['en', 'English'],
      ['pt', 'Português'],
    ]
      .map(
        ([code, name]) =>
          `<option value="${code}" ${(format.hyphenLanguage || 'es') === code ? 'selected' : ''}>${name}</option>`,
      )
      .join('')}</select>
  </div>`;
}
globalThis.hyphenationFields = hyphenationFields;

function readHyphenationFields(prefix: string): { hyphenate: boolean; hyphenLanguage: string } {
  return {
    hyphenate: $('#' + prefix + 'Enabled').checked,
    hyphenLanguage: $('#' + prefix + 'Language').value,
  };
}
globalThis.readHyphenationFields = readHyphenationFields;

function bindParagraphHyphenation(object: BookObject, formats: ParagraphFormat[]): void {
  const enabled = $('#paragraphHyphenEnabled'),
    language = $('#paragraphHyphenLanguage');
  enabled.indeterminate = formats.some((format) => !!format.hyphenate !== !!formats[0].hyphenate);
  enabled.disabled = language.disabled = !!object.locked;
  enabled.onchange = () => paragraphPatch(readHyphenationFields('paragraphHyphen'));
  language.onchange = () => paragraphPatch({ hyphenLanguage: language.value });
}
globalThis.bindParagraphHyphenation = bindParagraphHyphenation;

// Mientras se escribe, usar el manuscrito original para que los guiones discrecionales nunca entren en él.
extend.after(
  'startEditing',
  function (element: HTMLElement) {
    if (editing !== element) return;
    const object = selectObject();
    if (!object || object.type !== 'text' || object.id !== element.dataset.id) return;
    const lines = object.text.split('\n');
    element.querySelectorAll('.mqt-paragraph').forEach((paragraph, index) => {
      if (paragraphFormat(book, object, index).hyphenate)
        paragraph.textContent = lines[index] || ' ';
    });
  },
  'hyphenation-controls',
);

extend(
  'finishEditing',
  (finishBeforeHyphenation) =>
    function () {
      const element = editing,
        object = element && selectObject();
      finishBeforeHyphenation();
      if (!object || object.type !== 'text' || object.id !== element!.dataset.id) return;
      const lines = object.text.split('\n');
      element!.querySelectorAll('.mqt-paragraph').forEach((paragraph, index) => {
        const format = paragraphFormat(book, object, index);
        if (format.hyphenate)
          setHyphenatedText(paragraph as HTMLElement, lines[index] || '', format);
      });
    },
  'hyphenation-controls',
);
