// Conexión con Motiova: cuenta, licencia de este equipo y versiones nuevas.
// Contrato en docs/arquitectura.md → "Conexión con Motiova" (detalle de cada endpoint en
// Motiova: docs/SOFTWARE_08-NOV_LICENCIAS.md). Este módulo no depende de Electron: el
// almacén del token, el navegador y los archivos llegan desde motiova/desktop.ts, y las
// pruebas lo ejercitan contra un Motiova falso.
import { createHash, randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';

export type Platform = 'windows' | 'macos' | 'linux';

export interface MotiovaConfig {
  /** Web de Motiova, p. ej. https://motiova.com (abre la página de activación). */
  web: string;
  /** API, p. ej. https://api.motiova.com/api/v1 */
  api: string;
  /** license_code del programa en Motiova. */
  product: string;
}

/** Dónde se guarda el refresh_token (almacén seguro del sistema). */
export interface TokenStore {
  load(): Promise<string | null>;
  save(token: string): Promise<void>;
  clear(): Promise<void>;
}

export interface Device {
  id: string;
  name: string;
  platform: Platform;
}

export interface MotiovaUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

export interface IssuedLicense {
  license: string;
  expires_at: string;
  product: string;
  edition: string;
  devices_in_use: number;
  max_devices: number;
}

export interface ReleaseInfo {
  version: string;
  notes: string;
  released_at?: string;
  files: { platform: Platform; size_bytes: number; sha256: string; file_name: string }[];
}

export interface Resource {
  slug: string;
  title: string;
  license_code: string;
  edition: string;
  max_devices: number;
  devices_in_use: number;
  latest: ReleaseInfo | null;
}

export interface DownloadLink {
  url: string;
  file_name: string;
  size_bytes: number;
  sha256: string;
  version: string;
}

export type MotiovaErrorCode =
  | 'offline' // sin conexión o el servidor no responde
  | 'signed-out' // no hay sesión, o venció: hay que volver a conectar
  | 'no-product' // 403: la cuenta no tiene el programa
  | 'device-limit' // 409: ya está en todas las computadoras permitidas
  | 'unavailable' // 503
  | 'cancelled'
  | 'timeout'
  | 'rejected'; // otro error con mensaje del servidor

/** Error con un mensaje listo para mostrar. */
export class MotiovaError extends Error {
  readonly code: MotiovaErrorCode;
  readonly status: number;
  constructor(code: MotiovaErrorCode, message: string, status = 0) {
    super(message);
    this.name = 'MotiovaError';
    this.code = code;
    this.status = status;
  }
}

const MESSAGES: Record<MotiovaErrorCode, string> = {
  offline: 'No pudimos conectarnos con Motiova. Revisá tu conexión a internet y volvé a intentar.',
  'signed-out': 'Tu sesión de Motiova terminó. Volvé a conectar Maquetario con tu cuenta.',
  'no-product': 'Tu cuenta de Motiova no tiene Maquetario.',
  'device-limit': 'Ya usás Maquetario en todas las computadoras permitidas. Liberá una desde Mi cuenta, en Mis programas.',
  unavailable: 'Motiova no puede emitir licencias en este momento. Probá en un rato.',
  cancelled: 'Se canceló la conexión con Motiova.',
  timeout: 'No llegó la confirmación desde el navegador. Volvé a intentar.',
  rejected: 'Motiova no aceptó el pedido. Volvé a intentar.',
};

const base64url = (bytes: Buffer): string => bytes.toString('base64url');

/** PKCE S256: verificador de 86 caracteres, desafío = base64url(sha256(verificador)), estado aleatorio. */
export function createPkce(): { verifier: string; challenge: string; state: string } {
  const verifier = base64url(randomBytes(64));
  const challenge = base64url(createHash('sha256').update(verifier, 'ascii').digest());
  return { verifier, challenge, state: base64url(randomBytes(24)) };
}

export function activationUrl(web: string, port: number, state: string, challenge: string): string {
  const url = new URL('/activar-programa', web.replace(/\/+$/, '') + '/');
  url.search = new URLSearchParams({ puerto: String(port), estado: state, desafio: challenge }).toString();
  return url.toString();
}

export function platformOf(nodePlatform: NodeJS.Platform): Platform {
  return nodePlatform === 'win32' ? 'windows' : nodePlatform === 'darwin' ? 'macos' : 'linux';
}

/** true si `candidate` es una versión más nueva que `current` (números separados por punto). */
export function isNewer(candidate: string, current: string): boolean {
  const parts = (v: string) => v.trim().replace(/^v/i, '').split(/[.+-]/).slice(0, 3).map((p) => Number.parseInt(p, 10) || 0);
  const a = parts(candidate);
  const b = parts(current);
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return false;
}

const PAGE = (title: string, text: string) =>
  `<!doctype html><html lang="es"><meta charset="utf-8"><title>${title}</title>` +
  '<body style="font:16px system-ui,sans-serif;background:#10212a;color:#f4f5ee;display:grid;place-items:center;height:100vh;margin:0">' +
  `<div style="max-width:420px;text-align:center"><h1 style="font-size:22px;font-weight:600">${title}</h1><p style="color:#b8d1cd;line-height:1.6">${text}</p></div></body></html>`;

export interface CallbackListener {
  port: number;
  /** El código de autorización, una vez que el navegador vuelve con el estado correcto. */
  code: Promise<string>;
  close(): void;
}

/**
 * Escucha en 127.0.0.1:<puerto libre>/callback hasta que el navegador vuelva con `code` y el
 * `state` esperado. Cualquier otro pedido se ignora.
 */
export function listenForCallback(state: string, timeoutMs: number, signal?: AbortSignal): Promise<CallbackListener> {
  return new Promise((resolveListener, rejectListener) => {
    let settle: { resolve: (code: string) => void; reject: (error: Error) => void } | null = null;
    const code = new Promise<string>((resolve, reject) => (settle = { resolve, reject }));
    code.catch(() => undefined); // Si nadie espera el código, que no quede un rechazo suelto.
    let done = false;
    const server: Server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (url.pathname !== '/callback' || done) {
        res.writeHead(404).end();
        return;
      }
      const given = url.searchParams.get('code');
      if (url.searchParams.get('state') !== state || !given) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(PAGE('No se pudo conectar', 'El enlace no corresponde a este pedido. Volvé a Maquetario e intentá de nuevo.'));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(PAGE('Listo', 'Maquetario ya está conectado con tu cuenta. Podés cerrar esta pestaña y volver al programa.'));
      finish(null, given);
    });
    const timer = setTimeout(() => finish(new MotiovaError('timeout', MESSAGES.timeout)), timeoutMs);
    const onAbort = () => finish(new MotiovaError('cancelled', MESSAGES.cancelled));
    signal?.addEventListener('abort', onAbort, { once: true });
    function finish(error: Error | null, value?: string) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      server.close();
      server.closeAllConnections?.();
      if (error) settle!.reject(error);
      else settle!.resolve(value!);
    }
    server.once('error', rejectListener);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolveListener({ port, code, close: () => finish(new MotiovaError('cancelled', MESSAGES.cancelled)) });
    });
  });
}

