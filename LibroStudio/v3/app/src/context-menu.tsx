// Clic derecho con las funciones de siempre (pedido de la BETA 0.2), y los atajos de objetos.
//
// - Sobre un objeto: cortar, copiar, pegar, duplicar y eliminar; traer al frente o enviar al
//   fondo; bloquear y ocultar; alinear. Sobre una caja de texto, además: editar el texto, ajustar
//   la caja al texto, elegir el rol, insertar una nota al pie y marcar como cita. Sobre una
//   imagen (o un marco), reemplazarla.
// - Sobre la página vacía: pegar (también en el mismo lugar), agregar, duplicar o eliminar la
//   página, agregar una guía y mostrar u ocultar la grilla.
// - Sobre una miniatura de página: insertar una página antes o después, duplicarla o eliminarla.
// - El clic derecho sobre texto (un campo, o una caja mientras se escribe) no pasa por acá: ese
//   menú, con las sugerencias de ortografía, lo arma el proceso principal (desktop/src/main/
//   context-menu.ts). Acá se cancela el evento sólo cuando se muestra el menú propio.
// - Atajos de objetos: Ctrl+C, Ctrl+X, Ctrl+V y Ctrl+D (⌘ en macOS). Copiar y cortar van por los
//   eventos copy/cut del navegador: el portapapeles del sistema guarda una marca, y al pegar
//   (evento paste) la marca dice si lo que hay son los objetos copiados o algo de afuera (una
//   imagen, un SVG de Illustrator: eso lo coloca placed-artwork.ts). El pegado de objetos corre
//   antes (fase de captura) y frena el de afuera.
//
// El menú es un DropdownMenu de Radix (foco, teclado, submenús, lectores de pantalla) anclado
// donde se hizo clic. Las acciones reusan las del editor (command, alignSelection, applyRole…) y
// todo lo que cambia el libro pasa por commit (se deshace).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { useSyncExternalStore, type CSSProperties } from 'react';
import { DropdownMenu } from 'radix-ui';
import type { BookObject, RoleId } from './model.ts';
import { mount } from './react/mount.tsx';
import { Icon } from './components/Icon.tsx';
import { bw } from './i18n/language.ts';
import { editor, M } from './core-api.ts';
import { canvasHit } from './core/editing.ts';
import { applyRole, markAsQuote, ROLE_IDS, roleName, selectedRole } from './roles.ts';
import { adoptPastedNotes, insertFootnote } from './footnote-model.ts';
import { openGuideDialog } from './editorial.ts';
import { commandKey, isMac, shortcutLabel } from './keys.ts';

// ── Selección y portapapeles de objetos ──

/** Lo elegido en la página activa: los de la selección múltiple, o el seleccionado. */
function selectionObjects(): BookObject[] {
  const page = editor.book.pages[editor.active];
  if (!page) return [];
  const many = editor.multiSelection;
  return page.objects.filter((o) => (many.size ? many.has(o.id) : editor.selected === o.id));
}
const editable = (objects: BookObject[]) => objects.filter((o) => !o.locked && !o.hidden);

/** Lo copiado: copias de los objetos, la página de donde salieron y la marca del portapapeles. */
let clipboard: { objects: BookObject[]; page: number; mark: string } | null = null;
const MARK_PREFIX = 'maquetario-objetos:';

function copyObjects(objects: BookObject[]): boolean {
  if (!objects.length) return false;
  clipboard = {
    objects: objects.map((o) => M.clone(o)),
    page: editor.active,
    mark: MARK_PREFIX + M.uid(),
  };
  return true;
}
/** Copia y deja la marca en el portapapeles del sistema (desde el menú, sin teclado). */
function copyFromMenu(objects: BookObject[]): void {
  if (!copyObjects(objects)) return;
  // execCommand dispara el evento copy, que escribe la marca (abajo); dentro de un clic se permite.
  markOnly = true;
  document.execCommand('copy');
  markOnly = false;
}
let markOnly = false;

function removeObjects(objects: BookObject[]): void {
  const ids = new Set(objects.map((o) => o.id));
  if (!ids.size) return;
  commit(() => {
    const page = editor.book.pages[editor.active]!;
    page.objects = page.objects.filter((o) => !ids.has(o.id));
    editor.selected = null;
    editor.multiSelection.clear();
  });
}

/**
 * Agrega copias de objects a la página page, corridas dx/dy mm, con ids nuevos y notas al pie
 * propias (si el original sigue en el libro, la nota se duplica con otra clave). Quedan elegidas.
 */
