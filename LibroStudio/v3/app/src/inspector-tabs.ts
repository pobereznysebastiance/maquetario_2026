// Nombres de pestaña del inspector: los viejos (design, text, object…) y los nuevos (book, page,
// selection), y las vistas del riel que se piden como pestaña. No tiene efectos al cargar: se
// importa. Las vistas en la página están en inspector-views.tsx.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import type { InspectorView } from './components/inspector/Inspector.tsx';

/** Nombre de pestaña (viejo o nuevo) → pestaña visible. */
export const VIEWS: Record<string, InspectorView> = {
  book: 'book',
  design: 'book',
  page: 'page',
  pages: 'page',
  selection: 'selection',
  text: 'selection',
  object: 'selection',
};
/** Las vistas del riel que también se piden como pestaña. */
export const isRailTab = (name: string): name is 'structure' | 'index' | 'layers' =>
  name === 'structure' || name === 'index' || name === 'layers';

/** Pestaña (o vista del riel) que corresponde a un nombre de pestaña, viejo o nuevo. */
export const inspectorTabFor = (name: string): string =>
  isRailTab(name) ? name : VIEWS[name] || 'book';
