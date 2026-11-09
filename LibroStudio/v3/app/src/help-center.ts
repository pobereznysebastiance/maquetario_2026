// Centro de Ayuda (D8): una sola puerta para Tutorial guiado, Glosario, Atajos y Recorrido del
// libro. Es una Ventana de trabajo con una navegación lateral; cada sección la aporta el módulo
// que la conoce (tutorial.ts, editorial-learning.ts, canvas-navigation.ts, book-workflow.ts) con
// registerHelpSection. La entrada fija está en la barra superior ("Ayuda", también con F1).
//
//   openHelp()                       → abre en la última sección vista (la primera vez, Tutorial)
//   openHelp('glossary', 'gutter')   → abre el glosario en un término
//   openHelp('shortcuts') · openHelp('route') · openHelp('tutorial')
//
// También acepta los nombres en castellano (glosario, atajos, recorrido). Los textos van en
// castellano y los traduce i18n.ts (su fila en labels).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

export type HelpSectionId = 'tutorial' | 'glossary' | 'shortcuts' | 'route';

/** Una sección del centro de Ayuda. */
export interface HelpSection {
  id: HelpSectionId;
  /** Nombre en la navegación (en castellano: lo traduce i18n.ts). */
  label: string;
  /** Lugar en la navegación (de menor a mayor). */
  order: number;
  /** Dibuja la sección en host; arg es lo que se pidió con openHelp (por ejemplo, un término). */
  render: (host: HTMLElement, arg?: string) => void;
}

declare global {
  /** Suma una sección al centro de Ayuda. */
  var registerHelpSection: (section: HelpSection) => void;
  /** Abre el centro de Ayuda en una sección (y, si la sección lo usa, en un término o paso). */
  var openHelp: (section?: HelpSectionId | string, arg?: string) => void;
}

const sections = new Map<string, HelpSection>();
const aliases: Record<string, HelpSectionId> = {
  glosario: 'glossary',
  atajos: 'shortcuts',
  recorrido: 'route',
};
let currentSection: string = 'tutorial';

globalThis.registerHelpSection = (section) => {
  sections.set(section.id, section);
};

const ordered = (): HelpSection[] => [...sections.values()].sort((a, b) => a.order - b.order);

function openHelp(section?: HelpSectionId | string, arg?: string): void {
  const wanted = section ? aliases[section] || section : currentSection;
  const id = sections.has(wanted) ? wanted : ordered()[0]?.id;
  if (!id) return;
  currentSection = id;
  // Ya abierto: sólo cambia de sección (no se vuelve a abrir la ventana).
  if (!($('#modal').open && $('#helpPane'))) {
    modal.workspace(
      'Ayuda',
      `<div class="help-center"><nav class="help-nav" aria-label="Secciones de la ayuda">${ordered()
        .map((s) => UI.textButton({ label: s.label, data: { helpSection: s.id } }))
        .join('')}</nav><div id="helpPane" class="help-pane"></div></div>`,
    );
    // Si el diálogo no se pudo abrir (por ejemplo, con una salida en curso), no hay nada que dibujar.
    if (!$('#helpPane')) return;
    $$('[data-help-section]').forEach((b) => (b.onclick = () => openHelp(b.dataset.helpSection)));
  }
  for (const b of $$('[data-help-section]'))
    if (b.dataset.helpSection === id) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  const pane = $('#helpPane');
  pane.replaceChildren();
  sections.get(id)!.render(pane, arg);
  pane.closest('.dialog-body')?.scrollTo(0, 0);
}
globalThis.openHelp = openHelp;

// Entrada fija en la barra superior, a la izquierda de las acciones del documento.
const helpButton = UI.element(
  UI.toolAction({ id: 'helpCenter', title: 'Ayuda', icon: 'help', label: 'Ayuda' }),
);
helpButton.setAttribute('aria-keyshortcuts', 'F1');
helpButton.onclick = () => openHelp();
$('.topright').prepend(helpButton);
document.addEventListener('keydown', (e) => {
  if (e.key !== 'F1') return;
  e.preventDefault();
  // Con otro diálogo abierto no se lo reemplaza (se perdería lo que tenga sin aplicar).
  if (!$('#modal').open || $('#helpPane')) openHelp();
});

export {};
