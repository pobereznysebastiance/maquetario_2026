// Componentes del sistema de diseño: la única forma de armar su marcado desde JS.
// Cada función devuelve el HTML de un átomo o molécula de ui/ con sus clases correctas;
// los módulos no escriben clases ni estructura de componentes a mano.
// Cuando la interfaz pase a React, cada función se convierte en un componente con la misma API.
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

const html = (value: unknown): string => esc(value ?? '');
const attrs = (map: Record<string, unknown>): string =>
  Object.entries(map)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${html(v)}"`))
    .join('');

const UI = {
  /** Átomo: ícono del set de la app (studio.js → paths). */
  icon(name: string): string {
    return icon(name);
  },

  /**
   * Átomo: botón. variant: 'secondary' (por defecto) | 'primary' | 'danger'.
   * @param {{label: string, id?: string, icon?: string, variant?: string, wide?: boolean, type?: string, value?: string, title?: string}} o
   */
  button(o: {
    label: string;
    id?: string;
    icon?: string;
    variant?: string;
    wide?: boolean;
    type?: string;
    value?: string;
    title?: string;
  }): string {
    const variant = o.variant === 'primary' ? ' primary' : o.variant === 'danger' ? ' danger' : '';
    return `<button${attrs({ type: o.type || 'button', id: o.id, value: o.value, title: o.title, class: `btn${variant}${o.wide ? ' wide' : ''}` })}>${o.icon ? icon(o.icon) : ''}${html(o.label)}</button>`;
  },

  /** Átomo: botón de sólo ícono (siempre con nombre accesible). */
  iconButton(o: { id?: string; label: string; icon: string }): string {
    return `<button${attrs({ type: 'button', id: o.id, class: 'icon-btn', title: o.label, 'aria-label': o.label })}>${icon(o.icon)}</button>`;
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

  /**
   * Molécula: contenido del aviso del sistema (#toast): ícono de estado y mensaje.
   * type: 'success' (por defecto) | 'info' | 'warning' | 'error'.
   * closeLabel: si viene, agrega el botón de cerrar (sólo ícono, con ese nombre accesible).
   */
  toast(o: { type?: string; message: string; closeLabel?: string }): string {
    const icons: Record<string, string> = {
      success: 'check',
      info: 'info',
      warning: 'alert',
      error: 'error',
    };
    return `${icon(icons[o.type ?? ''] || icons.success)}<span class="toast-message">${html(o.message)}</span>${o.closeLabel ? UI.iconButton({ label: o.closeLabel, icon: 'close' }) : ''}`;
  },
};

export type UIComponents = typeof UI;

declare global {
  var UI: Readonly<UIComponents>;
}
globalThis.UI = Object.freeze(UI);
