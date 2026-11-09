// Registro de las vistas del riel izquierdo que no son las miniaturas (Índice y Capas): cada
// módulo registra la suya (editorial.ts → index, layout-tools.ts → layers) y RailViews.tsx la
// dibuja en #railView cuando inspector-views.tsx la elige con showRailView.
//
// Es un módulo sin efectos ni dependencias de React en tiempo de ejecución: lo importan módulos
// que cargan temprano sin adelantar la carga de nada más.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import type { ReactNode } from 'react';

export type RailViewName = 'index' | 'layers';

const views = new Map<RailViewName, () => ReactNode>();

/** Registra el contenido de una vista del riel. */
export function registerRailView(name: RailViewName, render: () => ReactNode): void {
  views.set(name, render);
}

/** El contenido de una vista registrada (o undefined). */
export const railView = (name: string): (() => ReactNode) | undefined =>
  views.get(name as RailViewName);
