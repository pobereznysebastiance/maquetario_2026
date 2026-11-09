// Paridad del motor de composición con Chromium, en Chrome sin ventana (sin Electron).
// Sirve la interfaz como scripts/serve-ui.cjs, prende la llave del motor y corre composeReport()
// sobre el libro de muestra y sobre la novela de la autoprueba (prepareNovelProof); después, sobre
// esa novela con separación silábica, con interletraje, en una fuente variable (Bahnschrift) y en
// una cara de colección .ttc (Cambria).
//
// Uso:  node desktop/scripts/build.mjs && node scripts/compose-parity.mjs [--details]
//       node scripts/compose-parity.mjs --eval <archivo.js>   (diagnóstico: evalúa en la página)
// Chrome: CHROME=<ruta> si no está en el lugar de siempre. Fuentes: las del sistema
// (FONTS_DIR=<carpeta>; las de FONT_FILES son de Windows); sin catálogo de escritorio, el motor
// mide con los mismos archivos que usa el navegador para ese texto.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFile, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..', 'LibroStudio', 'v3', 'app');
const fontsDir = resolve(
  process.env.FONTS_DIR ??
    (process.platform === 'win32'
      ? 'C:/Windows/Fonts'
      : process.platform === 'darwin'
        ? '/System/Library/Fonts/Supplemental'
        : '/usr/share/fonts/truetype/msttcorefonts'),
);
const FONT_FILES = {
  'Georgia|400|normal': 'georgia.ttf',
  'Georgia|700|normal': 'georgiab.ttf',
  'Georgia|400|italic': 'georgiai.ttf',
  'Georgia|700|italic': 'georgiaz.ttf',
  // Fuente variable (ejes wght y wdth) y una cara de colección, para probar esos casos.
  'Bahnschrift|400|normal': 'bahnschrift.ttf',
  'Cambria|400|normal': 'cambria.ttc#0',
};
const chrome =
  process.env.CHROME ??
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : 'google-chrome');
const details = process.argv.includes('--details');

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.wasm': 'application/wasm',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ttf': 'font/ttf',
};

const server = createServer((request, response) => {
  const path = decodeURIComponent(request.url.split('?')[0]);
  const [base, relative] = path.startsWith('/__system-fonts/')
    ? [fontsDir, path.slice('/__system-fonts/'.length)]
    : [root, path === '/' ? 'index.html' : path];
  const file = normalize(join(base, relative));
  if (!file.startsWith(base + sep)) return response.writeHead(403).end();
  readFile(file, (error, data) => {
    if (error) return response.writeHead(404).end();
    response
      .writeHead(200, {
        'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      })
      .end(data);
  });
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const appUrl = `http://127.0.0.1:${server.address().port}/`;

const profile = mkdtempSync(join(tmpdir(), 'maquetario-paridad-'));
const debugPort = 9300 + Math.floor(Math.random() * 500);
const browser = spawn(
  chrome,
  [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    '--window-size=1536,1024',
    '--no-first-run',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
async function pageSocket() {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
      const page = targets.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(100);
  }
  throw new Error('Chrome no respondió');
}

const socket = new WebSocket(await pageSocket());
await new Promise((done) => socket.addEventListener('open', done, { once: true }));
let nextId = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  pending.get(message.id)?.(message);
  pending.delete(message.id);
});
const send = (method, params = {}) =>
  new Promise((done) => {
    const id = ++nextId;
    pending.set(id, done);
    socket.send(JSON.stringify({ id, method, params }));
  });
async function evaluate(expression) {
  const { result } = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails)
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (await evaluate(`(() => { try { return !!(${expression}); } catch { return false; } })()`))
      return;
    await sleep(100);
  }
  throw new Error(`No se cumplió: ${expression}`);
}

try {
  const engineRequested =
    "performance.getEntriesByType('resource').some((e) => /compose\\.mjs|harfbuzz\\.wasm/.test(e.name))";
  await send('Page.navigate', { url: appUrl });
  await waitFor("document.readyState === 'complete' && typeof composeReport === 'function'");
  // Con la llave apagada, la página no pide el motor.
  const withKeyOff = await evaluate(engineRequested);
  await evaluate("localStorage.setItem('maquetario-compose', '1'); window.beforeReload = true");
  await send('Page.reload');
  // La marca desaparece con la página nueva: así no se mide la vieja mientras recarga.
  await waitFor(
    "!window.beforeReload && document.readyState === 'complete' && typeof prepareNovelProof === 'function'",
  );
  const fonts = Object.fromEntries(
    Object.entries(FONT_FILES).map(([key, file]) => [key, `/__system-fonts/${file}`]),
  );
  const options = JSON.stringify({ fonts, details });
  // Diagnóstico: --eval <archivo> evalúa ese JavaScript en la página (con la llave prendida) y
  // muestra el resultado en lugar de los informes.
  const evalFile = process.argv[process.argv.indexOf('--eval') + 1];
  if (process.argv.includes('--eval') && evalFile) {
    console.log(await evaluate(readFileSync(evalFile, 'utf8')));
    process.exitCode = 0;
  } else {
    const sample = await evaluate(`composeReport(${options})`);
    await evaluate('prepareNovelProof()');
    const novel = await evaluate(`composeReport(${options})`);
    // La misma novela con separación silábica en todas las cajas (la de muestra no la usa).
    await evaluate(
      "book.pages.forEach((p) => p.objects.forEach((o) => { if (o.type === 'text') { o.hyphenate = true; o.hyphenLanguage = 'es'; } }))",
    );
    const novelHyphenated = await evaluate(`composeReport(${options})`);
    // Y después, sobre esa misma novela: interletraje, una fuente variable con un eje propio
    // (Bahnschrift, wdth 85) y una cara de una colección .ttc (Cambria).
    // Los cambios van en el objeto y en los ajustes de cada párrafo, porque los estilos de
    // párrafo de la novela fijan la fuente.
    const everyText = (changes) =>
      `book.pages.forEach((p) => p.objects.forEach((o) => { if (o.type !== 'text') return; const c = ${changes}; Object.assign(o, c); for (const m of o.paragraphMap || []) if (m) m.overrides = { ...(m.overrides || {}), ...c }; }))`;
    await evaluate(everyText('{ tracking: 30 }'));
    const novelTracking = await evaluate(`composeReport(${options})`);
    // Como en la app (fonts.ts → FontFace desde los bytes): con la fuente del sistema, Chromium en
    // Windows ignora font-variation-settings y sólo usa sus instancias con nombre.
    await evaluate(
      "(async () => { const face = new FontFace('Bahnschrift', 'url(/__system-fonts/bahnschrift.ttf)', { weight: '300 700', stretch: '75% 100%' }); document.fonts.add(await face.load()); })()",
    );
    await evaluate(everyText("{ tracking: 0, font: 'Bahnschrift', fontAxes: { wdth: 85 } }"));
    const novelVariable = await evaluate(`composeReport(${options})`);
    await evaluate(everyText("{ font: 'Cambria', fontAxes: {} }"));
    const novelCollection = await evaluate(`composeReport(${options})`);
    const engineLoaded = { withKeyOff, withKeyOn: await evaluate(engineRequested) };
    console.log(
      JSON.stringify(
        {
          engineLoaded,
          sample,
          novel,
          novelHyphenated,
          novelTracking,
          novelVariable,
          novelCollection,
        },
        null,
        2,
      ),
    );
  }
} finally {
  socket.close();
  browser.kill();
  server.close();
  await sleep(300);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {}
}
