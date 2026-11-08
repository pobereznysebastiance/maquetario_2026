// Compara los PDF y JSON de dos corridas de la autoprueba sin los metadatos que cambian siempre
// (fecha y ID del documento). Uso: node scripts/compare-outputs.mjs <antes> <después>
// Con una sola carpeta, lista las huellas.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const huella = (file) => {
  let text = readFileSync(file).toString('latin1')
  if (file.endsWith('.pdf')) {
    text = text
      .replace(/\/(CreationDate|ModDate)\s*\([^)]*\)/g, '/$1()')
      .replace(/\/ID\s*\[\s*<[0-9A-Fa-f]*>\s*<[0-9A-Fa-f]*>\s*\]/g, '/ID[]')
      .replace(/<xmp:(CreateDate|ModifyDate|MetadataDate)>[^<]*</g, '<xmp:$1><')
      .replace(/xmpMM:(DocumentID|InstanceID)[^<]*</g, 'xmpMM:$1<')
  }
  return createHash('sha256').update(text, 'latin1').digest('hex').slice(0, 16)
}
const lista = (dir) => Object.fromEntries(readdirSync(dir).filter((f) => /\.(pdf|json)$/.test(f)).map((f) => [f, huella(join(dir, f))]))
const [a, b] = process.argv.slice(2)
const A = lista(a)
if (!b) { for (const [f, h] of Object.entries(A)) console.log(h, f); process.exit(0) }
const B = lista(b)
let distintos = 0
for (const f of Object.keys(A)) {
  const igual = A[f] === B[f]
  if (!igual) distintos++
  console.log(igual ? 'igual   ' : 'DISTINTO', f)
}
console.log(distintos ? `${distintos} distintos` : 'todo idéntico')