function placeCopies(objects: BookObject[], page: number, dx: number, dy: number): void {
  if (!objects.length) return;
  commit(() => {
    const target = editor.book.pages[page]!;
    const copies = objects.map((o) => {
      const copy = M.clone(o);
      copy.id = M.uid();
      copy.x = Number((copy.x + dx).toFixed(2));
      copy.y = Number((copy.y + dy).toFixed(2));
      if (typeof copy.text === 'string') copy.text = adoptPastedNotes(copy.text);
      return copy;
    });
    target.objects.push(...copies);
    goToPage(page);
    editor.multiSelection.clear();
    if (copies.length > 1) copies.forEach((copy) => editor.multiSelection.add(copy.id));
    editor.selected = copies[copies.length - 1]!.id;
  });
}
/** Corrimiento de un duplicado o de un pegado sobre su original (mm). */
const NUDGE = 5;

function duplicateSelection(): void {
  const objects = selectionObjects();
  placeCopies(objects, editor.active, NUDGE, NUDGE);
}
/**
 * Pega lo copiado. Sin punto: en la página activa, en el mismo lugar si es otra página y corrido si
 * es la misma (para que se vea). Con punto (clic derecho): con su esquina donde se hizo clic.
 * inPlace: exactamente donde estaba.
 */
function pasteObjects(at?: { page: number; x: number; y: number }, inPlace = false): void {
  if (!clipboard) return;
  const page = at?.page ?? editor.active;
  let dx = 0,
    dy = 0;
  if (at && !inPlace) {
    dx = at.x - Math.min(...clipboard.objects.map((o) => o.x));
    dy = at.y - Math.min(...clipboard.objects.map((o) => o.y));
  } else if (!inPlace && page === clipboard.page) {
    const taken = new Set(editor.book.pages[page]!.objects.map((o) => `${o.x},${o.y}`));
    while (clipboard.objects.some((o) => taken.has(`${o.x + dx},${o.y + dy}`))) {
      dx += NUDGE;
      dy += NUDGE;
    }
  }
  placeCopies(clipboard.objects, page, dx, dy);
}

function goToPage(index: number): void {
  editor.active = index;
  const per = editor.book.facing ? 2 : 1;
  editor.spread = Math.floor(index / per) * per;
}
/** Elige el objeto tocado con el clic derecho (si no era parte de la selección múltiple). */
function selectForMenu(page: number, o: BookObject): void {
  finishEditing();
  if (editor.active !== page || !editor.multiSelection.has(o.id)) {
    editor.multiSelection.clear();
    goToPage(page);
  }
  editor.selected = o.id;
  render(false);
}

function setFlag(objects: BookObject[], key: 'locked' | 'hidden', value: boolean): void {
  if (!objects.length) return;
  commit(() => {
    for (const o of objects) o[key] = value;
    if (key === 'hidden' && value) {
      editor.selected = null;
      editor.multiSelection.clear();
    }
  }, false);
}

/** Inserta una página vacía en index (antes o después de una miniatura) y la deja activa. */
function insertPageAt(index: number): void {
  finishEditing();
  commit(() => {
    editor.book.pages.splice(index, 0, M.page());
    goToPage(index);
    editor.selected = null;
    editor.multiSelection.clear();
  });
}
/** Corre una acción de página (command) sobre la página index. */
function onPage(index: number, name: 'duplicate' | 'deletePage' | 'addPage'): void {
  finishEditing();
  goToPage(index);
  editor.selected = null;
  editor.multiSelection.clear();
  render(true);
  command(name);
}

// ── Atajos y eventos del portapapeles ──

/** El lienzo es el destino del atajo: hay libro, no se escribe en un campo ni en una caja. */
const canvasTarget = (target: EventTarget | null): boolean =>
  !canvasUnavailable() &&
  !editor.preview &&
  !editor.editing &&
  !canvasInputTarget(target) &&
  // Con el menú contextual abierto, el teclado es del menú.
  !document.querySelector('.context-menu');
/** Hay texto elegido fuera del lienzo (un rótulo, una ayuda): ese copiar es del texto. */
const textSelected = (): boolean => {
  const selection = getSelection();
  return !!selection && !selection.isCollapsed && !!selection.toString().trim();
};

