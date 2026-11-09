// Publica loadOpenedProject (project-package.tsx, sin efectos al cargar): lo llaman src/core/project-file.ts (Abrir)
// y el proceso principal. Lo importa src/entries/app.ts en el lugar que tenía project-package.tsx.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { loadOpenedProject } from './project-package.tsx';

globalThis.loadOpenedProject = loadOpenedProject;
