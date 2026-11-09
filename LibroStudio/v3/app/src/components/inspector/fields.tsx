// Piezas comunes de los paneles del inspector en React (etapa 3, D2), con el mismo marcado que las
// funciones de studio.ts que reemplazan (section(), row(), number(), options()), así los estilos,
// las pruebas y los decoradores las reconocen igual.
//
// - Los controles con data-bind se ligan a su ruta del libro con el "change" nativo y
//   commitBinding() de studio.ts (la misma validación que bindInspector). Las pruebas escriben
//   .value y disparan new Event('change'), que no sube: por eso no va el onChange de React.
// - Son "no controlados" (defaultValue / defaultChecked): el valor vive en el elemento.
// - tt() traduce como el traductor del DOM (que no entra en lo que dibuja React).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import type { ReactNode } from 'react';
import { Icon } from '../Icon.tsx';

type Control = HTMLInputElement | HTMLSelectElement;

/** Texto traducido como lo hace el traductor del DOM: sin tocar los espacios del borde. */
export const tt = (text: string): string => {
  const trim = text.trim();
  return trim ? text.replace(trim, LibroI18n.tr(trim)) : text;
};

const bound = new WeakSet<Element>();
/**
 * Engancha listener al "change" nativo del control, una sola vez por nodo (las refs de React se
 * vuelven a llamar en cada dibujo).
 */
export const onNativeChange =
  <T extends Control>(listener: (el: T) => void) =>
  (el: T | null): void => {
    if (!el || bound.has(el)) return;
    bound.add(el);
    el.addEventListener('change', () => listener(el));
  };
/** Liga un control con data-bind a su ruta del libro. */
export const bind = onNativeChange<Control>((el) => commitBinding(el as UIElement));
const prepared = new WeakSet<Element>();
/** Para refs que preparan un nodo una sola vez (deslizadores, valor inicial…). */
export const firstTime = (el: Element): boolean => {
  if (prepared.has(el)) return false;
  prepared.add(el);
  return true;
};

/** Título de sección con interruptor (section(…, enabled) de studio.ts). */
export const SwitchHeading = ({
  icon,
  title,
  enabled,
}: {
  icon: string;
  /** Texto en castellano: queda en data-text-source para la ayuda de términos. */
  title: string;
  /** Ruta del interruptor (grid.enabled…). */
  enabled: string;
}) => (
  <div className="section-heading">
    <Icon name={icon} />
    <span id={`switchLabel-${enabled}`} data-text-source={title}>
      {tt(title)}
    </span>
    <label className="switch">
      <input
        type="checkbox"
        data-bind={enabled}
        defaultChecked={!!get(enabled)}
        aria-labelledby={`switchLabel-${enabled}`}
        ref={bind}
      />
      <span></span>
    </label>
  </div>
);

/** Fila del inspector (row() de studio.ts). */
export const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="field-row">
    <label>{tt(label)}</label>
    {children}
  </div>
);

/** Número con unidad (number() de studio.ts). */
export const NumberField = ({
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
export const Options = ({ path, items }: { path: string; items: string[][] }) => (
  <select aria-label={tt(path)} data-bind={path} defaultValue={get(path)} ref={bind}>
    {items.map(([value, label]) => (
      <option key={value} value={value}>
        {tt(label)}
      </option>
    ))}
  </select>
);

/** Casilla con su texto (.check-line). */
export const CheckLine = ({
  path,
  label,
  hidden,
}: {
  path: string;
  label: string;
  hidden?: boolean;
}) => (
  <label className="check-line" hidden={hidden}>
    <input type="checkbox" data-bind={path} defaultChecked={!!get(path)} ref={bind} />
    {tt(label)}
  </label>
);

/**
 * "Personalizar pares, impares y posición" de cornisa, titulillo y folio (masterDetails() de
 * studio.ts). offsets: incluye los desplazamientos X e Y (el folio los tiene en su ajuste fino).
 * verticalHidden: la casilla "Rotar texto 90°" queda oculta (en el margen lateral la reemplaza la
 * lectura lateral). extra: casillas propias, después de la de rotar.
 */
export const MasterDetails = ({
  type,
  offsets = true,
  verticalHidden = false,
  extra,
}: {
  type: 'folio' | 'header' | 'titulillo';
  offsets?: boolean;
  verticalHidden?: boolean;
  extra?: ReactNode;
}) => (
  <details>
    <summary>{tt('Personalizar pares, impares y posición')}</summary>
    <label className="field-label">{tt('Páginas impares')}</label>
    <input
      className="field-full"
      data-bind={`${type}.odd`}
      defaultValue={book[type].odd}
      maxLength={1000}
      ref={bind}
    />
    <label className="field-label">{tt('Páginas pares')}</label>
    <input
      className="field-full"
      data-bind={`${type}.even`}
      defaultValue={book[type].even}
      maxLength={1000}
      ref={bind}
    />
    <Row label="Aplicar a">
      <Options
        path={`${type}.scope`}
        items={[
          ['all', 'Todas las páginas'],
          ['odd', 'Solo impares'],
          ['even', 'Solo pares'],
        ]}
      />
    </Row>
    <Row label="Tipo de letra">
      <Options path={`${type}.font`} items={fontList.map((f) => [f, f])} />
    </Row>
    <Row label="Cuerpo">
      <NumberField path={`${type}.size`} min={4} max={72} unit="pt" />
    </Row>
    <Row label="Distancia al borde">
      <NumberField path={`${type}.distance`} min={0} max={100} />
    </Row>
    {offsets ? (
      <>
        <Row label="Desplazamiento X">
          <NumberField path={`${type}.offsetX`} min={-200} max={200} />
        </Row>
        <Row label="Desplazamiento Y">
          <NumberField path={`${type}.offsetY`} min={-200} max={200} />
        </Row>
      </>
    ) : null}
    <Row label="Alineación">
      <Options
        path={`${type}.align`}
        items={[
          ['left', 'Izquierda'],
          ['center', 'Centrada'],
          ['right', 'Derecha'],
        ]}
      />
    </Row>
    <CheckLine path={`${type}.vertical`} label=" Rotar texto 90°" hidden={verticalHidden} />
    {extra}
    <p className="help">
      {tt('Variables: {book} libro · {section} sección')}
      <br />
      {tt('{page} folio · {total} total de páginas.')}
      <br />
      {tt('Usá | para separar dos extremos.')}
    </p>
  </details>
);