document.addEventListener('copy', (event) => {
  if (markOnly && clipboard) {
    event.clipboardData?.setData('text/plain', clipboard.mark);
    event.preventDefault();
    return;
  }
  if (!canvasTarget(event.target) || textSelected()) return;
  if (!copyObjects(selectionObjects())) return;
  event.clipboardData?.setData('text/plain', clipboard!.mark);
  event.preventDefault();
});
document.addEventListener('cut', (event) => {
  if (!canvasTarget(event.target) || textSelected()) return;
  const objects = editable(selectionObjects());
  if (!copyObjects(objects)) return;
  event.clipboardData?.setData('text/plain', clipboard!.mark);
  event.preventDefault();
  removeObjects(objects);
});
// En captura: antes que el pegado de imágenes y SVG (placed-artwork.ts).
document.addEventListener(
  'paste',
  (event) => {
    if (!clipboard || !canvasTarget(event.target)) return;
    if (event.clipboardData?.getData('text/plain') !== clipboard.mark) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    pasteObjects();
  },
  true,
);
document.addEventListener('keydown', (event) => {
  if (!commandKey(event) || event.altKey || event.shiftKey) return;
  if (event.key.toLowerCase() !== 'd' || !canvasTarget(event.target)) return;
  if (document.querySelector('#dialogLayer dialog[open]')) return;
  event.preventDefault();
  duplicateSelection();
});

// ── El menú ──

type Entry =
  | { label: string; run: () => void; shortcut?: string; disabled?: boolean; danger?: boolean }
  | { label: string; items: Entry[]; disabled?: boolean }
  | 'separator';

