// Inspector · Libro · Foliado: el primer panel del inspector en React (etapa 3, D2).
//
// El marco de la sección lo pone Inspector.tsx. Mismo marcado que tenía en HTML (section() y
// masterDetails()): mismas clases, data-bind, aria y textos, así los estilos y las pruebas la
// tratan igual.
// Suma el ajuste fino de posición (deslizadores) que antes agregaba folio-position.ts moviendo
// nodos: un decorador no puede mover lo que dibuja React.
//
// Las piezas comunes (campos ligados con el "change" nativo, traducción) están en fields.tsx. El
// panel se redibuja con el inspector.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { useLanguage } from '../../react/mount.tsx';
import {
  bind,
  fieldKey,
  firstTime,
  lengthUnit,
  MasterDetails,
  NumberField,
  Options,
  Row,
  SwitchHeading,
} from './fields.tsx';
import { bw } from '../../i18n/language.ts';
import { editor } from '../../core-api.ts';
import { registerInspectorPanel } from '../../inspector-registry.ts';

/** Ajuste fino: el número del desplazamiento y su deslizador, que previsualiza sin grabar. */
const FineOffset = ({ axis }: { axis: 'offsetX' | 'offsetY' }) => {
  const label =
      axis === 'offsetX'
        ? bw('Horizontal', 'Horizontal', 'Horizontal')
        : bw('Vertical', 'Vertical', 'Vertical'),
    value = Number(editor.book.folio[axis]),
    span = Math.max(axis === 'offsetX' ? 30 : 60, Math.abs(value));
  const slide = (slider: HTMLInputElement | null) => {
    if (!slider || !firstTime(slider)) return;
    // El valor va por la propiedad (como antes), no como atributo.
    slider.value = String(value);
    const numeric = () =>
      slider.parentElement!.querySelector<HTMLInputElement>(`[data-bind="folio.${axis}"]`)!;
    // Mientras se arrastra: se ve en la página sin grabar ni sumar un paso de deshacer.
    slider.addEventListener('input', () => {
      const previous = editor.book.folio[axis];
      numeric().value = slider.value;
      editor.book.folio[axis] = Number(slider.value);
      try {
        renderPages();
      } finally {
        editor.book.folio[axis] = previous;
      }
    });
    // Al soltar: lo graba el número, como si se hubiera escrito.
    slider.addEventListener('change', () =>
      numeric().dispatchEvent(new Event('change', { bubbles: true })),
    );
  };
  return (
    <div className="field-row">
      <label>{label}</label>
      <span className="unit-wrap">
        <input
          key={fieldKey(axis, value)}
          aria-label={label}
          data-bind={`folio.${axis}`}
          type="number"
          min={-200}
          max={200}
          step={0.5}
          defaultValue={value}
          ref={bind}
        />
        <span className="unit">{lengthUnit()}</span>
      </span>
      <input
        key={value}
        type="range"
        min={-span}
        max={span}
        step=".5"
        aria-label={label + ' · ' + bw('desplazamiento', 'offset', 'deslocamento')}
        ref={slide}
      />
    </div>
  );
};

export const FolioPanel = () => {
  useLanguage();
  return (
    <>
      <SwitchHeading icon="folio" title="Foliado" enabled="folio.enabled" />
      <Row label="Formato">
        <Options
          path="folio.format"
          items={[
            ['arabic', '1, 2, 3…'],
            ['roman', 'i, ii, iii…'],
            ['ROMAN', 'I, II, III…'],
          ]}
        />
      </Row>
      <Row label="Posición">
        <Options path="folio.pos" items={folioPositions} />
      </Row>
      <Row label="Comenzar en">
        <NumberField path="folio.start" min={1} max={9999} step={1} unit="" />
      </Row>
      {/* Desplegable común (como Guías individuales): nada de tarjeta dentro de la sección. */}
      <details className="folio-placement">
        <summary>
          {bw('Ajuste fino de posición', 'Fine position', 'Ajuste fino de posição')}
        </summary>
        <p className="help">
          {bw(
            'Mové el folio con los deslizadores o escribí la medida exacta. El eje del margen queda protegido.',
            'Drag the sliders or type an exact value. The margin boundary is protected.',
            'Arraste os controles ou digite a medida exata. O limite da margem é protegido.',
          )}
        </p>
        <FineOffset axis="offsetX" />
        <FineOffset axis="offsetY" />
      </details>
      <MasterDetails type="folio" offsets={false} />
    </>
  );
};

registerInspectorPanel('design:folio', () => <FolioPanel />, 'folio-panel');
