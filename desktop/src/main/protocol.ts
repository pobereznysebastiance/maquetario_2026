// Sirve la interfaz desde maquetario://app/ (en vez de file://) y las fuentes
// del catálogo desde maquetario://app/__fonts/<id>.ttf, en el mismo origen.
import { protocol } from 'electron';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { APP_SCHEME, FONT_ROUTE, noticeDir, rendererDir } from './env.ts';
import { findFace } from './fonts/catalog.ts';
import { faceBytes } from './fonts/opentype.ts';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** Debe llamarse antes de app.whenReady(). */
export function registerScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true },
    },
  ]);
}

const notFound = () => new Response('No encontrado', { status: 404 });

async function serveFont(pathname: string): Promise<Response> {
  const id = decodeURIComponent(pathname.slice(FONT_ROUTE.length)).split('.')[0] ?? '';
  const face = findFace(id);
  if (!face) return notFound();
  try {
    return new Response(new Uint8Array(await faceBytes(face)), {
      headers: { 'Content-Type': 'font/ttf', 'Cache-Control': 'private, max-age=3600' },
    });
  } catch {
    return notFound();
  }
}

/** Política de contenido también como cabecera (además del meta del HTML): defensa en profundidad. */
const APP_CSP = [
  "default-src 'self' data: blob:",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data: https://fonts.maquetario.local",
  "connect-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
].join('; ');

async function serveFile(root: string, pathname: string, csp?: string): Promise<Response> {
  // Nunca servir algo fuera de la carpeta indicada.
  const file = normalize(join(root, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(root + sep)) return notFound();
  try {
    return new Response(new Uint8Array(await readFile(file)), {
      headers: {
        'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
        // Archivos locales: leer siempre la versión actual (si no, Ctrl+R muestra CSS viejo).
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        ...(csp && extname(file).toLowerCase() === '.html'
          ? { 'Content-Security-Policy': csp }
          : {}),
      },
    });
  } catch {
    return notFound();
  }
}

export function handleScheme(): void {
  const roots: Record<string, string> = { app: rendererDir(), notice: noticeDir() };
  protocol.handle(APP_SCHEME, (request) => {
    const url = new URL(request.url);
    const root = Object.hasOwn(roots, url.host) ? roots[url.host] : undefined;
    if (!root) return notFound();
    const pathname = decodeURIComponent(url.pathname);
    if (url.host === 'app' && pathname.startsWith(FONT_ROUTE)) return serveFont(url.pathname);
    return serveFile(root, pathname, url.host === 'app' ? APP_CSP : undefined);
  });
}
