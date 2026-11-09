// El inspector (etapa 3, D2 y D3): un componente de React que arma la pestaña visible con los
// paneles registrados (registerInspectorPanel, inspector-registry.ts).
//
//   Libro      estructura, misceláneas, grilla, foliado, cornisa, titulillo y fuentes del equipo
//   Página     la página activa y sus excepciones
//   Selección  el objeto (y, si es una caja de texto, párrafo, tipografía y carácter); sin
//              selección, un estado vacío
//
// Cada pestaña visible junta "pasadas" (los nombres de pestaña de antes: structure, design, pages,
// object, text), que siguen siendo el prefijo de los paneles ('design:grid'). La tabla SECTIONS dice
// qué secciones tiene cada pasada, en qué orden y con qué marco (<section> con data-section y
// data-key, los mismos atributos de antes).
//
// Se monta una vez (inspector-views.tsx) y se redibuja con cada aviso del estado del editor:
// inspector() (src/core/inspector.ts) es una fachada que avisa. React toca sólo lo que cambió; los campos
// llevan de key su valor (fields.tsx), así que un valor nuevo del libro crea el campo de nuevo.
// Con el documento en otra unidad (mm/cm) se vuelve a crear todo.
//
// Sin libro abierto (hasDocument falso) muestra, en las tres pestañas, sólo un estado vacío.
//
// Orden y plegado de las secciones (antes inspector-sections.ts): se arrastran por el agarrador
// del título (o Alt+↑ / Alt+↓ desde él) y se pliegan con la flecha o con un clic en el nombre. Se
// recuerdan por pestaña visible en localStorage, con las mismas claves de antes.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { inspectorPanel, inspectorPaused } from '../../inspector-registry.ts';
import { useEditorState } from '../../react/editor-state.ts';
import { useLanguage } from '../../react/mount.tsx';
import { SectionContext, type SectionChrome } from './fields.tsx';
import { bw, i18n } from '../../i18n/language.ts';
import { editor } from '../../core-api.ts';
import { hasFootnotes } from '../../footnote-model.ts';

/** Pestaña visible del inspector. */
export type InspectorView = 'book' | 'page' | 'selection';

/** Una sección de una pasada y su marco. */
interface Slot {
  name: string;
  /** 'div': no es una sección (no se reordena ni se pliega). */
  tag?: 'div';
  /** Clase propia, además de .section. */
  className?: string;
  /** data-section */
  title?: string;
  /** data-key (el ícono de la sección). */
  key?: string;
}

/** Secciones de cada pasada, en orden. */
function sectionsOf(pass: string): Slot[] {
  switch (pass) {
    case 'design':
      return [
        // Primero las medidas de la página; la grilla se ajusta a ellas.
        { name: 'margins', title: 'Formato y márgenes', key: 'margins' },
        { name: 'grid', title: 'Grilla', key: 'grid' },
        // Misceláneas y líneas (RulesPanel.tsx): sin data-section, después de la grilla.
        { name: 'rules' },
        { name: 'folio', title: 'Foliado', key: 'folio' },
        { name: 'header', title: 'Cornisa', key: 'header' },
        { name: 'titulillo', title: 'Titulillo', key: 'text' },
        // Formato de las notas al pie: sólo si el libro tiene alguna (FootnotePanels.tsx).
        ...(hasFootnotes()
          ? [
              {
                name: 'footnotes',
                title: 'Notas al pie',
                key: 'text',
                className: 'footnote-format',
              },
            ]
          : []),
        // Las fuentes del equipo son del documento, no de la caja: van en Libro, al final.
        { name: 'fonts', className: 'font-library' },
      ];
    case 'pages':
      return [
        // La página sola (qué elementos automáticos se ven) va primero, sin data-section.
        { name: 'exceptions', className: 'individual-page-settings' },
        { name: 'page', title: 'Página ' + (editor.active + 1), key: 'file' },
        { name: 'auto', title: 'Elementos automáticos', key: 'link' },
      ];
    case 'object':
      return [
        {
          name: 'select',
          title: bw('Objeto seleccionado', 'Selected object', 'Objeto selecionado'),
          key: 'select',
        },
        // Figura · relleno y trazo: sólo marcos e imágenes.
        ...(['frame', 'image'].includes(selectObject()?.type ?? '')
          ? [{ name: 'shape', className: 'shape-appearance' }]
          : []),
        {
          name: 'box',
          title: bw('Posición y tamaño', 'Position and size', 'Posição e tamanho'),
          key: 'box',
        },
        { name: 'align', title: rw().alignObjects, key: 'frame' },
        {
          name: 'distribute',
          title: bw('Distribuir objetos', 'Distribute objects', 'Distribuir objetos'),
          key: 'grid',
        },
        {
          name: 'order',
          title: bw('Orden y bloqueo', 'Order and locking', 'Ordem e bloqueio'),
          key: 'layers',
        },
      ];
    case 'text':
      return [
        // El rol de la planilla de la cátedra (RolePanel.tsx) va primero: decide el formato.
        { name: 'role', title: 'Rol', key: 'text', className: 'role-panel' },
        // Lo más usado con una caja de texto va primero: la letra, después el párrafo.
        { name: 'typography', title: 'Tipografía', key: 'text' },
        { name: 'paragraph', className: 'paragraph-panel' },
        { name: 'notes', title: 'Notas al pie y citas', key: 'text', className: 'footnote-panel' },
        // "Carácter y párrafo" va al final, dentro de un <div> (no se reordena ni se pliega).
        { name: 'character', tag: 'div' },
      ];
    case 'selection':
      // Nada seleccionado.
      return [{ name: 'empty', tag: 'div', className: 'inspector-empty' }];
    default:
      return [];
  }
}

