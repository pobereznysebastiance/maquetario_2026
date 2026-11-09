// core: anfitrión, ventana, extensiones, modelo, estado del editor, componentes de marcado (UI) y
// el núcleo de la interfaz (src/core/), con su arranque al final.
// Fuente: se compila a build/core.js (desktop/scripts/build.mjs). El orden de los
// import es el orden de carga: cada módulo corre al importarse, como corría su <script> en index.html.

import '../host.ts';
import '../ui/window-controls.ts';
import '../extend.ts';
import '../test-registry.ts';
import '../model.ts';
import '../state/editor.ts';
import '../ui/components.ts';
// El núcleo: módulos sin efectos en src/core/ y su publicación (core-wiring.ts).
import '../core/core-wiring.ts';
// El arranque, último: oyentes, primer dibujo y aviso de listo.
import '../core/studio-wiring.ts';
