// Capa de selección del lienzo (etapa 3, D2, lienzo paso 3): lo que el papel lleva encima sólo en
// la pantalla, dibujado por React con portales dentro de los nodos del papel.
//
//   en el objeto elegido   la etiqueta (.object-badge) y los 8 controladores (.frame-handle);
//                          bloqueado, sólo la etiqueta
//   en cada caja de texto  la marca + de texto sobrante (.overflow-mark)
//   en cada página         el rótulo de página activa (.page-active-badge)
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
}
let pages: TrackedPage[] = [];
/** La página que se está armando (todavía fuera del documento). */
let pending: TrackedPage | null = null;
/** Cajas de texto con texto sobrante (las mide checkOverflow, en canvas-layer.ts). */
let overflowing = new Set<string>();

let version = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
let mounted = false;

/** Redibuja la capa en el acto (al volver, el DOM ya está al día). */
export function refreshSelection(): void {
  if (!mounted) {
    mounted = true;
    const host = document.createElement('div');
    host.hidden = true;
    host.className = 'selection-layer-root';
    document.body.append(host);
    mount(host, <SelectionLayer />, { sync: true });
    return;
  }
  version += 1;
  flushSync(() => {
    for (const listener of listeners) listener();
  });
}

/** Una página nueva del lienzo (screenPage): la capa se dibuja sobre ella en el acto. */
export function trackPage(page: HTMLElement, index: number): void {
  pages = pages.filter((p) => p.page.isConnected && p.page !== page);
  pending = { page, index };
  pages.push(pending);
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

/** Una página: su rótulo de página activa y las marcas de sus objetos. */
const PageMarks = ({ page, index }: { page: HTMLElement; index: number }) => {
  const objects = editor.book.pages[index]?.objects ?? [];
  return (
    <>
      {createPortal(
        <span className="page-active-badge">{`${globalThis.rw().active} ${index + 1}`}</span>,
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
      {list.map(({ page, index }) => (
        <PageMarks key={keyOf(page)} page={page} index={index} />
      ))}
    </>
  );
};
