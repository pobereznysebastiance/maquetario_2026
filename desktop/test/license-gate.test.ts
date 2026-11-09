import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gateButtons } from '../src/main/license-gate.ts';
import { callbackPage, inlineFonts } from '../src/main/motiova/callback-page.ts';
import { listenForCallback, myProgramsUrl } from '../src/main/motiova/client.ts';

const app = join(import.meta.dirname, '..', '..', 'LibroStudio', 'v3', 'app');
const ids = (buttons: { id: string }[]) => buttons.map((b) => b.id);
const primary = (buttons: { id: string; primary?: boolean }[]) =>
  buttons.filter((b) => b.primary).map((b) => b.id);

test('sin licencia ofrece conectar con Motiova', () => {
  const buttons = gateButtons(null);
  assert.deepEqual(ids(buttons), ['quit', 'connect']);
  assert.equal(buttons[1]!.label, 'Conectar con Motiova');
});

test('con el tope de equipos ofrece Mis programas y volver a pedir, no conectar otra vez', () => {
  const first = gateButtons('device-limit');
  assert.deepEqual(ids(first), ['quit', 'account', 'retry']);
  assert.deepEqual(primary(first), ['account']);
  assert.ok(!ids(first).includes('connect'));
  // Después de abrir Mis programas, lo principal es volver a intentar.
  assert.deepEqual(primary(gateButtons('device-limit', true)), ['retry']);
});

test('después de cancelar, vencer la espera o quedarse sin conexión, ofrece reintentar', () => {
  for (const code of ['cancelled', 'timeout', 'offline']) {
    const buttons = gateButtons(code);
    assert.deepEqual(ids(buttons), ['quit', 'connect'], code);
    assert.equal(buttons[1]!.label, 'Volver a intentar');
  }
});

test('Mis programas en la web de Motiova', () => {
  assert.equal(myProgramsUrl('https://motiova.com'), 'https://motiova.com/mi-cuenta?tab=programas');
  assert.equal(
    myProgramsUrl('http://localhost:5183/'),
    'http://localhost:5183/mi-cuenta?tab=programas',
  );
});

const assets = () => ({
  sheets: ['fonts', 'primitives', 'semantic', 'contract'].map((sheet) =>
    readFileSync(join(app, 'ui', 'tokens', `${sheet}.css`), 'utf8'),
  ),
  fonts: Object.fromEntries(
    [400, 500, 600, 700].map((w) => [
      `DM-Sans-${w}.ttf`,
      readFileSync(join(app, 'fonts', `DM-Sans-${w}.ttf`)),
    ]),
  ),
  mark: readFileSync(join(app, 'maquetario.svg')),
});

test('la página de vuelta trae los tokens y la DM Sans de la app, todo adentro', () => {
  const html = callbackPage(assets())('Listo', 'Podés volver a Maquetario.', true);
  assert.match(html, /--surface-window/);
  assert.match(html, /--type-body/);
  assert.match(html, /url\(data:font\/ttf;base64,/);
  assert.doesNotMatch(html, /\.\.\/fonts\//, 'ninguna fuente apunta a un archivo');
  assert.doesNotMatch(html, /system-ui[^,]*;/, 'no usa system-ui como fuente principal');
  assert.match(html, /data:image\/svg\+xml;base64,/);
  assert.match(html, /<h1 class="callback-title">Listo<\/h1>/);
  assert.match(html, /<main class="callback">/);
  assert.match(callbackPage(assets())('No se pudo', 'x', false), /class="callback is-error"/);
});

test('la página escapa el texto y deja intactas las fuentes que no tiene', () => {
  const html = callbackPage({ sheets: [], fonts: {} })('<b>', 'a & "b"', true);
  assert.match(html, /&lt;b&gt;/);
  assert.match(html, /a &amp; &quot;b&quot;/);
  const css = "src: url('../../fonts/Otra.ttf');";
  assert.equal(inlineFonts(css, {}), css);
});

test('el callback responde con la página que se le pasa', async () => {
  const listener = await listenForCallback('estado-123', 5000, undefined, (title, _text, ok) =>
    ok ? `ok:${title}` : `error:${title}`,
  );
  const wrong = await fetch(`http://127.0.0.1:${listener.port}/callback?code=x&state=otro`);
  assert.equal(await wrong.text(), 'error:No se pudo conectar');
  const right = await fetch(`http://127.0.0.1:${listener.port}/callback?code=c&state=estado-123`);
  assert.equal(await right.text(), 'ok:Listo');
  assert.equal(await listener.code, 'c');
});
