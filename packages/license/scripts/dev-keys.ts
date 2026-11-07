// Genera un par de claves Ed25519 SOLO para desarrollo en packages/license/dev-keys/.
// La clave privada real vive en el backend de Motiova y nunca entra a este repo.
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, '..', 'dev-keys');
if (existsSync(join(dir, 'private.pem'))) {
  console.log(`Ya existen claves de desarrollo en ${dir}`);
  process.exit(0);
}
mkdirSync(dir, { recursive: true });
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
writeFileSync(join(dir, 'public.pem'), publicKey.export({ type: 'spki', format: 'pem' }));
writeFileSync(join(dir, 'private.pem'), privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
console.log(`Claves de desarrollo creadas en ${dir} (kid "dev").`);
