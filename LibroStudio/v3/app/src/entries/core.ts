// core: lo que carga antes del núcleo (studio.ts): anfitrión, ventana, extensiones, modelo y los
// componentes de la interfaz (UI: studio.ts arma la barra y el riel al cargar).
// Fuente: se compila a build/core.js (desktop/scripts/build.mjs). El orden de los
// import es el orden de carga: cada módulo corre al importarse, como corría su <script> en index.html.

import '../host.ts';
import '../ui/window-controls.ts';
import '../extend.ts';
import '../test-registry.ts';
import '../model.ts';
import '../ui/components.ts';
