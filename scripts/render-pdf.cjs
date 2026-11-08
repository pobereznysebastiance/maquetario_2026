// Convierte un HTML a PDF A4 con el motor de Electron (misma tipografía que la app).
// Uso: npx electron scripts/render-pdf.cjs <entrada.html> <salida.pdf> ["Texto del pie"]
const { app, BrowserWindow } = require('electron');
const { writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const [input, output, footer = ''] = process.argv
  .slice(2)
  .filter((a) => !a.startsWith('--') && a !== '.');
if (!input || !output) {
  console.error('Uso: npx electron scripts/render-pdf.cjs <entrada.html> <salida.pdf> ["pie"]');
  process.exit(1);
}

const escape = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true },
  });
  await win.loadURL(pathToFileURL(resolve(input)).href);
  await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
  const pdf = await win.webContents.printToPDF({
    preferCSSPageSize: true,
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="width:100%;font-family:'DM Sans','Segoe UI',sans-serif;font-size:7.5pt;color:#7a8a8d;padding:0 20mm 0 22mm;display:flex;justify-content:space-between"><span>${escape(footer)}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  });
  writeFileSync(resolve(output), pdf);
  console.log(`PDF: ${resolve(output)} (${Math.round(pdf.length / 1024)} KB)`);
  app.quit();
});
