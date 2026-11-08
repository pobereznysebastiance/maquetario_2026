// Control del sistema de diseño (npm run lint:design).
// 1. Falla si una hoja de ui/ (fuera de ui/tokens) usa un color, o una medida en px
//    en una propiedad común, en vez de un token. Definir una variable (--x: 12px) sí se permite
//    para geometría local; los colores sólo pueden nacer en ui/tokens.
// 2. Informa cuánto CSS queda en la capa legacy, para ver que baja con cada entrega.
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
      if (COLOR.test(value)) problems.push(`${where}  color literal en "${property}" (usá un token de ui/tokens)`);
      else if (!property.startsWith('--') && PX.test(value)) problems.push(`${where}  medida literal en "${property}" (usá un token)`);
    }
  });
}

const legacyFiles = readdirSync(app).filter((f) => f.endsWith('.css'));
const legacyBytes = legacyFiles.reduce((sum, f) => sum + statSync(join(app, f)).size, 0);
const legacyColors = legacyFiles.reduce(
  (sum, f) => sum + (readFileSync(join(app, f), 'utf8').match(/#[0-9a-f]{3,8}\b|rgba?\(/gi) ?? []).length,
  0,
);

console.log(`Legacy: ${legacyFiles.length} hojas, ${(legacyBytes / 1024).toFixed(1)} KB, ${legacyColors} colores literales.`);
if (problems.length) {
  console.error(`\n${problems.length} valores sueltos en el sistema de diseño:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('Sistema de diseño: sin valores sueltos.');

// ── Deuda de "alambre" (informativa: tiene que bajar en cada entrega) ──
const appJs = readdirSync(app).filter((f) => f.endsWith('.js') && f !== 'pdf-lib.min.js' && f !== 'sample-image.js');
const allJs = appJs.map((f) => readFileSync(join(app, f), 'utf8')).join('\n');
const legacyCss = legacyFiles.map((f) => readFileSync(join(app, f), 'utf8')).join('\n');
const count = (text, re) => (text.match(re) ?? []).length;
const debt = {
  'funciones globales reemplazadas por otro módulo (const x=f; f=function…)': count(
    allJs,
    /(?:const|let)\s+\w+\s*=\s*(?:window\.)?(\w+)\s*;\s*(?:window\.)?\1\s*=\s*(?:async\s*)?function/g,
  ),
  'cadenas de onchange sobre #language': count(allJs, /\$\('#language'\)\.onchange\s*=\s*function/g),
  'anchos fijos en px en el CSS legacy (width/min-width)': count(legacyCss, /(?:^|[;{\s])(?:min-)?width:\s*\d+px/g),
  '!important en el CSS legacy': count(legacyCss, /!important/g),
  'estilos inline desde JS (style= / .style.x=)': count(allJs, /style="|\.style\.[a-zA-Z]+\s*=/g),
};
console.log('\nDeuda pendiente (tiene que bajar):');
for (const [what, n] of Object.entries(debt)) console.log(`  ${String(n).padStart(4)}  ${what}`);
