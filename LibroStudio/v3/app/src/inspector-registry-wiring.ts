// Mientras haya una pausa del inspector (pauseInspectorWhile, inspector-registry.ts), inspector()
// no hace nada (el componente, además, conserva lo que muestra aunque llegue otro aviso del estado:
// ver Inspector.tsx). Lo importa src/entries/app.ts en el lugar que tenía inspector-registry.ts,
// así el orden de las extensiones no cambia.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { inspectorPaused } from './inspector-registry.ts';

extend.around(
  'inspector',
  (draw) =>
    function () {
      if (!inspectorPaused()) draw();
    },
  'inspector-registry',
);
