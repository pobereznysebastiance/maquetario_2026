// Motiova en la app de escritorio: dónde se guardan el token, el equipo y la licencia, y cómo se
// abren el navegador y las descargas. El protocolo está en client.ts.
import { app, safeStorage, shell } from 'electron';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import { appVersion, dataDir, motiovaDir } from '../env.ts';
import { checkLicense, licenseSummary } from '../license.ts';
import {
  isNewer,
  MotiovaClient,
  MotiovaError,
  platformOf,
  type Device,
  type MotiovaConfig,
  type ReleaseInfo,
  type Resource,
  type TokenStore,
} from './client.ts';

/** Fijadas al compilar desde desktop/package.json → maquetario.motiova (scripts/build.mjs). */
declare const __MOTIOVA__: { web: string; api: string; dev: { web: string; api: string } };

function config(): MotiovaConfig {
  // En desarrollo apunta a Motiova local (o a lo que digan MOTIOVA_WEB / MOTIOVA_API).
  // Una instalación usa siempre las de producción: no se pueden cambiar desde afuera.
  const dev = !app.isPackaged;
  return {
    web: (dev && process.env.MOTIOVA_WEB) || (dev ? __MOTIOVA__.dev.web : __MOTIOVA__.web),
    api: (dev && process.env.MOTIOVA_API) || (dev ? __MOTIOVA__.dev.api : __MOTIOVA__.api),
    product: 'maquetario',
  };
}

/**
 * El refresh_token, cifrado con el almacén del sistema (DPAPI en Windows, Keychain en macOS,
 * libsecret/kwallet en Linux). Si el sistema no ofrece uno, no se guarda: la sesión dura lo
 * que la app esté abierta.
 */
class SecureTokenStore implements TokenStore {
  private memory: string | null = null;
  private readonly file = join(dataDir(), 'motiova.session');

  private persistent(): boolean {
    if (!safeStorage.isEncryptionAvailable()) return false;
    return process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text';
  }

  async load(): Promise<string | null> {
    if (this.memory) return this.memory;
    if (!this.persistent()) return null;
    try {
      this.memory = safeStorage.decryptString(await readFile(this.file));
      return this.memory;
    } catch {
      return null;
    }
  }

  async save(token: string): Promise<void> {
    this.memory = token;
    if (!this.persistent()) return;
    const temp = `${this.file}.tmp`;
    await writeFile(temp, safeStorage.encryptString(token));
    await rename(temp, this.file);
  }

  async clear(): Promise<void> {
    this.memory = null;
    await rm(this.file, { force: true });
  }
}

let client: MotiovaClient | null = null;
const motiova = (): MotiovaClient =>
  (client ??= new MotiovaClient(config(), new SecureTokenStore()));

const licenseFile = (): string => join(motiovaDir(), 'licenses', 'maquetario.lic');

/** El equipo: <appData>/Motiova/device.json. Se crea una sola vez y es el que firma la licencia. */
async function device(): Promise<Device> {
  const file = join(motiovaDir(), 'device.json');
  let id: string | undefined;
  try {
    const value = (JSON.parse(await readFile(file, 'utf8')) as { deviceId?: unknown }).deviceId;
    if (typeof value === 'string' && value.length >= 8) id = value;
  } catch {
    // Todavía no existe.
  }
  if (!id) {
    id = randomUUID();
    await mkdir(motiovaDir(), { recursive: true });
    await writeFile(file, JSON.stringify({ deviceId: id }, null, 2));
  }
  return { id, name: hostname().trim() || 'Computadora', platform: platformOf(process.platform) };
}

async function writeLicense(token: string): Promise<void> {
  const file = licenseFile();
  await mkdir(join(motiovaDir(), 'licenses'), { recursive: true });
  await writeFile(`${file}.tmp`, token.trim() + '\n');
  await rename(`${file}.tmp`, file);
  checkLicense(); // La app pasa a usar la licencia nueva sin reiniciar.
}

export interface AccountStatus {
  connected: boolean;
  email?: string;
  name?: string;
  edition?: string;
  devicesInUse?: number;
  maxDevices?: number;
  /** Hasta cuándo funciona sin conexión (ISO). */
  validUntil?: string;
  licenseValid: boolean;
  update: UpdateInfo | null;
}

export interface UpdateInfo {
  version: string;
  notes: string;
}

let lastResource: Resource | null = null;
let lastUpdate: UpdateInfo | null = null;

