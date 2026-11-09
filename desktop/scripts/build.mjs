// Compila con esbuild el proceso principal y el preload de Electron, y las fuentes TypeScript
// de la interfaz (LibroStudio/v3/app/src → app/build). El resto de la interfaz (los .js) se
// carga tal cual: en desarrollo desde su carpeta y al empaquetar se copia como recurso.
import { build } from 'esbuild';
import { cpSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
rmSync(join(root, 'dist'), { recursive: true, force: true });

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const licenseMode = pkg.maquetario?.licenseMode ?? 'enforce';
if (!['off', 'warn', 'enforce'].includes(licenseMode))
  throw new Error(`licenseMode inválido: ${licenseMode}`);

// Dónde está Motiova: producción en la app empaquetada; "dev" (Motiova local) en desarrollo.
const motiova = pkg.maquetario?.motiova;
const isUrl = (value) => typeof value === 'string' && /^https?:\/\/[^\s]+$/.test(value);
if (![motiova?.web, motiova?.api, motiova?.dev?.web, motiova?.dev?.api].every(isUrl)) {
  throw new Error('Falta maquetario.motiova (web, api, dev.web, dev.api) en desktop/package.json');
}

const common = {
  define: { __LICENSE_MODE__: JSON.stringify(licenseMode), __MOTIOVA__: JSON.stringify(motiova) },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  sourcemap: 'linked',
  external: ['electron'],
  logLevel: 'info',
};

await Promise.all([
  build({
    ...common,
    entryPoints: [join(root, 'src/main/main.ts')],
    outfile: join(root, 'dist/main.cjs'),
  }),
  build({
    ...common,
    entryPoints: [join(root, 'src/preload/preload.ts')],
    outfile: join(root, 'dist/preload.cjs'),
  }),
  build({
    ...common,
    entryPoints: [join(root, 'src/preload/notice-preload.ts')],
    outfile: join(root, 'dist/notice-preload.cjs'),
  }),
]);

// Interfaz: las fuentes TypeScript (LibroStudio/v3/app/src) se compilan a app/build, que carga
// index.html en este orden: terceros → build/core.js → build/app.js.
// - src/entries/*.ts son los puntos de entrada (core y app): importan los módulos de src/ en el
//   orden de carga. Cada módulo corre al importarse y mantiene privado lo suyo; lo que comparte
//   con los demás lo publica en globalThis (declare global).
// - El núcleo son módulos de src/core/ dentro
//   de build/core.js: lo que otros leen por nombre lo publica src/core/core-wiring.ts.
// - React y Radix (etapa 3) se empaquetan dentro de build/app.js: JSX automático (archivos .tsx
//   en src/components/ y src/react/) y React en modo producción. Con MAQUETARIO_REACT_DEV=1 se
//   arma con el React de desarrollo (avisos y comprobaciones en la consola, más pesado).
const ui = join(root, '../LibroStudio/v3/app');
rmSync(join(ui, 'build'), { recursive: true, force: true });
const uiOptions = {
  outdir: join(ui, 'build'),
  platform: 'browser',
  target: 'chrome140',
  charset: 'utf8',
  sourcemap: 'linked',
  logLevel: 'info',
  jsx: 'automatic',
  define: {
    'process.env.NODE_ENV': JSON.stringify(
      process.env.MAQUETARIO_REACT_DEV ? 'development' : 'production',
    ),
  },
};
const tsIn = (dir) =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    .map((f) => join(dir, f));
await build({
  ...uiOptions,
  entryPoints: tsIn(join(ui, 'src/entries')),
  bundle: true,
  format: 'iife',
});
// - src/modules/*.ts son módulos ES que la app carga a pedido con import() (build/<nombre>.mjs).
//   Hoy, el motor de composición (etapa 4, detrás de una llave: src/compose-loader.ts), con
//   HarfBuzz en WASM: harfbuzz.wasm va al lado, donde lo busca (new URL(…, import.meta.url)).
await build({
  ...uiOptions,
  entryPoints: tsIn(join(ui, 'src/modules')),
  bundle: true,
  format: 'esm',
  outExtension: { '.js': '.mjs' },
  // harfbuzz.js importa "module" sólo cuando corre en Node; en la página ese camino no se usa.
  external: ['module'],
});
cpSync(
  join(dirname(fileURLToPath(import.meta.resolve('harfbuzzjs'))), 'harfbuzz.wasm'),
  join(ui, 'build', 'harfbuzz.wasm'),
);
// El recorte de fuentes del PDF propio (desktop/src/main/font-subset.ts) lo lee el proceso
// principal de la carpeta de la interfaz, que va en el instalador.
cpSync(
  join(dirname(fileURLToPath(import.meta.resolve('harfbuzzjs'))), 'harfbuzz-subset.wasm'),
  join(ui, 'build', 'harfbuzz-subset.wasm'),
);

// Perfiles ICC de la salida PDF/X-4 (src/main/pdfx.ts; licencias en assets/icc/LICENCIAS.md).
cpSync(join(root, 'assets/icc'), join(root, 'dist/icc'), { recursive: true });

// Avisos de sistema: página estática + ilustración del instalador + DM Sans y tokens de la
// interfaz (los mismos archivos de ui/tokens, en notice/ui/tokens: fonts.css apunta a
// ../../fonts, que queda en notice/fonts). También los usa la página que ve el navegador al
// volver de Motiova (motiova/callback-page.ts).
const notice = join(root, 'dist/notice');
cpSync(join(root, 'src/notice'), notice, { recursive: true });
cpSync(join(root, 'assets/brand-art.jpg'), join(notice, 'brand-art.jpg'));
cpSync(join(ui, 'maquetario.svg'), join(notice, 'maquetario.svg'));
for (const weight of [400, 500, 600, 700]) {
  const font = `DM-Sans-${weight}.ttf`;
  cpSync(join(ui, 'fonts', font), join(notice, 'fonts', font));
}
for (const sheet of ['fonts', 'primitives', 'semantic', 'contract']) {
  cpSync(join(ui, 'ui/tokens', `${sheet}.css`), join(notice, 'ui/tokens', `${sheet}.css`));
}
