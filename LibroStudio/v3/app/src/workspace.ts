// Espacios de trabajo: qué herramientas, pestañas (y vistas del riel) y zonas se ven.
//   Inicial         → lo esencial para empezar (menos herramientas, más simple).
//   Predeterminado  → todo, como siempre.
//   Personalizado   → la selección que cada persona arma en Configuración y queda guardada.
// No cambia nada del libro: sólo oculta controles de la interfaz.
//
// MaquetarioWorkspace es global: lo usan settings-panel.js, studio.js (menú del selector) y la
// autoprueba (desktop/src/main/selftest.ts).
//
// Fuente TypeScript: se compila a build/workspace.js (desktop/scripts/build.mjs).

export type WorkspaceMode = 'simple' | 'default' | 'custom';
export type WorkspaceGroup = 'tools' | 'tabs' | 'zones';

/** Algo que un espacio de trabajo puede mostrar u ocultar. `locked`: siempre visible. */
interface WorkspaceItem {
  id: string;
  group: WorkspaceGroup;
  selector: string;
  label: () => string;
  locked?: boolean;
}

interface WorkspaceState {
  mode: WorkspaceMode;
  /** Ids ocultos en el espacio Personalizado. */
  custom: string[];
}

export interface MaquetarioWorkspaceApi {
  /** Lo que se puede mostrar u ocultar, con su nombre en el idioma actual. */
  items(): { id: string; group: WorkspaceGroup; label: string; locked: boolean }[];
  isVisible(id: string): boolean;
  mode(): WorkspaceMode;
  setMode(mode: WorkspaceMode): void;
  /** Personalizado: muestra u oculta un elemento y pasa a ese espacio. */
  setVisible(id: string, visible: boolean): void;
  /** Abre o cierra el menú del selector de la barra superior. */
  toggleMenu(): void;
}

declare global {
  /** Espacio de trabajo activo y lo que muestra (congelado). */
  var MaquetarioWorkspace: Readonly<MaquetarioWorkspaceApi>;
}

const STORE = 'maquetario-workspace';
const t = (es: string, en: string, pt: string): string => bw(es, en, pt);

