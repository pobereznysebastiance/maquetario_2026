// Paridad del motor de composición con Chromium, en Chrome sin ventana (sin Electron).
// Sirve la interfaz como scripts/serve-ui.cjs, prende la llave del motor y corre composeReport()
// sobre el libro de muestra y sobre la novela de la autoprueba (prepareNovelProof); después, sobre
// esa novela con separación silábica, con interletraje, en una fuente variable (Bahnschrift) y en
// una cara de colección .ttc (Cambria).
//
// Uso:  node desktop/scripts/build.mjs && node scripts/compose-parity.mjs [--details]
//       node scripts/compose-parity.mjs --eval <archivo.js>   (diagnóstico: evalúa en la página)
//       node scripts/compose-parity.mjs --draw [--shot captura.png]   (dibujo con el motor)
// Chrome: CHROME=<ruta> si no está en el lugar de siempre. Fuentes: las del sistema
// (FONTS_DIR=<carpeta>; las de FONT_FILES son de Windows); sin catálogo de escritorio, el motor
// mide con los mismos archivos que usa el navegador para ese texto.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFile, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

/**
 * Lo que revisa --draw en la página: los párrafos que dibuja el motor en pantalla y en el paper()
 * de la salida, que cada línea entre en una sola línea del navegador y no se pase del ancho, que
 * las justificadas lleguen al borde, que pantalla y salida tengan los mismos cortes, que el alto
 * sea líneas × interlineado y que editar vuelva al texto de siempre y al salir se recomponga.
 */
/**
 * Casos que la novela no trae, para --draw: espacios duros ("de la" con un espacio duro)
 * y tramos con otro estilo en el segundo párrafo de cada caja (negrita, cursiva y cuerpo 13), con
 * el formato provisorio paragraphMap[i].runs (src/modules/compose.ts → paragraphRuns).
 */
const drawVariants = function () {
  let hard = 0;
  let runs = 0;
  for (const page of book.pages)
    for (const o of page.objects) {
      if (o.type !== 'text' || o.toc) continue;
      const before = o.text;
      o.text = o.text.replaceAll(' de la ', ' de la ');
      if (o.text !== before) hard++;
      const lines = o.text.split('\n');
      if (!lines[1] || lines[1].length < 100) continue;
      o.paragraphMap ??= lines.map(() => ({ styleId: null, overrides: {} }));
      o.paragraphMap[1] = {
        ...(o.paragraphMap[1] || { styleId: null, overrides: {} }),
        runs: [
          { start: 10, end: 30, overrides: { bold: true } },
          { start: 40, end: 60, overrides: { italic: true } },
          { start: 70, end: 90, overrides: { size: 13 } },
        ],
      };
      runs++;
    }
  return { hard, runs };
}.toString();

/**
 * La salida espera al motor: con una fuente que el motor todavía no cargó (Cambria en un
 * párrafo), prepareNovelPdf deja composeOutputReady en false, y cuando queda en true la salida
 * tiene todos los párrafos compuestos.
 */
const outputWaitCheck = async function () {
  const o = book.pages.flatMap((p) => p.objects).find((x) => x.type === 'text' && !x.toc);
  o.font = 'Cambria';
  for (const meta of o.paragraphMap || [])
    if (meta) meta.overrides = { ...meta.overrides, font: 'Cambria' };
  window.prepareNovelPdf();
  const rightAway = window.composeOutputReady;
  let waited = 0;
  while (window.composeOutputReady !== true && waited < 10000) {
    await new Promise((done) => setTimeout(done, 50));
    waited += 50;
  }
  const root = document.querySelector('#printRoot');
  const paragraphs = [...root.querySelectorAll('.mqt-paragraph')].filter((p) =>
    p.textContent.trim(),
  );
  const result = {
    notReadyRightAway: rightAway === false,
    readyAfterMs: waited,
    paragraphsInOutput: paragraphs.length,
    composedInOutput: paragraphs.filter((p) => p.classList.contains('mqt-composed')).length,
    cambriaComposed: !!root.querySelector(`[data-id="${o.id}"] .mqt-composed`),
  };
  clearPrint();
  return JSON.stringify(result);
}.toString();

