// Piezas comunes de los paneles del inspector en React (etapa 3, D2), con el mismo marcado que las
// funciones de studio.ts que reemplazaron (section(), row(), number(), options()), así los estilos
// y las pruebas las reconocen igual.
//
// - Los controles con data-bind se ligan a su ruta del libro con el "change" nativo y
//   commitBinding() de studio.ts. Las pruebas escriben .value y disparan new Event('change'), que
//   no sube: por eso no va el onChange de React.
// - Son "no controlados" (defaultValue / defaultChecked): el valor vive en el elemento. El
//   inspector ya no se vuelve a crear entero en cada inspector(): cada campo lleva de key su valor
//   (fieldKey), así React lo vuelve a crear sólo cuando el valor del libro cambia.
// - tt() traduce como el traductor del DOM (que no entra en lo que dibuja React).
// - Lo que antes agregaban los decoradores del inspector sale de acá: la ayuda de términos
//   (TermHelp), el selector visual de fuentes (FontOptions) y la unidad del documento
//   (lengthUnit; document-units adapta los campos con fieldAdapters).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import {
  createContext,
  useContext,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Icon } from '../Icon.tsx';
import { bw, i18n } from '../../i18n/language.ts';
import { editor } from '../../core-api.ts';

type Control = HTMLInputElement | HTMLSelectElement;

/** Texto traducido como lo hace el traductor del DOM: sin tocar los espacios del borde. */
export const tt = (text: string): string => {
  const trim = text.trim();
  return trim ? text.replace(trim, i18n.tr(trim)) : text;
};

/**
 * Clave de un campo no controlado: su nombre, su valor y el idioma. Cuando el valor del libro
 * cambia (por deshacer, por otro panel, por una prueba), React crea el campo de nuevo con el valor
 * nuevo; con otro idioma también (un selector muestra el texto de la opción elegida como era al
 * elegirla).
 */
export const fieldKey = (name: string, value: unknown): string =>
  [name, String(value), i18n.language].join('\u0000');

/** Unidad de las longitudes del documento: mm o cm (document-units). */
export const lengthUnit = (): string => documentUnit();

/**
 * Lo que se le hace a cada campo nuevo del inspector, una vez (document-units: con el documento en
 * cm, los campos de longitud muestran y aceptan cm).
 */
export const fieldAdapters: ((el: Control) => void)[] = [];

const listeners = new WeakMap<Element, (el: never) => void>();
/**
 * Engancha listener al "change" nativo del control. El oyente nativo se agrega una sola vez por
 * nodo y llama siempre al último listener (las refs de React se vuelven a llamar en cada dibujo, y
 * el nodo ahora dura entre dibujos: así no queda un oyente con datos viejos).
 */