/** Todo lo que un espacio de trabajo puede mostrar u ocultar. `locked`: siempre visible. */
const ITEMS: WorkspaceItem[] = [
  {
    id: 'tool:select',
    group: 'tools',
    selector: '[data-tool="select"]',
    label: () => t('Seleccionar', 'Select', 'Selecionar'),
    locked: true,
  },
  {
    id: 'tool:hand',
    group: 'tools',
    selector: '[data-tool="hand"]',
    label: () => t('Mano', 'Hand', 'Mão'),
  },
  {
    id: 'tool:text',
    group: 'tools',
    selector: '[data-tool="text"]',
    label: () => t('Crear texto', 'Create text', 'Criar texto'),
  },
  {
    id: 'tool:image',
    group: 'tools',
    selector: '[data-tool="image"]',
    label: () => t('Imagen', 'Image', 'Imagem'),
  },
  {
    id: 'tool:frame',
    group: 'tools',
    selector: '[data-tool="frame"]',
    label: () => t('Marco', 'Frame', 'Moldura'),
  },
  {
    id: 'tool:shape',
    group: 'tools',
    selector: '[data-tool="shape"], #shapeTool',
    label: () => t('Figuras', 'Shapes', 'Formas'),
  },
  {
    id: 'tool:grid',
    group: 'tools',
    selector: '[data-tool="grid"]',
    label: () => t('Grilla', 'Grid', 'Grade'),
  },
  {
    id: 'tool:folio',
    group: 'tools',
    selector: '[data-tool="folio"]',
    label: () => t('Foliado', 'Page numbers', 'Fólio'),
  },
  {
    id: 'tool:header',
    group: 'tools',
    selector: '[data-tool="header"]',
    label: () => t('Cornisa', 'Running head', 'Cabeço'),
  },
  {
    id: 'tool:box',
    group: 'tools',
    selector: '[data-tool="box"]',
    label: () => t('Caja de texto', 'Text box', 'Caixa de texto'),
  },
  {
    id: 'tool:index',
    group: 'tools',
    selector: '#indexTool',
    label: () => t('Índice', 'Contents', 'Sumário'),
  },
  {
    id: 'tool:layers',
    group: 'tools',
    selector: '#layersTool',
    label: () => t('Capas', 'Layers', 'Camadas'),
  },
  {
    id: 'tool:cover',
    group: 'tools',
    selector: '#coverTool',
    label: () => t('Cubierta', 'Cover', 'Capa'),
  },
  {
    id: 'tab:book',
    group: 'tabs',
    selector: '.tab[data-tab="book"]',
    label: () => t('Libro', 'Book', 'Livro'),
    locked: true,
  },
  // Los ids viejos se conservan para respetar los espacios personalizados ya guardados:
  // Páginas pasó a la pestaña Página y Texto a Selección (que también muestra el objeto).
  {
    id: 'tab:pages',
    group: 'tabs',
    selector: '.tab[data-tab="page"]',
    label: () => t('Página', 'Page', 'Página'),
  },
  {
    id: 'tab:text',
    group: 'tabs',
    selector: '.tab[data-tab="selection"]',
    label: () => t('Selección', 'Selection', 'Seleção'),
  },
  // Índice y Capas son vistas del riel izquierdo.
  {
    id: 'tab:index',
    group: 'tabs',
    selector: '[data-rail-view="index"]',
    label: () => t('Índice', 'Contents', 'Sumário'),
  },
  {
    id: 'tab:layers',
    group: 'tabs',
    selector: '[data-rail-view="layers"]',
    label: () => t('Capas', 'Layers', 'Camadas'),
  },
  {
    id: 'zone:templates',
    group: 'zones',
    selector: '.template-panel',
    label: () => t('Plantillas de grilla', 'Grid templates', 'Modelos de grade'),
  },
];

/** Lo que oculta el espacio Inicial. */
const SIMPLE_HIDDEN = [
  'tool:frame',
  'tool:shape',
  'tool:grid',
  'tool:folio',
  'tool:header',
  'tool:box',
  'tool:index',
  'tool:layers',
  'tool:cover',
  'tab:index',
  'tab:layers',
  'zone:templates',
];

const MODES: Record<WorkspaceMode, { title: () => string; description: () => string }> = {
  simple: {
    title: () => t('Inicial', 'Starter', 'Inicial'),
    description: () =>
      t('Lo esencial para empezar.', 'The essentials to get started.', 'O essencial para começar.'),
  },
  default: {
    title: () => t('Predeterminado', 'Default', 'Padrão'),
    description: () => t('Todas las herramientas.', 'All tools.', 'Todas as ferramentas.'),
  },
  custom: {
    title: () => t('Personalizado', 'Custom', 'Personalizado'),
    description: () => t('Tu selección guardada.', 'Your saved selection.', 'Sua seleção salva.'),
  },
};

function read(): WorkspaceState {
  try {
    // JSON.parse(null) da null: sin nada guardado queda {}.
    const value = JSON.parse(localStorage.getItem(STORE)!) || {};
    return {
      mode: MODES[value.mode as WorkspaceMode] ? value.mode : 'default',
      custom: Array.isArray(value.custom) ? value.custom : SIMPLE_HIDDEN.slice(),
    };
  } catch {
    return { mode: 'default', custom: SIMPLE_HIDDEN.slice() };
  }
}
function write(state: WorkspaceState): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(state));
  } catch {
    // Sin almacenamiento: el espacio vale hasta cerrar la app.
  }
}

let state = read();

const hiddenFor = (s: WorkspaceState): Set<string> =>
  new Set(s.mode === 'simple' ? SIMPLE_HIDDEN : s.mode === 'custom' ? s.custom : []);