function updateFrom(resource: Resource | null): UpdateInfo | null {
  const latest: ReleaseInfo | null | undefined = resource?.latest;
  return latest && isNewer(latest.version, appVersion())
    ? { version: latest.version, notes: latest.notes ?? '' }
    : null;
}

export async function accountStatus(): Promise<AccountStatus> {
  const summary = licenseSummary();
  const connected = await motiova().hasSession();
  const user = motiova().user;
  return {
    connected,
    email: user?.email ?? summary?.email,
    name: user ? `${user.first_name} ${user.last_name}`.trim() : undefined,
    edition: lastResource?.edition ?? summary?.edition,
    devicesInUse: lastResource?.devices_in_use,
    maxDevices: lastResource?.max_devices,
    validUntil: summary?.valid ? summary.expires : undefined,
    licenseValid: !!summary?.valid,
    update: lastUpdate,
  };
}

/** Licencia de este equipo + datos del programa en la cuenta. */
async function syncLicense(): Promise<void> {
  const issued = await motiova().requestLicense(await device());
  await writeLicense(issued.license);
  try {
    lastResource = await motiova().resource();
    lastUpdate = updateFrom(lastResource);
  } catch {
    // Sin la lista de recursos igual hay licencia: no se interrumpe por esto.
  }
  if (lastResource) {
    lastResource = {
      ...lastResource,
      devices_in_use: issued.devices_in_use,
      max_devices: issued.max_devices,
      edition: issued.edition,
    };
  }
}

let connecting: AbortController | null = null;

/** "Conectar con Motiova": login en el navegador y licencia de este equipo. */
export async function connectAccount(): Promise<AccountStatus> {
  connecting?.abort();
  const controller = new AbortController();
  connecting = controller;
  try {
    await motiova().connect((url) => shell.openExternal(url), { signal: controller.signal });
    await syncLicense();
    return accountStatus();
  } finally {
    if (connecting === controller) connecting = null;
  }
}

export function cancelConnect(): boolean {
  connecting?.abort();
  connecting = null;
  return true;
}

/** "Cerrar sesión en esta computadora": libera el lugar y borra la licencia y la sesión. */
export async function releaseAccount(): Promise<AccountStatus> {
  try {
    if (await motiova().hasSession()) await motiova().release(await device());
  } finally {
    await rm(licenseFile(), { force: true });
    lastResource = null;
    lastUpdate = null;
    checkLicense();
  }
  return accountStatus();
}

/**
 * Al abrir con conexión: renueva la licencia (vence a los 7 días sin conexión) y mira si hay
 * versión nueva. Sin sesión o sin conexión no hace nada; nunca interrumpe el arranque.
 */
export async function renewAtStartup(): Promise<UpdateInfo | null> {
  if (!(await motiova().hasSession())) return null;
  try {
    await syncLicense();
  } catch (error) {
    if (!(error instanceof MotiovaError)) throw error;
    console.warn(`[motiova] no se renovó la licencia: ${error.code}`);
  }
  return lastUpdate;
}

/**
 * Descarga el instalador de la versión nueva a la carpeta Descargas, verifica el sha256 y lo
 * muestra en la carpeta. Si el sha256 no coincide, borra el archivo.
 */
export async function downloadUpdate(): Promise<{ path: string; version: string }> {
  const slug = lastResource?.slug ?? 'maquetario';
  const link = await motiova().downloadLink(slug, platformOf(process.platform));
  const target = join(app.getPath('downloads'), link.file_name.replace(/[\\/:*?"<>|]/g, '_'));
  const partial = `${target}.descarga`;
  let response: Response;
  try {
    response = await fetch(link.url);
  } catch {
    throw new MotiovaError(
      'offline',
      'No pudimos bajar la versión nueva. Revisá tu conexión y volvé a intentar.',
    );
  }
  if (!response.ok || !response.body)
    throw new MotiovaError('rejected', 'El link de descarga venció. Volvé a intentar.');
  const hash = createHash('sha256');
  const body = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream);
  body.on('data', (chunk: Buffer) => hash.update(chunk));
  await pipeline(body, createWriteStream(partial));
  if (hash.digest('hex') !== link.sha256.toLowerCase()) {
    await rm(partial, { force: true });
    throw new MotiovaError(
      'rejected',
      'El archivo descargado no coincide con el publicado. Volvé a intentar.',
    );
  }
  await rename(partial, target);
  shell.showItemInFolder(target);
  return { path: target, version: link.version };
}

export { MotiovaError };
