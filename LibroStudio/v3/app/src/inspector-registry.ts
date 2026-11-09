// Inspector: registro de sus paneles y pausas.
//   registerInspectorPanel('pasada:sección', () => <Panel />, 'módulo')  →  el panel de esa sección.
//   pauseInspectorWhile(cond, 'módulo')  →  mientras cond() sea verdadera, el inspector no se redibuja.
//
// El inspector es un componente de React (components/inspector/Inspector.tsx) que arma las tres
// pestañas con las secciones registradas acá, en el orden de su tabla (SECTIONS). inspector() de
// studio.ts quedó como fachada: avisa que el estado cambió y React redibuja sólo lo que cambia.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import type { ReactNode } from 'react';

declare global {
  /**
   * Panel de React de la sección 'pasada:sección' (por ejemplo 'design:grid'). Dónde va y con qué
   * marco (<section> con data-section y data-key) lo dice la tabla de components/inspector/Inspector.tsx.
   */
  var registerInspectorPanel: (id: string, render: () => ReactNode, origin?: string) => void;
  /** Mientras cond() sea verdadera, inspector() no redibuja. Devuelve la cantidad de pausas. */
  var pauseInspectorWhile: (cond: () => unknown, origin?: string) => number;
}

/** Paneles de React por sección: 'pasada:sección' → render. */
const sectionPanels = new Map<string, () => ReactNode>();
/** El panel registrado para una sección, si lo hay. */
export const inspectorPanel = (id: string): (() => ReactNode) | undefined => sectionPanels.get(id);

globalThis.registerInspectorPanel = (id, render) => {
  sectionPanels.set(id, render);
};

const pauses: { cond: () => unknown; origin: string }[] = [];
globalThis.pauseInspectorWhile = (cond, origin = '') => pauses.push({ cond, origin });
/** Alguna pausa está activa (por ejemplo, mientras se ajusta un número de cornisa). */
export const inspectorPaused = (): boolean => pauses.some((p) => p.cond());

// Mientras haya una pausa, inspector() no hace nada (el componente, además, conserva lo que
// muestra aunque llegue otro aviso del estado: ver Inspector.tsx).
extend.around(
  'inspector',
  (draw) =>
    function () {
      if (!inspectorPaused()) draw();
    },
  'inspector-registry',
);

export {};
