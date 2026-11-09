// Inspector · Libro · Grilla en React (etapa 3, D2): columnas, filas, medianiles, ajuste a los
// márgenes o al borde y márgenes de la página. Mismo marcado que en HTML (section(), row(), pair()
// y los botones de ajuste del viejo inspector en HTML); la validación de grilla y márgenes la hace
// commitBinding(), como antes. Al final, las guías individuales (antes las agregaba editorial.ts
// después de dibujar el inspector).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { useLanguage } from '../../react/mount.tsx';
import { openGuideDialog, type BookGuide } from '../../editorial.ts';
import { NumberField, Row, SwitchHeading, TermHelp, tt } from './fields.tsx';
import { Icon } from '../Icon.tsx';
import { editor } from '../../core-api.ts';
import { registerInspectorPanel } from '../../inspector-registry.ts';

/** Dos medidas lado a lado con su etiqueta debajo (el viejo pair()). */
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
        <TermHelp text={label} />
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
    className={editor.book.grid.fit === fit ? 'active' : undefined}
    data-fit={fit}
    onClick={() => commit(() => (editor.book.grid.fit = fit), false)}
  >
    {tt(label)}
  </button>
);

/** Guías horizontales y verticales del libro: agregar y quitar. */
const GuideControls = () => (
  <div>
    <details className="guide-controls">
      <summary>{tt('Guías individuales')}</summary>
      <p className="help">
        {tt('Guías horizontales y verticales en todas las páginas. No se imprimen.')}
      </p>
      <button type="button" id="addGuide" className="btn wide" onClick={openGuideDialog}>
        {tt('Agregar guía')}
      </button>
      <div className="guide-list">
        {((editor.book.guides || []) as BookGuide[]).map((g, i) => (
          <div className="field-row" key={i}>
            <span>
              {`${g.axis === 'v' ? 'Vertical' : 'Horizontal'} · ${displayMeasure(g.position)} ${documentUnit()}`}
            </span>
            <button
              type="button"
              className="icon-btn"
              title={tt('Quitar guía')}
              aria-label={tt('Quitar guía')}
              data-remove-guide={i}
              onClick={() => commit(() => editor.book.guides.splice(i, 1), false)}
            >
              <Icon name="close" />
            </button>
          </div>
        ))}
      </div>
    </details>
  </div>
);

export const GridPanel = () => {
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
      <GuideControls />
    </>
  );
};

registerInspectorPanel('design:grid', () => <GridPanel />, 'grid-panel');
