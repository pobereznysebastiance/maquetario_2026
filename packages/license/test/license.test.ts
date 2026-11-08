import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  decodeLicenseUnverified,
  issueLicense,
  verifyLicense,
  type LicenseClaims,
} from '../src/index.ts';

const pair = () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    pub: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    priv: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };
};
const keys = pair();
const NOW = Date.UTC(2026, 10, 7);
const base: LicenseClaims = {
  v: 1,
  iss: 'motiova',
  kid: 'k1',
  sub: 'user-1',
  email: 'alumno@example.com',
  product: 'maquetario',
  edition: 'pro',
  maxMajor: 3,
  device: 'device-a',
  iat: NOW / 1000 - 60,
  exp: NOW / 1000 + 14 * 86400,
};
const options = {
  publicKeys: { k1: keys.pub },
  product: 'maquetario',
  appVersion: '3.24.0',
  now: NOW,
};

test('acepta una licencia válida', () => {
  const result = verifyLicense(issueLicense(base, keys.priv), options);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.claims.edition, 'pro');
});

test('rechaza una firma alterada', () => {
  const token = issueLicense(base, keys.priv);
  const [prefix, , signature] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ ...base, edition: 'enterprise' })).toString(
    'base64url',
  );
  assert.deepEqual(verifyLicense(`${prefix}.${forged}.${signature}`, options).ok, false);
  const result = verifyLicense(`${prefix}.${forged}.${signature}`, options);
  assert.equal(!result.ok && result.reason, 'bad-signature');
});

test('rechaza una firma de otra clave con el mismo kid', () => {
  const other = pair();
  const result = verifyLicense(issueLicense(base, other.priv), options);
  assert.equal(!result.ok && result.reason, 'bad-signature');
});

test('rechaza kid desconocido', () => {
  const result = verifyLicense(issueLicense({ ...base, kid: 'k9' }, keys.priv), options);
  assert.equal(!result.ok && result.reason, 'unknown-key');
});

test('vencimiento con tolerancia de reloj', () => {
  const token = issueLicense({ ...base, exp: NOW / 1000 - 10 }, keys.priv);
  assert.equal(verifyLicense(token, options).ok, true, 'dentro de la tolerancia');
  const late = verifyLicense(token, { ...options, now: NOW + 3_600_000 });
  assert.equal(!late.ok && late.reason, 'expired');
});

test('versión mayor no cubierta', () => {
  const token = issueLicense(base, keys.priv);
  const result = verifyLicense(token, { ...options, appVersion: '4.0.0' });
  assert.equal(!result.ok && result.reason, 'version-not-covered');
  assert.equal(
    verifyLicense(issueLicense({ ...base, maxMajor: null }, keys.priv), {
      ...options,
      appVersion: '9.1.0',
    }).ok,
    true,
  );
});

test('producto y equipo', () => {
  const token = issueLicense(base, keys.priv);
  const product = verifyLicense(token, { ...options, product: 'otro' });
  assert.equal(!product.ok && product.reason, 'wrong-product');
  const device = verifyLicense(token, { ...options, deviceId: 'device-b' });
  assert.equal(!device.ok && device.reason, 'wrong-device');
});

test('texto mal formado', () => {
  for (const bad of ['', 'MQL1', 'MQL1.a', 'XYZ.a.b', 'MQL1.!!.b', `MQL1.${'a'.repeat(20000)}.b`]) {
    const result = verifyLicense(bad, options);
    assert.equal(!result.ok && result.reason, 'malformed', bad.slice(0, 20));
  }
  assert.equal(decodeLicenseUnverified('MQL1.e30.x'), null);
});
