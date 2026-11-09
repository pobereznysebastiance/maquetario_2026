// Estructura del libro, en React: una vista del riel izquierdo (junto a Páginas, Índice y Capas).
// Antes era la primera sección de la pestaña Libro; es para recorrer el libro, no un ajuste.
//
// La sección la pone structurePanelFor (abajo). Mismo marcado que tenía en HTML: resumen, "Armar otro
// libro…", las partes del libro (ir al comienzo de cada una) y la ayuda. Suma lo que antes le
// agregaban dos decoradores desde afuera:
// - "Formato y configuración" (#structureSettings), que insertaba inspector-views.tsx;
// - "Pauta tipográfica" (#editorialRules, con un libro abierto), que editorial-rules.ts ponía arriba
//   de todo el inspector, pegado a sus bordes: ahora va dentro de la sección, con los otros botones.
//
// Los textos van con bw() o LibroI18n.tr (el traductor del DOM no entra en lo que dibuja React) y
// el panel se redibuja con el inspector: la parte actual sigue a la página
// activa.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import type { Page } from '../../model.ts';
import { useLanguage } from '../../react/mount.tsx';
import { Icon } from '../Icon.tsx';
import { fieldKey, onNativeChange, SectionHeading, SectionTitle } from './fields.tsx';
import { bw, i18n } from '../../i18n/language.ts';
import { editor } from '../../core-api.ts';
import { goToBookPage } from '../../book-navigation.ts';
import { addPart, BOOK_PARTS, partName, presentParts, removePart } from '../../book-parts.ts';

/**
 * Partes del libro para tildar (pedido de la cátedra): tildar agrega la parte en su lugar,
 * destildar la quita (con confirmación); el número lleva a su primera página.
 */
const PartsChecklist = () => {
  const present = presentParts();
  return (
    <div
      className="book-parts"
      role="group"
      aria-label={bw('Partes del libro', 'Book parts', 'Partes do livro')}
    >
      <h3 className="book-parts-title">
        {bw('Partes del libro', 'Book parts', 'Partes do livro')}
      </h3>
      {BOOK_PARTS.map(({ id }) => {
        const range = present.get(id);
        return (
          <div className="book-part" key={id}>
            <label className="check-line">
              <input
                key={fieldKey('part-' + id, !!range)}
                type="checkbox"
                data-book-part={id}
                defaultChecked={!!range}
                disabled={!editor.hasDocument || (id === 'body' && !!range)}
                ref={onNativeChange<HTMLInputElement>((input) => {
                  if (input.checked) addPart(id);
                  else {
                    input.checked = true;
                    void removePart(id);
                  }
                })}
              />
              {partName(id)}
            </label>
            {range ? (
              <button
                type="button"
                className="quiet book-part-go"
                data-go-book-part={id}
                title={
                  bw('Ir a la página ', 'Go to page ', 'Ir para a página ') + (range.start + 1)
                }
                onClick={() => goToBookPage(range.start)}
              >
                {bw('p. ', 'p. ', 'p. ') + (range.start + 1)}
              </button>
            ) : null}
          </div>
        );
      })}
      <p className="help">
        {bw(
          'Tildá una parte para agregarla en su lugar; destildala para quitar sus páginas.',
          'Check a part to add it in place; uncheck it to remove its pages.',
          'Marque uma parte para adicioná-la no lugar; desmarque para remover suas páginas.',
        )}
      </p>
    </div>
  );
};

const StructurePanel = ({
  titleOf,
  build,
}: {
  titleOf: (page: Page) => string;
  build: () => void;
}) => {
  useLanguage();
  const parts = editor.book.pages
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => p.partName || p.section || i === 0);
  return (
    <>
      <SectionHeading>
        <Icon name="pages" />
        <SectionTitle source="Estructura del libro">
          {bw('Estructura del libro', 'Book structure', 'Estrutura do livro')}
        </SectionTitle>
      </SectionHeading>
      <p className="structure-summary">
        {`${editor.book.pages.length} ${bw('páginas. Elegí una parte para ir a su comienzo.', 'pages. Choose a part to go to its start.', 'páginas. Escolha uma parte para ir ao início.')}`}
      </p>
      <button id="structureBuild" className="btn wide" onClick={() => build()}>
        {bw('Armar otro libro…', 'Build another book…', 'Montar outro livro…')}
      </button>
      <button
        type="button"
        id="structureSettings"
        className="btn wide"
        onClick={() => command('settings')}
      >
        <Icon name="settings" />
        {i18n.tr('Formato y configuración')}
      </button>
      {editor.hasDocument ? (
        <button
          type="button"
          id="editorialRules"
          className="btn wide"
          onClick={() => editorialRulesDialog()}
        >
          {bw('Pauta tipográfica', 'Type guide', 'Pauta tipográfica')}
        </button>
      ) : null}
      <PartsChecklist />
      {parts.map(({ p, i }, n) => {
        const end = parts[n + 1]?.i ?? editor.book.pages.length;
        return (
          <button
            key={i}
            className={
              'structure-item ' + (editor.active >= i && editor.active < end ? 'current' : '')
            }
            data-go-part={i}
            onClick={() => goToBookPage(i)}
          >
            <small>{i + 1}</small>
            <span className="user-content">{titleOf(p)}</span>
            <em>{`${end - i} p.`}</em>
          </button>
        );
      })}
      <p className="help">
        {bw(
          'En la pestaña Página podés ocultar cornisas y folios solo en la página activa.',
          'The Page tab lets you hide headers and folios on the active page only.',
          'Na aba Página você pode ocultar cabeçalhos e fólios somente na página ativa.',
        )}
      </p>
    </>
  );
};

/**
 * La vista Estructura del riel, con el nombre de cada parte como lo arma book-workflow.ts. Va en una
 * sección, como Índice y Capas (el margen de la vista sale de .rail-view .section).
 */
export const structurePanelFor = (titleOf: (page: Page) => string, build: () => void) => () => (
  <section className="section" data-section="Estructura del libro" data-key="pages">
    <StructurePanel titleOf={titleOf} build={build} />
  </section>
);
