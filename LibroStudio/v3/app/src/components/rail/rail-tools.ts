// Registro de las herramientas del riel izquierdo (#tools). El riel lo dibuja React (Rail.tsx);
// los módulos no agregan botones al DOM: registran su herramienta con registerTool().
//
//   registerTool({ tool: 'hand', id: 'handTool', icon: 'hand', label: () => bw('Mano', …),
//                  shortcut: 'H', after: 'select', onSelect: () => … });
//
// - tool: el nombre de la herramienta (data-tool, el global tool, setTool). Sin tool es una vista
//   o una acción del riel (Índice, Capas, Cubierta): nunca queda marcada como activa.
// - id: el id del botón (#handTool, #shapeTool, #indexTool…), si otros lo buscan.
// - label y title son funciones: se evalúan al dibujar, en el idioma actual. title, si falta,
//   es el nombre.
// - shortcut: la tecla que se muestra; '' deja el lugar vacío y null no lo dibuja. Los atajos en
//   sí los atiende cada módulo (src/core/studio-wiring.ts: V T I F; canvas-navigation.ts: H).
// - after: la clave (tool o id) de la herramienta tras la cual va; sin after, al final.
// - onSelect: qué hace el clic; si falta, setTool(tool).
//
// El registro (sin efectos al cargar, se importa) está en rail-registry.ts. Este módulo carga
// primero (src/entries/app.ts), antes que los módulos que registran; las herramientas del núcleo
// (Seleccionar, Crear texto, Imagen…) se registran acá mismo, y publica registerTool para los
// archivos del lienzo.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { bw, i18n } from '../../i18n/language.ts';
import { registerTool, type RailTool } from './rail-registry.ts';

export type { RailTool } from './rail-registry.ts';

declare global {
  /** Suma una herramienta al riel izquierdo (ver src/components/rail/rail-registry.ts). */
  var registerTool: (spec: RailTool) => void;
}

globalThis.registerTool = registerTool;

// Herramientas del núcleo (src/core/tools.ts: setTool). Los nombres van en castellano y se traducen al
// dibujar (src/i18n.ts); "Texto" tiene su texto propio. En el riel van sólo las herramientas que
// actúan sobre la página: la grilla, el foliado y la cornisa son ajustes del libro (pestaña Libro),
// Índice y Capas son vistas del riel (junto a Páginas) y la Cubierta está en la barra del documento.
const tr = (text: string) => (globalThis.LibroI18n ? i18n.tr(text) : text);
const textTitle = () => bw('Crear caja de texto', 'Create a text frame', 'Criar caixa de texto');
for (const spec of [
  { tool: 'select', icon: 'select', label: () => tr('Seleccionar'), shortcut: 'V' },
  {
    tool: 'text',
    icon: 'text',
    label: () => bw('Texto', 'Text', 'Texto'),
    title: textTitle,
    shortcut: 'T',
  },
  { tool: 'image', icon: 'image', label: () => tr('Imagen'), shortcut: 'I' },
  { tool: 'frame', icon: 'frame', label: () => tr('Marco'), shortcut: 'F' },
] satisfies RailTool[])
  registerTool(spec);
