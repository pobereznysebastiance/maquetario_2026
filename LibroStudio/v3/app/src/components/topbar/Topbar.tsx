// Barra superior (organismo "topbar") en React: marca (Inicio), acciones de archivo (Nuevo, Abrir,
// Guardar, Guardar como…, Empaquetar), Deshacer / Rehacer, Configuración y Espacio de trabajo, y a
// la derecha Ayuda, Asistente editorial, Imprimir, Vista previa y Exportar PDF.
//
// Se monta en #topbarRoot, un contenedor con display: contents dentro de .topbar (como la barra del
// documento): sus hijos siguen siendo los elementos de la barra, con el mismo CSS. Conserva los ids
// que usan las pruebas, el tutorial (señala controles por id), la autoprueba y workspace.ts.
// Lee los globales del núcleo y se redibuja con cada aviso (useEditorState) y con el idioma:
// - Deshacer / Rehacer, según las pilas de cambios.
// - Imprimir, Vista previa y Exportar PDF, sin libro o con una salida en curso (busy).
// - Sin libro (hasDocument en falso), también Guardar, Guardar como…, Empaquetar y el Asistente
//   editorial, con el motivo en su title (src/react/no-book.ts).
// - Vista previa, resaltada mientras está activa.
//
// Las acciones van por la propiedad onclick del botón (no por onClick de React), una sola vez: las
// pruebas reemplazan algunas (tests/review-tests.js → #save) y así el reemplazo sigue mandando, sin
// que corran las dos.
// El nombre del Espacio de trabajo lo escribe workspace.ts en el <span> de #workspace: React no le
// pone hijos, así que no lo pisa.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { Icon } from '../Icon.tsx';
import { mount, useLanguage } from '../../react/mount.tsx';
import { notifyEditorState, useEditorState } from '../../react/editor-state.ts';
import { bookTitle } from '../../react/no-book.ts';

const tr = (text: string) => LibroI18n.tr(text);

/** Acción del botón por su propiedad onclick, una sola vez (un reemplazo desde afuera gana). */
const action =
  (run: () => unknown) =>
  (button: HTMLButtonElement | null): void => {
    if (button && !button.onclick) button.onclick = () => run();
  };

/** Acción de archivo: botón cuadrado de ícono; el nombre va en el title y oculto para lectores. */
const ToolAction = ({
  id,
  icon,
  label,
  title = label,
  disabled,
  run,
}: {
  id: string;
  icon: string;
  label: string;
  title?: string;
  disabled?: boolean;
  run: () => unknown;
}) => (
  <button
    type="button"
    id={id}
    className="tool-action"
    title={title}
    disabled={disabled}
    ref={action(run)}
  >
    <Icon name={icon} />
    <span>{label}</span>
  </button>
);

/** Destello del Asistente editorial (relleno, no trazo: no está en el set de íconos). */
const AssistantSpark = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7Z" />
    <path d="m20 2 .6 1.4L22 4l-1.4.6L20 6l-.6-1.4L18 4l1.4-.6Z" />
  </svg>
);

