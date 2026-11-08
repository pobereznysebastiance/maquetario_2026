// Registro de pruebas de integración. Cada módulo declara su prueba en lugar de envolver a mano
// las funciones que corre la autoprueba (desktop/src/main/selftest.ts).
//   registerIntegrationTest(fn, 'módulo')  →  fn(resultado) agrega verificaciones y lo devuelve.
//   registerNavigationTest(fn, 'módulo')   →  ídem para runNavigationTests (puede ser async).
//   registerFontTest(fn, 'módulo')         →  ídem para runFontIntegrationTests (puede ser async).
// Corren en orden de carga, después de las pruebas ya registradas.
(function () {
  'use strict';
  // runIntegrationTests devuelve el resultado como JSON (así lo lee la autoprueba).
  window.registerIntegrationTest = (fn, origin = '') =>
    extend.result('runIntegrationTests', (json) => JSON.stringify(fn(JSON.parse(json))), origin);
  window.registerNavigationTest = (fn, origin = '') =>
    extend.result('runNavigationTests', async (pending) => fn(await pending), origin);
  window.registerFontTest = (fn, origin = '') =>
    extend.result('runFontIntegrationTests', async (pending) => fn(await pending), origin);
})();
