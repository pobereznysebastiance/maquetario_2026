// Emite una licencia de PRUEBA firmada con la clave de desarrollo.
// Uso: npm run license:dev-issue -- [--days 14] [--edition pro] [--device <id>] [--out <archivo>]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { issueLicense } from '../src/index.ts';

const { values } = parseArgs({
  options: {
    days: { type: 'string', default: '14' },
    edition: { type: 'string', default: 'pro' },
    device: { type: 'string', default: 'dev-device' },
    email: { type: 'string', default: 'dev@maquetario.local' },
    'max-major': { type: 'string' },
    out: { type: 'string' },
  },
});

const privateKey = readFileSync(join(import.meta.dirname, '..', 'dev-keys', 'private.pem'), 'utf8');
const now = Math.floor(Date.now() / 1000);
const token = issueLicense(
  {
    v: 1,
    iss: 'motiova',
    kid: 'dev',
    sub: 'dev-user',
    email: values.email!,
    name: 'Licencia de desarrollo',
    product: 'maquetario',
    edition: values.edition!,
    maxMajor: values['max-major'] ? Number(values['max-major']) : null,
    device: values.device!,
    iat: now,
    exp: now + Number(values.days) * 86400,
  },
  privateKey,
);
if (values.out) {
  writeFileSync(values.out, token + '\n');
  console.log(`Licencia escrita en ${values.out}`);
} else {
  console.log(token);
}
