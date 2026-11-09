// Inspector · Página (etapa 3, D2, paso 5): las tres secciones de la pestaña Página.
// - La página sola (exceptions): qué elementos automáticos se ven en la página activa (antes lo
//   agregaba page-exceptions.ts sacando las casillas de la base y anteponiendo su sección).
// - Página N (page): sección que empieza en esta página, Agregar y Duplicar (antes los movía
//   reshapePagePass de inspector-views.ts desde la tarjeta del documento), Antes/Después y Eliminar.
// - Elementos automáticos (auto): la explicación.
//
// studio.ts deja los tres lugares en su orden; React dibuja el contenido con el mismo marcado,
// ids, data-command y textos que tenía en HTML. Las casillas y la sección graban con el "change"
// nativo (las pruebas disparan new Event('change'), que no sube); los botones de data-command van
// a command() de studio.ts, como los ligaba bindInspector.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { useEditorState } from '../../react/editor-state.ts';
import { useLanguage } from '../../react/mount.tsx';
import { Icon } from '../Icon.tsx';

/** Texto traducido como lo hace el traductor del DOM: sin tocar los espacios del borde. */
const tt = (text: string): string => {
  const trim = text.trim();
  return trim ? text.replace(trim, LibroI18n.tr(trim)) : text;
};

const bound = new WeakSet<Element>();
/** Escucha el "change" nativo de un campo (una sola vez por nodo). */
const onChange =
  (handler: (el: HTMLInputElement) => void) =>
  (el: HTMLInputElement | null): void => {
    if (!el || bound.has(el)) return;
    bound.add(el);
    el.addEventListener('change', () => handler(el));
  };

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
  commit(() => (book.pages[active][input.dataset.pageVisible!] = !input.checked), true),
);
const setAll = (hidden: boolean) =>
  commit(() => {
    const p = book.pages[active];
    p.hideFolio = p.hideHeader = p.hideTitle = hidden;
  }, true);

/** La página sola: elementos automáticos que se ven en la página activa. */
export const PageExceptionsPanel = () => {
  useEditorState();
  useLanguage();
  const page = book.pages[active];
  return (
    <>
      <div className="section-heading active-page-notice">
        <Icon name="pages" /> <strong>{`${bw('Página', 'Page', 'Página')} ${active + 1}`}</strong>
      </div>
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
            type="checkbox"
            data-page-visible={key}
            defaultChecked={!page[key]}
            ref={toggleVisible}
          />
          <span>
            {label()}
            {!book[element].enabled ? (
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

/** Botón de una orden del editor (UI.button con data-command, como lo ligaba bindInspector). */
const CommandButton = ({
  name,
  label,
  icon,
  variant,
  wide = false,
  disabled = false,
}: {
  name: string;
  label: string;
  icon?: string;
  variant?: 'danger';
  wide?: boolean;
  disabled?: boolean;
}) => (
  <button
    type="button"
    className={'btn' + (variant ? ' ' + variant : '') + (wide ? ' wide' : '')}
    data-command={name}
    disabled={disabled}
    onClick={() => command(name)}
  >
    {icon ? <Icon name={icon} /> : null}
    {tt(label)}
  </button>
);

const saveSection = onChange((input) =>
  commit(() => (book.pages[active].section = input.value), false),
);

/** Página N: sección, agregar, duplicar, mover y eliminar. */
export const PageSectionPanel = () => {
  useEditorState();
  useLanguage();
  const page = book.pages[active];
  return (
    <>
      <div className="section-heading">
        <Icon name="file" />
        <span data-text-source={'Página ' + (active + 1)}>{tt('Página ' + (active + 1))}</span>
      </div>
      <div className="sub-label" id="pageSectionLabel">
        {tt('Comenzar sección en esta página')}
      </div>
      <input
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
        <CommandButton name="addPage" icon="plus" label="Agregar" />
        <CommandButton name="duplicate" label="Duplicar" />
      </div>
      <div className="page-action">
        <CommandButton name="earlier" label="← Antes" disabled={active === 0} />
        <CommandButton name="later" label="Después →" disabled={active === book.pages.length - 1} />
      </div>
      <CommandButton
        name="deletePage"
        icon="trash"
        label="Eliminar página"
        variant="danger"
        wide
        disabled={book.pages.length === 1}
      />
    </>
  );
};

/** Elementos automáticos: se actualizan solos en todo el libro. */
export const AutoElementsPanel = () => {
  useLanguage();
  return (
    <>
      <div className="section-heading">
        <Icon name="link" />
        <span data-text-source="Elementos automáticos">{tt('Elementos automáticos')}</span>
      </div>
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
