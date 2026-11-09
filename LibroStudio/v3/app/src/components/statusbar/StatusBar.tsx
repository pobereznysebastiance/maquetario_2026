// Barra de estado (organismo "statusbar"): página activa, selección, cajas con texto sobrante,
// unidad del documento y estado de guardado. Lee los globales del núcleo y se redibuja con cada
// aviso (useEditorState, src/react/editor-state.ts) y con el idioma (useLanguage).
//
// El indicador de guardado dice la verdad: sale de dirty, la misma variable que syncNative()
// manda al anfitrión y que pone body.has-unsaved-changes (el color del punto lo da el CSS).
// Los textos en castellano tienen su fila (o su patrón) en src/i18n.ts y se traducen con
// LibroI18n.tr(); la unidad usa bw(), como antes en document-units.ts.
//
// Mismo marcado que tenía index.html: lo leen las pruebas (tests/document-view-tests.js busca la
// unidad en el elemento que sigue a .status-spacer) y el CSS de ui/organisms/statusbar.css.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { mount, useLanguage } from '../../react/mount.tsx';
import { useEditorState } from '../../react/editor-state.ts';

const tr = (text: string) => LibroI18n.tr(text);

const OBJECT_NAMES: Record<string, string> = { text: 'Texto', image: 'Imagen' };

export const StatusBar = () => {
  useEditorState();
  useLanguage();
  const object = selectObject();
  const name = object ? OBJECT_NAMES[object.type] || 'Marco' : '';
  return (
    <>
      <span id="statusText">{tr(`Página ${active + 1} de ${book.pages.length}`)}</span>
      <span id="selectionText">
        {object ? tr(`${name} · ${displayDimensions(object.w, object.h)}`) : tr('Sin selección')}
      </span>
      <span id="overflowStatus">
        {overflowCount
          ? tr(`${overflowCount} caja${overflowCount > 1 ? 's' : ''} con texto sobrante`)
          : ''}
      </span>
      <span className="status-spacer"></span>
      <span>{bw('Unidades', 'Units', 'Unidades') + ': ' + documentUnit()}</span>
      <span className="saved" id="savedState">
        <i></i> {dirty ? tr('Cambios sin guardar') : tr('Guardado en tu equipo')}
      </span>
    </>
  );
};

mount($('.statusbar'), <StatusBar />, { sync: true });
