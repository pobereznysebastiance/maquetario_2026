// Compila el proceso principal y el preload de Electron con esbuild.
// La interfaz (LibroStudio/v3/app) no se compila: en desarrollo se carga
// directo desde su carpeta y al empaquetar se copia como recurso.
import { build } from 'esbuild';
import { cpSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
rmSync(join(root, 'dist'), { recursive: true, force: true });

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const licenseMode = pkg.maquetario?.licenseMode ?? 'enforce';
if (!['off', 'warn', 'enforce'].includes(licenseMode)) throw new Error(`licenseMode inválido: ${licenseMode}`);

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
  build({ ...common, entryPoints: [join(root, 'src/main/main.ts')], outfile: join(root, 'dist/main.cjs') }),
  build({ ...common, entryPoints: [join(root, 'src/preload/preload.ts')], outfile: join(root, 'dist/preload.cjs') }),
  build({ ...common, entryPoints: [join(root, 'src/preload/notice-preload.ts')], outfile: join(root, 'dist/notice-preload.cjs') }),
]);

// Avisos de sistema: página estática + ilustración del instalador + DM Sans de la interfaz.
const notice = join(root, 'dist/notice');
cpSync(join(root, 'src/notice'), notice, { recursive: true });
cpSync(join(root, 'assets/brand-art.jpg'), join(notice, 'brand-art.jpg'));
for (const weight of [400, 600, 700]) {
  const font = `DM-Sans-${weight}.ttf`;
  cpSync(join(root, '../LibroStudio/v3/app/fonts', font), join(notice, 'fonts', font));
}
