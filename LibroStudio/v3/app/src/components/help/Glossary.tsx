// Sección "Glosario" del centro de Ayuda, en React: búsqueda, categoría, lista de términos,
// definición con su ejemplo y "Encontrarlo en Maquetario". Los términos y las categorías los pone
// editorial-learning.ts (glossaryHelpSection); el filtro es glossaryMatches (global).
//
// La búsqueda y la categoría viven en sus campos (no controlados), como en la versión en HTML:
// renderGlossary() lee #glossarySearch y #glossaryCategory y vuelve a dibujar en el acto, así las
// pruebas pueden escribir .value y llamarla. Al cambiar de idioma no se pierde nada: el centro de
// Ayuda no vuelve a pedir la sección, sólo se traducen los textos (useLanguage).
// La categoría escucha el "change" nativo (Select de components/form): un new Event('change'), que
// no sube, también llega.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { useLanguage } from '../../react/mount.tsx';
import { Select } from '../form/Form.tsx';
import type { HelpSection } from './help-center.tsx';
import type { EditorialTerm, GlossaryCategory } from '../../editorial-learning.ts';

type Words = [string, string, string];

/** Lo que el glosario necesita del módulo que lo conoce (editorial-learning.ts). */
export interface GlossarySource {
  categories: Record<GlossaryCategory, Words>;
  /** Abre la herramienta donde se usa el término (cierra la Ayuda). */
  openTool: (term: EditorialTerm) => void;
}

// Estado: búsqueda, categoría y término elegido. version cambia con cada cambio.
let query = '',
  category = 'all',
  selected: string | undefined = 'grid',
  version = 0,
  /** Cada pedido vuelve a montar la sección: sus campos arrancan con la búsqueda y la categoría nuevas. */
  requests = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const notify = () => {
  version += 1;
  flushSync(() => listeners.forEach((listener) => listener()));
};

/** Lee la búsqueda y la categoría de sus campos y vuelve a dibujar el glosario (si está abierto). */
export function renderGlossary(): void {
  const search = document.getElementById('glossarySearch') as HTMLInputElement | null,
    select = document.getElementById('glossaryCategory') as HTMLSelectElement | null;
  if (search) query = search.value;
  if (select) category = select.value;
  notify();
}

const GlossarySection = ({ source }: { source: GlossarySource }) => {
  useSyncExternalStore(subscribe, () => version);
  useLanguage();
  const matches = glossaryMatches(query, category);
  // El término elegido, si sigue en la lista; si no, el primero que coincide (o ninguno).
  if (!matches.some((t) => t[0] === selected)) selected = matches[0]?.[0];
  const term = editorialTerms.find((t) => t[0] === selected);
  return (
    <>
      <h2 className="help-heading">{LibroI18n.tr('Glosario')}</h2>
      <p className="builder-intro">
        {bw(
          'Un diccionario para entender lo que estás diseñando. Buscá un término o explorá una categoría.',
          'A dictionary to understand what you are designing. Search a term or explore a category.',
          'Um dicionário para entender o que você está criando. Busque um termo ou explore uma categoria.',
        )}
      </p>
      <div className="glossary-filters">
        <input
          id="glossarySearch"
          type="search"
          defaultValue={query}
          aria-label={bw('Buscar término', 'Search term', 'Buscar termo')}
          placeholder={bw(
            'Buscar: medianil, sangrado, lomo…',
            'Search: gutter, bleed, spine…',
            'Buscar: sangria, lombada, grade…',
          )}
          onInput={renderGlossary}
        />
        <Select
          id="glossaryCategory"
          defaultValue={category}
          options={[
            {
              value: 'all',
              label: bw('Todas las categorías', 'All categories', 'Todas as categorias'),
            },
            ...Object.entries(source.categories).map(([value, words]) => ({
              value,
              label: bw(...words),
            })),
          ]}
          onChange={renderGlossary}
        />
      </div>
      <div className="glossary-layout">
        <nav id="glossaryList" aria-label={bw('Términos', 'Terms', 'Termos')}>
          {matches.length ? (
            matches.map((t) => (
              <button
                key={t[0]}
                type="button"
                data-glossary-term={t[0]}
                className={t[0] === selected ? 'active' : undefined}
                onClick={() => {
                  selected = t[0];
                  notify();
                }}
              >
                {bw(...t[2])}
              </button>
            ))
          ) : (
            <p className="help">
              {bw('No encontramos ese término.', 'No matching terms.', 'Nenhum termo encontrado.')}
            </p>
          )}
        </nav>
        <article id="glossaryDefinition">
          {term ? (
            <>
              <span className="eyebrow">{bw(...source.categories[term[1]])}</span>
              <h2>{bw(...term[2])}</h2>
              <p>{bw(...term[3])}</p>
              <div className="glossary-example">
                <strong>{bw('Ejemplo', 'Example', 'Exemplo')}</strong>
                <p>{bw(...term[4])}</p>
              </div>
              <button
                type="button"
                className="btn"
                id="glossaryOpenTool"
                onClick={() => source.openTool(term)}
              >
                {bw(
                  'Encontrarlo en Maquetario',
                  'Find it in Maquetario',
                  'Encontrar no Maquetario',
                )}{' '}
                →
              </button>
            </>
          ) : null}
        </article>
      </div>
      <p className="help glossary-note">
        {bw(
          'Glosario educativo. Las convenciones pueden variar según el país y la imprenta. Aprender un concepto no significa que exista una corrección automática para él.',
          'Educational glossary. Conventions can vary by country and printer. Learning a concept does not imply automatic correction support.',
          'Glossário educativo. Convenções podem variar conforme país e gráfica. Aprender um conceito não implica correção automática.',
        )}
      </p>
    </>
  );
};

/**
 * La sección del centro de Ayuda. Cada pedido (abrir el glosario, elegirlo en la navegación) arranca
 * sin búsqueda y en todas las categorías; con un término, en ese término (si no existe, "grid").
 */
export const glossaryHelpSection = (source: GlossarySource): HelpSection => ({
  id: 'glossary',
  label: 'Glosario',
  order: 2,
  render: (_host, term) => {
    query = '';
    category = 'all';
    if (term) selected = editorialTerms.some((t) => t[0] === term) ? term : 'grid';
    requests += 1;
    return <GlossarySection key={requests} source={source} />;
  },
});