function apply(): void {
  const hidden = hiddenFor(state);
  for (const item of ITEMS) {
    const hide = !item.locked && hidden.has(item.id);
    document
      .querySelectorAll(item.selector)
      .forEach((el) => el.toggleAttribute('data-workspace-hidden', hide));
  }
  document.body.dataset.workspace = state.mode;
  // Si la pestaña activa quedó oculta, se pasa a la primera visible.
  const active = document.querySelector('.inspector .tab.active');
  if (active?.hasAttribute('data-workspace-hidden')) {
    const first = document.querySelector<HTMLElement>(
      '.inspector .tab:not([data-workspace-hidden])',
    );
    if (first && typeof showTab === 'function') showTab(first.dataset.tab!);
  }
  // Lo mismo con la vista del riel (Índice, Capas): vuelve a Páginas.
  const rail = document.querySelector('.rail-switch [aria-selected="true"]');
  if (rail?.hasAttribute('data-workspace-hidden') && typeof showRailView === 'function')
    showRailView('pages');
  // Sólo si cambió: escribir el mismo texto igual dispara el observador y entraría en bucle.
  const label = document.querySelector('#workspace > span');
  const name = MODES[state.mode].title();
  if (label && label.textContent !== name) label.textContent = name;
}

function setMode(mode: WorkspaceMode): void {
  state = { ...state, mode };
  write(state);
  apply();
}

/** Personalizado: muestra u oculta un elemento y pasa a ese espacio. */
function setVisible(id: string, visible: boolean): void {
  const custom = new Set(state.mode === 'custom' ? state.custom : [...hiddenFor(state)]);
  if (visible) custom.delete(id);
  else custom.add(id);
  state = { mode: 'custom', custom: [...custom] };
  write(state);
  apply();
}

// ── Menú del selector (popover nativo, anclado al botón) ──
const menu = document.createElement('div');
menu.id = 'workspaceMenu';
menu.className = 'menu';
menu.setAttribute('popover', 'auto');
menu.setAttribute('role', 'menu');
document.body.append(menu);

function renderMenu(): void {
  menu.innerHTML =
    Object.entries(MODES)
      .map(([id, m]) =>
        UI.menuItem({
          id: `workspace-${id}`,
          title: m.title(),
          description: m.description(),
          checked: state.mode === id,
        }),
      )
      .join('') +
    '<hr class="menu-separator">' +
    UI.menuItem({
      id: 'workspace-customize',
      title: t('Personalizar…', 'Customize…', 'Personalizar…'),
      icon: 'settings',
    });
  for (const id of Object.keys(MODES) as WorkspaceMode[]) {
    menu.querySelector<HTMLElement>(`#workspace-${id}`)!.onclick = () => {
      menu.hidePopover();
      setMode(id);
    };
  }
  menu.querySelector<HTMLElement>('#workspace-customize')!.onclick = () => {
    menu.hidePopover();
    openSettings('workspace');
  };
}

function toggleMenu(): void {
  renderMenu();
  menu.togglePopover();
}

// Las herramientas y pestañas se vuelven a dibujar (por ejemplo, al cambiar de idioma): se reaplica.
const observer = new MutationObserver(() => {
  observer.disconnect();
  apply();
  watch();
});
function watch(): void {
  for (const root of [$('#tools'), $('.inspector .tabs'), $('.leftpanel'), $('.topbar')]) {
    if (root) observer.observe(root, { childList: true, subtree: true });
  }
}

globalThis.MaquetarioWorkspace = Object.freeze({
  items: () =>
    ITEMS.map((i) => ({ id: i.id, group: i.group, label: i.label(), locked: !!i.locked })),
  isVisible: (id: string) => !hiddenFor(state).has(id) || !!ITEMS.find((i) => i.id === id)?.locked,
  mode: () => state.mode,
  setMode,
  setVisible,
  toggleMenu,
});

apply();
watch();