/** Pasadas de la pestaña visible y la que queda en tab (la pestaña interna de antes). */
export function planFor(view: InspectorView): { passes: string[]; primary: string } {
  if (view === 'book') return { passes: ['design'], primary: 'design' };
  if (view === 'page') return { passes: ['pages'], primary: 'pages' };
  const o = selectObject();
  if (editor.multiSelection.size > 1) return { passes: ['object'], primary: 'object' };
  if (!o) return { passes: ['selection'], primary: 'selection' };
  // Primero el objeto, después el texto y el párrafo.
  // Caja de texto: primero tipografía y párrafo, después posición, alineación y orden de la caja.
  if (o.type === 'text') return { passes: ['text', 'object'], primary: 'text' };
  return { passes: ['object'], primary: 'object' };
}

// ── Orden y plegado guardados ──

/** Por pestaña visible: claves de sección (orden o plegadas). */
type SectionKeysByView = Record<string, string[]>;
const ORDER_STORE = 'maquetario-inspector-order';
const COLLAPSED_STORE = 'maquetario-inspector-collapsed';

// JSON.parse(null) da null: sin nada guardado queda {}.
const readKeys = (store: string): SectionKeysByView => {
  try {
    return JSON.parse(localStorage.getItem(store)!) || {};
  } catch {
    return {};
  }
};
const writeKeys = (store: string, keys: SectionKeysByView): void => {
  try {
    localStorage.setItem(store, JSON.stringify(keys));
  } catch {
    // Sin almacenamiento: vale hasta cerrar la app.
  }
};

/** Una sección para dibujar: su pasada, su marco y su clave de orden. */
interface Item {
  pass: string;
  slot: Slot;
  render: () => ReactNode;
  /** La primera de su pasada lleva data-pass (showTab('text') lleva hasta ahí). */
  first: boolean;
  /** Clave estable (no depende del idioma): clase propia o ícono, y su número de aparición. */
  orderKey?: string;
}

/** Arrastre de una sección: cuál y sobre cuál se soltaría (antes o después). */
interface Drag {
  key: string;
  over?: { key: string; after: boolean };
}

