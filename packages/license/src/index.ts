/**
 * Licencias de Maquetario.
 *
 * Motiova (el backend) firma la licencia con una clave privada Ed25519 y el
 * launcher se la entrega a Maquetario. Maquetario la verifica con la clave
 * pública que trae incorporada, así que funciona sin conexión hasta `exp`.
 *
 * Formato (texto, una línea):
 *   MQL1.<payload>.<firma>
 * - payload: JSON de `LicenseClaims` en UTF-8, codificado en base64url.
 * - firma:   Ed25519 sobre los bytes ASCII de "MQL1.<payload>", en base64url.
 *
 * Ver README.md para emitirla desde otro lenguaje (el backend es Python).
 */
import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';

export const LICENSE_PREFIX = 'MQL1';

export interface LicenseClaims {
  /** Versión del formato de claims. */
  v: 1;
  /** Emisor. Siempre "motiova". */
  iss: 'motiova';
  /** Identificador de la clave que firmó; permite rotar claves. */
  kid: string;
  /** Id del usuario en Motiova. */
  sub: string;
  email: string;
  name?: string;
  /** Producto licenciado, p. ej. "maquetario". */
  product: string;
  /** Edición o plan. Los valores los define Motiova (p. ej. "estudiante", "pro"). */
  edition: string;
  /** Versión mayor más alta que cubre la licencia; null = todas. */
  maxMajor: number | null;
  /** Funciones habilitadas además de las de la edición (opcional). */
  features?: string[];
  /** Id del equipo que registró el launcher. */
  device: string;
  /** Emitida y vencimiento, en segundos Unix. */
  iat: number;
  exp: number;
}

export type LicenseFailure =
  | 'missing'
  | 'malformed'
  | 'unknown-key'
  | 'bad-signature'
  | 'expired'
  | 'not-yet-valid'
  | 'wrong-issuer'
  | 'wrong-product'
  | 'version-not-covered'
  | 'wrong-device';

export type LicenseResult =
  | { ok: true; claims: LicenseClaims }
  | { ok: false; reason: LicenseFailure; claims?: LicenseClaims };

export interface VerifyOptions {
  /** Claves públicas (PEM SPKI) por `kid`. */
  publicKeys: Record<string, string>;
  product: string;
  /** Versión de la app que verifica, p. ej. "3.24.0". */
  appVersion: string;
  /** Si se pasa, la licencia tiene que ser de este equipo. */
  deviceId?: string;
  /** Hora actual en ms; por defecto Date.now(). */
  now?: number;
  /** Tolerancia de reloj en segundos (por defecto 300). */
  clockSkewSeconds?: number;
}

const toBase64Url = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64url');
const fromBase64Url = (text: string): Buffer => Buffer.from(text, 'base64url');
const BASE64URL = /^[A-Za-z0-9_-]+$/;

function isClaims(value: unknown): value is LicenseClaims {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  return (
    c.v === 1 &&
    typeof c.iss === 'string' &&
    typeof c.kid === 'string' &&
    typeof c.sub === 'string' &&
    typeof c.email === 'string' &&
    typeof c.product === 'string' &&
    typeof c.edition === 'string' &&
    (c.maxMajor === null || Number.isInteger(c.maxMajor)) &&
    (c.features === undefined || (Array.isArray(c.features) && c.features.every((f) => typeof f === 'string'))) &&
    typeof c.device === 'string' &&
    Number.isFinite(c.iat) &&
    Number.isFinite(c.exp)
  );
}

/** Lee los claims SIN verificar la firma. Sólo para mostrar datos; nunca para autorizar. */
export function decodeLicenseUnverified(token: string): LicenseClaims | null {
  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts[0] !== LICENSE_PREFIX || !BASE64URL.test(parts[1]!)) return null;
  try {
    const claims: unknown = JSON.parse(fromBase64Url(parts[1]!).toString('utf8'));
    return isClaims(claims) ? claims : null;
  } catch {
    return null;
  }
}

