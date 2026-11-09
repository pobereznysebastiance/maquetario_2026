// Contenido de la Hoja "Crear / Definir estilo de párrafo" (paragraphs.ts → styleDialog, que la
// abre con modal.sheet y lee los campos al aplicar). Mismos ids que la versión en HTML:
// #paragraphStyleName, #paragraphStyleFont, #paragraphStyleSize… y los de separación silábica
// (#styleHyphenEnabled, #styleHyphenLanguage, que lee readHyphenationFields).
//
// Los campos no son controlados: el valor vive en el elemento, como antes. Por eso funciona el
// explorador de fuentes alojado: decorateFontBrowsers cambia el selector de familia por su botón,
// el explorador se abre encima de esta Hoja (que sigue montada, dialogs.tsx) y al aplicar escribe
// la familia en #paragraphStyleFont. Las longitudes van en la unidad del documento
// (adaptLengthControls, document-units.ts).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { useLayoutEffect, useRef } from 'react';
import { Control, Field, Select } from '../form/Form.tsx';
import type { ParagraphFormat, ParagraphStyle } from '../../paragraphs.ts';
import { bw } from '../../i18n/language.ts';
import { editor } from '../../core-api.ts';

interface FormProps {
  existing: ParagraphStyle | null | undefined;
  properties: ParagraphFormat;
  /** Textos de la interfaz de párrafos en el idioma actual (pw()). */
  words: Record<string, string>;
}

/** Separación silábica (la misma que hyphenationFields de hyphenation-controls.ts). */
const HyphenationFields = ({ format, prefix }: { format: ParagraphFormat; prefix: string }) => (
  <div className="control full hyphenation-controls">
    <label className="check-line">
      <input type="checkbox" id={prefix + 'Enabled'} defaultChecked={!!format.hyphenate} />
      {bw('Separación silábica', 'Hyphenation', 'Separação silábica')}
    </label>
    <label htmlFor={prefix + 'Language'}>
      {bw('Idioma del texto', 'Text language', 'Idioma do texto')}
    </label>
    <Select
      id={prefix + 'Language'}
      defaultValue={format.hyphenLanguage || 'es'}
      options={[
        { value: 'es', label: 'Español' },
        { value: 'en', label: 'English' },
        { value: 'pt', label: 'Português' },
      ]}
    />
  </div>
);

const ParagraphStyleForm = ({ existing, properties, words: w }: FormProps) => {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = root.current!;
    decorateFontBrowsers(node);
    adaptLengthControls(node);
    // El botón del explorador muestra la familia elegida (también al volver del explorador).
    const font = node.querySelector<HTMLSelectElement>('#paragraphStyleFont')!;
    const show = () => {
      const button = font.nextElementSibling;
      if (button?.classList.contains('font-visual-select')) button.textContent = font.value + ' ▾';
    };
    font.addEventListener('change', show);
    return () => font.removeEventListener('change', show);
  }, []);
  const unit = ' · ' + documentUnit();
  return (
    <div id="paragraphStyleForm" ref={root}>
      <div className="modal-grid">
        <Field
          id="paragraphStyleName"
          label={w.name}
          type="text"
          defaultValue={existing?.name || ''}
          full
        />
        <Control label={w.font} htmlFor="paragraphStyleFont" full>
          <Select
            id="paragraphStyleFont"
            defaultValue={properties.font}
            options={editor.fontList.map((family) => ({ value: family, label: family }))}
          />
        </Control>
        <Field
          id="paragraphStyleSize"
          label={w.size}
          defaultValue={properties.size}
          min={4}
          max={150}
        />
        <Field
          id="paragraphStyleLeading"
          label={w.leading}
          defaultValue={properties.leading}
          min={4}
          max={220}
        />
        <Control label={w.panel} htmlFor="paragraphStyleAlign" full>
          <Select
            id="paragraphStyleAlign"
            defaultValue={properties.align}
            options={[
              { value: 'left', label: w.l },
              { value: 'center', label: w.c },
              { value: 'right', label: w.r },
              { value: 'justify', label: w.j },
            ]}
          />
        </Control>
        <HyphenationFields format={properties} prefix="styleHyphen" />
      </div>
      <div className="modal-grid">
        <Field
          id="paragraphStyleLeft"
          label={w.left + unit}
          defaultValue={properties.indentLeft || 0}
          min={0}
          max={80}
        />
        <Field
          id="paragraphStyleRight"
          label={w.right + unit}
          defaultValue={properties.indentRight || 0}
          min={0}
          max={80}
        />
        <Field
          id="paragraphStyleFirst"
          label={w.first + unit}
          defaultValue={properties.firstIndent || 0}
          min={-30}
          max={50}
        />
        <Field
          id="paragraphStyleBefore"
          label={w.before + unit}
          defaultValue={properties.spaceBefore || 0}
          min={0}
          max={50}
        />
        <Field
          id="paragraphStyleAfter"
          label={w.after + unit}
          defaultValue={properties.spaceAfter || 0}
          min={0}
          max={50}
        />
      </div>
    </div>
  );
};

/** Elemento de la Hoja (lo llama paragraphs.ts, que no es .tsx). */
export const paragraphStyleForm = (props: FormProps) => <ParagraphStyleForm {...props} />;
