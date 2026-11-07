// Arma el aviso con los datos que manda el proceso principal (en el hash de la URL).
// Sólo se usa textContent: el contenido nunca se interpreta como HTML.
(function () {
  'use strict';
  let data;
  try {
    data = JSON.parse(decodeURIComponent(location.hash.slice(1)));
  } catch {
    data = { title: 'Maquetario', message: '', buttons: [{ id: 'close', label: 'Cerrar', primary: true }] };
  }
  const byId = (id) => document.getElementById(id);
  document.documentElement.lang = data.lang || 'es';
  document.title = data.title || 'Maquetario';
  byId('eyebrow').textContent = data.eyebrow || 'Maquetario';
  byId('title').textContent = data.title || '';
  byId('message').textContent = data.message || '';
  if (data.detail) {
    byId('detail').textContent = data.detail;
    byId('detail').hidden = false;
  }

  const buttons = Array.isArray(data.buttons) && data.buttons.length ? data.buttons : [{ id: 'close', label: 'Cerrar', primary: true }];
  const actions = byId('actions');
  let primary = null;
  for (const spec of buttons) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button ' + (spec.primary ? 'button-primary' : 'button-secondary');
    button.textContent = spec.label;
    button.addEventListener('click', () => window.noticeBridge.choose(spec.id));
    actions.append(button);
    if (spec.primary) primary = button;
  }
  (primary || actions.lastElementChild).focus();

  // Escape elige la opción de cancelar (la que no es principal) o cierra.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const cancel = buttons.find((b) => !b.primary) || buttons[buttons.length - 1];
    window.noticeBridge.choose(cancel.id);
  });
})();
