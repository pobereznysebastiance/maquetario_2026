// Componentes del sistema de diseño: la única forma de armar su marcado desde JS.
// Cada función devuelve el HTML de un átomo o molécula de ui/ con sus clases correctas;
// los módulos no escriben clases ni estructura de componentes a mano.
// Cuando la interfaz pase a React, cada función se convierte en un componente con la misma API:
// los parámetros documentados acá son el contrato (las props) de ese componente.
//
// Reglas comunes a todos los botones:
// - Siempre llevan type="button" (ninguno envía formularios: los de los diálogos con
//   value="cancel" se escriben aparte).
// - Los textos (label, title, description…) se escapan: van como texto, nunca como marcado.
// - data y aria se escriben con su prefijo: { goPart: 3 } → data-go-part="3",
//   { pressed: true } → aria-pressed="true" (en aria, true y false se escriben como texto).
//
// Se carga con el núcleo (src/entries/core.ts), antes de studio.ts: la barra de herramientas y
// el riel se arman al cargar. Sólo usa icon() y esc() de studio.ts al llamarse.
//
// Fuente TypeScript: viaja dentro de build/core.js (src/entries/core.ts).

type AttrValue = string | number | boolean | undefined | null;

const html = (value: unknown): string => esc(value ?? '');
const attrs = (map: Record<string, unknown>): string =>
  Object.entries(map)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${html(v)}"`))
    .join('');
/** { goPart: 3 } → { 'data-go-part': 3 }. */
const dataAttrs = (data: Record<string, AttrValue> = {}): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(data).map(([k, v]) => [
      'data-' + k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()),
      v === true ? 'true' : v,
    ]),
  );
/** { pressed: true } → { 'aria-pressed': 'true' }. */
const ariaAttrs = (aria: Record<string, AttrValue> = {}): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(aria).map(([k, v]) => ['aria-' + k, typeof v === 'boolean' ? String(v) : v]),
  );

/** Lo común a todos los botones (props compartidas de los componentes de botón). */
export interface ButtonBase {
  id?: string;
  /** Texto de ayuda al pasar el puntero (atributo title). */
  title?: string;
  disabled?: boolean;
  /** Atributos data-*, sin el prefijo y en camelCase. */
  data?: Record<string, AttrValue>;
  /** Atributos aria-*, sin el prefijo. */
  aria?: Record<string, AttrValue>;
}

/** Atributos de un botón: type, id, clase, title, disabled, data-* y aria-*. */
const buttonAttrs = (o: ButtonBase, className?: string): string =>
  attrs({
    type: 'button',
    id: o.id,
    class: className,
    title: o.title,
    disabled: !!o.disabled,
    ...dataAttrs(o.data),
    ...ariaAttrs(o.aria),
  });
/** Ícono y texto: con ícono, el texto va en un <span> (las barras lo ocultan en ancho chico). */
const iconLabel = (iconName: string | undefined, label: string | undefined): string =>
  iconName ? icon(iconName) + (label ? `<span>${html(label)}</span>` : '') : html(label);
/** Clase con modificadores: cls('tool', { active: true }) → 'tool active'. */
const cls = (base: string, modifiers: Record<string, boolean | undefined>): string =>
  [base, ...Object.keys(modifiers).filter((k) => modifiers[k])].join(' ');

