// Capa de selección del lienzo (etapa 3, D2, lienzo paso 3): lo que el papel lleva encima sólo en
// la pantalla, dibujado por React con portales dentro de los nodos del papel.
//
//   en el objeto elegido   la etiqueta (.object-badge) y los 8 controladores (.frame-handle);
//                          bloqueado, sólo la etiqueta
//   en cada caja de texto  la marca + de texto sobrante (.overflow-mark)
//   en cada página         la grilla y las guías (.guides), el rótulo de página activa
//                          (.page-active-badge) y, durante un arrastre, el imán (.snap-indicator)
//   en las reglas          sus marcas (#rulerX, #rulerY)
//   clases                 selected, multi-selected y locked en los objetos; active-page e
//                          is-page-active en las páginas
//
// Mismo marcado que cuando lo agregaban screenPage, frame-handles, review-workspace, shapes,
// layout-tools y checkOverflow. Los nodos del papel se rehacen en cada dibujo: screenPage avisa
// cada página nueva (trackPage, desde canvas-layer.ts) y la capa se dibuja en el acto. Durante un
// arrastre los controladores van dentro del nodo que se mueve: siguen al estilo sin redibujar.
//
// Este archivo no tiene efectos al cargar: la raíz se monta con el primer uso.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { useLayoutEffect, useSyncExternalStore } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { editor } from '../../core-api.ts';
import { bw, i18n } from '../../i18n/language.ts';
import { useEditorState } from '../../react/editor-state.ts';
import { mount, useLanguage } from '../../react/mount.tsx';
import { PageGrid, Rulers, SnapMarks, type SnapMark } from './CanvasGuides.tsx';

/** Direcciones de los controladores: esquinas y bordes. */
export const frameDirections = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

const HANDLE_NAMES: Record<string, Record<string, string>> = {
  es: {
    nw: 'Esquina superior izquierda',
    n: 'Borde superior',
    ne: 'Esquina superior derecha',
    e: 'Borde derecho',
    se: 'Esquina inferior derecha',
    s: 'Borde inferior',
    sw: 'Esquina inferior izquierda',
    w: 'Borde izquierdo',
  },
  en: {
    nw: 'Top-left corner',
    n: 'Top edge',
    ne: 'Top-right corner',
    e: 'Right edge',
    se: 'Bottom-right corner',
    s: 'Bottom edge',
    sw: 'Bottom-left corner',
    w: 'Left edge',
  },
  pt: {
    nw: 'Canto superior esquerdo',
    n: 'Borda superior',
    ne: 'Canto superior direito',
    e: 'Borda direita',
    se: 'Canto inferior direito',
    s: 'Borda inferior',
    sw: 'Canto inferior esquerdo',
    w: 'Borda esquerda',
  },
};
/** Nombre accesible de un controlador, en el idioma de la interfaz. */
const handleLabel = (direction: string): string => HANDLE_NAMES[i18n.language || 'es'][direction];

// ── Estado de la capa ──

/** Una página del lienzo dibujada por screenPage, con su índice. */
interface TrackedPage {
  page: HTMLElement;
  index: number;
  /** Píxeles por mm con que se dibujó. */
  px: number;
}
let pages: TrackedPage[] = [];
/** La página que se está armando (todavía fuera del documento). */
let pending: TrackedPage | null = null;
/** Cajas de texto con texto sobrante (las mide checkOverflow, en canvas-layer.ts). */
let overflowing = new Set<string>();
/** Indicadores del imán: la página del arrastre y sus líneas. */
let snap: { page: HTMLElement | null; marks: SnapMark[] } = { page: null, marks: [] };

let version = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
let mounted = false;

/** Monta la raíz de la capa si todavía no está (devuelve si la montó recién). */
export function ensureSelectionLayer(): boolean {
  if (mounted) return false;
  mounted = true;
  const host = document.createElement('div');
  host.hidden = true;
  host.className = 'selection-layer-root';
  document.body.append(host);
  mount(host, <SelectionLayer />, { sync: true });
  return true;
}

/** Dentro de un dibujo del pliego (Spread.tsx): la capa se redibuja al terminarlo. */
let drawing = 0;

/** Redibuja la capa en el acto (al volver, el DOM ya está al día). */
export function refreshSelection(): void {
  if (ensureSelectionLayer()) return;
  version += 1;
  const notify = () => {
    for (const listener of listeners) listener();
  };
  // Dentro de un dibujo de React (los lugares del pliego se llenan en un efecto) no se puede
  // forzar: React redibuja la capa al terminar ese dibujo, antes de volver.
  if (drawing) notify();
  else flushSync(notify);
}

/**
 * Llena lugares del pliego (Spread.tsx, dentro de un useLayoutEffect): las páginas que arma fn se
 * anotan y la capa se redibuja una vez, al final.
 */
