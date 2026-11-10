// Organismo: riel izquierdo. Las herramientas del lienzo (#tools: Seleccionar, Mano, Texto, Imagen,
// Marco, Figuras) y, debajo, lo que forma el libro (.rail-switch): las vistas Páginas · Estructura ·
// Índice · Capas y la Cubierta y solapas (#coverTool, pedido de la BETA 0.2: arriba quedan las
// acciones del programa y a la izquierda todo lo que forma el libro). La cubierta no es una vista:
// abre su ventana de trabajo (coverEditor). Grilla, foliado y cornisa están en la pestaña Libro.
//
// - Las herramientas salen del registro (rail-tools.ts: registerTool). La activa es la del global
//   tool (estado del editor): se redibuja con useEditorState(), y setTool avisa al terminar.
// - La vista del riel la lleva inspector-views.tsx (showRailView / currentRailView), que avisa con
//   notifyEditorState(); acá sólo se dibujan las pestañas, el clic y las flechas.
// - Mismos ids y atributos que antes: data-tool, #handTool, #shapeTool, #railTab-pages|index|layers,
//   data-rail-view, data-tab, #coverTool. El espacio de trabajo
//   (workspace.ts) les sigue poniendo data-workspace-hidden.
// - No toca las miniaturas (#thumbnails): son dibujo del libro.
//
// Se monta después de book-workflow.ts (bw) y dibuja al instante: los módulos que cargan después
// encuentran los botones (tutorial, workspace, pruebas).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { useSyncExternalStore, type KeyboardEvent } from 'react';
import { Icon } from '../Icon.tsx';
import { mount, useLanguage } from '../../react/mount.tsx';
import { notifyEditorState, useEditorState } from '../../react/editor-state.ts';
import { railMounted, railToolsSnapshot, subscribeRailTools } from './rail-registry.ts';
import { bookTitle, noBookReason } from '../../react/no-book.ts';
import { bw, i18n } from '../../i18n/language.ts';
import { editor } from '../../core-api.ts';

type RailView = 'pages' | 'structure' | 'index' | 'layers';

/** Herramientas del riel. */
export const ToolRail = () => {
  useEditorState();
  useLanguage();
  const list = useSyncExternalStore(subscribeRailTools, railToolsSnapshot);
  return (
    <>
      {list.map((spec) => {
        const label = spec.label();
        const active = !!spec.tool && spec.tool === editor.tool;
        return (
          <button
            key={spec.tool ?? spec.id}
            type="button"
            id={spec.id}
            className={active ? 'tool active' : 'tool'}
            data-tool={spec.tool}
            title={spec.title ? spec.title() : label}
            onClick={() => (spec.onSelect ? spec.onSelect() : setTool(spec.tool!))}
          >
            <Icon name={spec.icon} />
            <span>{label}</span>
            {spec.shortcut === null ? null : (
              <span className="shortcut">{spec.shortcut ?? ''}</span>
            )}
          </button>
        );
      })}
    </>
  );
};

const VIEWS: { view: RailView; label: string; icon: string; panel: string }[] = [
  { view: 'pages', label: 'Páginas', icon: 'pages', panel: 'thumbnails' },
  { view: 'structure', label: 'Estructura', icon: 'layout', panel: 'railView' },
  { view: 'index', label: 'Índice', icon: 'index', panel: 'railView' },
  { view: 'layers', label: 'Capas', icon: 'layers', panel: 'railView' },
];

/** Flechas entre vistas (patrón de pestañas de ARIA), salteando las que oculta el espacio. */
function onArrows(event: KeyboardEvent<HTMLButtonElement>): void {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  const list = [
    ...document.querySelectorAll<HTMLElement>(
      '.rail-switch [data-rail-view]:not([data-workspace-hidden])',
    ),
  ];
  const index = list.findIndex((b) => b.dataset.railView === currentRailView());
  if (index < 0) return;
  event.preventDefault();
  const next = list[(index + (event.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length];
  showRailView(next.dataset.railView as RailView);
  next.focus();
}

/** Lo que forma el libro: las vistas del riel (Páginas · Estructura · Índice · Capas) y la cubierta. */
export const RailSwitch = () => {
  useEditorState();
  useLanguage();
  // inspector-views.tsx (la vista) carga al final: hasta entonces, Páginas.
  const current: RailView = typeof currentRailView === 'function' ? currentRailView() : 'pages';
  const cover = bw('Cubierta y solapas', 'Cover and flaps', 'Capa e orelhas');
  return (
    <>
      <div className="rail-tablist" role="tablist" aria-label={i18n.tr('Vistas del panel')}>
        {VIEWS.map(({ view, label, icon, panel }) => {
          const on = view === current;
          const name = i18n.tr(label);
          // Sin libro, Índice y Capas no tienen qué mostrar (review-workspace vuelve a Páginas).
          const off = !editor.hasDocument && view !== 'pages';
          return (
            <button
              key={view}
              type="button"
              className={on ? 'rail-tab active' : 'rail-tab'}
              id={'railTab-' + view}
              data-rail-view={view}
              data-tab={view === 'pages' ? undefined : view}
              role="tab"
              aria-selected={on}
              aria-controls={panel}
              tabIndex={on ? 0 : -1}
              aria-label={name}
              title={off ? noBookReason() : name}
              disabled={off}
              onClick={() => {
                finishEditing();
                showRailView(view);
              }}
              onKeyDown={onArrows}
            >
              <span>
                <Icon name={icon} />
              </span>
            </button>
          );
        })}
      </div>
      {/* Cubierta y solapas: abre la cubierta desplegada (su ventana de trabajo). */}
      <button
        type="button"
        className="rail-tab rail-piece"
        id="coverTool"
        aria-label={cover}
        title={bookTitle(
          cover +
            ' · ' +
            bw(
              'Tapa, lomo, contratapa y solapas.',
              'Front, spine, back and flaps.',
              'Capa, lombada, contracapa e orelhas.',
            ),
        )}
        disabled={!editor.hasDocument}
        onClick={() => {
          finishEditing();
          coverEditor();
        }}
      >
        <span>
          <Icon name="book" />
        </span>
      </button>
    </>
  );
};

mount($('#tools'), <ToolRail />, { sync: true });
mount($('.rail-switch'), <RailSwitch />, { sync: true });
railMounted();
// Cambiar de herramienta marca la nueva en el riel. Por fuera de toda la cadena de setTool
// (algunas extensiones la reemplazan: grilla, foliado, cornisa).
extend.around(
  'setTool',
  (next) =>
    function (this: unknown, ...args: unknown[]) {
      const result = next.apply(this, args);
      notifyEditorState();
      return result;
    },
  'rail',
);
