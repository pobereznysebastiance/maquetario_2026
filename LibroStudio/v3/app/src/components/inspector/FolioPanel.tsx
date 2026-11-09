// Inspector · Libro · Foliado: el primer panel del inspector en React (etapa 3, D2).
//
// Dibuja la sección dentro del lugar que deja inspectorSlot('folio', …) en studio.ts, con el mismo
// marcado que tenía en HTML (section() y masterDetails()): mismas clases, data-bind, aria y textos,
// así los estilos, las pruebas, el orden y plegado de secciones y los decoradores la tratan igual.
// Suma el ajuste fino de posición (deslizadores) que antes agregaba folio-position.ts moviendo
// nodos: un decorador no puede mover lo que dibuja React.
//
// Las piezas comunes (campos ligados con el "change" nativo, traducción) están en fields.tsx. El
// panel se redibuja con useEditorState() y useLanguage().
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { useEditorState } from '../../react/editor-state.ts';
import { useLanguage } from '../../react/mount.tsx';
import {
  bind,
  firstTime,
  MasterDetails,
  NumberField,
  Options,
  Row,
  SwitchHeading,
} from './fields.tsx';

/** Ajuste fino: el número del desplazamiento y su deslizador, que previsualiza sin grabar. */
const FineOffset = ({ axis }: { axis: 'offsetX' | 'offsetY' }) => {
  const label =
      axis === 'offsetX'
        ? bw('Horizontal', 'Horizontal', 'Horizontal')
        : bw('Vertical', 'Vertical', 'Vertical'),
    value = Number(book.folio[axis]),
    span = Math.max(axis === 'offsetX' ? 30 : 60, Math.abs(value));
  const slide = (slider: HTMLInputElement | null) => {
    if (!slider || !firstTime(slider)) return;
    // El valor va por la propiedad (como antes), no como atributo.
    slider.value = String(value);
    const numeric = () =>
      slider.parentElement!.querySelector<HTMLInputElement>(`[data-bind="folio.${axis}"]`)!;
    // Mientras se arrastra: se ve en la página sin grabar ni sumar un paso de deshacer.
    slider.addEventListener('input', () => {
      const previous = book.folio[axis];
      numeric().value = slider.value;
      book.folio[axis] = Number(slider.value);
      try {
        renderPages();
      } finally {
        book.folio[axis] = previous;
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
          aria-label={label}
          data-bind={`folio.${axis}`}
          type="number"
          min={-200}
          max={200}
          step={0.5}
          defaultValue={value}
          ref={bind}
        />
        <span className="unit">mm</span>
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
  useEditorState();
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
      <div className="folio-placement">
        <strong>{bw('Ajuste fino de posición', 'Fine position', 'Ajuste fino de posição')}</strong>
        {'\n    '}
        <p className="help">
          {bw(
            'Mové el folio con los deslizadores o escribí la medida exacta. El eje del margen queda protegido.',
            'Drag the sliders or type an exact value. The margin boundary is protected.',
            'Arraste os controles ou digite a medida exata. O limite da margem é protegido.',
          )}
        </p>
        <FineOffset axis="offsetX" />
        <FineOffset axis="offsetY" />
      </div>
      <MasterDetails type="folio" offsets={false} />
    </>
  );
};

registerInspectorPanel('design:folio', () => <FolioPanel />, 'folio-panel');
