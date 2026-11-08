// Secciones del inspector:
// - Orden: se arrastran por la manija del título (o Alt+↑ / Alt+↓ desde la manija).
// - Plegado: la flecha del título (o un clic en el nombre) pliega la sección y libera su alto.
// Orden y plegado se recuerdan por pestaña. No toca cómo se arma cada sección:
// trabaja sobre lo que inspector() dibuja. No publica nada.
//
// Fuente TypeScript: se compila a build/inspector-sections.js (desktop/scripts/build.mjs).

/** Por pestaña: claves de sección (orden o plegadas). */
type SectionKeysByTab = Record<string, string[]>;

const STORE = 'maquetario-inspector-order';
const COLLAPSED_STORE = 'maquetario-inspector-collapsed';
const host = $('#inspectorContent');
const label = () => bw('Arrastrar para reordenar', 'Drag to reorder', 'Arraste para reordenar');

// JSON.parse(null) da null: sin nada guardado queda {}.
const readOrder = (): SectionKeysByTab => {
  try {
    return JSON.parse(localStorage.getItem(STORE)!) || {};
  } catch {
    return {};
  }
};
const writeOrder = (order: SectionKeysByTab): void => {
  try {
    localStorage.setItem(STORE, JSON.stringify(order));
  } catch {
    // Sin almacenamiento: el orden vale hasta cerrar la app.
  }
};
const tabKey = (): string =>
  (document.querySelector<HTMLElement>('.inspector .tab.active') || ({} as Partial<HTMLElement>))
    .dataset?.tab || 'default';
const sectionsOf = (): HTMLElement[] =>
  ([...host.children] as HTMLElement[]).filter((el) => el.classList.contains('section'));

/** Clave estable (no depende del idioma): clase propia o ícono de la sección, y su número de aparición. */
function assignKeys(sections: HTMLElement[]): void {
  const seen: Record<string, number> = {};
  for (const section of sections) {
    const base =
      [...section.classList].find((c) => c !== 'section') || section.dataset.key || 'section';
    seen[base] = (seen[base] || 0) + 1;
    section.dataset.orderKey = `${base}#${seen[base]}`;
  }
}

function saveCurrent(): void {
  const order = readOrder();
  order[tabKey()] = sectionsOf().map((s) => s.dataset.orderKey!);
  writeOrder(order);
}

function applyStoredOrder(sections: HTMLElement[]): void {
  const stored = readOrder()[tabKey()] || [];
  const rank = (s: HTMLElement): number => {
    const i = stored.indexOf(s.dataset.orderKey!);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const sorted = [...sections].sort(
    (a, b) => rank(a) - rank(b) || sections.indexOf(a) - sections.indexOf(b),
  );
  if (sorted.every((s, i) => s === sections[i])) return;
  const marker = document.createComment('orden');
  host.insertBefore(marker, sections[0]);
  for (const s of sorted) host.insertBefore(s, marker);
  marker.remove();
}

function move(section: HTMLElement, direction: number): void {
  const sections = sectionsOf();
  const index = sections.indexOf(section);
  const target = sections[index + direction];
  if (!target) return;
  host.insertBefore(section, direction < 0 ? target : target.nextSibling);
  saveCurrent();
  section.querySelector<HTMLElement>('.section-grip')?.focus();
}

let dragging: HTMLElement | null = null;
const clearIndicators = () =>
  host
    .querySelectorAll('.drop-before, .drop-after')
    .forEach((el) => el.classList.remove('drop-before', 'drop-after'));

function addGrip(section: HTMLElement): void {
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
    event.dataTransfer!.effectAllowed = 'move';
    event.dataTransfer!.setData('text/plain', section.dataset.orderKey!);
    event.dataTransfer!.setDragImage(section, 24, 16);
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

host.addEventListener('dragover', (event: DragEvent) => {
  if (!dragging) return;
  const target = (event.target as Element).closest?.<HTMLElement>('#inspectorContent > .section');
  if (!target || target === dragging) return;
  event.preventDefault();
  const after = event.clientY > target.getBoundingClientRect().top + target.offsetHeight / 2;
  clearIndicators();
  target.classList.add(after ? 'drop-after' : 'drop-before');
});
host.addEventListener('drop', (event: DragEvent) => {
  if (!dragging) return;
  const target = host.querySelector('.drop-before, .drop-after');
  if (!target) return;
  event.preventDefault();
  host.insertBefore(
    dragging,
    target.classList.contains('drop-after') ? target.nextSibling : target,
  );
  clearIndicators();
  saveCurrent();
});

// ── Plegado ──
const readCollapsed = (): SectionKeysByTab => {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSED_STORE)!) || {};
  } catch {
    return {};
  }
};
function setCollapsed(section: HTMLElement, collapsed: boolean): void {
  section.classList.toggle('is-collapsed', collapsed);
  const toggle = section.querySelector<HTMLElement>(':scope > .section-heading > .section-toggle');
  if (toggle) {
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.title = toggle.ariaLabel = collapsed
      ? bw('Desplegar', 'Expand', 'Expandir')
      : bw('Plegar', 'Collapse', 'Recolher');
  }
  const all = readCollapsed();
  const keys = new Set(all[tabKey()] || []);
  if (collapsed) keys.add(section.dataset.orderKey!);
  else keys.delete(section.dataset.orderKey!);
  all[tabKey()] = [...keys];
  try {
    localStorage.setItem(COLLAPSED_STORE, JSON.stringify(all));
  } catch {
    // Sin almacenamiento: vale hasta cerrar la app.
  }
}

function addToggle(section: HTMLElement, collapsedKeys: Set<string>): void {
  const heading = section.querySelector(':scope > .section-heading');
  if (!heading || heading.querySelector('.section-toggle')) return;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'section-toggle';
  toggle.innerHTML = icon('chevron');
  toggle.addEventListener('click', () =>
    setCollapsed(section, !section.classList.contains('is-collapsed')),
  );
  heading.append(toggle);
  // Un clic en el nombre de la sección también pliega (no en sus controles: interruptor, ayuda…).
  const title = heading.querySelector(':scope > span:not(.tiny)');
  if (title) {
    title.classList.add('section-title');
    title.addEventListener('click', () => toggle.click());
  }
  const collapsed = collapsedKeys.has(section.dataset.orderKey!);
  section.classList.toggle('is-collapsed', collapsed);
  toggle.setAttribute('aria-expanded', String(!collapsed));
  toggle.title = toggle.ariaLabel = collapsed
    ? bw('Desplegar', 'Expand', 'Expandir')
    : bw('Plegar', 'Collapse', 'Recolher');
}

function decorate(): void {
  const sections = sectionsOf();
  if (!sections.length) return;
  // Ya decoradas (por ejemplo, después de mover una): nada que hacer.
  if (sections.every((s) => s.querySelector(':scope > .section-heading > .section-toggle'))) return;
  assignKeys(sections);
  if (sections.length > 1) {
    applyStoredOrder(sections);
    sections.forEach(addGrip);
  }
  const collapsedKeys = new Set(readCollapsed()[tabKey()] || []);
  sections.forEach((s) => addToggle(s, collapsedKeys));
}

new MutationObserver(decorate).observe(host, { childList: true });
decorate();

export {};