function majorOf(version: string): number {
  const major = Number.parseInt(version.split('.')[0] ?? '', 10);
  if (!Number.isInteger(major)) throw new Error(`Versión inválida: ${version}`);
  return major;
}

export function verifyLicense(token: string, options: VerifyOptions): LicenseResult {
  const text = token.trim();
  if (text.length > 16_384) return { ok: false, reason: 'malformed' };
  const parts = text.split('.');
  if (parts.length !== 3 || parts[0] !== LICENSE_PREFIX || !BASE64URL.test(parts[1]!) || !BASE64URL.test(parts[2]!)) {
    return { ok: false, reason: 'malformed' };
  }
  const claims = decodeLicenseUnverified(text);
  if (!claims) return { ok: false, reason: 'malformed' };

  const pem = options.publicKeys[claims.kid];
  if (!pem) return { ok: false, reason: 'unknown-key', claims };
  let key: KeyObject;
  try {
    key = createPublicKey(pem);
  } catch {
    return { ok: false, reason: 'unknown-key', claims };
  }
  if (key.asymmetricKeyType !== 'ed25519') return { ok: false, reason: 'unknown-key', claims };

  const signed = Buffer.from(`${parts[0]}.${parts[1]}`, 'ascii');
  if (!verify(null, signed, key, fromBase64Url(parts[2]!))) return { ok: false, reason: 'bad-signature', claims };

  // A partir de acá la firma es válida: los claims son de Motiova.
  const now = Math.floor((options.now ?? Date.now()) / 1000);
  const skew = options.clockSkewSeconds ?? 300;
  if (claims.iss !== 'motiova') return { ok: false, reason: 'wrong-issuer', claims };
  if (claims.product !== options.product) return { ok: false, reason: 'wrong-product', claims };
  if (claims.iat - skew > now) return { ok: false, reason: 'not-yet-valid', claims };
  if (claims.exp + skew <= now) return { ok: false, reason: 'expired', claims };
  if (claims.maxMajor !== null && majorOf(options.appVersion) > claims.maxMajor) {
    return { ok: false, reason: 'version-not-covered', claims };
  }
  if (options.deviceId !== undefined && claims.device !== options.deviceId) {
    return { ok: false, reason: 'wrong-device', claims };
  }
  return { ok: true, claims };
}

/**
 * Firma una licencia. La usa el backend (o las herramientas de desarrollo);
 * Maquetario nunca tiene una clave privada.
 */
export function issueLicense(claims: LicenseClaims, privateKeyPem: string): string {
  if (!isClaims(claims)) throw new Error('Claims de licencia incompletos.');
  const key = createPrivateKey(privateKeyPem);
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('La clave de firma tiene que ser Ed25519.');
  const payload = toBase64Url(Buffer.from(JSON.stringify(claims), 'utf8'));
  const head = `${LICENSE_PREFIX}.${payload}`;
  const signature = sign(null, Buffer.from(head, 'ascii'), key);
  return `${head}.${toBase64Url(signature)}`;
}

/** Mensaje para la persona usuaria, por motivo de rechazo. */
export function describeFailure(reason: LicenseFailure): string {
  switch (reason) {
    case 'expired':
      return 'Tu licencia necesita renovarse. Conectate a internet y conectá Maquetario con tu cuenta de Motiova.';
    case 'version-not-covered':
      return 'Tu licencia no incluye esta versión de Maquetario.';
    case 'wrong-device':
      return 'Esta licencia es de otra computadora. Conectá Maquetario con tu cuenta de Motiova en esta.';
    case 'wrong-product':
      return 'La licencia es de otro producto de Motiova.';
    case 'not-yet-valid':
      return 'La licencia todavía no es válida. Revisá la fecha y hora de la computadora.';
    default:
      return 'Para usar Maquetario, conectalo con tu cuenta de Motiova.';
  }
}
