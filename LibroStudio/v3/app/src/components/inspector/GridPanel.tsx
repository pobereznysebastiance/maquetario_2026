// Inspector · Libro · Grilla en React (etapa 3, D2): columnas, filas, medianiles, ajuste a los
// márgenes o al borde y márgenes de la página. Mismo marcado que en HTML (section(), row(), pair()
// y los botones de ajuste de studio.ts); la validación de grilla y márgenes la hace
// commitBinding(), como antes.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { useEditorState } from '../../react/editor-state.ts';
import { useLanguage } from '../../react/mount.tsx';
import { NumberField, Row, SwitchHeading, tt } from './fields.tsx';

/** Dos medidas lado a lado con su etiqueta debajo (pair() de studio.ts). */
const Pair = ({
  label,
  paths,
  labels,
}: {
  /** Subtítulo en castellano (queda en data-text-source para la ayuda de términos). */
  label?: string;
  paths: [string, string];
  labels: [string, string];
}) => (
  <>
    {label ? (
      <div className="sub-label" data-text-source={label}>
        {tt(label)}
      </div>
    ) : null}
    <div className="pair">
      {paths.map((path, i) => (
        <div key={path}>
          <NumberField path={path} min={0} max={150} />
          <label>{tt(labels[i])}</label>
        </div>
      ))}
    </div>
  </>
);

/** Ajustar la grilla a los márgenes o al borde de la página. */
const FitButton = ({ fit, label }: { fit: 'margins' | 'page'; label: string }) => (
  <button
    type="button"
    className={book.grid.fit === fit ? 'active' : undefined}
    data-fit={fit}
    onClick={() => commit(() => (book.grid.fit = fit), false)}
  >
    {tt(label)}
  </button>
);

export const GridPanel = () => {
  useEditorState();
  useLanguage();
  return (
    <>
      <SwitchHeading icon="grid" title="Grilla" enabled="grid.enabled" />
      <Row label="Columnas">
        <NumberField path="grid.cols" min={1} max={12} step={1} unit="" />
      </Row>
      <Row label="Filas">
        <NumberField path="grid.rows" min={1} max={40} step={1} unit="" />
      </Row>
      <Pair
        label="Medianiles"
        paths={['grid.gapX', 'grid.gapY']}
        labels={['Entre columnas', 'Entre filas']}
      />
      <div className="sub-label">{tt('Ajustar grilla a')}</div>
      <div className="segmented">
        <FitButton fit="margins" label="A los márgenes" />
        <FitButton fit="page" label="Al borde de página" />
      </div>
      <Pair
        label="Márgenes"
        paths={['margins.top', 'margins.bottom']}
        labels={['Superior', 'Inferior']}
      />
      <Pair paths={['margins.inside', 'margins.outside']} labels={['Interior', 'Exterior']} />
    </>
  );
};

registerInspectorPanel('design:grid', () => <GridPanel />, 'grid-panel');
