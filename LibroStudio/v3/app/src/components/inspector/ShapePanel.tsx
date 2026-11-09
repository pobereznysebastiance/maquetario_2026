// Inspector · Selección · Figura · relleno y trazo (marcos e imágenes), en React (etapa 3, D2).
//
// Antes la agregaba shapes.ts después de la primera sección del objeto; ahora inspector-
// organization.ts deja su lugar (section.shape-appearance) cuando lo elegido es un marco o una
// imagen. Mismo marcado que en HTML, ya con la unidad dentro del campo como la dejaba
// unitsInsideFields ("Grosor" + campo con mm): data-shape-prop, data-shape-none, #shapeSwapColors y
// #shapePlaceImage los usan tests/shapes-tests.js y document-units.ts. Con el objeto bloqueado,
// todo queda deshabilitado.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import type { ReactNode } from 'react';
import { useEditorState } from '../../react/editor-state.ts';
import { useLanguage } from '../../react/mount.tsx';
import { Icon } from '../Icon.tsx';
import { Btn, onNativeChange } from './fields.tsx';

/** Una figura sin forma todavía (marco o imagen común) pasa a rectángulo al tocar su aspecto. */
const init = (o: Record<string, any>) => {
  if (!o.shape) {
    o.shape = 'rect';
    o.fill = 'none';
    o.stroke = '#153D42';
    o.strokeWidth = 0.5;
  }
};

/** Campos numéricos, de color y selectores: type, value, min y max alcanzan para los tres. */
const shapeProp = onNativeChange<HTMLInputElement | HTMLSelectElement>((el) => {
  const o = selectObject();
  if (!o) return;
  const v = el.type === 'number' ? Number(el.value) : el.value;
  const input = el as HTMLInputElement;
  if (
    el.type === 'number' &&
    (!Number.isFinite(v) ||
      (v as number) < Number(input.min) ||
      (v as number) > Number(input.max) ||
      (el.dataset.shapeProp === 'sides' && !Number.isInteger(v)))
  ) {
    inspector();
    return;
  }
  commit(() => {
    init(o);
    o[el.dataset.shapeProp!] = v;
  }, false);
});
const shapeNone = onNativeChange<HTMLInputElement>((el) => {
  const o = selectObject();
  if (!o) return;
  commit(() => {
    init(o);
    o[el.dataset.shapeNone!] = el.checked
      ? 'none'
      : el.dataset.shapeNone === 'fill'
        ? '#D8EBE5'
        : '#153D42';
  }, false);
});

/** Fila con la unidad dentro del campo (row() + unitsInsideFields). */
const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="field-row">
    <label>{label}</label>
    {children}
  </div>
);
const WithUnit = ({ unit, children }: { unit: string; children: ReactNode }) => (
  <span className="unit-wrap">
    {children}
    <span className="unit">{unit}</span>
  </span>
);

export const ShapePanel = () => {
  useEditorState();
  useLanguage();
  const o = selectObject();
  if (!o || !['frame', 'image'].includes(o.type)) return null;
  const locked = !!o.locked;
  return (
    <>
      <div className="section-heading">
        <Icon name="frame" />
        {' ' +
          bw(
            'Figura · relleno y trazo',
            'Shape · fill and stroke',
            'Figura · preenchimento e traço',
          )}
      </div>
      <Row label={bw('Forma', 'Shape', 'Forma')}>
        <select
          data-shape-prop="shape"
          defaultValue={o.shape || 'rect'}
          disabled={locked}
          ref={shapeProp}
        >
          {Object.entries(shapeNames).map(([key, labels]) => (
            <option key={key} value={key}>
              {bw(...labels)}
            </option>
          ))}
        </select>
      </Row>
      {(
        [
          [
            'fill',
            bw('Relleno', 'Fill', 'Preenchimento'),
            '#D8EBE5',
            bw('Sin relleno', 'No fill', 'Sem preenchimento'),
            o.fill === 'none' || !o.shape,
          ],
          [
            'stroke',
            bw('Trazo', 'Stroke', 'Traço'),
            '#153D42',
            bw('Sin trazo', 'No stroke', 'Sem traço'),
            o.stroke === 'none',
          ],
        ] as const
      ).map(([key, label, fallback, none, empty]) => (
        <div className="shape-color-control" key={key}>
          <label>{label}</label>
          <input
            type="color"
            data-shape-prop={key}
            defaultValue={o[key] && o[key] !== 'none' ? o[key] : fallback}
            disabled={locked}
            ref={shapeProp}
          />
          <label className="check-line">
            <input
              type="checkbox"
              data-shape-none={key}
              defaultChecked={empty}
              disabled={locked}
              ref={shapeNone}
            />
            {none}
          </label>
        </div>
      ))}
      <Row label={bw('Grosor', 'Weight', 'Espessura')}>
        <WithUnit unit="mm">
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            data-shape-prop="strokeWidth"
            defaultValue={o.strokeWidth ?? 0.5}
            disabled={locked}
            ref={shapeProp}
          />
        </WithUnit>
      </Row>
      <Row label={bw('Tipo de trazo', 'Stroke style', 'Tipo de traço')}>
        <select
          data-shape-prop="strokeStyle"
          defaultValue={o.strokeStyle}
          disabled={locked}
          ref={shapeProp}
        >
          {[
            ['solid', bw('Continuo', 'Solid', 'Contínuo')],
            ['dashed', bw('Guiones', 'Dashed', 'Tracejado')],
            ['dotted', bw('Punteado', 'Dotted', 'Pontilhado')],
          ].map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </Row>
      <Row label={bw('Opacidad', 'Opacity', 'Opacidade')}>
        <WithUnit unit="%">
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            data-shape-prop="opacity"
            defaultValue={o.opacity ?? 100}
            disabled={locked}
            ref={shapeProp}
          />
        </WithUnit>
      </Row>
      {o.shape === 'round' ? (
        <Row label={bw('Radio', 'Radius', 'Raio')}>
          <WithUnit unit="mm">
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              data-shape-prop="cornerRadius"
              defaultValue={o.cornerRadius ?? 5}
              disabled={locked}
              ref={shapeProp}
            />
          </WithUnit>
        </Row>
      ) : null}
      {o.shape === 'polygon' ? (
        <Row label={bw('Lados', 'Sides', 'Lados')}>
          <input
            type="number"
            min="3"
            max="12"
            step="1"
            data-shape-prop="sides"
            defaultValue={o.sides ?? 6}
            disabled={locked}
            ref={shapeProp}
          />
        </Row>
      ) : null}
      <div className="page-action">
        <Btn
          id="shapeSwapColors"
          label={'⇄ ' + bw('Intercambiar', 'Swap', 'Trocar')}
          disabled={locked}
          onClick={() =>
            commit(() => {
              init(o);
              [o.fill, o.stroke] = [o.stroke || 'none', o.fill || 'none'];
            }, false)
          }
        />
        <Btn
          id="shapePlaceImage"
          label={bw('Colocar imagen…', 'Place image…', 'Inserir imagem…')}
          disabled={locked}
          onClick={() => {
            if (!o.shape) commit(() => init(o), false);
            chooseImage({ frame: o, page: active });
          }}
        />
      </div>
      <p className="help">
        {bw(
          'La figura puede ser fondo o contenedor de una imagen. Usá Al fondo para ubicarla detrás de un texto.',
          'The shape can be a background or an image container. Use To back to put it behind text.',
          'A figura pode ser fundo ou contêiner de imagem. Use Para trás para colocá-la atrás do texto.',
        )}
      </p>
    </>
  );
};

registerInspectorPanel('object:shape', () => <ShapePanel />, 'shape-panel');
