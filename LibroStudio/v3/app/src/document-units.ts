// Unidad de medida del documento (mm o cm). El modelo guarda siempre milímetros; con el documento
// en centímetros, los campos de longitud muestran y aceptan cm, y la barra de estado lo indica.
// La conversión de los campos está en length-fields.ts (sin efectos: las Hojas de React la
// importan); acá se engancha al inspector y a la cubierta.
// Fuente TypeScript: se compila a build/document-units.js (desktop/scripts/build.mjs).
import { fieldAdapters } from './components/inspector/fields.tsx';
import { adaptLengthControls, adaptLengthField } from './length-fields.ts';

// Inspector: cada campo nuevo se adapta una vez, al crearse (fields.tsx); la unidad que se ve
// junto al campo ya la dibuja el panel (lengthUnit).
fieldAdapters.push((field) => {
  if (field instanceof HTMLInputElement && field.type === 'number' && documentUnit() === 'cm')
    adaptLengthField(field);
});
extend.after(
  'coverEditor',
  function () {
    // La cubierta es una Ventana de React: sus medidas están en su .dialog-body.
    const body = $('#coverPreview')?.closest('.dialog-body');
    if (body) adaptLengthControls(body);
  },
  'document-units',
);

// La unidad, las medidas de la selección y el formato en la unidad del documento los muestran las
// barras de estado y del documento (src/components/statusbar y documentbar), con documentUnit()
// y displayDimensions().
