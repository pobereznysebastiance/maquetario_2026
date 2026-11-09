// Asistente editorial conectado al servicio del aula.
// El código de aula se guarda cifrado con safeStorage
// (Keychain en macOS, DPAPI en Windows). Más adelante esto pasa a usar la sesión de Motiova.
import { safeStorage } from 'electron';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { dataDir, exeDir, isSelfTest } from '../env.ts';
import { readJson } from '../files.ts';
import type { Session } from '../session.ts';

type AulaConfig = { url?: string; code?: string; device?: string };

const configFile = () => join(dataDir(), isSelfTest ? 'aula-selftest.dat' : 'aula.dat');

async function readConfig(): Promise<AulaConfig> {
  try {
    const raw = await readFile(configFile());
    const text = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : '';
    return JSON.parse(text) as AulaConfig;
  } catch {
    return {};
  }
}

async function classProfileUrl(): Promise<string> {
  const profile = await readJson<{ serviceUrl?: unknown }>(
    join(exeDir(), 'maquetario-aula.json'),
    {},
  );
  return typeof profile.serviceUrl === 'string' ? profile.serviceUrl : '';
}

function assistantUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Usá una dirección HTTPS del servicio del aula.');
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !(parsed.protocol === 'https:' || (parsed.protocol === 'http:' && loopback))
  ) {
    throw new Error('Usá una dirección HTTPS del servicio del aula.');
  }
  return parsed;
}

export async function assistantStatus() {
  const config = await readConfig();
  const profile = await classProfileUrl();
  const endpoint = config.url ?? profile;
  return {
    configured: endpoint.length > 0 && !!config.code,
    serviceUrl: endpoint,
    hasProfile: profile.length > 0,
  };
}

export async function configureAssistant(payload: { url?: unknown; code?: unknown }) {
  const url = String(payload.url ?? '').trim();
  let code = String(payload.code ?? '').trim();
  assistantUrl(url);
  const old = await readConfig();
  if (!code && old.url === url && old.code) code = old.code;
  if (code.length < 8 || code.length > 200)
    throw new Error('Ingresá el código de aula provisto por tu docente.');
  if (!safeStorage.isEncryptionAvailable())
    throw new Error('Este equipo no permite guardar el código de forma segura.');
  const config: AulaConfig = {
    url: url.replace(/\/+$/, ''),
    code,
    device: old.device ?? randomUUID().replaceAll('-', ''),
  };
  await mkdir(dirname(configFile()), { recursive: true });
  await writeFile(configFile(), safeStorage.encryptString(JSON.stringify(config)));
  return assistantStatus();
}

export async function assistantReview(
  session: Session,
  payload: { consent?: unknown; document?: unknown },
) {
  if (session.assistantWorking) throw new Error('Hay una consulta en curso.');
  if (payload.consent !== true) throw new Error('Confirmá el envío de esta consulta.');
  const config = await readConfig();
  if (!config.url || !config.code) throw new Error('Primero conectá el aula.');
  const body = JSON.stringify(payload.document ?? null);
  if (body.length > 60_000) throw new Error('La consulta supera el límite de texto.');
  session.assistantWorking = true;
  try {
    const endpoint = new URL(`${assistantUrl(config.url).href.replace(/\/+$/, '')}/review`);
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        redirect: 'manual',
        signal: AbortSignal.timeout(120_000),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.code}`,
          'X-Maquetario-Device': config.device ?? '',
        },
        body,
      });
    } catch {
      throw new Error('No se pudo consultar al aula. Revisá la conexión o avisá a tu docente.');
    }
    if (response.status === 401) throw new Error('Código de aula incorrecto o vencido.');
    if (response.status === 429)
      throw new Error('El aula alcanzó su límite de consultas. Intentá más tarde.');
    if (!response.ok)
      throw new Error('No se pudo consultar al aula. Revisá la conexión o avisá a tu docente.');
    const text = await response.text();
    if (text.length > 200_000) throw new Error('Respuesta del aula demasiado grande.');
    return JSON.parse(text) as unknown;
  } finally {
    session.assistantWorking = false;
  }
}