export const Inspector = ({
  host,
  view,
  drawn,
}: {
  host: HTMLElement;
  view: () => InspectorView;
  /** Después de cada dibujo (inspector-views.tsx: el consejo del pie). */
  drawn?: () => void;
}) => {
  useEditorState();
  useLanguage();
  const [, setTick] = useState(0);
  const [drag, setDrag] = useState<Drag | null>(null);
  const redraw = () => setTick((t) => t + 1);
  const last = useRef<ReactNode>(null);
  // Lo que necesitan los oyentes nativos del contenedor (arrastrar y soltar).
  const live = useRef({ drag, keys: [] as string[], current: '' as InspectorView });
  live.current.drag = drag;

  useEffect(() => {
    const over = (event: DragEvent) => {
      const dragging = live.current.drag;
      if (!dragging) return;
      const target = (event.target as Element).closest?.<HTMLElement>(
        '#inspectorContent > .section',
      );
      if (!target || target.dataset.orderKey === dragging.key) return;
      event.preventDefault();
      const after = event.clientY > target.getBoundingClientRect().top + target.offsetHeight / 2;
      const was = dragging.over;
      if (!was || was.key !== target.dataset.orderKey || was.after !== after)
        setDrag({ key: dragging.key, over: { key: target.dataset.orderKey!, after } });
    };
    const drop = (event: DragEvent) => {
      const dragging = live.current.drag,
        target = dragging?.over;
      if (!dragging || !target) return;
      event.preventDefault();
      const keys = live.current.keys.filter((k) => k !== dragging.key);
      keys.splice(keys.indexOf(target.key) + (target.after ? 1 : 0), 0, dragging.key);
      flushSync(() => saveOrder(keys));
      setDrag({ key: dragging.key });
    };
    host.addEventListener('dragover', over);
    host.addEventListener('drop', drop);
    return () => {
      host.removeEventListener('dragover', over);
      host.removeEventListener('drop', drop);
    };
  }, [host]);

  useLayoutEffect(() => drawn?.());

  // Mientras el inspector está en pausa (por ejemplo, ajustando un número de cornisa) queda lo que
  // se ve: el campo que se está ajustando no se vuelve a crear.
  if (inspectorPaused() && last.current) return last.current;

  // Sin libro (la mesa vacía, que ya tiene Crear y Abrir): un estado vacío en las tres pestañas.
  if (!editor.hasDocument)
    return (last.current = (
      <div key="no-book" className="inspector-empty">
        <p className="help">{i18n.tr('Creá o abrí un libro para ver sus propiedades.')}</p>
      </div>
    ));

  const current = view();
  const items: Item[] = planFor(current).passes.flatMap((pass) =>
    sectionsOf(pass).flatMap((slot) => {
      const render = inspectorPanel(pass + ':' + slot.name);
      return render ? [{ pass, slot, render, first: false }] : [];
    }),
  );
  for (const pass of new Set(items.map((i) => i.pass)))
    items.find((i) => i.pass === pass)!.first = true;
  const seen: Record<string, number> = {};
  const sections = items.filter((i) => i.slot.tag !== 'div');
  for (const item of sections) {
    const base = item.slot.className || item.slot.key || 'section';
    seen[base] = (seen[base] || 0) + 1;
    item.orderKey = `${base}#${seen[base]}`;
  }
  // Orden guardado: lo que no está guardado va al final, en su orden de siempre.
  if (sections.length > 1) {
    const stored = readKeys(ORDER_STORE)[current] || [];
    const rank = (i: Item) => {
      const at = stored.indexOf(i.orderKey!);
      return at < 0 ? Number.MAX_SAFE_INTEGER : at;
    };
    sections.sort((a, b) => rank(a) - rank(b) || items.indexOf(a) - items.indexOf(b));
  }
  const keys = sections.map((s) => s.orderKey!);
  live.current.keys = keys;
  live.current.current = current;
  const collapsed = new Set(readKeys(COLLAPSED_STORE)[current] || []);

  function saveOrder(next: string[]): void {
    const order = readKeys(ORDER_STORE);
    order[live.current.current] = next;
    writeKeys(ORDER_STORE, order);
    redraw();
  }
  const setCollapsed = (key: string, fold: boolean): void => {
    const all = readKeys(COLLAPSED_STORE),
      folded = new Set(all[current] || []);
    if (fold) folded.add(key);
    else folded.delete(key);
    all[current] = [...folded];
    writeKeys(COLLAPSED_STORE, all);
    flushSync(redraw);
  };
  const move = (key: string, direction: number): void => {
    const index = keys.indexOf(key),
      target = index + direction;
    if (index < 0 || target < 0 || target >= keys.length) return;
    const next = [...keys];
    [next[index], next[target]] = [next[target], next[index]];
    flushSync(() => saveOrder(next));
    host.querySelector<HTMLElement>(`:scope > [data-order-key="${key}"] .section-grip`)?.focus();
  };

  const frame = (item: Item, children: ReactNode) => {
    const { slot } = item,
      reactKey = current + ':' + item.pass + ':' + slot.name;
    if (slot.tag === 'div')
      return (
        <div
          key={reactKey}
          className={slot.className}
          data-pass={item.first ? item.pass : undefined}
        >
          {children}
        </div>
      );
    const key = item.orderKey!,
      folded = collapsed.has(key);
    const chrome: SectionChrome = {
      grip: sections.length > 1,
      collapsed: folded,
      toggle: () => setCollapsed(key, !folded),
      dragStart: (event) => {
        setDrag({ key });
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', key);
        const section = event.currentTarget.closest('section');
        if (section) event.dataTransfer.setDragImage(section, 24, 16);
      },
      dragEnd: () => setDrag(null),
      gripKey: (event) => {
        if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
        event.preventDefault();
        move(key, event.key === 'ArrowUp' ? -1 : 1);
      },
    };
    const className = [
      'section',
      slot.className,
      folded && 'is-collapsed',
      drag?.key === key && 'is-dragging',
      drag?.over?.key === key && (drag.over.after ? 'drop-after' : 'drop-before'),
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <SectionContext.Provider key={reactKey} value={chrome}>
        <section
          className={className}
          data-section={slot.title}
          data-key={slot.key}
          data-pass={item.first ? item.pass : undefined}
          data-order-key={key}
        >
          {children}
        </section>
      </SectionContext.Provider>
    );
  };

  // Las secciones van en su orden; lo que no es sección (Carácter y párrafo, el estado vacío),
  // después.
  const content = (
    <Fragment key={documentUnit()}>
      {[...sections, ...items.filter((i) => i.slot.tag === 'div')].map((item) =>
        frame(item, item.render()),
      )}
    </Fragment>
  );
  last.current = content;
  return content;
};
