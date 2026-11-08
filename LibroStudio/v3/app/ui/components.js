// Componentes del sistema de diseño: la única forma de armar su marcado desde JS.
// Cada función devuelve el HTML de un átomo o molécula de ui/ con sus clases correctas;
// los módulos no escriben clases ni estructura de componentes a mano.
// Cuando la interfaz pase a React, cada función se convierte en un componente con la misma API.
(function () {
  'use strict';

  const html = (value) => esc(value ?? '');
  const attrs = (map) =>
    Object.entries(map)
      .filter(([, v]) => v !== undefined && v !== null && v !== false)
      .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${html(v)}"`))
      .join('');

  const UI = {
    /** Átomo: ícono del set de la app (studio.js → paths). */
    icon(name) {
      return icon(name);
    },

    /**
     * Átomo: botón. variant: 'secondary' (por defecto) | 'primary' | 'danger'.
     * @param {{label: string, id?: string, icon?: string, variant?: string, wide?: boolean, type?: string, value?: string, title?: string}} o
     */
    button(o) {
      const variant = o.variant === 'primary' ? ' primary' : o.variant === 'danger' ? ' danger' : '';
      return `<button${attrs({ type: o.type || 'button', id: o.id, value: o.value, title: o.title, class: `btn${variant}${o.wide ? ' wide' : ''}` })}>${o.icon ? icon(o.icon) : ''}${html(o.label)}</button>`;
    },

    /** Átomo: botón de sólo ícono (siempre con nombre accesible). */
    iconButton(o) {
      return `<button${attrs({ type: 'button', id: o.id, class: 'icon-btn', title: o.label, 'aria-label': o.label })}>${icon(o.icon)}</button>`;
    },

    /**
     * Molécula: acción con explicación (ícono + título + descripción). Para listas de opciones
     * donde no alcanza con el nombre: "Para empezar", menús de ayuda, elecciones de salida.
     */
    actionItem(o) {
      return `<button${attrs({ type: 'button', id: o.id, class: 'action-item' })}>${icon(o.icon)}<span class="action-item-text"><span class="action-item-title">${html(o.title)}</span><span class="action-item-description">${html(o.description)}</span></span></button>`;
    },

    /** Átomo: esqueleto de carga, con texto accesible de lo que se está cargando. */
    skeleton(o = {}) {
      const lines = Math.max(1, Math.min(o.lines || 3, 12));
      return `<div class="skeleton" role="status" aria-busy="true" aria-label="${html(o.label || '')}">${'<span class="skeleton-line"></span>'.repeat(lines)}</div>`;
    },

    /** Molécula: fila de preferencia (etiqueta y ayuda a la izquierda, control a la derecha). */
    settingRow(o) {
      return `<div class="setting-row"><div class="setting-row-label">${html(o.label)}${o.help ? `<p class="setting-row-help">${html(o.help)}</p>` : ''}</div><div class="setting-row-control">${o.control}</div></div>`;
    },
  };

  window.UI = Object.freeze(UI);
})();
