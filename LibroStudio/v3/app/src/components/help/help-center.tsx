// Centro de Ayuda (D8) en React: una sola puerta para Tutorial guiado, Glosario, Atajos y
// Recorrido del libro. Es una Ventana de trabajo (openWorkWindow, components/dialog/dialogs.tsx)
// con una navegación lateral; cada sección la aporta el módulo que la conoce (tutorial.ts,
// editorial-learning.ts, canvas-navigation.ts, book-workflow.ts) con registerHelpSection. La
// entrada fija está en la barra superior ("Ayuda", también con F1).
//
//   openHelp()                       → abre en la última sección vista (la primera vez, Tutorial)
//   openHelp('glossary', 'gutter')   → abre el glosario en un término
//   openHelp('shortcuts') · openHelp('route') · openHelp('tutorial')
//
// También acepta los nombres en castellano (glosario, atajos, recorrido). Abre y cambia de sección
// en el acto (flushSync): al volver, la sección ya está en la página (las pruebas la leen enseguida).
//
// Una sección devuelve su contenido en React (las de src/components/help/sections.tsx) o, si
// todavía no pasó, dibuja HTML en host (el glosario). Lo que dibuja React no lo traduce el DOM:
// los textos van con i18n.tr() o bw(), y el HTML de una sección tiene que llegar traducido.
//
// Este archivo no tiene efectos al cargar: se importa. Los globales (openHelp, registerHelpSection)
// y la tecla F1 están en help-center-wiring.ts.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useLanguage } from '../../react/mount.tsx';
import { bw, i18n } from '../../i18n/language.ts';
import { openSheetContent, openWorkWindow } from '../dialog/dialogs.tsx';
import { editor } from '../../core-api.ts';

export type HelpSectionId = 'tutorial' | 'glossary' | 'bibliography' | 'shortcuts' | 'route';

/** Una sección del centro de Ayuda. */
export interface HelpSection {
  id: HelpSectionId;
  /** Nombre en la navegación (en castellano: se traduce con LibroI18n.tr y su fila de i18n.ts). */
  label: string;
  /** Lugar en la navegación (de menor a mayor). */
  order: number;
  /**
   * Contenido de la sección para arg (por ejemplo, un término): un nodo de React, o nada si dibuja
   * HTML en host (ya traducido). Se vuelve a llamar con cada pedido; la que dibuja HTML, también
   * al cambiar el idioma (la de React se traduce sola, con useLanguage, sin perder su estado).
   */
  render: (host: HTMLElement, arg?: string) => ReactNode | void;
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
  bibliografia: 'bibliography',
};
const ordered = (): HelpSection[] => [...sections.values()].sort((a, b) => a.order - b.order);

// Estado: la sección pedida (y su argumento). nonce cambia con cada pedido, aunque sea el mismo.
let request: { section: string; arg?: string; nonce: number } = { section: 'tutorial', nonce: 0 };
/** El elemento de la Ventana: la Ayuda está abierta mientras sea la Ventana de React actual. */
let helpElement: ReactNode = null;
const helpOpen = () => helpElement !== null && openSheetContent() === helpElement;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const notify = () => {
  if (helpOpen()) flushSync(() => listeners.forEach((listener) => listener()));
};

/** Una sección: el HTML (si lo dibuja en host) o el nodo de React que devuelve. */
const SectionView = ({
  section,
  arg,
  nonce,
}: {
  section: HelpSection;
  arg?: string;
  nonce: number;
}) => {
  const language = useLanguage();
  const host = useRef<HTMLDivElement | null>(null);
  const [content, setContent] = useState<ReactNode>(null);
  /** La sección dibuja HTML (no devolvió React) y en qué idioma lo hizo. */
  const html = useRef<{ language: string } | null>(null);
  useLayoutEffect(() => {
    const element = host.current!;
    element.replaceChildren();
    const node = section.render(element, arg);
    html.current = node === undefined ? { language } : null;
    setContent(node === undefined ? null : (node as ReactNode));
    element.closest('.dialog-body')?.scrollTo(0, 0);
    // El idioma lo atiende abajo (sólo para HTML): una sección de React se traduce sola y no
    // pierde su estado (la búsqueda del glosario, el término elegido).
  }, [section, arg, nonce]);
  useLayoutEffect(() => {
    if (!html.current || html.current.language === language) return;
    html.current = { language };
    host.current!.replaceChildren();
    section.render(host.current!, arg);
  }, [section, arg, language]);
  return (
    <>
      <div ref={host} />
      {content}
    </>
  );
};

export const HelpCenter = () => {
  const current = useSyncExternalStore(subscribe, () => request);
  useLanguage();
  const section = sections.get(current.section)!;
  return (
    <div className="help-center">
      <nav className="help-nav" aria-label={i18n.tr('Secciones de la ayuda')}>
        {ordered().map((s) => (
          <button
            key={s.id}
            type="button"
            data-help-section={s.id}
            aria-current={s.id === current.section ? 'page' : undefined}
            onClick={() => openHelp(s.id)}
          >
            {i18n.tr(s.label)}
          </button>
        ))}
      </nav>
      <div id="helpPane" className="help-pane">
        <SectionView key={section.id} section={section} arg={current.arg} nonce={current.nonce} />
      </div>
    </div>
  );
};

/** Abre el centro de Ayuda en una sección (y, si la sección lo usa, en un término o paso). */
export function openHelp(section?: HelpSectionId | string, arg?: string): void {
  const wanted = section ? aliases[section] || section : request.section;
  const id = sections.has(wanted) ? wanted : ordered()[0]?.id;
  if (!id) return;
  request = { section: id, arg, nonce: request.nonce + 1 };
  // Ya abierto: sólo cambia de sección (no se vuelve a abrir la ventana).
  if (helpOpen()) return notify();
  // Como modal(): con una salida en curso no se abre nada.
  if (editor.busy) return;
  finishEditing();
  helpElement = <HelpCenter />;
  void openWorkWindow(helpElement, { title: bw('Aprender', 'Learn', 'Aprender') });
}

/** Suma una sección al centro de Ayuda. */
export function registerHelpSection(section: HelpSection): void {
  sections.set(section.id, section);
}
/** Vuelve a dibujar la sección abierta (si el centro de Ayuda está abierto). */
export function refreshHelp(): void {
  request = { ...request, nonce: request.nonce + 1 };
  notify();
}
/** El centro de Ayuda está abierto (y es la Ventana que se ve). */
export const helpIsOpen = (): boolean => helpOpen();
