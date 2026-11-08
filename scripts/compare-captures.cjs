// Compara capturas de la autoprueba píxel a píxel (dos carpetas de .png).
// Uso: npx electron scripts/compare-captures.cjs <antes> <después> <salida>   (UMBRAL=4 para diferencias finas)
// Escribe <salida>/informe.txt y recortes antes/después de cada zona distinta. Diferencias de 1/255 son ruido del renderizado.
const { app, nativeImage } = require('electron');
const LOG = [];
console.log = (...a) => LOG.push(a.join(' '));
const fs = require('fs'),
  path = require('path');
app.whenReady().then(() => {
  const [A, B, OUT] = process.argv.slice(-3);
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(A).filter((f) => f.endsWith('.png'))) {
    const a = nativeImage.createFromPath(path.join(A, f)),
      b = nativeImage.createFromPath(path.join(B, f));
    const sa = a.getSize(),
      sb = b.getSize();
    if (sa.width !== sb.width || sa.height !== sb.height) {
      console.log(f, 'tamaño distinto', sa, sb);
      continue;
    }
    const pa = a.toBitmap(),
      pb = b.toBitmap();
    let n = 0,
      x0 = 1e9,
      y0 = 1e9,
      x1 = -1,
      y1 = -1;
    for (let i = 0; i < pa.length; i += 4) {
      if (
        Math.abs(pa[i] - pb[i]) +
          Math.abs(pa[i + 1] - pb[i + 1]) +
          Math.abs(pa[i + 2] - pb[i + 2]) >
        (Number(process.env.UMBRAL) || 30)
      ) {
        n++;
        const p = i / 4,
          x = p % sa.width,
          y = (p / sa.width) | 0;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
    let mx = 0;
    for (let i = 0; i < pa.length; i++) mx = Math.max(mx, Math.abs(pa[i] - pb[i]));
    if (!n) {
      if (mx) console.log(f + ': diferencia máxima ' + mx + ' (bajo el umbral)');
      continue;
    }
    console.log(
      `${f}: ${n} px distintos, zona x${x0}-${x1} y${y0}-${y1} (de ${sa.width}x${sa.height})`,
    );
    const rect = {
      x: Math.max(0, x0 - 20),
      y: Math.max(0, y0 - 20),
      width: Math.min(sa.width, x1 + 20) - Math.max(0, x0 - 20),
      height: Math.min(sa.height, y1 + 20) - Math.max(0, y0 - 20),
    };
    fs.writeFileSync(path.join(OUT, f.replace('.png', '-antes.png')), a.crop(rect).toPNG());
    fs.writeFileSync(path.join(OUT, f.replace('.png', '-despues.png')), b.crop(rect).toPNG());
  }
  fs.writeFileSync(path.join(OUT, 'informe.txt'), LOG.join('\n') || 'sin diferencias');
  app.quit();
});
