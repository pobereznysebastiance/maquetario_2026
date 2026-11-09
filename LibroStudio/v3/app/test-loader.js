// Pruebas de integración de la interfaz: sólo se cargan en la autoprueba (npm run self-test).
// Viven en tests/; el programa que se distribuye no las incluye (desktop/package.json → build.files).
// Se cargan en el mismo orden relativo que tenían en index.html; cada una envuelve a la anterior.
(function () {
  'use strict';
  const FILES = [
    // Las que antes vivían dentro de cada módulo, en el orden en que se cargaban los módulos.
    // studio-tests.js y fonts-tests.js definen la base (runIntegrationTests, runFontIntegrationTests):
    // van antes que las pruebas que la extienden.
    'studio-tests.js',
    'editorial-tests.js',
    'i18n-tests.js',
    'output-tests.js',
    'fonts-tests.js',
    'frame-handles-tests.js',
    'layout-tools-tests.js',
    'book-proof-tests.js',
    'cover-actions-tests.js',
    'panel-resize-tests.js',
    'cover-measurements-tests.js',
    'output-review-tests.js',
    'focus-layout-tests.js',
    'font-glyphs-tests.js',
    'inspector-organization-tests.js',
    'shapes-tests.js',
    'app-notices-tests.js',
    // Las que ya eran archivos aparte.
    'welcome-tests.js',
    'review-tests.js',
    'publications-tests.js',
    'readability-tests.js',
    'learning-tests.js',
    'font-browser-tests.js',
    'refinement-tests.js',
    'assistant-tests.js',
    'navigation-tests.js',
    'feedback-tests.js',
    'package-proof-tests.js',
    'document-view-tests.js',
    'category-tests.js',
  ].map((name) => 'tests/' + name);
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
          resolve(undefined);
        };
        document.body.append(script);
      });
    }
    // true: todas cargadas · 'missing': el paquete no trae pruebas (distribución).
    window.maquetarioTestsReady = missing === 0 ? true : 'missing';
  })();
})();