interface MenuState {
  x: number;
  y: number;
  label: string;
  entries: Entry[];
  key: number;
}
let state: MenuState | null = null;
let opened = 0;
const listeners = new Set<() => void>();
const show = (next: MenuState | null): void => {
  state = next;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const keys = {
  cut: () => shortcutLabel('Ctrl+X'),
  copy: () => shortcutLabel('Ctrl+C'),
  paste: () => shortcutLabel('Ctrl+V'),
  duplicate: () => shortcutLabel('Ctrl+D'),
  remove: () => (isMac ? '⌫' : bw('Supr', 'Del', 'Del')),
};

const pasteEntries = (at?: { page: number; x: number; y: number }): Entry[] => [
  {
    label: bw('Pegar', 'Paste', 'Colar'),
    shortcut: keys.paste(),
    disabled: !clipboard,
    run: () => pasteObjects(at),
  },
  {
    label: bw('Pegar en el mismo lugar', 'Paste in place', 'Colar no mesmo lugar'),
    disabled: !clipboard,
    run: () => pasteObjects(at, true),
  },
];

const ALIGN: [string, () => string][] = [
  ['left', () => bw('Izquierda', 'Left', 'Esquerda')],
  ['hcenter', () => bw('Centro', 'Center', 'Centro')],
  ['right', () => bw('Derecha', 'Right', 'Direita')],
  ['top', () => bw('Arriba', 'Top', 'Topo')],
  ['vcenter', () => bw('Medio', 'Middle', 'Meio')],
  ['bottom', () => bw('Abajo', 'Bottom', 'Base')],
];

function objectEntries(o: BookObject, at: { page: number; x: number; y: number }): Entry[] {
  const objects = selectionObjects(),
    movable = editable(objects),
    single = objects.length === 1,
    locked = objects.every((item) => item.locked);
  const entries: Entry[] = [];
  if (single && o.type === 'text' && !o.toc) {
    const role = selectedRole(o);
    entries.push(
      {
        label: bw('Editar el texto', 'Edit text', 'Editar o texto'),
        disabled: o.locked,
        run: () => command('editText'),
      },
      {
        label: bw('Ajustar la caja al texto', 'Fit frame to text', 'Ajustar a caixa ao texto'),
        disabled: o.locked,
        run: () => {
          const el = document.querySelector<HTMLElement>(`#spread [data-id="${o.id}"]`);
          if (el && !fitTextFrame(o, el))
            toast(
              bw(
                'La caja ya está ajustada.',
                'The frame already fits.',
                'A caixa já está ajustada.',
              ),
              'info',
            );
        },
      },
      {
        label: bw('Rol', 'Role', 'Função'),
        disabled: o.locked,
        items: [
          {
            label: (role === '' ? '✓ ' : '') + bw('Sin rol', 'No role', 'Sem função'),
            run: () => applyRole(''),
          },
          'separator',
          ...ROLE_IDS.map((id: RoleId): Entry => ({
            label: (role === id ? '✓ ' : '') + roleName(id),
            run: () => applyRole(id),
          })),
        ],
      },
      {
        label: bw('Insertar nota al pie', 'Insert footnote', 'Inserir nota de rodapé'),
        disabled: o.locked,
        run: () => insertFootnote(),
      },
      {
        label: bw('Marcar como cita', 'Mark as quote', 'Marcar como citação'),
        disabled: o.locked,
        run: () => markAsQuote(),
      },
      'separator',
    );
  }
  if (single && (o.type === 'image' || o.type === 'frame'))
    entries.push(
      {
        label:
          o.type === 'image'
            ? bw('Reemplazar la imagen…', 'Replace image…', 'Substituir a imagem…')
            : bw('Colocar una imagen…', 'Place image…', 'Colocar uma imagem…'),
        disabled: o.locked,
        run: () => chooseImage({ frame: o, page: editor.active }),
      },
      'separator',
    );
  entries.push(
    {
      label: bw('Cortar', 'Cut', 'Recortar'),
      shortcut: keys.cut(),
      disabled: !movable.length,
      run: () => {
        copyFromMenu(movable);
        removeObjects(movable);
      },
    },
    {
      label: bw('Copiar', 'Copy', 'Copiar'),
      shortcut: keys.copy(),
      run: () => copyFromMenu(objects),
    },
    ...pasteEntries(at),
    {
      label: bw('Duplicar', 'Duplicate', 'Duplicar'),
      shortcut: keys.duplicate(),
      run: duplicateSelection,
    },
    {
      label: bw('Eliminar', 'Delete', 'Excluir'),
      shortcut: keys.remove(),
      danger: true,
      disabled: !movable.length,
      run: () => removeObjects(movable),
    },
    'separator',
    {
      label: bw('Traer al frente', 'Bring to front', 'Trazer para a frente'),
      disabled: !single || o.locked,
      run: () => command('front'),
    },
    {
      label: bw('Enviar al fondo', 'Send to back', 'Enviar para trás'),
      disabled: !single || o.locked,
      run: () => command('back'),
    },
    'separator',
    {
      label: locked
        ? bw('Desbloquear', 'Unlock', 'Desbloquear')
        : bw('Bloquear', 'Lock', 'Bloquear'),
      run: () => setFlag(objects, 'locked', !locked),
    },
    {
      label: bw('Ocultar', 'Hide', 'Ocultar'),
      run: () => setFlag(objects, 'hidden', true),
    },
    'separator',
    {
      label: bw('Alinear', 'Align', 'Alinhar'),
      disabled: !movable.length,
      items: ALIGN.map(([axis, label]) => ({ label: label(), run: () => alignSelection(axis) })),
    },
  );
  return entries;
}

function pageEntries(at: { page: number; x: number; y: number }): Entry[] {
  const grid = editor.book.grid.enabled;
  return [
    ...pasteEntries(at),
    'separator',
    {
      label: bw('Agregar una página', 'Add page', 'Adicionar uma página'),
      run: () => onPage(at.page, 'addPage'),
    },
    {
      label: bw('Duplicar la página', 'Duplicate page', 'Duplicar a página'),
      run: () => onPage(at.page, 'duplicate'),
    },
    {
      label: bw('Eliminar la página…', 'Delete page…', 'Excluir a página…'),
      danger: true,
      disabled: editor.book.pages.length < 2,
      run: () => onPage(at.page, 'deletePage'),
    },
    'separator',
    {
      label: bw('Agregar una guía…', 'Add guide…', 'Adicionar uma guia…'),
      run: () => {
        goToPage(at.page);
        openGuideDialog();
      },
    },
    {
      label: grid
        ? bw('Ocultar la grilla', 'Hide grid', 'Ocultar o grid')
        : bw('Mostrar la grilla', 'Show grid', 'Mostrar o grid'),
      run: () => commit(() => (editor.book.grid.enabled = !grid), false),
    },
  ];
}

function thumbEntries(page: number): Entry[] {
  return [
    {
      label: bw('Insertar una página antes', 'Insert page before', 'Inserir uma página antes'),
      run: () => insertPageAt(page),
    },
    {
      label: bw('Insertar una página después', 'Insert page after', 'Inserir uma página depois'),
      run: () => insertPageAt(page + 1),
    },
    {
      label: bw('Duplicar la página', 'Duplicate page', 'Duplicar a página'),
      run: () => onPage(page, 'duplicate'),
    },
    'separator',
    {
      label: bw('Eliminar la página…', 'Delete page…', 'Excluir a página…'),
      danger: true,
      disabled: editor.book.pages.length < 2,
      run: () => onPage(page, 'deletePage'),
    },
  ];
}

/** El punto del clic en mm de la página (para pegar ahí). */
function pointOnPage(pageEl: HTMLElement, page: number, e: MouseEvent) {
  const box = pageEl.getBoundingClientRect();
  return {
    page,
    x: Number((((e.clientX - box.left) / box.width) * editor.book.width).toFixed(2)),
    y: Number((((e.clientY - box.top) / box.height) * editor.book.height).toFixed(2)),
  };
}

const Items = ({ entries }: { entries: Entry[] }) => (
  <>
    {entries.map((entry, i) =>
      entry === 'separator' ? (
        // Sin dos líneas seguidas, ni al principio o al final.
        i === 0 || i === entries.length - 1 || entries[i - 1] === 'separator' ? null : (
          <DropdownMenu.Separator key={i} className="menu-separator" />
        )
      ) : 'items' in entry ? (
        <DropdownMenu.Sub key={i}>
          <DropdownMenu.SubTrigger className="context-menu-item" disabled={entry.disabled}>
            <span>{entry.label}</span>
            <Icon name="chevron" />
          </DropdownMenu.SubTrigger>
          <DropdownMenu.Portal>
            <DropdownMenu.SubContent
              className="menu context-menu"
              sideOffset={2}
              collisionPadding={8}
            >
              <Items entries={entry.items} />
            </DropdownMenu.SubContent>
          </DropdownMenu.Portal>
        </DropdownMenu.Sub>
      ) : (
        <DropdownMenu.Item
          key={i}
          className="context-menu-item"
          data-danger={entry.danger ? '' : undefined}
          disabled={entry.disabled}
          onSelect={() => entry.run()}
        >
          <span>{entry.label}</span>
          {entry.shortcut ? <kbd className="context-menu-shortcut">{entry.shortcut}</kbd> : null}
        </DropdownMenu.Item>
      ),
    )}
  </>
);

const ContextMenu = () => {
  const current = useSyncExternalStore(subscribe, () => state);
  if (!current) return null;
  return (
    <DropdownMenu.Root
      key={current.key}
      open
      onOpenChange={(open) => {
        if (!open) show(null);
      }}
    >
      <DropdownMenu.Trigger asChild>
        <span
          className="context-menu-anchor"
          style={{ '--menu-x': `${current.x}px`, '--menu-y': `${current.y}px` } as CSSProperties}
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="menu context-menu"
          aria-label={current.label}
          side="bottom"
          align="start"
          sideOffset={2}
          collisionPadding={8}
          // El foco vuelve al lienzo, no al ancla invisible.
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <Items entries={current.entries} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

const host = document.createElement('div');
host.id = 'contextMenuRoot';
document.body.append(host);
mount(host, <ContextMenu />);

/** Abre el menú en el punto del clic. */
function openMenu(e: MouseEvent, label: string, entries: Entry[]): void {
  e.preventDefault();
  show({ x: e.clientX, y: e.clientY, label, entries, key: ++opened });
}

document.addEventListener('contextmenu', (e) => {
  const target = e.target as Element | null;
  if (!target?.closest) return;
  // Campos y texto en edición: el menú de texto del sistema (proceso principal).
  if (canvasInputTarget(target) || document.querySelector('#dialogLayer dialog[open]')) return;
  const thumb = target.closest<HTMLElement>('#thumbnails [data-individual-page]');
  if (thumb && editor.hasDocument) {
    const page = Number(thumb.dataset.individualPage);
    openMenu(e, bw('Página', 'Page', 'Página') + ' ' + (page + 1), thumbEntries(page));
    return;
  }
  if (!target.closest('#spread') || canvasUnavailable() || editor.preview || editor.editing) return;
  const hit = canvasHit(target);
  if (!hit) return;
  const at = pointOnPage(hit.page, hit.i, e);
  if (hit.o && hit.el) {
    selectForMenu(hit.i, hit.o);
    openMenu(e, bw('Objeto', 'Object', 'Objeto'), objectEntries(hit.o, at));
    return;
  }
  finishEditing();
  goToPage(hit.i);
  editor.selected = null;
  editor.multiSelection.clear();
  render(false);
  openMenu(e, bw('Página', 'Page', 'Página'), pageEntries(at));
});
