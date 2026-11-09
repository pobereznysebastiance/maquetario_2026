// Inspector: registro de sus paneles y pausas. No tiene efectos al cargar: se importa.
//   registerInspectorPanel('pasada:sección', () => <Panel />, 'módulo')  →  el panel de esa sección.
//   pauseInspectorWhile(cond, 'módulo')  →  mientras cond() sea verdadera, el inspector no se redibuja.
//
// El inspector es un componente de React (components/inspector/Inspector.tsx) que arma las tres
// pestañas con las secciones registradas acá, en el orden de su tabla (SECTIONS). inspector()
// (src/core/inspector.ts) quedó como fachada: avisa que el estado cambió y React redibuja sólo lo que cambia.
// La pausa sobre inspector() (extend.around) está en inspector-registry-wiring.ts.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import type { ReactNode } from 'react';

/** Paneles de React por sección: 'pasada:sección' → render. */
const sectionPanels = new Map<string, () => ReactNode>();
/** El panel registrado para una sección, si lo hay. */
export const inspectorPanel = (id: string): (() => ReactNode) | undefined => sectionPanels.get(id);

/**
 * Panel de React de la sección 'pasada:sección' (por ejemplo 'design:grid'). Dónde va y con qué
 * marco (<section> con data-section y data-key) lo dice la tabla de components/inspector/Inspector.tsx.
 */
export function registerInspectorPanel(id: string, render: () => ReactNode, origin?: string): void {
  sectionPanels.set(id, render);
}

const pauses: { cond: () => unknown; origin: string }[] = [];
/** Mientras cond() sea verdadera, inspector() no redibuja. Devuelve la cantidad de pausas. */
export const pauseInspectorWhile = (cond: () => unknown, origin = ''): number =>
  pauses.push({ cond, origin });
/** Alguna pausa está activa (por ejemplo, mientras se ajusta un número de cornisa). */
export const inspectorPaused = (): boolean => pauses.some((p) => p.cond());
