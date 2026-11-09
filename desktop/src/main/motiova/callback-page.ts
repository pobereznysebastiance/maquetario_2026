// Página que ve el navegador al volver de Motiova ("Listo" o "No se pudo conectar"), con la
// identidad de Maquetario: los mismos tokens y la misma DM Sans que los avisos de sistema.
// El servidor de 127.0.0.1 se cierra apenas responde, así que todo va adentro de la página:
// estilos en línea y fuentes e isotipo como data: URL.
// Sin Electron: se prueba con node --test (desktop/test/license-gate.test.ts). Los archivos los
// lee motiova/desktop.ts de la carpeta de avisos (scripts/build.mjs los copia ahí).
import type { CallbackPage } from './client.ts';

export interface CallbackAssets {
  /** Hojas de tokens en orden: fonts, primitives, semantic, contract (ui/tokens). */
  sheets: string[];
  /** Archivos de fuente por nombre (DM-Sans-400.ttf…), para incrustarlos. */
  fonts: Record<string, Buffer>;
  /** Isotipo (maquetario.svg). */
  mark?: Buffer;
}

const escapeHtml = (text: string): string =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/** fonts.css apunta a ../../fonts/<archivo>.ttf: se reemplaza por la fuente incrustada. */
export function inlineFonts(css: string, fonts: Record<string, Buffer>): string {
  return css.replace(/url\(\s*['"]?(?:\.\.\/)+fonts\/([\w.-]+\.ttf)['"]?\s*\)/g, (match, file) =>
    fonts[file] ? `url(data:font/ttf;base64,${fonts[file].toString('base64')})` : match,
  );
}

/** Estilos propios de la página: sólo tokens de la interfaz, como notice.css. */
const PAGE_CSS = `
* { box-sizing: border-box; margin: 0; }
html, body { min-height: 100%; }
body {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: var(--space-xl);
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-ui);
  font-size: var(--type-body);
  line-height: var(--leading-ui);
  -webkit-font-smoothing: antialiased;
}
.callback {
  max-width: var(--dialog-confirm-width);
  padding: var(--space-2xl);
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card);
  box-shadow: var(--elevation-2);
  text-align: center;
}
.callback-brand {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--type-headline);
  font-weight: var(--weight-semibold);
}
.callback-brand img { width: var(--icon-md); height: var(--icon-md); }
.callback-title {
  margin-top: var(--space-xl);
  font-size: var(--type-title1);
  font-weight: var(--weight-semibold);
  line-height: var(--leading-tight);
  letter-spacing: var(--tracking-title);
}
.callback.is-error .callback-title { color: var(--destructive); }
.callback-text {
  margin-top: var(--space-md);
  color: var(--muted-foreground);
  line-height: var(--leading-text);
}
`;

/** Arma la función de página para el cliente de Motiova a partir de los archivos de la app. */
export function callbackPage(assets: CallbackAssets): CallbackPage {
  const tokens = assets.sheets.map((css) => inlineFonts(css, assets.fonts)).join('\n');
  const mark = assets.mark
    ? `<img src="data:image/svg+xml;base64,${assets.mark.toString('base64')}" alt="">`
    : '';
  return (title, text, ok) =>
    '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    `<title>${escapeHtml(title)} · Maquetario</title><style>${tokens}${PAGE_CSS}</style></head>` +
    `<body><main class="callback${ok ? '' : ' is-error'}">` +
    `<p class="callback-brand">${mark}Maquetario</p>` +
    `<h1 class="callback-title">${escapeHtml(title)}</h1>` +
    `<p class="callback-text">${escapeHtml(text)}</p></main></body></html>`;
}
