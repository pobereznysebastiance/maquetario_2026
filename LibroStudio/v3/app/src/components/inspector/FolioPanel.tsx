// Inspector · Libro · Foliado: el primer panel del inspector en React (etapa 3, D2).
//
// Dibuja la sección dentro del lugar que deja inspectorSlot('folio', …) en studio.ts, con el mismo
// marcado que tenía en HTML (section() y masterDetails()): mismas clases, data-bind, aria y textos,
// así los estilos, las pruebas, el orden y plegado de secciones y los decoradores la tratan igual.
// Suma el ajuste fino de posición (deslizadores) que antes agregaba folio-position.ts moviendo
// nodos: un decorador no puede mover lo que dibuja React.
//
// Cada control se liga a su ruta del libro con el "change" nativo y commitBinding() de studio.ts
// (igual que bindInspector): las pruebas que escriben .value y disparan new Event('change') siguen
// funcionando. Los textos fijos se traducen acá con LibroI18n.tr (el traductor del DOM no entra en
// lo que dibuja React), y el panel se redibuja con useEditorState() y useLanguage().
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import type { ReactNode } from 'react';
import { useEditorState } from '../../react/editor-state.ts';
import { useLanguage } from '../../react/mount.tsx';
import { Icon } from '../Icon.tsx';

type Control = HTMLInputElement | HTMLSelectElement;

/** Texto traducido como lo hace el traductor del DOM: sin tocar los espacios del borde. */
const tt = (text: string): string => {
  const trim = text.trim();
  return trim ? text.replace(trim, LibroI18n.tr(trim)) : text;
};

const bound = new WeakSet<Element>();
/** Liga un control con data-bind a su ruta del libro (una sola vez por nodo). */
const bind = (el: Control | null): void => {
  if (!el || bound.has(el)) return;
  bound.add(el);
  el.addEventListener('change', () => commitBinding(el as UIElement));
};

/** Fila del inspector (row() de studio.ts). */
const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="field-row">
    <label>{tt(label)}</label>
    {children}
  </div>
);

/** Número con unidad (number() de studio.ts). */
const NumberField = ({
  path,
  min,
  max,
  step = 0.5,
  unit = 'mm',
}: {
  path: string;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) => (
  <span className="unit-wrap">
    <input
      aria-label={tt(path)}
      data-bind={path}
      type="number"
      min={min}
      max={max}
      step={step}
      defaultValue={get(path)}
      ref={bind}
    />
    {unit ? <span className="unit">{unit}</span> : null}
  </span>
);

/** Selector de opciones (options() de studio.ts). */
const Options = ({ path, items }: { path: string; items: string[][] }) => (
  <select aria-label={tt(path)} data-bind={path} defaultValue={get(path)} ref={bind}>
    {items.map(([value, label]) => (
      <option key={value} value={value}>
        {tt(label)}
      </option>
    ))}
  </select>
);

/** Ajuste fino: el número del desplazamiento y su deslizador, que previsualiza sin grabar. */
const FineOffset = ({ axis }: { axis: 'offsetX' | 'offsetY' }) => {
  const label =
      axis === 'offsetX'
        ? bw('Horizontal', 'Horizontal', 'Horizontal')
        : bw('Vertical', 'Vertical', 'Vertical'),
    value = Number(book.folio[axis]),
    span = Math.max(axis === 'offsetX' ? 30 : 60, Math.abs(value));
  const slide = (slider: HTMLInputElement | null) => {
    if (!slider || bound.has(slider)) return;
    bound.add(slider);
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
  const folio = book.folio;
  return (
    <>
      <div className="section-heading">
        <Icon name="folio" />
        <span id="switchLabel-folio.enabled" data-text-source="Foliado">
          {tt('Foliado')}
        </span>
        <label className="switch">
          <input
            type="checkbox"
            data-bind="folio.enabled"
            defaultChecked={!!folio.enabled}
            aria-labelledby="switchLabel-folio.enabled"
            ref={bind}
          />
          <span></span>
        </label>
      </div>
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
      <details>
        <summary>{tt('Personalizar pares, impares y posición')}</summary>
        <label className="field-label">{tt('Páginas impares')}</label>
        <input
          className="field-full"
          data-bind="folio.odd"
          defaultValue={folio.odd}
          maxLength={1000}
          ref={bind}
        />
        <label className="field-label">{tt('Páginas pares')}</label>
        <input
          className="field-full"
          data-bind="folio.even"
          defaultValue={folio.even}
          maxLength={1000}
          ref={bind}
        />
        <Row label="Aplicar a">
          <Options
            path="folio.scope"
            items={[
              ['all', 'Todas las páginas'],
              ['odd', 'Solo impares'],
              ['even', 'Solo pares'],
            ]}
          />
        </Row>
        <Row label="Tipo de letra">
          <Options path="folio.font" items={fontList.map((f) => [f, f])} />
        </Row>
        <Row label="Cuerpo">
          <NumberField path="folio.size" min={4} max={72} unit="pt" />
        </Row>
        <Row label="Distancia al borde">
          <NumberField path="folio.distance" min={0} max={100} />
        </Row>
        <Row label="Alineación">
          <Options
            path="folio.align"
            items={[
              ['left', 'Izquierda'],
              ['center', 'Centrada'],
              ['right', 'Derecha'],
            ]}
          />
        </Row>
        <label className="check-line">
          <input
            type="checkbox"
            data-bind="folio.vertical"
            defaultChecked={!!folio.vertical}
            ref={bind}
          />
          {tt(' Rotar texto 90°')}
        </label>
        <p className="help">
          {tt('Variables: {book} libro · {section} sección')}
          <br />
          {tt('{page} folio · {total} total de páginas.')}
          <br />
          {tt('Usá | para separar dos extremos.')}
        </p>
      </details>
    </>
  );
};

registerInspectorPanel('design:folio', () => <FolioPanel />, 'folio-panel');
