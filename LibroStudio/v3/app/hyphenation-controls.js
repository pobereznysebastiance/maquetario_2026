'use strict';

const paragraphHyphenators = {
  es:createHyphenator(hyphenationPatternsEs),
  en:createHyphenator(hyphenationPatternsEnUs),
  pt:createHyphenator(hyphenationPatternsPt)
};

function setHyphenatedText(element, text, format) {
  const language = format.hyphenLanguage || 'es';
  element.lang = language;
  element.style.hyphens = format.hyphenate ? 'manual' : 'none';
  element.textContent = (format.hyphenate ? paragraphHyphenators[language](text) : text) || '\u00a0';
}

function hyphenationFields(format, prefix, formats = [format]) {
  const mixed = formats.some(item => !!item.hyphenate !== !!format.hyphenate);
  return `<div class="control full hyphenation-controls">
    <label class="check-line"><input type="checkbox" id="${prefix}Enabled" ${format.hyphenate && !mixed ? 'checked' : ''}>
    ${bw('Separación silábica','Hyphenation','Separação silábica')}</label>
    <label for="${prefix}Language">${bw('Idioma del texto','Text language','Idioma do texto')}</label>
    <select id="${prefix}Language">${[['es','Español'],['en','English'],['pt','Português']].map(([code,name]) =>
      `<option value="${code}" ${(format.hyphenLanguage || 'es') === code ? 'selected' : ''}>${name}</option>`).join('')}</select>
  </div>`;
}

function readHyphenationFields(prefix) {
  return {hyphenate:$('#'+prefix+'Enabled').checked,hyphenLanguage:$('#'+prefix+'Language').value};
}

function bindParagraphHyphenation(object, formats) {
  const enabled = $('#paragraphHyphenEnabled'), language = $('#paragraphHyphenLanguage');
  enabled.indeterminate = formats.some(format => !!format.hyphenate !== !!formats[0].hyphenate);
  enabled.disabled = language.disabled = !!object.locked;
  enabled.onchange = () => paragraphPatch(readHyphenationFields('paragraphHyphen'));
  language.onchange = () => paragraphPatch({hyphenLanguage:language.value});
}

// While typing, use the original manuscript so discretionary hyphens never enter it.
extend.after('startEditing',function(element){
  if (editing !== element) return;
  const object = selectObject();
  if (!object || object.type !== 'text' || object.id !== element.dataset.id) return;
  const lines = object.text.split('\n');
  element.querySelectorAll('.mqt-paragraph').forEach((paragraph, index) => {
    if (paragraphFormat(book, object, index).hyphenate) paragraph.textContent = lines[index] || '\u00a0';
  });
},'hyphenation-controls');

extend('finishEditing',finishBeforeHyphenation=>function(){
  const element = editing, object = element && selectObject();
  finishBeforeHyphenation();
  if (!object || object.type !== 'text' || object.id !== element.dataset.id) return;
  const lines = object.text.split('\n');
  element.querySelectorAll('.mqt-paragraph').forEach((paragraph, index) => {
    const format = paragraphFormat(book, object, index);
    if (format.hyphenate) setHyphenatedText(paragraph,lines[index] || '',format);
  });
},'hyphenation-controls');
