// Orden de las secciones del inspector: se arrastran por la manija del título
// (o con Alt+↑ / Alt+↓ desde la manija) y el orden se recuerda por pestaña.
// No toca cómo se arma cada sección: reordena lo que inspector() dibuja.
(function () {
  'use strict';

  const STORE = 'maquetario-inspector-order';
  const host = $('#inspectorContent');
  const label = () => bw('Arrastrar para reordenar', 'Drag to reorder', 'Arraste para reordenar');

  const readOrder = () => {
    try {
      return JSON.parse(localStorage.getItem(STORE)) || {};
    } catch {
      return {};
    }
  };
  const writeOrder = (order) => {
    try {
      localStorage.setItem(STORE, JSON.stringify(order));
    } catch {
      // Sin almacenamiento: el orden vale hasta cerrar la app.
    }
  };
  const tabKey = () => (document.querySelector('.inspector .tab.active') || {}).dataset?.tab || 'default';
  const sectionsOf = () => [...host.children].filter((el) => el.classList.contains('section'));

  /** Clave estable (no depende del idioma): clase propia o ícono de la sección, y su número de aparición. */
  function assignKeys(sections) {
    const seen = {};
    for (const section of sections) {
      const base = [...section.classList].find((c) => c !== 'section') || section.dataset.key || 'section';
      seen[base] = (seen[base] || 0) + 1;
      section.dataset.orderKey = `${base}#${seen[base]}`;
    }
  }

  function saveCurrent() {
    const order = readOrder();
    order[tabKey()] = sectionsOf().map((s) => s.dataset.orderKey);
    writeOrder(order);
  }

  function applyStoredOrder(sections) {
    const stored = readOrder()[tabKey()] || [];
    const rank = (s) => {
      const i = stored.indexOf(s.dataset.orderKey);
      return i < 0 ? Number.MAX_SAFE_INTEGER : i;
    };
    const sorted = [...sections].sort((a, b) => rank(a) - rank(b) || sections.indexOf(a) - sections.indexOf(b));
    if (sorted.every((s, i) => s === sections[i])) return;
    const marker = document.createComment('orden');
    host.insertBefore(marker, sections[0]);
    for (const s of sorted) host.insertBefore(s, marker);
    marker.remove();
  }

  function move(section, direction) {
    const sections = sectionsOf();
    const index = sections.indexOf(section);
    const target = sections[index + direction];
    if (!target) return;
    host.insertBefore(section, direction < 0 ? target : target.nextSibling);
    saveCurrent();
    section.querySelector('.section-grip')?.focus();
  }

  let dragging = null;
  const clearIndicators = () =>
    host.querySelectorAll('.drop-before, .drop-after').forEach((el) => el.classList.remove('drop-before', 'drop-after'));

  function addGrip(section) {
    const heading = section.querySelector(':scope > .section-heading');
    if (!heading || heading.querySelector('.section-grip')) return;
    const grip = document.createElement('button');
    grip.type = 'button';
    grip.className = 'section-grip';
    grip.draggable = true;
    grip.title = grip.ariaLabel = label();
    grip.innerHTML = icon('grip');
    grip.addEventListener('dragstart', (event) => {
      dragging = section;
      section.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', section.dataset.orderKey);
      event.dataTransfer.setDragImage(section, 24, 16);
    });
    grip.addEventListener('dragend', () => {
      section.classList.remove('is-dragging');
      dragging = null;
      clearIndicators();
    });
    grip.addEventListener('keydown', (event) => {
      if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
      event.preventDefault();
      move(section, event.key === 'ArrowUp' ? -1 : 1);
    });
    heading.prepend(grip);
  }

  host.addEventListener('dragover', (event) => {
    if (!dragging) return;
    const target = event.target.closest?.('#inspectorContent > .section');
    if (!target || target === dragging) return;
    event.preventDefault();
    const after = event.clientY > target.getBoundingClientRect().top + target.offsetHeight / 2;
    clearIndicators();
    target.classList.add(after ? 'drop-after' : 'drop-before');
  });
  host.addEventListener('drop', (event) => {
    if (!dragging) return;
    const target = host.querySelector('.drop-before, .drop-after');
    if (!target) return;
    event.preventDefault();
    host.insertBefore(dragging, target.classList.contains('drop-after') ? target.nextSibling : target);
    clearIndicators();
    saveCurrent();
  });

  function decorate() {
    const sections = sectionsOf();
    if (sections.length < 2) return;
    // Ya decoradas (por ejemplo, después de mover una): nada que hacer.
    if (sections.every((s) => s.querySelector(':scope > .section-heading > .section-grip'))) return;
    assignKeys(sections);
    applyStoredOrder(sections);
    sections.forEach(addGrip);
  }

  new MutationObserver(decorate).observe(host, { childList: true });
  decorate();
})();
