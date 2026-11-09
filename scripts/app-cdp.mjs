// Maneja la app de escritorio abierta en modo desarrollo, para medir y capturar sobre Electron
// (no sobre el navegador): controles de ventana, diálogos y avisos tal como los ve el usuario.
//
// 1. Levantar la app con el puerto de depuración:
//      cd desktop && node scripts/build.mjs && npx electron . --dev --remote-debugging-port=9333
// 2. Usar:
//      node scripts/app-cdp.mjs eval "<expresión>"        (admite await; devuelve JSON)
//      node scripts/app-cdp.mjs evalfile scripts/style-snapshot.js
//      node scripts/app-cdp.mjs shot salida.png [x y ancho alto]
//      node scripts/app-cdp.mjs click x y
//      node scripts/app-cdp.mjs dblclick x y       (dos clics seguidos, como el mouse)
//      node scripts/app-cdp.mjs key Escape
//      node scripts/app-cdp.mjs reload          (recarga sin caché)
//
// Mientras dura cada llamada la vista se fija en 1536 × 1024 a escala 1 (como pide el método de
// docs/proximos-pasos.md), sin importar el tamaño de la ventana ni la escala de la pantalla.
// APP_CDP_SIZE=1920x1020 usa otra medida (la de la autoprueba); APP_CDP_SIZE=0 lo desactiva. Con la ventana minimizada Chromium no dibuja: las capturas esperan.
// APP_CDP_TIMEOUT: segundos de espera (60 por defecto; style-snapshot recorre muchos estados y tarda más).
import { readFileSync, writeFileSync } from 'node:fs';

const port = process.env.APP_CDP_PORT || 9333;
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = targets.find((t) => t.type === 'page' && !t.url.startsWith('devtools'));
if (!page) throw new Error('No hay página abierta en el puerto ' + port);

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const data = JSON.parse(m.data);
  if (data.id && pending.has(data.id)) {
    pending.get(data.id)(data);
    pending.delete(data.id);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const i = ++id;
    pending.set(i, resolve);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

const timeout = Number(process.env.APP_CDP_TIMEOUT || 60);
setTimeout(() => {
  console.error(`Sin respuesta en ${timeout} s: ¿la ventana de la app está minimizada?`);
  process.exit(2);
}, timeout * 1000).unref();

if (process.env.APP_CDP_SIZE !== '0') {
  const [width, height] = (process.env.APP_CDP_SIZE || '1536x1024').split('x').map(Number);
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
}

const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    replMode: true,
    userGesture: true,
  });
  const error = res.result?.exceptionDetails;
  if (error) return { error: error.exception?.description || error.text };
  return res.result?.result?.value;
};

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'eval') console.log(JSON.stringify(await evaluate(args[0]), null, 1));
else if (cmd === 'evalfile')
  console.log(JSON.stringify(await evaluate(readFileSync(args[0], 'utf8')), null, 1));
else if (cmd === 'shot') {
  const [file, x, y, w, h] = args;
  const params = { format: 'png' };
  if (w) params.clip = { x: +x, y: +y, width: +w, height: +h, scale: 1 };
  const res = await send('Page.captureScreenshot', params);
  writeFileSync(file, Buffer.from(res.result.data, 'base64'));
  console.log('ok', file);
} else if (cmd === 'click') {
  const [x, y] = args.map(Number);
  for (const type of ['mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
  console.log('clic', x, y);
} else if (cmd === 'dblclick') {
  const [x, y] = args.map(Number);
  for (const clickCount of [1, 2])
    for (const type of ['mousePressed', 'mouseReleased'])
      await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount });
  console.log('doble clic', x, y);
} else if (cmd === 'key') {
  for (const type of ['keyDown', 'keyUp'])
    await send('Input.dispatchKeyEvent', {
      type,
      key: args[0],
      code: args[0],
      windowsVirtualKeyCode: args[0] === 'Escape' ? 27 : 0,
    });
  console.log('tecla', args[0]);
} else if (cmd === 'reload') {
  // Recarga sin caché: toma los CSS e index.html recién cambiados (location.reload() puede no hacerlo).
  await send('Page.reload', { ignoreCache: true });
  console.log('recargada sin caché');
} else {
  console.log('Comandos: eval, evalfile, shot, click, dblclick, key, reload');
}
ws.close();
