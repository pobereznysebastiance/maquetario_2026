// Inspector · Página (etapa 3, D2, paso 5): las tres secciones de la pestaña Página.
// - La página sola (exceptions): qué elementos automáticos se ven en la página activa (antes lo
//   agregaba page-exceptions.ts sacando las casillas de la base y anteponiendo su sección).
// - Página N (page): sección que empieza en esta página, Agregar y Duplicar (antes los movía
//   reshapePagePass de inspector-views.tsx desde la tarjeta del documento), Antes/Después y Eliminar.
// - Elementos automáticos (auto): la explicación.
//
// studio.ts deja los tres lugares en su orden; React dibuja el contenido con el mismo marcado,
// ids, data-command y textos que tenía en HTML. Las casillas y la sección graban con el "change"
// nativo (las pruebas disparan new Event('change'), que no sube); los botones de data-command van
// a command() de studio.ts, como los ligaba bindInspector.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { useLanguage } from '../../react/mount.tsx';
import { Icon } from '../Icon.tsx';
import { Btn, fieldKey, Heading, onNativeChange, SectionHeading, tt } from './fields.tsx';
import { bw } from '../../i18n/language.ts';
import { editor } from '../../core-api.ts';

/** Escucha el "change" nativo de un campo (una sola vez por nodo). */
const onChange = onNativeChange<HTMLInputElement>;

const VISIBILITY: [key: string, label: () => string, element: 'folio' | 'header' | 'titulillo'][] =
  [
    [
      'hideFolio',
      () => bw('Mostrar número de página', 'Show page number', 'Mostrar número da página'),
      'folio',
    ],
    [
      'hideHeader',
      () => bw('Mostrar cornisa', 'Show running header', 'Mostrar cabeçalho'),
      'header',
    ],
    [
      'hideTitle',
      () => bw('Mostrar titulillo', 'Show running title', 'Mostrar título corrente'),
      'titulillo',
    ],
  ];

/** Casilla "Mostrar …": marcada si el elemento se ve en la página activa. */
const toggleVisible = onChange((input) =>
  commit(
    () => (editor.book.pages[editor.active][input.dataset.pageVisible!] = !input.checked),
    true,
  ),
);
const setAll = (hidden: boolean) =>
  commit(() => {
    const p = editor.book.pages[editor.active];
    p.hideFolio = p.hideHeader = p.hideTitle = hidden;
  }, true);

/** La página sola: elementos automáticos que se ven en la página activa. */
export const PageExceptionsPanel = () => {
  useLanguage();
  const page = editor.book.pages[editor.active];
  return (
    <>
      <SectionHeading className="active-page-notice">
        <Icon name="pages" />{' '}
        <strong>{`${bw('Página', 'Page', 'Página')} ${editor.active + 1}`}</strong>
      </SectionHeading>
      <span className="page-only-tag">
        {bw('Solo esta página', 'This page only', 'Somente esta página')}
      </span>
      <p className="help">
        {bw(
          'Elegí qué elementos automáticos aparecen en la página seleccionada. Las demás no se modifican.',
          'Choose which automatic elements appear on the selected page. Other pages are unchanged.',
          'Escolha quais elementos automáticos aparecem na página selecionada. As demais não mudam.',
        )}
      </p>
      {VISIBILITY.map(([key, label, element]) => (
        <label key={key} className="check-line page-visibility-control">
          <input
            key={fieldKey(key, !page[key])}
            type="checkbox"
            data-page-visible={key}
            defaultChecked={!page[key]}
            ref={toggleVisible}
          />
          <span>
            {label()}
            {!editor.book[element].enabled ? (
              <small>
                {bw(
                  'Desactivado para todo el libro en la pestaña Libro.',
                  'Disabled for the whole book in the Book tab.',
                  'Desativado para o livro inteiro na aba Livro.',
                )}
              </small>
            ) : null}
          </span>
        </label>
      ))}
      <div className="page-action">
        <button type="button" id="pageHideAutomatic" className="btn" onClick={() => setAll(true)}>
          {bw('Ocultar los tres', 'Hide all three', 'Ocultar os três')}
        </button>
        <button type="button" id="pageShowAutomatic" className="btn" onClick={() => setAll(false)}>
          {bw('Mostrar los tres', 'Show all three', 'Mostrar os três')}
        </button>
      </div>
      <p className="help">
        {bw(
          'Ocultar un número no elimina la página ni reinicia la numeración. Para ver un elemento, también tiene que estar activado en la pestaña Libro.',
          'Hiding a number does not remove the page or restart numbering. To display an element, it must also be enabled in the Book tab.',
          'Ocultar um número não remove a página nem reinicia a numeração. Para mostrar um elemento, ele também deve estar ativado na aba Livro.',
        )}
      </p>
    </>
  );
};

const saveSection = onChange((input) =>
  commit(() => (editor.book.pages[editor.active].section = input.value), false),
);

/** Página N: sección, agregar, duplicar, mover y eliminar. */
export const PageSectionPanel = () => {
  useLanguage();
  const page = editor.book.pages[editor.active];
  return (
    <>
      <Heading icon="file" title={'Página ' + (editor.active + 1)} />
      <div className="sub-label" id="pageSectionLabel">
        {tt('Comenzar sección en esta página')}
      </div>
      <input
        key={fieldKey('section', page.section)}
        className="field-full"
        id="pageSection"
        aria-labelledby="pageSectionLabel"
        maxLength={250}
        defaultValue={page.section}
        placeholder={tt('Ej.: Capítulo 2')}
        ref={saveSection}
      />
      <p className="help">
        {tt('La sección se mantiene en las páginas siguientes hasta el próximo comienzo.')}
      </p>
      <div className="page-action">
        <Btn command="addPage" icon="plus" label="Agregar" />
        <Btn command="duplicate" label="Duplicar" />
      </div>
      <div className="page-action">
        <Btn command="earlier" label="← Antes" disabled={editor.active === 0} />
        <Btn
          command="later"
          label="Después →"
          disabled={editor.active === editor.book.pages.length - 1}
        />
      </div>
      <Btn
        command="deletePage"
        icon="trash"
        label="Eliminar página"
        variant="danger"
        wide
        disabled={editor.book.pages.length === 1}
      />
    </>
  );
};

/** Elementos automáticos: se actualizan solos en todo el libro. */
export const AutoElementsPanel = () => {
  useLanguage();
  return (
    <>
      <Heading icon="link" title="Elementos automáticos" />
      <p className="help">
        {tt(
          'Cornisas, titulillos y folios se actualizan en todo el libro al cambiar una sección o reorganizar páginas.',
        )}
        <br />
        <br />
        {tt('Podés definir contenido distinto para pares e impares desde la pestaña Libro.')}
      </p>
    </>
  );
};

registerInspectorPanel('pages:exceptions', () => <PageExceptionsPanel />, 'page-panel');
registerInspectorPanel('pages:page', () => <PageSectionPanel />, 'page-panel');
registerInspectorPanel('pages:auto', () => <AutoElementsPanel />, 'page-panel');
