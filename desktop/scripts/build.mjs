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
// index.html en este orden: terceros → build/core.js → build/studio.js → build/app.js.
// - src/entries/*.ts son los puntos de entrada (core y app): importan los módulos de src/ en el
//   orden de carga. Cada módulo corre al importarse y mantiene privado lo suyo; lo que comparte
//   con los demás lo publica en globalThis (declare global).
// - src/global/*.ts son scripts globales (sin import/export) y se compilan sin envoltorio:
//   esbuild sólo les saca los tipos, así sus let/const/function de nivel superior siguen siendo
//   globales como en un .js clásico (studio.ts: book, render, $…, que otros archivos asignan y
//   extienden por nombre). Van al mismo build/: no repetir nombres con las entradas.
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
await build({ ...uiOptions, entryPoints: tsIn(join(ui, 'src/global')), bundle: false });

// Avisos de sistema: página estática + ilustración del instalador + DM Sans de la interfaz.
const notice = join(root, 'dist/notice');
cpSync(join(root, 'src/notice'), notice, { recursive: true });
cpSync(join(root, 'assets/brand-art.jpg'), join(notice, 'brand-art.jpg'));
for (const weight of [400, 600, 700]) {
  const font = `DM-Sans-${weight}.ttf`;
  cpSync(join(root, '../LibroStudio/v3/app/fonts', font), join(notice, 'fonts', font));
}