/** Texto del error tal como lo manda Motiova ({detail: "…"}), si viene uno. */
async function detailOf(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { detail?: unknown; error?: unknown };
    const detail = body.detail ?? body.error;
    return typeof detail === 'string' && detail.trim() ? detail : null;
  } catch {
    return null;
  }
}

const ACCESS_TTL_MS = 25 * 60 * 1000; // El access_token dura 30 minutos: se renueva antes.

export class MotiovaClient {
  readonly config: MotiovaConfig;
  private readonly store: TokenStore;
  private readonly fetchImpl: typeof fetch;
  private access: { token: string; at: number } | null = null;
  private refreshing: Promise<string> | null = null;
  user: MotiovaUser | null = null;

  constructor(config: MotiovaConfig, store: TokenStore, fetchImpl: typeof fetch = fetch) {
    this.config = { ...config, web: config.web.replace(/\/+$/, ''), api: config.api.replace(/\/+$/, '') };
    this.store = store;
    this.fetchImpl = fetchImpl;
  }

  async hasSession(): Promise<boolean> {
    return !!(await this.store.load());
  }

  private async request<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.config.api}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new MotiovaError('offline', MESSAGES.offline);
    }
    if (response.ok) return (response.status === 204 ? null : await response.json()) as T;
    const detail = await detailOf(response);
    const code: MotiovaErrorCode =
      response.status === 401
        ? 'signed-out'
        : response.status === 403
          ? 'no-product'
          : response.status === 409
            ? 'device-limit'
            : response.status === 503
              ? 'unavailable'
              : response.status >= 500
                ? 'offline'
                : 'rejected';
    // El 401 de la API no trae un mensaje para la persona: se usa el propio.
    const message = code === 'signed-out' || code === 'offline' ? MESSAGES[code] : (detail ?? MESSAGES[code]);
    throw new MotiovaError(code, message, response.status);
  }

  /**
   * Login con el navegador (OAuth 2.0 + PKCE). `open` abre la URL en el navegador del sistema.
   * Guarda el refresh_token y deja el access_token en memoria.
   */
  async connect(open: (url: string) => Promise<void> | void, options: { timeoutMs?: number; signal?: AbortSignal } = {}): Promise<MotiovaUser> {
    const pkce = createPkce();
    const listener = await listenForCallback(pkce.state, options.timeoutMs ?? 5 * 60 * 1000, options.signal);
    try {
      await open(activationUrl(this.config.web, listener.port, pkce.state, pkce.challenge));
    } catch (error) {
      listener.close();
      throw error;
    }
    const code = await listener.code;
    const tokens = await this.request<{ access_token: string; refresh_token: string; user: MotiovaUser }>('POST', '/desktop/token', {
      code,
      code_verifier: pkce.verifier,
    });
    await this.store.save(tokens.refresh_token);
    this.access = { token: tokens.access_token, at: Date.now() };
    this.user = tokens.user;
    return tokens.user;
  }

  /**
   * Access token vigente. Si hace falta, lo renueva con el refresh_token; cada refresh se usa una
   * sola vez, así que el nuevo se guarda antes de seguir. Un solo refresh a la vez.
   */
  async accessToken(force = false): Promise<string> {
    if (!force && this.access && Date.now() - this.access.at < ACCESS_TTL_MS) return this.access.token;
    this.refreshing ??= (async () => {
      const refresh = await this.store.load();
      if (!refresh) throw new MotiovaError('signed-out', MESSAGES['signed-out']);
      try {
        const tokens = await this.request<{ access_token: string; refresh_token: string; user?: MotiovaUser }>('POST', '/auth/refresh', {
          refresh_token: refresh,
        });
        await this.store.save(tokens.refresh_token);
        this.access = { token: tokens.access_token, at: Date.now() };
        if (tokens.user) this.user = tokens.user;
        return tokens.access_token;
      } catch (error) {
        // Refresh vencido o ya usado: la sesión no sirve más.
        if (error instanceof MotiovaError && error.code === 'signed-out') await this.signOutLocally();
        throw error;
      }
    })().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  /** Pedido autenticado; ante un 401 renueva una vez y reintenta. */
  private async authed<T>(method: string, path: string, body?: unknown): Promise<T> {
    try {
      return await this.request<T>(method, path, body, await this.accessToken());
    } catch (error) {
      if (!(error instanceof MotiovaError) || error.code !== 'signed-out' || !this.access) throw error;
      this.access = null;
      return this.request<T>(method, path, body, await this.accessToken(true));
    }
  }

  /** Emite (o renueva) la licencia firmada de este equipo. */
  requestLicense(device: Device): Promise<IssuedLicense> {
    return this.authed<IssuedLicense>('POST', '/desktop/licenses', {
      product: this.config.product,
      device_id: device.id,
      device_name: device.name.slice(0, 80),
      platform: device.platform,
    });
  }

  /** El programa en la cuenta (edición, equipos y última versión), o null si la cuenta no lo tiene. */
  async resource(): Promise<Resource | null> {
    const { resources } = await this.authed<{ resources: Resource[] }>('GET', '/desktop/resources');
    return resources.find((r) => r.license_code === this.config.product || r.slug === this.config.product) ?? null;
  }

  downloadLink(slug: string, platform: Platform): Promise<DownloadLink> {
    return this.authed<DownloadLink>('POST', `/me/products/${encodeURIComponent(slug)}/download`, { platform });
  }

  /**
   * "Cerrar sesión en esta computadora": libera el lugar del equipo y cierra la sesión.
   * Aunque Motiova no responda, la sesión local se borra igual.
   */
  async release(device: Device): Promise<void> {
    try {
      await this.authed<null>('POST', '/desktop/licenses/release', { product: this.config.product, device_id: device.id });
      const refresh = await this.store.load();
      if (refresh) await this.request<null>('POST', '/auth/logout', { refresh_token: refresh }).catch(() => undefined);
    } finally {
      await this.signOutLocally();
    }
  }

  async signOutLocally(): Promise<void> {
    this.access = null;
    this.user = null;
    await this.store.clear();
  }
}

export const motiovaMessage = (code: MotiovaErrorCode): string => MESSAGES[code];
