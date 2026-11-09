// El dibujo del libro en pantalla e impreso: la página (paper), sus cornisas y folios
// (autoElement), lo que la página lleva sólo en el lienzo (screenPage), la fachada del lienzo
// (renderPages: lo dibuja <Spread/>), el redibujo general (render) y los avisos de estado. No tiene
// efectos al cargar. core-wiring.ts registra todo como extensible
// (son las funciones más extendidas) y lo publica. Cada una llama a las demás por el nombre global,
// así pasa por sus extensiones (paper → autoElement, render → renderPages, thumbs…).
//
// Fuente TypeScript: viaja dentro de build/core.js (src/entries/core.ts).
import type { AutoType } from '../model.ts';
import { $, M } from './utils.ts';
import { icon } from './icons.ts';

/** Pliego en vertical (una página arriba de la otra). */
export function verticalSpread(): boolean {
  return book.facing && book.spreadDirection === 'vertical';
}
/** Escala del pliego para que entre en #spreadStage (por el zoom). */
export function calculateScale(): void {
  const area = $('#spreadStage'),
    availableW = area.clientWidth - 58,
    availableH = area.clientHeight - 56,
    count = book.facing && spread + 1 < book.pages.length ? 2 : 1;
  scale =
    Math.max(
      0.15,
      Math.min(
        availableW / (book.width * (verticalSpread() ? 1 : count)),
        availableH / (book.height * (verticalSpread() ? count : 1)),
      ),
    ) * zoom;
}
/** Cornisa, titulillo o folio de la página i. Se publica extensible como autoElement. */
export function autoElementBase(
  i: number,
  type: AutoType,
  px: number,
  print = false,
): HTMLElement | null {
  const cfg = M.auto(book, i, type);
  if (!cfg) return null;
  const el = document.createElement('div'),
    m = M.margins(book, i),
    font = ((cfg.size * 25.4) / 72) * px;
  el.className = 'auto-element auto-' + type;
  el.style.fontFamily = cfg.font;
  el.style.fontSize = font + 'px';
  let x = 0,
    y = 0,
    w = 0,
    h = font * 1.3,
    alignment = cfg.align,
    side = cfg.pos;
  const outer = i % 2 === 0 ? 'left' : 'right',
    inner = i % 2 === 0 ? 'right' : 'left';
  if (side === 'top' || side === 'bottom') {
    x = m.left * px;
    w = (book.width - m.left - m.right) * px;
    y =
      (side === 'top' ? cfg.distance : book.height - cfg.distance) * px -
      (side === 'bottom' ? h : 0);
  } else if (side.includes('-')) {
    let [v, a] = side.split('-');
    let horizontal = a === 'outer' ? outer : a === 'inner' ? inner : 'center';
    w = 30 * px;
    x =
      (horizontal === 'left'
        ? cfg.distance
        : horizontal === 'right'
          ? book.width - cfg.distance - 30
          : book.width / 2 - 15) * px;
    y = (v === 'top' ? cfg.distance : book.height - cfg.distance) * px - (v === 'bottom' ? h : 0);
    alignment = horizontal === 'left' ? 'left' : horizontal === 'right' ? 'right' : 'center';
  } else {
    let s = side === 'outer' ? outer : side === 'inner' ? inner : side;
    x = (s === 'left' ? cfg.distance : book.width - cfg.distance) * px;
    y = (book.height / 2) * px;
    w = 70 * px;
    el.style.transform = `translate(${s === 'left' ? '0' : '-100%'},-50%)${cfg.vertical ? ' rotate(-90deg)' : ''}`;
    el.style.transformOrigin = s === 'left' ? 'left center' : 'right center';
  }
  if (cfg.vertical && (side === 'top' || side === 'bottom' || side.includes('-')))
    el.style.transform = 'rotate(-90deg)';
  el.style.left = x + cfg.offsetX * px + 'px';
  el.style.top = y + cfg.offsetY * px + 'px';
  el.style.width = w + 'px';
  el.style.textAlign = alignment;
  if (cfg.text.includes('|')) {
    el.classList.add('auto-header');
    cfg.text.split('|').forEach((s) => {
      const span = document.createElement('span');
      span.textContent = s.trim();
      el.append(span);
    });
  } else el.textContent = cfg.text;
  if (type === 'header' && cfg.rule) el.classList.add('rule');
  return el;
}
/**
 * Dibuja la página i a px píxeles por milímetro: sólo lo del libro (lo mismo en pantalla y en lo que
 * sale impreso). Lo que es sólo de la pantalla (selección, controladores, guías, oyentes) lo suma
 * screenPage() después, en el lienzo. print: página de impresión (.print-page).
 */
