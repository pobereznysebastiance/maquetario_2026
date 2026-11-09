// Pestañas y herramientas: la pestaña del inspector (showTab), la herramienta del lienzo
// (setTool), la vista previa, el zoom de base (canvas-navigation.ts lo reemplaza) y los comandos
// de la barra (command). No tiene efectos al cargar. core-wiring.ts
// registra showTab, setTool, setZoom y command como extensibles y los publica. Lo que llaman del
// resto (inspector, finishEditing, render, commit, settings, confirmAction, bw…) va por el nombre
// global.
//
// Fuente TypeScript: viaja dentro de build/core.js (src/entries/core.ts).
import { $, $$, M } from './utils.ts';

/** Muestra una pestaña del inspector. Se publica extensible como showTab. */
export function showTabBase(name: string): void {
  tab = name;
  $$('.tab').forEach((e) => {
    e.classList.toggle('active', e.dataset.tab === tab);
    e.setAttribute('aria-selected', String(e.dataset.tab === tab));
  });
  $('#inspectorContent').scrollTop = 0;
  inspector();
}
/** Elige una herramienta del lienzo (o lleva a su sección). Se publica extensible como setTool. */
export function setToolBase(name: string): void {
  finishEditing();
  if (['grid', 'folio', 'header'].includes(name)) {
    showTab('design');
    const section = [...$('#inspectorContent').querySelectorAll('.section')][
      ({ grid: 0, folio: 2, header: 3 } as Record<string, number>)[name]
    ];
    section?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    tool = 'select';
  } else {
    tool = name;
    if (name === 'text' || name === 'box') showTab('text');
  }
  // La herramienta activa la marca el riel (src/components/rail/Rail.tsx) al terminar setTool.
  $('#spread').dataset.cursor = tool === 'select' ? 'default' : 'crosshair';
}
/**
 * Comandos de la barra y del inspector: páginas (agregar, duplicar, borrar, mover), objetos (borrar,
 * adelante, atrás), editar texto y formato del libro. Se publica extensible como command.
 */
export function commandBase(name: string): void {
  const o = selectObject();
  if (name === 'settings') {
    settings(false);
    return;
  }
  if (name === 'editText') {
    const el = $(`#spread [data-id="${selected}"]`);
    if (el) startEditing(el);
    return;
  }
  if (name === 'addPage') {
    commit(() => {
      book.pages.splice(active + 1, 0, M.page());
      active++;
      spread = Math.floor(active / (book.facing ? 2 : 1)) * (book.facing ? 2 : 1);
      selected = null;
    });
    return;
  }
  if (name === 'duplicate') {
    commit(() => {
      let p = M.clone(book.pages[active]);
      p.id = M.uid();
      p.objects.forEach((o) => (o.id = M.uid()));
      book.pages.splice(active + 1, 0, p);
      active++;
      selected = null;
      spread = Math.floor(active / (book.facing ? 2 : 1)) * (book.facing ? 2 : 1);
    });
    return;
  }
  if (name === 'deletePage' && book.pages.length > 1) {
    confirmAction({
      title: bw(
        '¿Eliminar la página ' + (active + 1) + '?',
        'Delete page ' + (active + 1) + '?',
        'Excluir a página ' + (active + 1) + '?',
      ),
      message: bw(
        'La página y sus objetos se quitan del libro. Podés recuperarlos con Deshacer.',
        'The page and its objects are removed from the book. You can bring them back with Undo.',
        'A página e seus objetos saem do livro. Você pode recuperá-los com Desfazer.',
      ),
      confirmLabel: bw('Eliminar página', 'Delete page', 'Excluir página'),
      danger: true,
    }).then((ok) => {
      if (ok) {
        commit(() => {
          book.pages.splice(active, 1);
          active = Math.min(active, book.pages.length - 1);
          spread = Math.floor(active / (book.facing ? 2 : 1)) * (book.facing ? 2 : 1);
          selected = null;
        });
      }
    });
    return;
  }
  if (name === 'earlier' || name === 'later') {
    const target = active + (name === 'earlier' ? -1 : 1);
    if (target < 0 || target >= book.pages.length) return;
    commit(() => {
      [book.pages[active], book.pages[target]] = [book.pages[target], book.pages[active]];
      active = target;
      spread = Math.floor(active / (book.facing ? 2 : 1)) * (book.facing ? 2 : 1);
    });
    return;
  }
  if (!o) return;
  if (name === 'deleteObject') {
    commit(() => {
      book.pages[active].objects = book.pages[active].objects.filter((n) => n !== o);
      selected = null;
    });
  }
  if (name === 'front' || name === 'back') {
    commit(() => {
      let a = book.pages[active].objects.filter((n) => n !== o);
      name === 'front' ? a.push(o) : a.unshift(o);
      book.pages[active].objects = a;
    });
  }
}
/** Vista previa (sin guías ni controles): la alterna "Vista previa" de la barra superior. */
export function togglePreview(): void {
  finishEditing();
  preview = !preview;
  document.body.classList.toggle('preview-mode', preview);
}
// La barra del zoom (−, deslizador, +, Ajustar, Ampliar área) es React
// (src/components/canvas-bar/CanvasBar.tsx); el zoom real lo lleva canvas-navigation.ts, que
// reemplaza setZoom (se publica extensible).
export function setZoomBase(z: number): void {
  zoom = Math.max(0.4, Math.min(1.6, z));
  renderPages();
}
