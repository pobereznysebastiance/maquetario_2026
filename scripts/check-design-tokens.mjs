// Control del sistema de diseño (npm run lint:design).
// 1. Falla si una hoja de ui/ (fuera de ui/tokens) usa un color, o una medida en px
//    en una propiedad común, en vez de un token. Definir una variable (--x: 12px) sí se permite
//    para geometría local; los colores sólo pueden nacer en ui/tokens.
// 2. Falla si vuelve a aparecer una hoja suelta fuera de ui/ (la capa legacy ya se vació).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const app = join(import.meta.dirname, '..', 'LibroStudio', 'v3', 'app');
const ui = join(app, 'ui');
const tokens = join(ui, 'tokens');

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.css') ? [path] : [];
  });

const COLOR = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|lab|lch)\(/i;
const PX = /(?<![\w-])(?!0px)\d*\.?\d+px\b/;
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

const problems = [];
for (const file of walk(ui)) {
  if (file.startsWith(tokens)) continue;
  const lines = stripComments(readFileSync(file, 'utf8')).split('\n');
  lines.forEach((line, i) => {
    for (const declaration of line.split(';')) {
      const colon = declaration.indexOf(':');
      if (colon < 0) continue;
      const property = declaration.slice(0, colon).trim().split(/[\s{]/).pop() ?? '';
      const value = declaration.slice(colon + 1);
      if (/^\[|^:/.test(property) || value.includes('{')) continue;
      const where = `${relative(app, file)}:${i + 1}`;
      if (COLOR.test(value))
        problems.push(`${where}  color literal en "${property}" (usá un token de ui/tokens)`);
      else if (!property.startsWith('--') && PX.test(value))
        problems.push(`${where}  medida literal en "${property}" (usá un token)`);
    }
  });
}

const looseSheets = readdirSync(app).filter((f) => f.endsWith('.css'));
for (const f of looseSheets)
  problems.push(`${f}  hoja fuera de ui/ (cada estilo va en su capa: book, tokens, base, átomos…)`);
if (problems.length) {
  console.error(
    `\n${problems.length} valores sueltos en el sistema de diseño:\n  ${problems.join('\n  ')}`,
  );
  process.exit(1);
}
console.log('Sistema de diseño: sin valores sueltos.');

// ── Deuda de "alambre" (informativa: tiene que bajar en cada entrega) ──
// El código propio de la interfaz: los .js de la carpeta y las fuentes TypeScript de src/ y de
// src/global/ (los scripts globales, como studio.ts).
const tsIn = (dir) =>
  readdirSync(join(app, dir))
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    .map((f) => join(dir, f));
const appJs = [
  ...readdirSync(app).filter(
    (f) => f.endsWith('.js') && f !== 'pdf-lib.min.js' && f !== 'sample-image.js',
  ),
  ...tsIn('src'),
  ...tsIn(join('src', 'global')),
  ...tsIn(join('src', 'ui')),
];
// Sin las líneas de comentario: los ejemplos de la documentación no cuentan como deuda.
const allJs = appJs
  .map((f) => readFileSync(join(app, f), 'utf8'))
  .join('\n')
  .split('\n')
  .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
  .join('\n');
const count = (text, re) => (text.match(re) ?? []).length;
/** Fuentes TypeScript de un directorio y sus subdirectorios (sin .d.ts). */
const walkSource = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walkSource(path);
    return /\.tsx?$/.test(name) && !name.endsWith('.d.ts') ? [path] : [];
  });
// Lo mismo sin src/ui/components.ts: ahí el marcado de los componentes es legítimo.
const componentJs = appJs
  .filter((f) => f !== join('src', 'ui', 'components.ts'))
  .map((f) => readFileSync(join(app, f), 'utf8'))
  .join('\n')
  .split('\n')
  .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
  .join('\n');
const debt = {
  'funciones globales reemplazadas a mano (sin extend)': count(
    allJs,
    /(?:const|let)\s+\w+\s*=\s*(?:window\.)?(\w+)\s*;\s*(?:window\.)?\1\s*=\s*(?:async\s*)?function/g,
  ),
  // f = function … en el nivel superior: reemplaza la función global sin pasar por extend
  // (y pisa las extensiones registradas antes). Va con extend.replace o extend.result/after/…
  'funciones globales reasignadas (f = function)': count(
    allJs,
    /^[a-zA-Z_$][\w$]* = (?:async )?function\b/gm,
  ),
  // extend('f', anterior => …) con la envoltura escrita a mano. Lo que tiene forma de
  // antes/después/resultado/ruta va con extend.before/after/result/instead o con los registros.
  'envolturas extend() escritas a mano': count(allJs, /\bextend\(\s*'\w+',\s*\(?\w+\)?\s*=>/g),
  'cadenas de onchange sobre #language': count(
    allJs,
    /\$\('#language'\)\.onchange\s*=\s*function/g,
  ),
  'estilos inline desde JS (style= / .style.x=)': count(allJs, /style="|\.style\.[a-zA-Z]+\s*=/g),
  // Botones escritos a mano en cadenas (class="btn…", <button …>) en lugar de UI.* de
  // src/ui/components.ts, que es el único lugar donde vive su marcado (etapa 3, D2).
  'HTML de componentes a mano (class="btn / <button en cadenas)': count(
    componentJs,
    /class="btn\b|<button\b/g,
  ),
  "botones creados a mano (createElement('button'))": count(
    componentJs,
    /createElement\('button'\)/g,
  ),
  // Etapa 2, parte B: lo que un módulo publica en globalThis en lugar de exportarlo. Cuenta
  // nombres distintos en todo src/ (también .tsx). El detalle, con quién lee y quién asigna cada
  // uno: node scripts/globals-report.mjs.
  'globales publicados por módulos (globalThis.x =)': new Set(
    walkSource(join(app, 'src'))
      .map((f) => readFileSync(f, 'utf8'))
      .flatMap((text) => [...text.matchAll(/(?:globalThis|window)\.([\w$]+)\s*=(?!=)/g)])
      .map((m) => m[1]),
  ).size,
};
console.log('\nDeuda pendiente (tiene que bajar):');
for (const [what, n] of Object.entries(debt)) console.log(`  ${String(n).padStart(4)}  ${what}`);
