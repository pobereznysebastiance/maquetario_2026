// Pruebas de integración de la interfaz: sólo se cargan en la autoprueba (npm run self-test).
// Viven en tests/; el programa que se distribuye no las incluye (desktop/package.json → build.files).
// Se cargan en el mismo orden relativo que tenían en index.html; cada una envuelve a la anterior.
//
// Qué usan las pruebas de la página:
// - el estado del editor sólo por window.maquetarioEditor (book, active, selected, tool…: el
//   objeto de src/state/editor.ts), nunca por el nombre suelto;
// - el resto de los globales que leen o asignan lo lista `node scripts/globals-report.mjs`
//   (columna "pruebas leen/asignan").
// Lo que la autoprueba les pide a las pruebas va por window.maquetarioTests (abajo).
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
  // Lo que llama la autoprueba (desktop/src/main/selftest.ts). Tiene que coincidir con
  // MaquetarioTestsApi (src/contract/page-contract.ts): lo controla scripts/globals-report.mjs.
  const TESTS_API = [
    'runIntegrationTests',
    'runFontIntegrationTests',
    'runAssistantTests',
    'runNavigationTests',
    'runNoticeTests',
    'prepareMarkedOutputTest',
    'prepareFontPdfTest',
    'prepareParagraphPdfTest',
    'prepareCoverProof',
    'preparePackageProof',
    'prepareOutputReviewPreview',
    'prepareFontBrowserPreview',
    'prepareAssistantPreview',
    'prepareGlossaryPreview',
  ];
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
    // El contrato con la autoprueba (MaquetarioTestsApi en src/contract/page-contract.ts): el
    // proceso principal llama a las pruebas sólo por este objeto. Cada función llama al global en
    // el momento (las pruebas se envuelven unas a otras). ready: true si se cargaron todas,
    // 'missing' si el paquete no trae pruebas (distribución).
    const api = { ready: missing === 0 ? true : 'missing' };
    for (const name of TESTS_API) api[name] = (...args) => window[name](...args);
    // Las funciones se suman por nombre (TESTS_API): el tipo lo da el contrato.
    window.maquetarioTests = /** @type {any} */ (Object.freeze(api));
  })();
})();
