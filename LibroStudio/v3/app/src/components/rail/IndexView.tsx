// Vista Índice del riel, en React: configuración del índice del libro (título, secciones, títulos
// marcados), "Marcar texto como título", "Colocar índice en página activa" y las entradas (quitar
// las manuales, agregar una). Mismo marcado e ids que la versión en HTML de editorial.ts.
//
// Los campos escuchan el "change" nativo en el propio elemento (no el onChange de React): las
// pruebas y otros módulos disparan new Event('change'), que no sube. Los textos fijos se traducen
// con LibroI18n.tr (el traductor del DOM no entra en lo que dibuja React). Se redibuja con
// RailViews.tsx (avisos del núcleo e idioma).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import type { TocConfig } from '../../model.ts';
import { Icon } from '../Icon.tsx';
import { i18n } from '../../i18n/language.ts';
import { editor, M } from '../../core-api.ts';

/** Lo que la vista necesita de editorial.ts. */
export interface IndexSource {
  ensureToc: () => TocConfig;
  /** Coloca el índice en la página activa (o elige el que ya está). */
  insertToc: () => void;
  /** Abre el formulario de una entrada manual. */
  addEntry: () => void;
}

/** Texto traducido como lo hace el traductor del DOM: sin tocar los espacios del borde. */
const tt = (text: string): string => {
  const trim = text.trim();
  return trim ? text.replace(trim, i18n.tr(trim)) : text;
};

const bound = new WeakSet<Element>();
/** Escucha el "change" nativo del campo (una sola vez por nodo). */
const onNativeChange =
  (run: (el: HTMLInputElement) => void) =>
  (el: HTMLInputElement | null): void => {
    if (!el || bound.has(el)) return;
    bound.add(el);
    el.addEventListener('change', () => run(el));
  };

const IndexView = ({ source }: { source: IndexSource }) => {
  const config = M.tocConfig(editor.book),
    entries = M.tocEntries(editor.book),
    o = selectObject();
  return (
    <>
      <section className="section" data-section="Índice del libro" data-key="pages">
        <div className="section-heading">
          <Icon name="pages" />
          <span>{tt('Índice del libro')}</span>
        </div>
        <p className="help">
          {tt(
            'Generá una tabla de contenidos con secciones, títulos marcados y entradas propias. Los folios se actualizan automáticamente.',
          )}
        </p>
        <div className="sub-label" id="tocTitleLabel">
          {tt('Título del índice')}
        </div>
        <input
          id="tocTitle"
          aria-labelledby="tocTitleLabel"
          className="field-full"
          maxLength={250}
          defaultValue={config.title}
          key={config.title}
          ref={onNativeChange((el) => commit(() => (source.ensureToc().title = el.value), false))}
        />
        <label className="check-line">
          <input
            id="tocSections"
            type="checkbox"
            defaultChecked={config.includeSections}
            key={String(config.includeSections)}
            ref={onNativeChange((el) =>
              commit(() => (source.ensureToc().includeSections = el.checked), false),
            )}
          />
          {tt(' Incluir comienzos de sección')}
        </label>
        <label className="check-line">
          <input
            id="tocHeadings"
            type="checkbox"
            defaultChecked={config.includeHeadings}
            key={String(config.includeHeadings)}
            ref={onNativeChange((el) =>
              commit(() => (source.ensureToc().includeHeadings = el.checked), false),
            )}
          />
          {tt(' Incluir títulos marcados')}
        </label>
        <button
          type="button"
          id="markHeading"
          className="btn wide"
          disabled={!o || o.type !== 'text' || !!o.toc}
          onClick={() => commit(() => (selectObject()!.heading = !selectObject()!.heading), false)}
        >
          {tt(o?.heading ? 'Quitar título del índice' : 'Marcar texto como título')}
        </button>
        <button
          type="button"
          id="insertToc"
          className="btn primary wide"
          onClick={() => source.insertToc()}
        >
          <Icon name="plus" />
          {tt('Colocar índice en página activa')}
        </button>
        <p className="help">
          {tt(
            'La tabla se actualiza también en el PDF. Si el contenido no entra, ampliá la caja o reducí el cuerpo.',
          )}
        </p>
      </section>
      <section className="section" data-section="Entradas del índice" data-key="pages">
        <div className="section-heading">
          <Icon name="pages" />
          <span>{tt('Entradas del índice')}</span>
        </div>
        <div className="toc-list">
          {entries.length ? (
            entries.map((e) => (
              <div className="toc-entry" key={e.id}>
                <span className="user-content">{e.label}</span>
                <strong>{e.folio}</strong>
                {e.source === 'manual' ? (
                  <button
                    type="button"
                    className="icon-btn"
                    title={tt('Quitar entrada')}
                    aria-label={tt('Quitar entrada')}
                    data-remove-entry={e.id}
                    onClick={() =>
                      commit(() => {
                        const toc = source.ensureToc();
                        toc.entries = toc.entries.filter((entry) => entry.id !== e.id);
                      }, false)
                    }
                  >
                    <Icon name="close" />
                  </button>
                ) : null}
              </div>
            ))
          ) : (
            <p className="help">
              {tt('Todavía no hay entradas. Marcá un título o definí una sección.')}
            </p>
          )}
        </div>
        <button
          type="button"
          id="addTocEntry"
          className="btn wide"
          onClick={() => source.addEntry()}
        >
          <Icon name="plus" />
          {tt('Agregar entrada manual')}
        </button>
      </section>
    </>
  );
};

/** La vista, con las acciones de editorial.ts. */
export const indexViewFor = (source: IndexSource) => () => <IndexView source={source} />;