const UI = {
  /** Átomo: ícono del set de la app (studio.ts → paths). */
  icon(name: string): string {
    return icon(name);
  },

  /**
   * Crea el nodo de un componente a partir de su marcado, para los módulos que necesitan el
   * elemento (engancharle eventos, insertarlo en un lugar fijo): UI.element(UI.quietButton(…)).
   * En React desaparece: el componente ya es el nodo.
   */
  element<T extends HTMLElement = HTMLButtonElement>(markup: string): T {
    const template = document.createElement('template');
    template.innerHTML = markup.trim();
    return template.content.firstElementChild as T;
  },

  /**
   * Átomo: botón (.btn). Para acciones de diálogo, de panel y de pantalla.
   * - variant: 'secondary' (por defecto) | 'primary' (la acción principal) | 'danger' (destructiva).
   * - wide: ocupa todo el ancho de su contenedor.
   * - icon: ícono antes del texto; iconAfter: ícono después.
   * - value: para los botones que responden a un formulario de diálogo.
   */
  button(
    o: ButtonBase & {
      label: string;
      icon?: string;
      iconAfter?: string;
      variant?: 'secondary' | 'primary' | 'danger' | string;
      wide?: boolean;
      type?: string;
      value?: string;
    },
  ): string {
    const variant = o.variant === 'primary' ? ' primary' : o.variant === 'danger' ? ' danger' : '';
    return `<button${attrs({ type: o.type || 'button', id: o.id, value: o.value, title: o.title, class: `btn${variant}${o.wide ? ' wide' : ''}`, disabled: !!o.disabled, ...dataAttrs(o.data), ...ariaAttrs(o.aria) })}>${o.icon ? icon(o.icon) : ''}${html(o.label)}${o.iconAfter ? icon(o.iconAfter) : ''}</button>`;
  },

  /**
   * Átomo: botón discreto (.quiet), sin fondo: alternadores y accesos secundarios de las barras
   * (recorrido, plantillas, continuo, tutorial, "Ver todas…").
   * - Sin label, queda vacío: el módulo pone el texto después (textContent), según el estado.
   * - Con icon, el texto va en un <span>.
   */
  quietButton(o: ButtonBase & { label?: string; icon?: string; wide?: boolean } = {}): string {
    return `<button${buttonAttrs(o, cls('quiet', { wide: o.wide }))}>${iconLabel(o.icon, o.label)}</button>`;
  },

  /**
   * Átomo: botón sin estilo propio: toma el de su contenedor (ruta del libro, enlaces de la
   * bienvenida, opciones de un menú simple). active marca la opción actual (clase active).
   * Con icon, el texto va en un <span>; sin label, es un botón de sólo ícono (darle aria o title).
   */
  textButton(o: ButtonBase & { label?: string; icon?: string; active?: boolean }): string {
    return `<button${buttonAttrs(o, o.active ? 'active' : undefined)}>${iconLabel(o.icon, o.label)}</button>`;
  },

  /** Átomo: botón de sólo ícono (.icon-btn), siempre con nombre accesible (title y aria-label). */
  iconButton(o: ButtonBase & { label: string; icon: string }): string {
    return `<button${attrs({ type: 'button', id: o.id, class: 'icon-btn', title: o.label, 'aria-label': o.label, disabled: !!o.disabled, ...dataAttrs(o.data), ...ariaAttrs(o.aria) })}>${icon(o.icon)}</button>`;
  },

  /**
   * Átomo: acción de la barra superior (.tool-action): ícono y nombre en un <span> (el nombre se
   * oculta en ancho chico, por eso conviene title). El <span> va siempre, aunque label esté
   * vacío: hay módulos que lo completan después.
   */
  toolAction(o: ButtonBase & { label: string; icon: string }): string {
    return `<button${buttonAttrs(o, 'tool-action')}>${icon(o.icon)}<span>${html(o.label)}</span></button>`;
  },

  /**
   * Molécula: herramienta del riel izquierdo (.tool): ícono, nombre y atajo de teclado.
   * - tool: el nombre de la herramienta (data-tool), que usa setTool().
   * - shortcut: la tecla; el lugar del atajo va siempre (vacío si no tiene).
   * - active: la herramienta elegida.
   */
  tool(
    o: ButtonBase & {
      tool: string;
      label: string;
      icon: string;
      shortcut?: string;
      active?: boolean;
    },
  ): string {
    return `<button${buttonAttrs({ ...o, data: { tool: o.tool, ...o.data } }, cls('tool', { active: o.active }))}>${icon(o.icon)}<span>${html(o.label)}</span><span class="shortcut">${html(o.shortcut)}</span></button>`;
  },

  /**
   * Molécula: tarjeta de plantilla de grilla (.template): miniatura, nombre y, si viene, la
   * medida (columnas y filas). art es el marcado de la miniatura (lo dibuja quien llama).
   */
  templateCard(
    o: ButtonBase & { art: string; label: string; detail?: string; active?: boolean },
  ): string {
    return `<button${buttonAttrs(o, cls('template', { active: o.active }))}><div class="template-art">${o.art}</div>${html(o.label)}${o.detail !== undefined ? `<span class="template-dimensions">${html(o.detail)}</span>` : ''}</button>`;
  },

  /**
   * Molécula: miniatura de la tira de páginas (.thumb): las páginas del pliego y su número.
   * pages es el marcado de las páginas en miniatura (lo dibuja quien llama).
   */
  pageThumb(o: ButtonBase & { pages: string; label: string; active?: boolean }): string {
    return `<button${buttonAttrs(o, cls('thumb', { active: o.active }))}><div class="thumb-pages">${o.pages}</div><small>${html(o.label)}</small></button>`;
  },

  /**
   * Molécula: proyecto reciente de la bienvenida (.recent-project): portada, nombre, ruta, fecha
   * y flecha. missing: el archivo ya no está (se muestra apagado, date dice "no encontrado").
   */
  recentProject(
    o: ButtonBase & { name: string; path: string; date: string; missing?: boolean },
  ): string {
    return `<button${buttonAttrs(o, cls('recent-project', { missing: o.missing }))}><span class="recent-cover">${icon('pages')}</span><span class="recent-details user-content"><strong>${html(o.name)}</strong><small>${html(o.path)}</small></span><span class="recent-date">${html(o.date)}</span><span class="recent-arrow">↗</span></button>`;
  },

  /**
   * Molécula: acción con explicación (ícono + título + descripción). Para listas de opciones
   * donde no alcanza con el nombre: "Para empezar", menús de ayuda, elecciones de salida.
   */
  actionItem(o: { id?: string; icon: string; title: string; description: string }): string {
    return `<button${attrs({ type: 'button', id: o.id, class: 'action-item' })}>${icon(o.icon)}<span class="action-item-text"><span class="action-item-title">${html(o.title)}</span><span class="action-item-description">${html(o.description)}</span></span></button>`;
  },

  /** Átomo: esqueleto de carga, con texto accesible de lo que se está cargando. */
  skeleton(o: { lines?: number; label?: string } = {}): string {
    const lines = Math.max(1, Math.min(o.lines || 3, 12));
    return `<div class="skeleton" role="status" aria-busy="true" aria-label="${html(o.label || '')}">${'<span class="skeleton-line"></span>'.repeat(lines)}</div>`;
  },

  /** Molécula: opción de menú. Con checked muestra la marca de la opción elegida. */
  menuItem(o: {
    id?: string;
    icon?: string;
    checked?: boolean;
    title: string;
    description?: string;
  }): string {
    const mark = o.icon
      ? icon(o.icon)
      : o.checked
        ? icon('check')
        : '<span class="menu-item-mark"></span>';
    return `<button${attrs({ type: 'button', id: o.id, class: 'menu-item', role: o.checked === undefined ? 'menuitem' : 'menuitemradio', 'aria-checked': o.checked === undefined ? undefined : String(!!o.checked) })}>${mark}<span class="menu-item-text"><span class="menu-item-title">${html(o.title)}</span>${o.description ? `<span class="menu-item-description">${html(o.description)}</span>` : ''}</span></button>`;
  },

  /** Molécula: casilla con etiqueta (listas de opciones que se prenden y apagan). */
  checkItem(o: {
    id?: string;
    item?: string;
    checked?: boolean;
    disabled?: boolean;
    label: string;
  }): string {
    return `<label class="check-item"><input${attrs({ type: 'checkbox', id: o.id, 'data-item': o.item, checked: !!o.checked, disabled: !!o.disabled })}><span>${html(o.label)}</span></label>`;
  },

  /** Molécula: fila de preferencia (etiqueta y ayuda a la izquierda, control a la derecha). */
  settingRow(o: { label: string; help?: string; control: string }): string {
    return `<div class="setting-row"><div class="setting-row-label">${html(o.label)}${o.help ? `<p class="setting-row-help">${html(o.help)}</p>` : ''}</div><div class="setting-row-control">${o.control}</div></div>`;
  },

  // El aviso (toast) es un componente React: src/components/toast/Toast.tsx.
};

export type UIComponents = typeof UI;

declare global {
  var UI: Readonly<UIComponents>;
}
globalThis.UI = Object.freeze(UI);
