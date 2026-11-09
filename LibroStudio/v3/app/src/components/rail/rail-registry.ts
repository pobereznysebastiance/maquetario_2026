// Registro de las herramientas del riel izquierdo (#tools): la lista, los avisos a Rail.tsx y
// registerTool / refreshRail. No tiene efectos al cargar: se importa. El formato de cada
// herramienta y las del núcleo están en rail-tools.ts.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { flushSync } from 'react-dom';

export interface RailTool {
  tool?: string;
  id?: string;
  icon: string;
  label: () => string;
  title?: () => string;
  shortcut?: string | null;
  after?: string;
  onSelect?: () => void;
}

const keyOf = (spec: RailTool): string => spec.tool ?? spec.id ?? '';

let tools: readonly RailTool[] = [];
let mounted = false;
const listeners = new Set<() => void>();

export const railToolsSnapshot = (): readonly RailTool[] => tools;
export const subscribeRailTools = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
/** Lo llama Rail.tsx al montarse: desde ahí, cada cambio se dibuja en el acto. */
export function railMounted(): void {
  mounted = true;
}
const emit = (): void => {
  const notify = () => listeners.forEach((listener) => listener());
  // Como un módulo que agregaba su botón: al volver, el botón ya está en la página.
  if (mounted) flushSync(notify);
  else notify();
};

/** Suma una herramienta al riel izquierdo (ver rail-tools.ts). */
export function registerTool(spec: RailTool): void {
  const list = tools.filter((t) => keyOf(t) !== keyOf(spec));
  const index = spec.after ? list.findIndex((t) => keyOf(t) === spec.after) : -1;
  if (index >= 0) list.splice(index + 1, 0, spec);
  else list.push(spec);
  tools = list;
  emit();
}
/** Vuelve a dibujar el riel (por ejemplo, cuando cambia el set de íconos). */
export function refreshRail(): void {
  tools = [...tools];
  emit();
}