export const onNativeChange =
  <T extends Control>(listener: (el: T) => void) =>
  (el: T | null): void => {
    if (!el) return;
    const first = !listeners.has(el);
    listeners.set(el, listener as (el: never) => void);
    if (!first) return;
    el.addEventListener('change', () => (listeners.get(el) as (el: T) => void)(el));
    for (const adapt of fieldAdapters) adapt(el);
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

// ── Secciones: orden y plegado (los maneja Inspector.tsx) ──

/** Lo que una sección del inspector le pasa a su título: plegado y agarrador para reordenar. */
export type SectionChrome = {
  /** Con más de una sección en la pestaña: el agarrador para arrastrar. */
  grip: boolean;
  collapsed: boolean;
  toggle: () => void;
  dragStart: (event: DragEvent<HTMLElement>) => void;
  dragEnd: () => void;
  /** Alt+↑ / Alt+↓ desde el agarrador. */
  gripKey: (event: KeyboardEvent<HTMLElement>) => void;
};
export const SectionContext = createContext<SectionChrome | null>(null);

/**
 * Título de una sección (.section-heading). Dentro de una sección del inspector suma el agarrador
 * (adelante) y la flecha de plegar (al final), como hacía inspector-sections.ts.
 */
export const SectionHeading = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => {
  const section = useContext(SectionContext);
  const grip = bw('Arrastrar para reordenar', 'Drag to reorder', 'Arraste para reordenar'),
    fold = section?.collapsed
      ? bw('Desplegar', 'Expand', 'Expandir')
      : bw('Plegar', 'Collapse', 'Recolher');
  return (
    <div className={'section-heading' + (className ? ' ' + className : '')}>
      {section?.grip ? (
        <button
          type="button"
          className="section-grip"
          draggable="true"
          title={grip}
          aria-label={grip}
          onDragStart={section.dragStart}
          onDragEnd={section.dragEnd}
          onKeyDown={section.gripKey}
        >
          <Icon name="grip" />
        </button>
      ) : null}
      {children}
      {section ? (
        <button
          type="button"
          className="section-toggle"
          title={fold}
          aria-label={fold}
          aria-expanded={!section.collapsed}
          onClick={section.toggle}
        >
          <Icon name="chevron" />
        </button>
      ) : null}
    </div>
  );
};

/** Nombre de la sección: un clic también pliega (no en sus controles: interruptor, ayuda…). */
export const SectionTitle = ({
  id,
  source,
  children,
}: {
  id?: string;
  /** Texto en castellano: queda en data-text-source y decide la ayuda de términos. */
  source?: string;
  children: ReactNode;
}) => {
  const section = useContext(SectionContext);
  return (
    <span
      id={id}
      data-text-source={source}
      className={section ? 'section-title' : undefined}
      onClick={section?.toggle}
    >
      {children}
    </span>
  );
};

// ── Ayuda de términos (antes: decorateGlossaryHints de editorial-learning.ts) ──

/** Rótulo del inspector (en castellano) → término del glosario. */
const TERMS: Record<string, string> = {
  Grilla: 'grid',
  Medianiles: 'gutter',
  Márgenes: 'margin',
  Foliado: 'folio',
  Cornisa: 'header',
  Titulillo: 'header',
  'Misceláneas y líneas': 'rule',
  'Párrafo y estilos': 'style',
  Interlineado: 'leading',
  Tracking: 'tracking',
  'Sangría inicial': 'indent',
};

/** Botón "Aprender" junto a un rótulo que es un término del glosario (si lo es). */
export const TermHelp = ({ text }: { text: string }) => {
  const term = TERMS[text.trim()],
    entry = term ? editorialTerms.find((t) => t[0] === term) : undefined;
  if (!term || !entry) return null;
  return (
    <button
      type="button"
      className="term-help"
      aria-label={bw('Aprender: ', 'Learn: ', 'Aprender: ') + bw(...entry[2])}
      onClick={(event) => {
        event.stopPropagation();
        showGlossary(term);
      }}
    >
      <Icon name="help" />
    </button>
  );
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
  <SectionHeading>
    <Icon name={icon} />
    <SectionTitle id={`switchLabel-${enabled}`} source={title}>
      {tt(title)}
      <TermHelp text={title} />
    </SectionTitle>
    <label className="switch">
      <input
        key={fieldKey(enabled, !!get(enabled))}
        type="checkbox"
        data-bind={enabled}
        defaultChecked={!!get(enabled)}
        aria-labelledby={`switchLabel-${enabled}`}
        ref={bind}
      />
      <span></span>
    </label>
  </SectionHeading>
);

/** Título de sección sin interruptor (section() de studio.ts). */
export const Heading = ({ icon, title }: { icon: string; title: string }) => (
  <SectionHeading>
    <Icon name={icon} />
    <SectionTitle source={title}>
      {tt(title)}
      <TermHelp text={title} />
    </SectionTitle>
  </SectionHeading>
);

/**
 * Fila del inspector (row() de studio.ts). term: deja el texto en castellano en
 * data-text-source, para que la ayuda de términos lo reconozca en cualquier idioma.
 */
export const Row = ({
  label,
  term = false,
  children,
}: {
  label: string;
  term?: boolean;
  children: ReactNode;
}) => (
  <div className="field-row">
    <label data-text-source={term ? label : undefined}>
      {tt(label)}
      <TermHelp text={term ? label : tt(label)} />
    </label>
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
      key={fieldKey(path, get(path))}
      aria-label={tt(path)}
      data-bind={path}
      type="number"
      min={min}
      max={max}
      step={step}
      defaultValue={get(path)}
      ref={bind}
    />
    {unit ? <span className="unit">{unit === 'mm' ? lengthUnit() : unit}</span> : null}
  </span>
);

/** Selector de opciones (options() de studio.ts). */
export const Options = ({
  path,
  items,
  className,
  browserHook,
  disabled,
}: {
  path: string;
  items: string[][];
  className?: string;
  /** Marca del selector visual de fuentes (data-browser-hook). */
  browserHook?: boolean;
  disabled?: boolean;
}) => (
  <select
    key={fieldKey(path, get(path))}
    aria-label={tt(path)}
    data-bind={path}
    className={className}
    data-browser-hook={browserHook ? '1' : undefined}
    disabled={disabled}
    defaultValue={get(path)}
    ref={bind}
  >
    {items.map(([value, label]) => (
      <option key={value} value={value}>
        {tt(label)}
      </option>
    ))}
  </select>
);

// ── Selector visual de fuentes (antes: decorateFontBrowsers sobre el inspector) ──

/** La familia que muestra un selector de fuentes: la elegida si está en la lista, si no la primera. */
const shownFamily = (family: string): string =>
  editor.fontList.includes(family) ? family : (editor.fontList[0] ?? '');

/**
 * Botón que abre el explorador de fuentes (font-browser.tsx) para el selector de al lado, que queda
 * oculto (.font-native-hidden). El explorador escribe el selector y dispara su "change".
 */
export const FontBrowserButton = ({ family, disabled }: { family: string; disabled?: boolean }) => (
  <button
    type="button"
    className="font-visual-select"
    disabled={disabled}
    title={bw('Ver diseños de tipografías', 'Preview typeface designs', 'Ver desenhos das fontes')}
    onClick={(event) =>
      openFontBrowser(event.currentTarget.previousElementSibling as HTMLSelectElement)
    }
  >
    {shownFamily(family) + ' ▾'}
  </button>
);

/** Tipo de letra de una ruta del libro (cornisa, titulillo, folio): selector y botón visual. */
export const FontOptions = ({ path }: { path: string }) => (
  <>
    <Options
      path={path}
      items={editor.fontList.map((f) => [f, f])}
      className="font-native-hidden"
      browserHook
    />
    <FontBrowserButton family={String(get(path))} />
  </>
);

/**
 * Botón (UI.button de src/ui/components.ts, o UI.quietButton con quiet): mismas clases y
 * atributos. label va traducido con tt().
 */
export const Btn = ({
  id,
  label,
  icon,
  variant,
  wide = false,
  quiet = false,
  disabled = false,
  title,
  command: name,
  onClick,
}: {
  id?: string;
  label: string;
  icon?: string;
  variant?: 'primary' | 'danger';
  wide?: boolean;
  quiet?: boolean;
  disabled?: boolean;
  title?: string;
  /** Orden del editor (data-command). */
  command?: string;
  onClick?: () => void;
}) => (
  <button
    type="button"
    id={id}
    className={(quiet ? 'quiet' : 'btn') + (variant ? ' ' + variant : '') + (wide ? ' wide' : '')}
    title={title}
    disabled={disabled}
    data-command={name}
    onClick={onClick ?? (name ? () => command(name) : undefined)}
  >
    {icon ? <Icon name={icon} /> : null}
    {tt(label)}
  </button>
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
    <input
      key={fieldKey(path, !!get(path))}
      type="checkbox"
      data-bind={path}
      defaultChecked={!!get(path)}
      ref={bind}
    />
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
      key={fieldKey('odd', editor.book[type].odd)}
      className="field-full"
      data-bind={`${type}.odd`}
      defaultValue={editor.book[type].odd}
      maxLength={1000}
      ref={bind}
    />
    <label className="field-label">{tt('Páginas pares')}</label>
    <input
      key={fieldKey('even', editor.book[type].even)}
      className="field-full"
      data-bind={`${type}.even`}
      defaultValue={editor.book[type].even}
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
      <FontOptions path={`${type}.font`} />
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
