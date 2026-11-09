// Contrato de tokens (D5): lee tokens.json y genera LibroStudio/v3/app/ui/tokens/contract.css.
//
//   node scripts/build.mjs           genera contract.css
//   node scripts/build.mjs --check   falla si contract.css no está al día o si un $value de
//                                    tokens.json no coincide con el valor real de Maquetario
//                                    (primitives.css + semantic.css)
//   node scripts/build.mjs --sync    copia a tokens.json los valores actuales de Maquetario
//                                    (después de cambiar semantic.css) y genera contract.css
//
// Cada token del contrato apunta a un token de Maquetario ($extensions.maquetario.var). En el CSS
// generado, el nombre común (--background, --primary…) es un alias de ese token: no hay valores
// sueltos, así que cambiar un color sigue siendo cambiar semantic.css. Los tokens cuyo nombre ya
// es el de Maquetario (--material-sidebar, --type-body…) no se repiten, y los marcados con
// "emit": false (choque de nombres) tampoco.
//
// Sin dependencias: sólo node.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, '..');
const repo = join(pkg, '..', '..');
const tokensDir = join(repo, 'LibroStudio', 'v3', 'app', 'ui', 'tokens');
const output = join(tokensDir, 'contract.css');
const check = process.argv.includes('--check');
const sync = process.argv.includes('--sync');
const source = join(pkg, 'tokens.json');

const contract = JSON.parse(readFileSync(source, 'utf8'));

// ── Tokens del contrato: hojas con $value (las claves que empiezan con $ son del formato) ──
/** @returns {{ name: string, group: string, token: any }[]} */
function leaves(node, group = '') {
  return Object.entries(node)
    .filter(([key]) => !key.startsWith('$'))
    .flatMap(([key, value]) =>
      value && typeof value === 'object' && '$value' in value
        ? [{ name: key, group, token: value }]
        : leaves(value, group || key),
    );
}
const tokens = leaves(contract);

// ── Valores reales de Maquetario: declaraciones de :root y body en primitives y semantic ──
// Sólo los bloques base (no los de @media, :root[data-material] ni body.ui-large): son los
// valores por defecto, los mismos que se anotan en tokens.json.
function declarations(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const found = new Map();
  let depth = 0;
  let selector = '';
  let start = 0;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (c === '{') {
      if (depth === 0) {
        selector = clean.slice(start, i).trim();
        start = i + 1;
      }
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) {
        if (selector === ':root' || selector === 'body') {
          const body = clean.slice(start, i);
          for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
            if (!found.has(m[1])) found.set(m[1], { value: m[2].trim(), scope: selector });
          }
        }
        start = i + 1;
      }
    }
  }
  return found;
}
const defined = new Map([
  ...declarations(readFileSync(join(tokensDir, 'primitives.css'), 'utf8')),
  ...declarations(readFileSync(join(tokensDir, 'semantic.css'), 'utf8')),
]);

/** Valor final de un token de Maquetario, con los var() resueltos y la escala de interfaz en 1. */
function resolve(name, seen = new Set()) {
  const entry = defined.get(name);
  if (!entry) throw new Error(`${name} no está definido en primitives.css ni en semantic.css`);
  if (seen.has(name)) throw new Error(`referencia circular en ${name}`);
  seen.add(name);
  const value = entry.value
    .replace(/var\((--[\w-]+)\)/g, (_, inner) => resolve(inner, new Set(seen)))
    .replace(/\s+/g, ' ');
  // calc(13px * 1): el rol tipográfico con --ui-scale en 1 (modo Cómodo).
  const scaled = value.match(/^calc\(([\d.]+)px \* 1\)$/);
  return scaled ? `${scaled[1]}px` : value;
}

// ── Validación ──
const problems = [];
const names = new Set();
for (const { name, token } of tokens) {
  const meta = token.$extensions?.maquetario;
  if (names.has(name)) problems.push(`${name}: repetido en tokens.json`);
  names.add(name);
  if (!meta?.var) {
    problems.push(`${name}: falta $extensions.maquetario.var`);
    continue;
  }
  try {
    const real = resolve(meta.var);
    if (sync) token.$value = real;
    else if (real !== token.$value)
      problems.push(`${name}: tokens.json dice ${token.$value}, Maquetario tiene ${real}`);
    const scope = defined.get(meta.var).scope;
    if (scope === 'body' && meta.var !== `--${name}` && meta.scope !== 'body')
      problems.push(`${name}: ${meta.var} vive en body; marcá "scope": "body"`);
  } catch (error) {
    problems.push(`${name}: ${error.message}`);
  }
}

// ── CSS generado ──
const emitted = tokens.filter(
  ({ name, token }) =>
    token.$extensions.maquetario.var !== `--${name}` && token.$extensions.maquetario.emit !== false,
);
const skipped = tokens.filter(({ token }) => token.$extensions.maquetario.emit === false);
const block = (selector, list) =>
  list.length
    ? `${selector} {\n${list
        .map(({ name, token }) => `  --${name}: var(${token.$extensions.maquetario.var});`)
        .join('\n')}\n}\n`
    : '';
const css = `/* Contrato de tokens compartido con Motiova (D5).
   GENERADO desde packages/tokens/tokens.json con \`npm run build --workspace @maquetario/tokens\`:
   no se edita a mano. Los nombres comunes apuntan a los tokens de Maquetario (semantic.css);
   los valores siguen viviendo allí.
   Los nombres del contrato que ya son de Maquetario (material-*, elevation-*, type-*, status-*,
   radius-*) no se repiten acá.${
     skipped.length
       ? `\n   Sin emitir por choque de nombres: ${skipped
           .map(({ name, token }) => `--${name} (${token.$extensions.maquetario.reason})`)
           .join('; ')}.`
       : ''
   } */
${block(
  ':root',
  emitted.filter(({ token }) => token.$extensions.maquetario.scope !== 'body'),
)}${block(
  /* Los que apuntan a tokens de body (dependen de la escala de la interfaz). */ 'body',
  emitted.filter(({ token }) => token.$extensions.maquetario.scope === 'body'),
)}`;

if (problems.length) {
  console.error(`\nContrato de tokens con problemas:\n  ${problems.join('\n  ')}`);
  if (!sync && problems.some((p) => p.includes('Maquetario tiene')))
    console.error(
      '\nSi cambiaste semantic.css a propósito: npm run sync --workspace @maquetario/tokens',
    );
  process.exit(1);
}
const where = relative(repo, output);
if (check) {
  let current = '';
  try {
    current = readFileSync(output, 'utf8');
  } catch {}
  if (current.replace(/\r\n/g, '\n') !== css) {
    console.error(
      `${where} no está al día con tokens.json: corré npm run build --workspace @maquetario/tokens`,
    );
    process.exit(1);
  }
  console.log(`Contrato de tokens: ${tokens.length} nombres, ${where} al día.`);
} else {
  if (sync) writeFileSync(source, JSON.stringify(contract, null, 2) + '\n');
  writeFileSync(output, css);
  console.log(`Contrato de tokens: ${tokens.length} nombres → ${where} (${emitted.length} alias).`);
}
