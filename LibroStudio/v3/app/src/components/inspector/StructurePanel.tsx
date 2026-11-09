// Inspector · Libro · Estructura del libro, en React (etapa 3, D2, paso 6 del plan del inspector).
//
// Dibuja la sección dentro del lugar que deja inspectorSlot('structure', …) en la pasada
// 'structure' (book-workflow.ts), con el mismo marcado que tenía en HTML: resumen, "Armar otro
// libro…", las partes del libro (ir al comienzo de cada una) y la ayuda. Suma lo que antes le
// agregaban dos decoradores desde afuera:
// - "Formato y configuración" (#structureSettings), que insertaba inspector-views.ts;
// - "Reglas internas" (#editorialRules, con un libro abierto), que editorial-rules.ts ponía arriba
//   de todo el inspector, pegado a sus bordes: ahora va dentro de la sección, con los otros botones.
//
// Los textos van con bw() o LibroI18n.tr (el traductor del DOM no entra en lo que dibuja React) y
// el panel se redibuja con useEditorState() y useLanguage(): la parte actual sigue a la página
// activa.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import type { Page } from '../../model.ts';
import { useEditorState } from '../../react/editor-state.ts';
import { useLanguage } from '../../react/mount.tsx';
import { Icon } from '../Icon.tsx';

const StructurePanel = ({ titleOf }: { titleOf: (page: Page) => string }) => {
  useEditorState();
  useLanguage();
  const parts = book.pages
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => p.partName || p.section || i === 0);
  return (
    <>
      <div className="section-heading">
        <Icon name="pages" />
        <span data-text-source="Estructura del libro">
          {bw('Estructura del libro', 'Book structure', 'Estrutura do livro')}
        </span>
      </div>
      <p className="structure-summary">
        {`${book.pages.length} ${bw('páginas. Elegí una parte para ir a su comienzo.', 'pages. Choose a part to go to its start.', 'páginas. Escolha uma parte para ir ao início.')}`}
      </p>
      <button id="structureBuild" className="btn wide" onClick={() => bookBuilder()}>
        {bw('Armar otro libro…', 'Build another book…', 'Montar outro livro…')}
      </button>
      <button
        type="button"
        id="structureSettings"
        className="btn wide"
        onClick={() => command('settings')}
      >
        <Icon name="settings" />
        {LibroI18n.tr('Formato y configuración')}
      </button>
      {hasDocument ? (
        <button
          type="button"
          id="editorialRules"
          className="btn wide"
          onClick={() => editorialRulesDialog()}
        >
          {bw('Reglas internas', 'Editorial rules', 'Regras internas')}
        </button>
      ) : null}
      {parts.map(({ p, i }, n) => {
        const end = parts[n + 1]?.i ?? book.pages.length;
        return (
          <button
            key={i}
            className={'structure-item ' + (active >= i && active < end ? 'current' : '')}
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

/** El panel, con el nombre de cada parte como lo arma book-workflow.ts. */
export const structurePanelFor = (titleOf: (page: Page) => string) => () => (
  <StructurePanel titleOf={titleOf} />
);