export const Topbar = () => {
  useEditorState();
  useLanguage();
  const noOutput = !hasDocument || busy;
  const assistant = bw('Asistente editorial', 'Editorial assistant', 'Assistente editorial'),
    print = bw('Imprimir', 'Print', 'Imprimir');
  return (
    <>
      <div
        className="brand"
        title={tr('Inicio')}
        ref={(el) => {
          if (el) el.onclick = () => globalThis.showWelcome();
        }}
      >
        <img className="brandmark" src="maquetario.svg" alt={tr('Símbolo de Maquetario')} />
        <div>
          <strong>Maquetario</strong>
          <small>{tr('Maquetación y diseño de libros')}</small>
        </div>
      </div>
      <div className="toolbar" id="fileActions">
        <ToolAction id="new" icon="file" label={tr('Nuevo')} run={() => settings(true)} />
        <ToolAction id="open" icon="folder" label={tr('Abrir')} run={() => openBook()} />
        <ToolAction
          id="save"
          icon="save"
          label={tr('Guardar')}
          title={bookTitle(bw('Guardar · Ctrl+S', 'Save · Ctrl+S', 'Salvar · Ctrl+S'))}
          disabled={!hasDocument}
          run={() => saveProject()}
        />
        <ToolAction
          id="saveAs"
          icon="save"
          label={bw('Guardar como…', 'Save as…', 'Salvar como…')}
          title={bookTitle(
            bw(
              'Guardar como… · Ctrl+Mayús+S',
              'Save as… · Ctrl+Shift+S',
              'Salvar como… · Ctrl+Shift+S',
            ),
          )}
          disabled={!hasDocument}
          run={() => saveProjectAs()}
        />
        <ToolAction
          id="packageProject"
          icon="folder"
          label={bw('Empaquetar', 'Package', 'Empacotar')}
          title={bookTitle(bw('Empaquetar proyecto', 'Package project', 'Empacotar projeto'))}
          disabled={!hasDocument}
          run={() => packageDialog()}
        />
        <span className="divider"></span>
        <ToolAction
          id="undo"
          icon="undo"
          label={tr('Deshacer')}
          disabled={!undoStack.length}
          run={() => undo()}
        />
        <ToolAction
          id="redo"
          icon="redo"
          label={tr('Rehacer')}
          disabled={!redoStack.length}
          run={() => redo()}
        />
        <span className="divider"></span>
        <ToolAction
          id="openSettings"
          icon="settings"
          label={tr('Configuración')}
          run={() => openSettings()}
        />
        {/* El <span> del nombre lo completa workspace.ts con el modo actual. */}
        <button
          type="button"
          id="workspace"
          className="tool-action"
          title={tr('Espacio de trabajo')}
          ref={action(() => MaquetarioWorkspace.toggleMenu())}
        >
          <Icon name="layout" />
          <span></span>
        </button>
      </div>
      <div className="topright">
        <ToolAction
          id="helpCenter"
          icon="help"
          label={tr('Ayuda')}
          title={tr('Ayuda') + ' · F1'}
          run={() => openHelp()}
        />
        {/* En ancho chico el nombre se oculta y queda un botón de ícono: va también en aria-label. */}
        <button
          type="button"
          id="editorialAssistant"
          className="btn assistant-entry"
          title={bookTitle(
            assistant + ' · ' + bw('Revisar mi libro', 'Review my book', 'Revisar meu livro'),
          )}
          aria-label={assistant}
          disabled={!hasDocument}
          ref={action(() => globalThis.openEditorialAssistant())}
        >
          <AssistantSpark />
          <span>{assistant}</span>
        </button>
        <button
          type="button"
          id="printButton"
          className="btn"
          title={bookTitle(print)}
          aria-label={print}
          disabled={noOutput}
          ref={action(() => outputDialog('print'))}
        >
          <Icon name="print" />
          <span>{print}</span>
        </button>
        <button
          type="button"
          id="preview"
          className={preview ? 'btn primary' : 'btn'}
          title={bookTitle(tr('Vista previa'))}
          aria-label={tr('Vista previa')}
          aria-pressed={preview}
          disabled={noOutput}
          ref={action(() => {
            togglePreview();
            notifyEditorState();
          })}
        >
          <Icon name="eye" />
          <span>{tr('Vista previa')}</span>
        </button>
        <button
          type="button"
          id="export"
          className="btn primary"
          title={bookTitle(undefined)}
          disabled={noOutput}
          ref={action(() => outputDialog('pdf'))}
        >
          <Icon name="export" />
          <span>{tr('Exportar PDF')}</span>
        </button>
      </div>
    </>
  );
};

mount($('#topbarRoot'), <Topbar />, { sync: true });