export function paperBase(i: number, px: number, print = false): HTMLElement {
  const page = document.createElement('div');
  page.className = print ? 'print-page' : 'page';
  page.dataset.page = String(i);
  page.style.width = book.width * px + 'px';
  page.style.height = book.height * px + 'px';
  const objects = document.createElement('div');
  objects.className = 'objects';
  page.append(objects);
  for (const o of book.pages[i].objects) {
    let el = document.createElement('div');
    el.className = 'paper-object ' + o.type;
    el.dataset.id = o.id;
    Object.assign(el.style, {
      left: o.x * px + 'px',
      top: o.y * px + 'px',
      width: o.w * px + 'px',
      height: o.h * px + 'px',
    });
    if (o.type === 'text') {
      Object.assign(el.style, {
        fontFamily: o.font,
        fontSize: ((o.size * 25.4) / 72) * px + 'px',
        lineHeight: ((o.leading * 25.4) / 72) * px + 'px',
        textAlign: o.align,
        color: o.color,
        fontWeight: o.bold ? '700' : '400',
        fontStyle: o.italic ? 'italic' : 'normal',
      });
      let t = document.createElement('div');
      t.className = 'text-content';
      t.textContent = o.text;
      el.append(t);
    } else if (o.type === 'image') {
      let img = new Image();
      img.src = o.src;
      img.alt = o.name || 'Imagen';
      el.append(img);
    } else el.innerHTML = icon('frame');
    objects.append(el);
  }
  for (const type of ['header', 'titulillo', 'folio'] as const) {
    const auto = autoElement(i, type, px, print);
    if (auto) page.append(auto);
  }
  return page;
}
/**
 * Lo que la página dibujada por paper() lleva sólo en el lienzo: lo dibuja, con React, la capa de
 * selección (components/canvas/SelectionLayer.tsx, enganchada acá en canvas-layer.ts): la grilla y
 * las guías, la etiqueta y los controladores del objeto elegido, la selección múltiple, la página
 * activa, el imán y la marca de texto sobrante. Nunca sale impreso. No pone oyentes: los eventos del
 * lienzo los atiende #spread (ver los eventos del lienzo en studio-wiring.ts).
 */
export function screenPageBase(page: HTMLElement, i: number, px: number): HTMLElement {
  return page;
}
/**
 * Dibuja el lienzo: el pliego, o las filas de la vista continua. Es una fachada: lo dibuja el
 * componente <Spread/> (components/canvas/Spread.tsx), que canvas-layer.ts engancha acá; React
 * decide qué páginas o filas se ven y las llena con paper() y screenPage(). Al volver, el DOM ya
 * está al día.
 */
export function renderPagesBase(): void {}
/** Redibuja la pantalla. Nombre y formato del libro: barra del documento (React), vía updateStatus. */
export function renderBase(full = true): void {
  renderPages();
  inspector();
  if (full) {
    thumbs();
    renderTemplates();
  }
  updateStatus();
}
/**
 * Estado de la pantalla después de un cambio. Las barras superior, de estado y del documento
 * (React) se redibujan después de esta función (src/react/editor-state.ts), que otros módulos
 * extienden.
 */
export function updateStatusBase(): void {}
/**
 * Mide las cajas de texto con texto sobrante del pliego visible (overflowCount). La medición y la
 * marca + son de la capa de selección (canvas-layer.ts); la barra de estado se redibuja después.
 */
export function checkOverflowBase(): void {}
