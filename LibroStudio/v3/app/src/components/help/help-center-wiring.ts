// Centro de Ayuda en la página: publica openHelp y registerHelpSection (help-center.tsx, que no
// tiene efectos al cargar) y abre la Ayuda con F1. Lo importa src/entries/app.ts en el lugar que
// tenía help-center.tsx.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { openSheetContent } from '../dialog/dialogs.tsx';
import { helpIsOpen, openHelp, registerHelpSection } from './help-center.tsx';

// Las usan las pruebas, las capturas de estilo y canvas-navigation.ts; los módulos las importan.
globalThis.registerHelpSection = registerHelpSection;
globalThis.openHelp = openHelp;

// La entrada fija ("Ayuda", #helpCenter) está en la barra superior (components/topbar/Topbar.tsx).
document.addEventListener('keydown', (e) => {
  if (e.key !== 'F1') return;
  e.preventDefault();
  // Con otro diálogo abierto no se lo reemplaza (se perdería lo que tenga sin aplicar).
  const other = !helpIsOpen() && openSheetContent() !== null;
  if (!other) openHelp();
});
