// Verificación de la licencia de Motiova. La pide la propia app al conectar la cuenta
// (motiova/desktop.ts) y, más adelante, también podrá dejarla el launcher.
//
// Contrato (ver docs/arquitectura.md):
// - La licencia es un archivo de texto "MQL1.…" en <appData>/Motiova/licenses/maquetario.lic,
//   o la ruta que llegue con --license-file=<ruta>.
// - Si existe <appData>/Motiova/device.json ({"deviceId": "..."}), la licencia tiene que ser de ese equipo.
//
// Modos (desktop/package.json → maquetario.licenseMode):
// - "off":     no bloquea ni avisa (hoy, hasta la versión a la venta); sí se verifica para mostrarla en Cuenta.
// - "warn":    se verifica y sólo se registra en consola.
// - "enforce": sin licencia válida, la app no abre.
import { app } from 'electron';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describeFailure, verifyLicense, type LicenseClaims, type LicenseResult } from '@maquetario/license';
import { appVersion, argValue, motiovaDir } from './env.ts';
import { PRODUCTION_PUBLIC_KEYS } from './license-keys.ts';

export type LicenseMode = 'off' | 'warn' | 'enforce';

let current: { mode: LicenseMode; result: LicenseResult | null } = { mode: 'off', result: null };

/** Fijado al compilar desde desktop/package.json (scripts/build.mjs): no se lee de un archivo editable. */
declare const __LICENSE_MODE__: string;

function mode(): LicenseMode {
  const configured = __LICENSE_MODE__;
  // La variable de entorno sólo vale en desarrollo: una instalación no se puede "apagar" desde afuera.
  const override = app.isPackaged ? undefined : process.env.MAQUETARIO_LICENSE_MODE;
  const value = override ?? configured ?? 'off';
  return value === 'warn' || value === 'enforce' ? value : 'off';
}

function publicKeys(): Record<string, string> {
  const keys: Record<string, string> = { ...PRODUCTION_PUBLIC_KEYS };
  if (!app.isPackaged) {
    // En desarrollo se acepta la clave de packages/license/dev-keys (npm run license:dev-keys).
    try {
      keys.dev = readFileSync(resolve(__dirname, '..', '..', 'packages', 'license', 'dev-keys', 'public.pem'), 'utf8');
    } catch {
      // Sin claves de desarrollo.
    }
  }
  return keys;
}

const readText = (path: string): string | null => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
};

function deviceId(): string | undefined {
  const text = readText(join(motiovaDir(), 'device.json'));
  if (!text) return undefined;
  try {
    const id = (JSON.parse(text) as { deviceId?: unknown }).deviceId;
    return typeof id === 'string' && id ? id : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Lee y verifica la licencia. Se verifica en todos los modos (la sección Cuenta muestra si está
 * vigente); sólo en "enforce" impide abrir la app. Se vuelve a llamar al recibir una licencia nueva.
 */
export function checkLicense(): { mode: LicenseMode; result: LicenseResult | null } {
  const selected = mode();
  const file = argValue('license-file') ?? join(motiovaDir(), 'licenses', 'maquetario.lic');
  const token = readText(file);
  const result: LicenseResult = token
    ? verifyLicense(token, { publicKeys: publicKeys(), product: 'maquetario', appVersion: appVersion(), deviceId: deviceId() })
    : { ok: false, reason: 'missing' };
  if (!result.ok && selected !== 'off') console.warn(`[licencia] ${result.reason}: ${describeFailure(result.reason)}`);
  return (current = { mode: selected, result });
}

export const licenseBlocks = (): boolean => current.mode === 'enforce' && !current.result?.ok;
export const licenseMessage = (): string =>
  current.result && !current.result.ok ? describeFailure(current.result.reason) : '';

/** Lo que la interfaz puede mostrar (sin datos sensibles más allá de la cuenta). */
export function licenseSummary(): null | { mode: LicenseMode; valid: boolean; edition?: string; email?: string; expires?: string } {
  if (!current.result) return null;
  const claims: LicenseClaims | undefined = current.result?.ok ? current.result.claims : undefined;
  return {
    mode: current.mode,
    valid: !!current.result?.ok,
    edition: claims?.edition,
    email: claims?.email,
    expires: claims ? new Date(claims.exp * 1000).toISOString() : undefined,
  };
}