const drawChecks = async function () {
  const rowTexts = (root) =>
    [...root.querySelectorAll('.mqt-composed')].map((p) =>
      [...p.querySelectorAll('.mqt-line')].map((r) => r.textContent),
    );
  const out = { screenComposed: document.querySelectorAll('#spread .mqt-composed').length };
  let paragraphs = 0;
  let composedParagraphs = 0;
  let rows = 0;
  let wrappedRows = 0;
  let overflowingRows = 0;
  let worstJustifiedGap = 0;
  let wrongHeights = 0;
  let screenMatchesOutput = true;
  let styledRuns = 0;
  let hardSpaces = 0;
  const range = document.createRange();
  for (let i = 0; i < book.pages.length; i++) {
    const page = paper(i, 96 / 25.4, true);
    Object.assign(page.style, { position: 'fixed', left: '-10000px', top: '0', display: 'block' });
    document.body.append(page);
    paragraphs += page.querySelectorAll('.mqt-paragraph').length;
    styledRuns += page.querySelectorAll('.mqt-line span[style*="font-"]').length;
    hardSpaces += page.querySelectorAll('.mqt-nbsp').length;
    for (const p of page.querySelectorAll('.mqt-composed')) {
      composedParagraphs++;
      const style = getComputedStyle(p);
      const right = p.getBoundingClientRect().right - parseFloat(style.paddingRight);
      const lineHeight = parseFloat(style.lineHeight);
      const lines = [...p.querySelectorAll('.mqt-line')];
      if (Math.abs(p.getBoundingClientRect().height - lines.length * lineHeight) > 0.5)
        wrongHeights++;
      lines.forEach((row, index) => {
        rows++;
        range.selectNodeContents(row);
        const rects = [...range.getClientRects()].filter((r) => r.width > 0);
        // Una línea que el navegador partiera en dos tendría el doble de alto (con tramos de otro
        // cuerpo, los rectángulos de una misma línea no empiezan a la misma altura).
        if (row.getBoundingClientRect().height > lineHeight * 1.5) wrappedRows++;
        const end = Math.max(...rects.map((r) => r.right));
        if (end > right + 1) overflowingRows++;
        const justified = style.textAlign === 'justify' && index < lines.length - 1;
        if (justified && rects.length) worstJustifiedGap = Math.max(worstJustifiedGap, right - end);
      });
    }
    const spreadPage = document.querySelector(`#spread .page[data-page="${i}"]`);
    if (spreadPage && JSON.stringify(rowTexts(spreadPage)) !== JSON.stringify(rowTexts(page)))
      screenMatchesOutput = false;
    page.remove();
  }
  Object.assign(out, {
    paragraphs,
    composedParagraphs,
    rows,
    wrappedRows,
    overflowingRows,
    worstJustifiedGapPx: Math.round(worstJustifiedGap * 1000) / 1000,
    wrongHeights,
    screenMatchesOutput,
    styledRuns,
    hardSpaces,
  });
  // Edición: el cuadro vuelve al texto de siempre y al terminar se recompone, sin tocar el texto.
  const composedOnScreen = document.querySelector('#spread .mqt-composed');
  const element = composedOnScreen?.closest('.paper-object');
  if (element) {
    const object = book.pages.flatMap((p) => p.objects).find((o) => o.id === element.dataset.id);
    const before = object.text;
    selected = object.id;
    startEditing(element);
    out.whileEditing = {
      composed: element.querySelectorAll('.mqt-composed').length,
      lines: element.querySelectorAll('.mqt-line').length,
      textMatches: element.querySelector('.text-content').innerText.replace(/\r/g, '') === before,
    };
    finishEditing();
    await new Promise((done) => setTimeout(done, 200));
    const again = document.querySelector(`#spread [data-id="${object.id}"]`);
    out.afterEditing = {
      composed: again?.querySelectorAll('.mqt-composed').length ?? 0,
      textUnchanged: object.text === before,
    };
  }
  return JSON.stringify(out);
}.toString();
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
  // …ni instala sus extensiones (el dibujo de paper() queda como siempre).
  const engineExtensions =
    "Object.values(MaquetarioExtensions.list()).flat().filter((origin) => origin.startsWith('compose')).length";
  const extensionsWithKeyOff = await evaluate(engineExtensions);
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
  } else if (process.argv.includes('--draw')) {
    // Dibujo con el motor sobre la novela: pantalla, salida (paper de impresión), edición y alto.
    await evaluate('prepareNovelProof()');
    await evaluate(`(${drawVariants})()`);
    await evaluate(`composeActivate(${JSON.stringify({ fonts })})`);
    await sleep(300);
    const checks = JSON.parse(await evaluate(`(${drawChecks})()`));
    const output = JSON.parse(await evaluate(`(${outputWaitCheck})()`));
    console.log(JSON.stringify({ ...checks, output }, null, 2));
    const shot = process.argv[process.argv.indexOf('--shot') + 1];
    if (process.argv.includes('--shot') && shot) {
      const { data } = (await send('Page.captureScreenshot', { format: 'png' })).result;
      writeFileSync(shot, Buffer.from(data, 'base64'));
    }
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
    const engineLoaded = {
      withKeyOff,
      withKeyOn: await evaluate(engineRequested),
      extensionsWithKeyOff,
      extensionsWithKeyOn: await evaluate(engineExtensions),
    };
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
