// Contenido de la Hoja "Nueva guía" (editorial.ts → extraGuideControls, que la abre con
// modal.sheet y lee #guideAxis y #guidePosition al aplicar). La posición va en la unidad del
// documento (adaptLengthControls convierte el campo; el modelo sigue en mm).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { useLayoutEffect, useRef } from 'react';
import { Control, Field, Select } from '../form/Form.tsx';
import { bw } from '../../i18n/language.ts';
import { editor } from '../../core-api.ts';
import { adaptLengthControls } from '../../length-fields.ts';

const GuideForm = () => {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => adaptLengthControls(root.current!), []);
  return (
    <div className="modal-grid" ref={root}>
      <Control label="Orientación" htmlFor="guideAxis">
        <Select
          id="guideAxis"
          defaultValue="v"
          options={[
            { value: 'v', label: 'Vertical' },
            { value: 'h', label: 'Horizontal' },
          ]}
        />
      </Control>
      <Field
        id="guidePosition"
        label={
          bw('Posición desde el borde', 'Position from edge', 'Posição a partir da borda') +
          ' · ' +
          documentUnit()
        }
        defaultValue={20}
        min={0}
        max={Math.max(editor.book.width, editor.book.height)}
      />
    </div>
  );
};

/** Elemento de la Hoja (lo llama editorial.ts, que no es .tsx). */
export const guideForm = () => <GuideForm />;
