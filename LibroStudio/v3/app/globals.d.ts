// Globales que comparten los scripts de la interfaz (etapa 2: tipos sobre el JS actual).
// Cada script las define con `window.X = …`; acá se declaran para que el chequeo de tipos las vea.
// Por ahora casi todas son `any`: se van tipando a medida que cada archivo pasa a TypeScript.
// Las que ya están en src/*.ts se declaran allí (declare global), con su tipo real.
// Un `declare var` sirve a la vez para `X` y para `window.X`.

/* eslint-disable no-var */

// Lo que devuelven $() y $(): un elemento de la interfaz. Lo propio de HTMLElement queda tipado;
// lo de cada clase de control (value, checked, showModal…) queda libre hasta tipar cada llamada.
type UIElement = HTMLElement & { [key: string]: any };

// ── Sistema de componentes (ui/) ──
declare var UI: any;
declare var dialogVariant: (name: string) => void;
declare var onDialogClose: (fn: () => void) => void;

// ── Modelo, idioma y anfitrión ──
declare var chrome: any;

// ── Fuentes y separación silábica ──
declare var fontLibraryReady: any;
declare var createHyphenator: any;
declare var hyphenationPatternsEs: any;
declare var hyphenationPatternsEnUs: any;
declare var hyphenationPatternsPt: any;
declare var PDFLib: any;

// ── Salida y autoprueba (las llama desktop/src/main/selftest.ts) ──
declare var outputReady: any;
declare var fontOutputReady: any;
declare var shapeOutputReady: any;
declare var maquetarioSelfTest: boolean;
declare var maquetarioTestsReady: true | 'missing' | undefined;
declare var prepareBlankCreatePreview: any;
declare var prepareGlassShapePreview: any;
declare var prepareObjectOrganizationPreview: any;

interface Navigator {
  windowControlsOverlay?: any;
}
