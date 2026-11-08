// Pruebas de integración de la interfaz: sólo se cargan en la autoprueba (npm run self-test).
// El programa que se distribuye no las incluye (desktop/package.json → build.files).
// Se cargan en el mismo orden relativo que tenían en index.html; cada una envuelve a la anterior.
(function () {
  'use strict';
  const FILES = ["welcome-tests.js","review-tests.js","publications-tests.js","readability-tests.js","learning-tests.js","font-browser-tests.js","refinement-tests.js","assistant-tests.js","navigation-tests.js","feedback-tests.js","package-proof-tests.js","document-view-tests.js","category-tests.js"];
  if (!window.MaquetarioHost || !MaquetarioHost.selfTest) return;
  (async () => {
    let missing = 0;
    for (const src of FILES) {
      await new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => {
          missing++;
          resolve();
        };
        document.body.append(script);
      });
    }
    // true: todas cargadas · 'missing': el paquete no trae pruebas (distribución).
    window.maquetarioTestsReady = missing === 0 ? true : 'missing';
  })();
})();
