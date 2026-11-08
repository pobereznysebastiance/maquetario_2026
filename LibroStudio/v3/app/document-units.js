'use strict';

const measureSelector = [
  '[data-object-geometry]','[data-paragraph]','[data-cover-size]','#coverWrap','#coverY',
  '[data-shape-prop="strokeWidth"]','[data-shape-prop="cornerRadius"]',
  '[data-extra="indent"]','[data-extra="spaceAfter"]',
  '#paragraphStyleLeft','#paragraphStyleRight','#paragraphStyleFirst','#paragraphStyleBefore','#paragraphStyleAfter'
].join(',');
function isLengthField(field) {
  if (field.matches('#newWidth,#newHeight')) return false;
  if (field.matches(measureSelector)) return true;
  const unit = field.parentElement.querySelector(':scope > .unit');
  const label = field.labels?.[0] || field.closest('.field-row,.control')?.querySelector('label');
  return unit?.textContent.trim() === 'mm' || /\bmm\b/.test(label?.textContent || '');
}

// Browser inputs edit the displayed length. Existing model handlers read and write mm.
function adaptLengthField(field) {
  if (field.dataset.unitConverted || !isLengthField(field)) return;
  field.dataset.unitConverted = 'cm';
  const canonical = (value, factor) => value === '' || value === 'any' || !Number.isFinite(Number(value))
    ? value : String(Number((Number(value)*factor).toFixed(10)));
  for (const property of ['value','min','max','step']) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,property);
    const original = descriptor.get.call(field);
    descriptor.set.call(field,canonical(original,.1));
    Object.defineProperty(field,property,{
      get() { return canonical(descriptor.get.call(this),10); },
      set(value) { descriptor.set.call(this,canonical(String(value),.1)); }
    });
  }
}

function adaptLengthControls(root) {
  if (documentUnit() !== 'cm') return;
  for (const field of root.querySelectorAll('input[type="number"]')) adaptLengthField(field);
  for (const label of root.querySelectorAll('label,.unit')) {
    if (label.htmlFor === 'newWidth' || label.htmlFor === 'newHeight') continue;
    for (const node of label.childNodes) if (node.nodeType === Node.TEXT_NODE) {
      const next = node.textContent.replace(/\bmm\b/g,'cm');
      if (next !== node.textContent) node.textContent = next;
    }
  }
}
decorateInspector(()=>{adaptLengthControls($('#inspectorContent')); },'document-units');
extend('modal',unitsModal=>function(...args){
  unitsModal(...args);
  if ($('#modal').open && !$('#pageUnits')) adaptLengthControls($('#modalBody'));
},'document-units');
extend('coverEditor',unitsCover=>function(){
  unitsCover();
  if ($('#coverPreview')) adaptLengthControls($('#modalBody'));
},'document-units');


const statusUnit = $('.statusbar .status-spacer').nextElementSibling;
extend('updateStatus',unitStatus=>function(){
  unitStatus();
  statusUnit.textContent = bw('Unidades','Units','Unidades')+': '+documentUnit();
  const object = selectObject();
  if (object) {
    const text = $('#selectionText');
    text.textContent = text.textContent.split(' · ')[0]+' · '+displayDimensions(object.w,object.h);
  }
  if ($('#documentFormat')) $('#documentFormat').textContent = book.format+' · '+displayDimensions(book.width,book.height);
},'document-units');
