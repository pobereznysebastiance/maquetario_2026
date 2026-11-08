// Borra reglas de nivel superior por índice (el mismo que muestra el CSSOM y legacyReport()).
// Uso: node scripts/prune-css.cjs LibroStudio/v3/app '["glass.css#3","crystal.css#0"]'
//      node scripts/prune-css.cjs LibroStudio/v3/app --contar   (comparar con el CSSOM antes de borrar)
const fs = require('fs'), path = require('path');
const [dir, json] = process.argv.slice(2);
// La lista puede venir como texto JSON o como ruta a un archivo .json.
const dead = json === '--contar' ? [] : JSON.parse(json.endsWith('.json') ? fs.readFileSync(json, 'utf8') : json);
// Nunca se borran, aunque la sonda las marque muertas: la sonda no ve todo lo que dependen de ellas
// (reset y fuente base de html/body, variables de :root que usa la impresión, @font-face, @media print…).
const PROTECTED = /(^|,)\s*(\*|html|body|:root)\b|^@(font-face|media|keyframes|import|charset|layer|supports)|print|::-webkit-/i;
const selectorOf = (rule) => rule.replace(/\/\*[\s\S]*?\*\//g, '').trim().split('{')[0].trim();
// Divide en reglas de nivel superior conservando el texto original; los comentarios van con la regla siguiente.
function split(text) {
  const rules = []; let start = 0, depth = 0, q = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '/' && text[i + 1] === '*') { i = text.indexOf('*/', i + 2) + 1; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { rules.push(text.slice(start, i + 1)); start = i + 1; } }
    else if (c === ';' && depth === 0) { rules.push(text.slice(start, i + 1)); start = i + 1; } // @import/@charset
  }
  return { rules, tail: text.slice(start) };
}
// --contar: cuántas reglas ve el separador en cada hoja (tiene que coincidir con el CSSOM antes de borrar).
if (json === '--contar') {
  const counts = {};
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.css'))) counts[f] = split(fs.readFileSync(path.join(dir, f), 'utf8')).rules.length;
  console.log(JSON.stringify(counts));
  process.exit(0);
}
// --ver: muestra el selector de cada clave sin tocar nada.
if (process.argv.includes('--ver')) {
  const cache = {};
  const full = process.argv.includes('--texto'); // la regla completa, no sólo el selector
  for (const k of dead) { const [f, i] = k.split('#'); cache[f] ??= split(fs.readFileSync(path.join(dir, f), 'utf8')).rules; const r = cache[f][i].replace(/\/\*[\s\S]*?\*\//g, '').trim(); console.log(k, full ? r.slice(0, 400) : selectorOf(r).slice(0, 90)); }
  process.exit(0);
}
for (const file of [...new Set(dead.map((k) => k.split('#')[0]))]) {
  const full = path.join(dir, file), { rules, tail } = split(fs.readFileSync(full, 'utf8'));
  const drop = new Set(dead.filter((k) => k.startsWith(file + '#')).map((k) => Number(k.split('#')[1])));
  for (const i of [...drop]) if (PROTECTED.test(selectorOf(rules[i]))) { drop.delete(i); console.log(`  se conserva ${file}#${i}: ${selectorOf(rules[i]).slice(0, 70)}`); }
  const kept = rules.filter((_, i) => !drop.has(i));
  // un comentario que encabezaba una regla borrada se conserva
  const comments = rules.filter((r, i) => drop.has(i)).map((r) => (r.match(/\/\*[\s\S]*?\*\//g) || []).join('\n')).filter(Boolean);
  fs.writeFileSync(full, (comments.length ? comments.join('\n') + '\n' : '') + kept.join('') + tail);
  console.log(file, 'reglas', rules.length, '→', kept.length, comments.length ? '(comentarios conservados: ' + comments.length + ')' : '');
}
