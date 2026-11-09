// Componentes chicos de formulario (átomos y moléculas de ui/), para las pantallas en React.
// Mismo marcado que sus versiones en HTML (studio.ts → control(), UI.settingRow, UI.checkItem),
// así los estilos, las pruebas y document-units los reconocen igual:
//
//   <Field id="newTitle" label="Título del libro" type="text" defaultValue={…} full />
//                                    → .control > label + input
//   <Control label="Orientación" htmlFor="orientation"><Select … /></Control>
//   <Select id="pageUnits" options={[{ value: 'mm', label: 'Milímetros (mm)' }]} … />
//   <SettingRow label="Idioma" help="…"><Select … /></SettingRow>
//                                    → .setting-row (etiqueta y ayuda a la izquierda, control a la derecha)
//   <CheckItem id="settingsRulers" label="" checked={…} onChange={…} />
//                                    → .check-item (casilla con su texto; sirve de interruptor)
//
// Los campos son "no controlados" (defaultValue) salvo que se pase value: el valor vive en el
// elemento, como en las pantallas en HTML, y la acción lo lee al aplicar. Así funcionan igual que
// antes las pruebas y los módulos que cambian el valor desde afuera (.value = …).
// Los textos que llegan en castellano se traducen acá (LibroI18n.tr): quien llama puede pasar
// el texto fuente o uno ya traducido con bw().
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type FormEvent,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react';
import { i18n } from '../../i18n/language.ts';

/**
 * Escucha el "change" nativo en el propio elemento, como hacía la interfaz en HTML. El onChange de
 * React se entera en la raíz y necesita que el evento suba: las pruebas y otros módulos disparan
 * new Event('change'), que no sube, y con onChange no llegaba.
 */
function useNativeChange<T extends HTMLSelectElement>(
  element: RefObject<T | null>,
  handler: ((event: Event) => void) | undefined,
): void {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const listener = (event: Event) => latest.current?.(event);
    node.addEventListener('change', listener);
    return () => node.removeEventListener('change', listener);
  }, [element]);
}

/** Une la ref interna con la que pasa quien llama. */
function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}

const tr = (text: string): string => i18n.tr(text);

/** Molécula: etiqueta arriba y control abajo (.control, como control() de studio.ts). */
export const Control = ({
  label,
  htmlFor,
  full = false,
  children,
}: {
  label: string;
  htmlFor?: string;
  full?: boolean;
  children: ReactNode;
}) => (
  <div className={full ? 'control full' : 'control'}>
    <label htmlFor={htmlFor}>{tr(label)}</label>
    {children}
  </div>
);

export interface FieldProps {
  id: string;
  label: string;
  type?: 'number' | 'text';
  defaultValue?: string | number;
  min?: number;
  max?: number;
  step?: number;
  full?: boolean;
  readOnly?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  onInput?: (event: FormEvent<HTMLInputElement>) => void;
}

/** Campo con etiqueta (.control): número con min/max/paso o texto. */
export const Field = ({
  id,
  label,
  type = 'number',
  defaultValue,
  min,
  max,
  step = type === 'number' ? 0.1 : undefined,
  full = false,
  readOnly,
  inputRef,
  onInput,
}: FieldProps) => (
  <Control label={label} htmlFor={id} full={full}>
    <input
      id={id}
      type={type}
      defaultValue={defaultValue}
      min={min}
      max={max}
      step={step}
      readOnly={readOnly}
      ref={inputRef}
      onInput={onInput}
    />
  </Control>
);

export interface SelectOption {
  value: string;
  label: string;
}

/** Selector. Con value queda controlado; si no, arranca en defaultValue. */
export const Select = ({
  id,
  options,
  value,
  defaultValue,
  selectRef,
  onChange,
  ariaLabel,
}: {
  id?: string;
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  selectRef?: Ref<HTMLSelectElement>;
  onChange?: (value: string, event: Event) => void;
  ariaLabel?: string;
}) => {
  const own = useRef<HTMLSelectElement | null>(null);
  useNativeChange(own, onChange ? (event) => onChange(own.current!.value, event) : undefined);
  return (
    <select
      id={id}
      value={value}
      defaultValue={value === undefined ? defaultValue : undefined}
      ref={(node) => {
        own.current = node;
        assignRef(selectRef, node);
      }}
      aria-label={ariaLabel ? tr(ariaLabel) : undefined}
      // El cambio lo atiende useNativeChange; esto sólo evita el aviso de React por value sin onChange.
      onChange={() => {}}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {tr(option.label)}
        </option>
      ))}
    </select>
  );
};

/** Molécula: fila de preferencia (UI.settingRow). */
export const SettingRow = ({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: ReactNode;
}) => (
  <div className="setting-row">
    <div className="setting-row-label">
      {tr(label)}
      {help ? <p className="setting-row-help">{tr(help)}</p> : null}
    </div>
    <div className="setting-row-control">{children}</div>
  </div>
);

/** Molécula: casilla con su texto (UI.checkItem). También hace de interruptor en una fila. */
export const CheckItem = ({
  id,
  item,
  label,
  checked,
  disabled = false,
  onChange,
}: {
  id?: string;
  /** data-item: la clave del elemento que controla (espacio de trabajo). */
  item?: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}) => (
  <label className="check-item">
    {/* En una casilla React detecta el cambio con el click (también el .click() de las pruebas)
        y restituye el valor controlado antes del "change" nativo: acá va su onChange. */}
    <input
      type="checkbox"
      id={id}
      data-item={item}
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange?.(event.currentTarget.checked)}
    />
    <span>{label ? tr(label) : ''}</span>
  </label>
);

/**
 * Campo con la etiqueta alrededor (<label>Texto<input/></label>), como las grillas de campos de
 * la cubierta (.cover-fields): el texto y el campo van juntos, sin id de por medio.
 */
export const LabeledInput = ({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) => (
  <label className={className}>
    {tr(label)}
    {children}
  </label>
);

/**
 * Atiende "change" e "input" nativos de todo lo que hay dentro de root, en captura: llegan también
 * los new Event('change') que disparan las pruebas y otros módulos (no suben, pero la fase de
 * captura pasa igual por los antecesores). handler recibe el campo y el tipo de evento.
 */
export function useFieldEvents(
  root: RefObject<HTMLElement | null>,
  handler: (target: HTMLElement, type: 'change' | 'input') => void,
): void {
  const latest = useRef(handler);
  latest.current = handler;
  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    const listener = (event: Event) =>
      latest.current(event.target as HTMLElement, event.type as 'change' | 'input');
    node.addEventListener('change', listener, true);
    node.addEventListener('input', listener, true);
    return () => {
      node.removeEventListener('change', listener, true);
      node.removeEventListener('input', listener, true);
    };
  }, [root]);
}