export function drawingPages(fn: () => void): void {
  drawing += 1;
  try {
    fn();
  } finally {
    drawing -= 1;
  }
  // Se llama desde un efecto de React: el redibujo queda para el final de ese dibujo.
  if (!drawing && !ensureSelectionLayer()) {
    version += 1;
    for (const listener of listeners) listener();
  }
}

/** Una página nueva del lienzo (screenPage): la capa se dibuja sobre ella en el acto. */
export function trackPage(page: HTMLElement, index: number, px: number): void {
  pages = pages.filter((p) => p.page.isConnected && p.page !== page);
  pending = { page, index, px };
  pages.push(pending);
  if (drawing) {
    // Se dibuja al terminar el llenado, cuando la página ya está en el documento.
    pending = null;
    return;
  }
  try {
    refreshSelection();
  } finally {
    pending = null;
  }
}

/** Cajas con texto sobrante: redibuja sólo si cambiaron. */
export function setOverflowing(ids: string[]): void {
  const next = new Set(ids);
  if (next.size === overflowing.size && ids.every((id) => overflowing.has(id))) return;
  overflowing = next;
  refreshSelection();
}

/** Indicadores del imán (layout-tools): redibuja sólo si cambiaron. */
export function setSnapMarks(page: HTMLElement | null, marks: SnapMark[]): void {
  const same =
    page === snap.page &&
    marks.length === snap.marks.length &&
    marks.every((m, i) => m.axis === snap.marks[i].axis && m.offset === snap.marks[i].offset);
  if (same) return;
  snap = { page, marks };
  refreshSelection();
}

// ── Dibujo ──

/** Una clave estable por nodo del papel (los portales cambian de nodo en cada dibujo). */
const keys = new WeakMap<Element, number>();
let nextKey = 0;
const keyOf = (node: Element): number => {
  if (!keys.has(node)) keys.set(node, ++nextKey);
  return keys.get(node)!;
};

const typeLabel = (o: Record<string, any>): string =>
  o.shape
    ? bw(...globalThis.shapeNames[o.shape])
    : o.type === 'text'
      ? 'Cuadro de texto'
      : o.type === 'image'
        ? 'Imagen'
        : 'Marco';

/** Lo que va dentro de un objeto del papel. */
const ObjectMarks = ({ el, o }: { el: HTMLElement; o: Record<string, any> }) => {
  const chosen = editor.selected === o.id,
    overflow = o.type === 'text' && overflowing.has(o.id);
  if (!chosen && !overflow) return null;
  return createPortal(
    <>
      {chosen ? <span className="object-badge">{typeLabel(o)}</span> : null}
      {chosen && !o.locked
        ? frameDirections.map((direction) => (
            <span
              key={direction}
              className={'resize-handle frame-handle handle-' + direction}
              data-handle={direction}
              title={handleLabel(direction)}
              aria-label={handleLabel(direction)}
              role="button"
            />
          ))
        : null}
      {overflow ? (
        <span className="overflow-mark" title="Texto desbordado">
          +
        </span>
      ) : null}
    </>,
    el,
    String(keyOf(el)),
  );
};

/** Una página: grilla y guías, rótulo de página activa, imán y las marcas de sus objetos. */
const PageMarks = ({ page, index, px }: { page: HTMLElement; index: number; px: number }) => {
  const objects = editor.book.pages[index]?.objects ?? [];
  return (
    <>
      {createPortal(
        <>
          <PageGrid index={index} px={px} />
          <span className="page-active-badge">{`${globalThis.rw().active} ${index + 1}`}</span>
          {snap.page === page ? <SnapMarks marks={snap.marks} /> : null}
        </>,
        page,
        String(keyOf(page)),
      )}
      {objects.map((o) => {
        const el = page.querySelector<HTMLElement>(`:scope > .objects > [data-id="${o.id}"]`);
        return el ? <ObjectMarks key={keyOf(el)} el={el} o={o} /> : null;
      })}
    </>
  );
};

/** Clases de selección en los nodos del papel (no son de React: se ponen después de dibujar). */
function applyClasses(list: TrackedPage[]): void {
  for (const { page, index } of list) {
    const current = editor.active === index;
    page.classList.toggle('active-page', current);
    page.classList.toggle('is-page-active', current);
    for (const o of editor.book.pages[index]?.objects ?? []) {
      const el = page.querySelector<HTMLElement>(`:scope > .objects > [data-id="${o.id}"]`);
      if (!el) continue;
      el.classList.toggle('selected', editor.selected === o.id);
      el.classList.toggle('multi-selected', editor.multiSelection.has(o.id));
      el.classList.toggle('locked', !!o.locked);
    }
  }
}

const SelectionLayer = () => {
  useEditorState();
  useLanguage();
  useSyncExternalStore(subscribe, () => version);
  const list = pages.filter((p) => p.page.isConnected || p === pending);
  useLayoutEffect(() => applyClasses(list));
  return (
    <>
      {list.map(({ page, index, px }) => (
        <PageMarks key={keyOf(page)} page={page} index={index} px={px} />
      ))}
      <Rulers />
    </>
  );
};
