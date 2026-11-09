// Vistas del riel en React: Índice y Capas, montadas en #railView (etapa 3, D2, paso 9 del plan del
// inspector). Antes se dibujaban con la cadena del inspector (tab = 'index' / 'layers') desde una
// envoltura de inspector() y se pasaban al riel en cada dibujo; ahora son componentes propios.
//
// La vista elegida la lleva inspector-views.ts (showRailView / currentRailView), que avisa con
// notifyEditorState(); el contenido de cada vista lo registra su módulo (rail-views.ts). Se
// redibuja con cada aviso del núcleo (useEditorState) y con el idioma (useLanguage).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import type { Root } from 'react-dom/client';
import { mount, useLanguage } from '../../react/mount.tsx';
import { useEditorState } from '../../react/editor-state.ts';
import { railView } from './rail-views.ts';

const RailViews = () => {
  useEditorState();
  useLanguage();
  const render = railView(currentRailView());
  return render ? <>{render()}</> : null;
};

let root: Root | null = null;

/** Monta las vistas del riel en host (una sola vez; después se redibujan con los avisos). */
export function mountRailViews(host: Element): void {
  if (!root) root = mount(host, <RailViews />, { sync: true });
}
