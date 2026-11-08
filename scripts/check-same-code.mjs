// Comprueba que un cambio de formato no cambió el código: minifica cada archivo como está en
// git (HEAD o la referencia que se pase) y como está en disco, y exige que salgan idénticos.
// Uso: node scripts/check-same-code.mjs [referencia] archivo...
//      node scripts/check-same-code.mjs HEAD $(git diff --name-only -- '*.js' '*.ts')
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const args = process.argv.slice(2);
const ref = args[0] && !/\.(m?[jt]s)$/.test(args[0]) ? args.shift() : 'HEAD';
const minify = (code, file) =>
  transformSync(code, {
    loader: file.endsWith('.ts') ? 'ts' : 'js',
    minify: true,
    legalComments: 'none',
    charset: 'utf8',
  }).code;

let different = 0;
for (const file of args) {
  const before = execFileSync('git', ['show', `${ref}:${file}`], {
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  });
  const after = readFileSync(file, 'utf8');
  const same = minify(before, file) === minify(after, file);
  if (!same) {
    different += 1;
    console.log('DISTINTO', file);
  }
}
console.log(
  different
    ? `${different} de ${args.length} cambiaron de verdad`
    : `${args.length} archivos: mismo código`,
);
process.exit(different ? 1 : 0);
