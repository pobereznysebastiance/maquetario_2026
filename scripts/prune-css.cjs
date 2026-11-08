// Borra reglas de nivel superior por índice (el mismo que muestra el CSSOM y legacyReport()).
// Uso: node scripts/prune-css.cjs LibroStudio/v3/app '["glass.css#3","crystal.css#0"]'
const fs = require('fs'), path = require('path');
const [dir, json] = process.argv.slice(2);
const dead = JSON.parse(json);
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
for (const file of [...new Set(dead.map((k) => k.split('#')[0]))]) {
  const full = path.join(dir, file), { rules, tail } = split(fs.readFileSync(full, 'utf8'));
  const drop = new Set(dead.filter((k) => k.startsWith(file + '#')).map((k) => Number(k.split('#')[1])));
  const kept = rules.filter((_, i) => !drop.has(i));
  // un comentario que encabezaba una regla borrada se conserva
  const comments = rules.filter((r, i) => drop.has(i)).map((r) => (r.match(/\/\*[\s\S]*?\*\//g) || []).join('\n')).filter(Boolean);
  fs.writeFileSync(full, (comments.length ? comments.join('\n') + '\n' : '') + kept.join('') + tail);
  console.log(file, 'reglas', rules.length, '→', kept.length, comments.length ? '(comentarios conservados: ' + comments.length + ')' : '');
}
