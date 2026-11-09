// Barra del documento (organismo "documentbar"): punto de estado, nombre del libro, formato,
// imán y "Configurar libro". Lee los globales del núcleo y se redibuja con cada aviso
// (useEditorState, src/react/editor-state.ts) y con el idioma (useLanguage).
//
// Se monta en #documentbarRoot, un contenedor con display: contents dentro de .documentbar: sus
// hijos siguen siendo elementos de la barra (mismo flex y mismo CSS), y lo que otros módulos
// agregan a .documentbar (la página activa de review-workspace, al principio; los botones de
// ayuda, al final) queda afuera del árbol de React, que nunca lo toca.
//
// "Configurar libro" recibe su acción por la propiedad onclick del botón, no por onClick de React:
// las pruebas la reemplazan (tests/review-tests.js) y así el reemplazo sigue mandando, como antes.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { Icon } from '../Icon.tsx';
import { mount, useLanguage } from '../../react/mount.tsx';
import { useEditorState } from '../../react/editor-state.ts';
import { snapButtonState, toggleSnap } from '../../layout-tools.ts';

const tr = (text: string) => LibroI18n.tr(text);

/** Acción por defecto de "Configurar libro" (una sola vez por botón: el reemplazo gana). */
const bindSettings = (button: HTMLButtonElement | null) => {
  if (button && !button.onclick) button.onclick = () => settings(false);
};

export const SnapButton = () => {
  const { on, label, hint } = snapButtonState();
  return (
    <button
      type="button"
      id="snapButton"
      className={on ? 'quiet on' : 'quiet'}
      title={hint}
      aria-pressed={on}
      onClick={toggleSnap}
    >
      ⌁ <span className="snap-label">{label}</span>
    </button>
  );
};

export const DocumentBar = () => {
  useEditorState();
  useLanguage();
  return (
    <>
      <div className="document-title">
        <span className="document-dot"></span>
        <span id="documentName">{book.title}</span>
        <span className="doc-format" id="documentFormat">
          {book.format + ' · ' + displayDimensions(book.width, book.height)}
        </span>
      </div>
      <SnapButton />
      {/* "Revisar libro": también es el paso 4 del recorrido (centro de Ayuda). */}
      <button
        type="button"
        className="quiet"
        id="reviewBook"
        title={tr('Texto que no entra y objetos fuera de página.')}
        onClick={() => preflightDialog()}
      >
        <Icon name="check" />
        <span>{tr('Revisar libro')}</span>
      </button>
      <button type="button" className="quiet" id="documentSettings" ref={bindSettings}>
        <Icon name="settings" />
        <span>{tr('Configurar libro')}</span>
      </button>
    </>
  );
};

mount($('#documentbarRoot'), <DocumentBar />, { sync: true });
