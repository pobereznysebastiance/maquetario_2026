// Inspector · Libro · Misceláneas y líneas (etapa 3, D2, paso 4): la línea que acompaña a cada
// elemento automático (cornisa, titulillo, folio) y una línea libre en la página.
//
// Va en Libro después de la Grilla (tabla de Inspector.tsx). Mismo marcado que tenía en HTML, con
// la unidad dentro del campo: mismas clases, data-rule y textos. Sin rótulo en un <span> ni ayuda
// de términos, como antes.
//
// Cada campo graba con el "change" nativo (las pruebas disparan new Event('change'), que no sube).
// Un número fuera de rango vuelve a dibujar el inspector sin grabar, como antes.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { useLanguage } from '../../react/mount.tsx';
import { Icon } from '../Icon.tsx';
import { fieldKey, lengthUnit, onNativeChange, Row, SectionHeading } from './fields.tsx';

type Field = HTMLInputElement | HTMLSelectElement;
type RuleType = 'header' | 'titulillo' | 'folio';

/** Liga un campo con data-rule a su ruta del libro (una sola vez por nodo). */
const bindRule = onNativeChange<Field>((el) => {
  {
    const input = el as HTMLInputElement;
    if (
      input.type === 'number' &&
      (!Number.isFinite(Number(input.value)) ||
        Number(input.value) < Number(input.min) ||
        Number(input.value) > Number(input.max))
    ) {
      inspector();
      return;
    }
    commit(
      () =>
        set(
          input.dataset.rule!,
          input.type === 'checkbox'
            ? input.checked
            : input.type === 'number'
              ? Number(input.value)
              : input.value,
        ),
      false,
    );
  }
});

/** Número con su unidad adentro del campo. */
const Measure = ({
  path,
  min,
  max,
  step,
  value,
  unit,
}: {
  path: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  unit: string;
}) => (
  <span className="unit-wrap">
    <input
      key={fieldKey(path, value)}
      type="number"
      min={min}
      max={max}
      step={step}
      data-rule={path}
      defaultValue={value}
      ref={bindRule}
    />
    <span className="unit">{unit === 'mm' ? lengthUnit() : unit}</span>
  </span>
);

const RuleSettings = ({ type }: { type: RuleType }) => {
  const element = book[type];
  const name =
    type === 'header'
      ? bw('cornisa', 'header', 'cabeçalho')
      : type === 'titulillo'
        ? bw('titulillo', 'running title', 'título corrente')
        : bw('folio', 'folio', 'fólio');
  return (
    <div className="rule-settings">
      <label className="check-line">
        <input
          key={fieldKey('rule', !!element.rule)}
          type="checkbox"
          data-rule={`${type}.rule`}
          defaultChecked={!!element.rule}
          ref={bindRule}
        />
        {bw('Línea de ', 'Rule for ', 'Linha de ') + name}
      </label>
      {element.rule ? (
        <>
          <Row label={bw('Grosor', 'Weight', 'Espessura')}>
            <Measure
              path={`${type}.ruleWidth`}
              min={0.05}
              max={3}
              step={0.05}
              value={element.ruleWidth ?? 0.25}
              unit="mm"
            />
          </Row>
          <Row label={bw('Largo', 'Length', 'Comprimento')}>
            <Measure
              path={`${type}.ruleLength`}
              min={1}
              max={100}
              value={element.ruleLength ?? 100}
              unit="%"
            />
          </Row>
          <Row label={bw('Separación', 'Gap', 'Distância')}>
            <Measure
              path={`${type}.ruleGap`}
              min={0}
              max={20}
              step={0.5}
              value={element.ruleGap ?? 1.5}
              unit="mm"
            />
          </Row>
          <Row label={bw('Color', 'Color', 'Cor')}>
            <input
              key={fieldKey('color', element.ruleColor)}
              type="color"
              data-rule={`${type}.ruleColor`}
              defaultValue={element.ruleColor || '#77716C'}
              ref={bindRule}
            />
          </Row>
          <Row label={bw('Trazo', 'Stroke', 'Traço')}>
            <select
              key={fieldKey('style', element.ruleStyle)}
              data-rule={`${type}.ruleStyle`}
              defaultValue={element.ruleStyle || 'solid'}
              ref={bindRule}
            >
              <option value="solid">{bw('Continuo', 'Solid', 'Contínuo')}</option>
              <option value="dashed">{bw('Guiones', 'Dashed', 'Tracejado')}</option>
              <option value="dotted">{bw('Puntos', 'Dotted', 'Pontilhado')}</option>
            </select>
          </Row>
        </>
      ) : null}
    </div>
  );
};

/** Una línea libre (marco decorativo) en la página activa. */
function insertFreeRule(): void {
  commit(() => {
    const o = {
      id: M.uid(),
      type: 'frame',
      decoration: 'line',
      name: bw('Línea libre', 'Free rule', 'Linha livre'),
      x: book.margins.inside,
      y: book.height / 2,
      w: Math.min(65, book.width - 40),
      h: 3,
      lineWidth: 0.35,
      lineColor: '#77716C',
    };
    book.pages[active].objects.push(o);
    selected = o.id;
  }, false);
}

export const RulesPanel = () => {
  useLanguage();
  return (
    <>
      <SectionHeading>
        <Icon name="header" />
        {bw('Misceláneas y líneas', 'Rules and ornaments', 'Linhas e ornamentos')}
      </SectionHeading>
      <p className="help">
        {bw(
          'Son opcionales. Cada línea acompaña a su elemento automático y se guarda en el libro.',
          'Optional. Each rule follows its automatic element and is saved with the book.',
          'Opcionais. Cada linha acompanha seu elemento automático e é salva no livro.',
        )}
      </p>
      <RuleSettings type="header" />
      <RuleSettings type="titulillo" />
      <RuleSettings type="folio" />
      <button id="insertFreeRule" className="btn wide" onClick={insertFreeRule}>
        {'+ ' +
          bw(
            'Insertar línea libre en esta página',
            'Insert a free rule on this page',
            'Inserir linha livre nesta página',
          )}
      </button>
    </>
  );
};

registerInspectorPanel('design:rules', () => <RulesPanel />, 'rules-panel');
