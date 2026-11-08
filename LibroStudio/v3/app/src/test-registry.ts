// Registro de pruebas de integración. Cada prueba (tests/*.js) declara su verificación en lugar de
// envolver a mano las funciones que corre la autoprueba (desktop/src/main/selftest.ts).
//   registerIntegrationTest(fn, 'módulo')  →  fn(resultado) agrega verificaciones y lo devuelve.
//   registerNavigationTest(fn, 'módulo')   →  ídem para runNavigationTests (puede ser async).
//   registerFontTest(fn, 'módulo')         →  ídem para runFontIntegrationTests (puede ser async).
// Corren en orden de carga, después de las pruebas ya registradas.
// Fuente TypeScript: se compila a build/test-registry.js (desktop/scripts/build.mjs).

/** Resultado que va armando cada suite: verificaciones cumplidas y, si algo falla, el error. */
export interface TestResult {
  ok?: boolean;
  checks: string[];
  error?: string;
  [extra: string]: unknown;
}
type Check = (result: TestResult) => TestResult | Promise<TestResult>;

declare global {
  var registerIntegrationTest: (fn: (result: TestResult) => TestResult, origin?: string) => void;
  var registerNavigationTest: (fn: Check, origin?: string) => void;
  var registerFontTest: (fn: Check, origin?: string) => void;
}

// runIntegrationTests devuelve el resultado como JSON (así lo lee la autoprueba).
globalThis.registerIntegrationTest = (fn, origin = '') =>
  extend.result(
    'runIntegrationTests',
    (json: string) => JSON.stringify(fn(JSON.parse(json))),
    origin,
  );
globalThis.registerNavigationTest = (fn, origin = '') =>
  extend.result(
    'runNavigationTests',
    async (pending: Promise<TestResult>) => fn(await pending),
    origin,
  );
globalThis.registerFontTest = (fn, origin = '') =>
  extend.result(
    'runFontIntegrationTests',
    async (pending: Promise<TestResult>) => fn(await pending),
    origin,
  );
