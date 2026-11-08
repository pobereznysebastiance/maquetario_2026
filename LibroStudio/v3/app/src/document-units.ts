// Unidad de medida del documento (mm o cm). El modelo guarda siempre milímetros; con el documento
// en centímetros, los campos de longitud muestran y aceptan cm, y la barra de estado lo indica.
// Fuente TypeScript: se compila a build/document-units.js (desktop/scripts/build.mjs).

const measureSelector = [
  '[data-object-geometry]',
  '[data-paragraph]',
  '[data-cover-size]',
  '#coverWrap',
  '#coverY',
  '[data-shape-prop="strokeWidth"]',
  '[data-shape-prop="cornerRadius"]',
  '[data-extra="indent"]',
  '[data-extra="spaceAfter"]',
  '#paragraphStyleLeft',
  '#paragraphStyleRight',
  '#paragraphStyleFirst',
  '#paragraphStyleBefore',
  '#paragraphStyleAfter',
].join(',');

function isLengthField(field: HTMLInputElement): boolean {
  if (field.matches('#newWidth,#newHeight')) return false;
  if (field.matches(measureSelector)) return true;
  const unit = field.parentElement?.querySelector(':scope > .unit');
  const label = field.labels?.[0] || field.closest('.field-row,.control')?.querySelector('label');
  return unit?.textContent?.trim() === 'mm' || /\bmm\b/.test(label?.textContent || '');
}

// El campo del navegador edita la longitud mostrada (cm); los manejadores del modelo leen y
// escriben mm. Se reemplazan value/min/max/step del campo por versiones que convierten.
function adaptLengthField(field: HTMLInputElement): void {
  if (field.dataset.unitConverted || !isLengthField(field)) return;
  field.dataset.unitConverted = 'cm';
  const canonical = (value: string, factor: number): string =>
    value === '' || value === 'any' || !Number.isFinite(Number(value))
      ? value
      : String(Number((Number(value) * factor).toFixed(10)));
  for (const property of ['value', 'min', 'max', 'step'] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, property)!;
    const original = descriptor.get!.call(field);
    descriptor.set!.call(field, canonical(original, 0.1));
    Object.defineProperty(field, property, {
      get() {
        return canonical(descriptor.get!.call(this), 10);
      },
      set(value) {
        descriptor.set!.call(this, canonical(String(value), 0.1));
      },
    });
  }
}

function adaptLengthControls(root: ParentNode): void {
  if (documentUnit() !== 'cm') return;
  for (const field of root.querySelectorAll<HTMLInputElement>('input[type="number"]'))
    adaptLengthField(field);
  for (const label of root.querySelectorAll<HTMLLabelElement>('label,.unit')) {
    if (label.htmlFor === 'newWidth' || label.htmlFor === 'newHeight') continue;
    for (const node of label.childNodes)
      if (node.nodeType === Node.TEXT_NODE) {
        const next = node.textContent!.replace(/\bmm\b/g, 'cm');
        if (next !== node.textContent) node.textContent = next;
      }
  }
}
decorateInspector(() => {
  adaptLengthControls($('#inspectorContent'));
}, 'document-units');
extend.after(
  'modal',
  function () {
    if ($('#modal').open && !$('#pageUnits')) adaptLengthControls($('#modalBody'));
  },
  'document-units',
);
extend.after(
  'coverEditor',
  function () {
    if ($('#coverPreview')) adaptLengthControls($('#modalBody'));
  },
  'document-units',
);

const statusUnit = $('.statusbar .status-spacer').nextElementSibling!;
extend.after(
  'updateStatus',
  function () {
    statusUnit.textContent = bw('Unidades', 'Units', 'Unidades') + ': ' + documentUnit();
    const object = selectObject();
    if (object) {
      const text = $('#selectionText');
      text.textContent =
        text.textContent!.split(' · ')[0] + ' · ' + displayDimensions(object.w, object.h);
    }
    if ($('#documentFormat'))
      $('#documentFormat').textContent =
        book.format + ' · ' + displayDimensions(book.width, book.height);
  },
  'document-units',
);

export {};
