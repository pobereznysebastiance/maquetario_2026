import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { canPackage, faceBytes, faceId, isOpenTypeCff, readFaces, unicodePoints } from '../src/main/fonts/opentype.ts';

const dmSans = join(import.meta.dirname, '..', '..', 'LibroStudio', 'v3', 'app', 'fonts', 'DM-Sans-700.ttf');

test('lee familia, estilo y peso', async () => {
  const [face, ...rest] = await readFaces(dmSans);
  assert.equal(rest.length, 0);
  assert.ok(face);
  assert.match(face.family, /DM Sans/);
  assert.equal(face.weight, 700);
  assert.equal(face.italic, false);
  assert.match(face.id, /^[0-9A-F]{24}$/);
});

test('cobertura de caracteres y licencia de incrustación', async () => {
  const [face] = await readFaces(dmSans);
  const bytes = await faceBytes(face!);
  const points = new Set(unicodePoints(bytes));
  for (const ch of 'AZaz09ñÑáé¿¡') assert.ok(points.has(ch.codePointAt(0)!), `falta ${ch}`);
  assert.equal(canPackage(bytes), true);
  assert.equal(isOpenTypeCff(bytes), false);
});

test('id compatible con la versión C# (ruta#offset#ticks .NET)', () => {
  // 2026-01-01T00:00:00Z = 639029664000000000 ticks .NET
  const ns = BigInt(Date.UTC(2026, 0, 1)) * 1_000_000n;
  assert.equal(faceId('C:\\Fonts\\A.ttf', 0, ns), faceId('c:\\fonts\\a.ttf', 0, ns));
  assert.notEqual(faceId('C:\\Fonts\\A.ttf', 0, ns), faceId('C:\\Fonts\\A.ttf', 12, ns));
});

test('archivo que no es fuente', async () => {
  assert.deepEqual(await readFaces(join(import.meta.dirname, 'opentype.test.ts')), []);
});
