import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import {
  activationUrl,
  createPkce,
  isNewer,
  listenForCallback,
  MotiovaClient,
  MotiovaError,
  platformOf,
  type Device,
  type TokenStore,
} from '../src/main/motiova/client.ts';

const memoryStore = (): TokenStore & { value: string | null } => ({
  value: null,
  async load() {
    return this.value;
  },
  async save(token: string) {
    this.value = token;
  },
  async clear() {
    this.value = null;
  },
});

const device: Device = {
  id: 'equipo-de-prueba-1234',
  name: 'Notebook de prueba',
  platform: 'windows',
};

/** Motiova falso: valida PKCE, rota el refresh (cada uno se usa una vez) y exige el bearer. */
async function fakeMotiova() {
  const state = {
    challenge: '',
    codes: new Map<string, string>(), // code → challenge
    refresh: new Set<string>(),
    access: new Set<string>(),
    refreshCalls: 0,
    deviceLimit: false,
    hasProduct: true,
    released: [] as string[],
    loggedOut: [] as string[],
    seq: 0,
  };
  const issue = () => {
    const access = `acc-${++state.seq}`;
    const refresh = `ref-${state.seq}`;
    state.access.add(access);
    state.refresh.add(refresh);
    return {
      access_token: access,
      refresh_token: refresh,
      token_type: 'bearer',
      user: { id: 'u1', email: 'ana@ejemplo.com', first_name: 'Ana', last_name: 'Pérez' },
    };
  };
  const server: Server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    const send = (status: number, data?: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(data === undefined ? '' : JSON.stringify(data));
    };
    const authed = () =>
      state.access.has(String(req.headers.authorization ?? '').replace('Bearer ', ''));
    const path = (req.url ?? '').replace('/api/v1', '');
    if (path === '/desktop/token') {
      const challenge = state.codes.get(body.code);
      const computed = createHash('sha256').update(body.code_verifier).digest('base64url');
      if (!challenge || challenge !== computed)
        return send(400, { detail: 'El link del programa no es válido.' });
      state.codes.delete(body.code);
      return send(200, issue());
    }
    if (path === '/auth/refresh') {
      state.refreshCalls++;
      if (!state.refresh.delete(body.refresh_token)) return send(401, { detail: 'Token inválido' });
      return send(200, issue());
    }
    if (path === '/auth/logout') {
      state.loggedOut.push(body.refresh_token);
      return send(204);
    }
    if (!authed()) return send(401, { detail: 'No autenticado' });
    if (path === '/desktop/licenses') {
      if (!state.hasProduct) return send(403, { detail: 'Tu cuenta no tiene Maquetario' });
      if (state.deviceLimit)
        return send(409, {
          detail: 'Ya usás Maquetario en 2 computadoras (A, B). Liberá una desde Mi cuenta.',
        });
      return send(200, {
        license: `MQL1.licencia.${body.device_id}`,
        expires_at: '2026-11-15T00:00:00Z',
        product: body.product,
        edition: 'estandar',
        devices_in_use: 1,
        max_devices: 2,
      });
    }
    if (path === '/desktop/resources') {
      return send(200, {
        resources: [
          {
            slug: 'maquetario',
            title: 'Maquetario',
            license_code: 'maquetario',
            edition: 'estandar',
            max_devices: 2,
            devices_in_use: 1,
            latest: { version: '3.25.0', notes: 'Mejoras', files: [] },
          },
        ],
      });
    }
    if (path === '/desktop/licenses/release') {
      state.released.push(body.device_id);
      return send(204);
    }
    send(404, { detail: 'No existe' });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return { state, server, api: `http://127.0.0.1:${port}/api/v1` };
}

/** "Navegador": la web de Motiova aprueba y redirige al callback del programa. */
const browser = (motiova: Awaited<ReturnType<typeof fakeMotiova>>) => async (url: string) => {
  const params = new URL(url).searchParams;
  const code = `codigo-${Math.random().toString(36).slice(2)}`;
  motiova.state.codes.set(code, params.get('desafio')!);
  const response = await fetch(
    `http://127.0.0.1:${params.get('puerto')}/callback?code=${code}&state=${params.get('estado')}`,
  );
  assert.equal(response.status, 200);
};

test('PKCE S256, URL de activación y utilidades', () => {
  const pkce = createPkce();
  assert.ok(pkce.verifier.length >= 43 && pkce.verifier.length <= 128);
  assert.match(pkce.verifier, /^[A-Za-z0-9_-]+$/);
  assert.equal(pkce.challenge, createHash('sha256').update(pkce.verifier).digest('base64url'));
  assert.ok(pkce.state.length >= 16);
  assert.notEqual(createPkce().verifier, pkce.verifier);

  const url = new URL(activationUrl('https://motiova.com/', 51234, 'estado123', 'desafio456'));
  assert.equal(url.origin + url.pathname, 'https://motiova.com/activar-programa');
  assert.equal(url.searchParams.get('puerto'), '51234');
  assert.equal(url.searchParams.get('estado'), 'estado123');
  assert.equal(url.searchParams.get('desafio'), 'desafio456');

  assert.equal(isNewer('3.25.0', '3.24.0'), true);
  assert.equal(isNewer('3.24.10', '3.24.9'), true);
  assert.equal(isNewer('4.0.0', '3.99.99'), true);
  assert.equal(isNewer('3.24.0', '3.24.0'), false);
  assert.equal(isNewer('v3.23.5', '3.24.0'), false);

  assert.equal(platformOf('win32'), 'windows');
  assert.equal(platformOf('darwin'), 'macos');
  assert.equal(platformOf('linux'), 'linux');
});

test('conectar, pedir la licencia, rotar el refresh y cerrar sesión', async () => {
  const motiova = await fakeMotiova();
  try {
    const store = memoryStore();
    const client = new MotiovaClient(
      { web: 'https://motiova.test', api: motiova.api, product: 'maquetario' },
      store,
    );

    const user = await client.connect(browser(motiova));
    assert.equal(user.email, 'ana@ejemplo.com');
    assert.equal(store.value, 'ref-1');
    assert.equal(await client.hasSession(), true);

    const license = await client.requestLicense(device);
    assert.equal(license.license, 'MQL1.licencia.equipo-de-prueba-1234');
    assert.equal(license.max_devices, 2);
    assert.equal(motiova.state.refreshCalls, 0, 'el access_token del login alcanza');

    // Renovación forzada: dos pedidos a la vez hacen un solo refresh, y el nuevo queda guardado.
    const [a, b] = await Promise.all([client.accessToken(true), client.accessToken(true)]);
    assert.equal(a, b);
    assert.equal(motiova.state.refreshCalls, 1);
    assert.equal(store.value, 'ref-2');
    assert.equal(motiova.state.refresh.has('ref-1'), false, 'el refresh viejo no sirve más');

    const resource = await client.resource();
    assert.equal(resource?.latest?.version, '3.25.0');

    await client.release(device);
    assert.deepEqual(motiova.state.released, [device.id]);
    assert.deepEqual(motiova.state.loggedOut, ['ref-2']);
    assert.equal(store.value, null);
    assert.equal(await client.hasSession(), false);
  } finally {
    motiova.server.close();
  }
});

test('errores de Motiova con mensaje listo para mostrar', async () => {
  const motiova = await fakeMotiova();
  try {
    const store = memoryStore();
    const client = new MotiovaClient(
      { web: 'https://motiova.test', api: motiova.api, product: 'maquetario' },
      store,
    );
    await client.connect(browser(motiova));

    motiova.state.deviceLimit = true;
    await assert.rejects(client.requestLicense(device), (error: MotiovaError) => {
      assert.equal(error.code, 'device-limit');
      assert.match(error.message, /Ya usás Maquetario en 2 computadoras/);
      return true;
    });

    motiova.state.hasProduct = false;
    await assert.rejects(
      client.requestLicense(device),
      (error: MotiovaError) =>
        error.code === 'no-product' && /no tiene Maquetario/.test(error.message),
    );

    // El refresh guardado ya no vale (por ejemplo, se usó desde otro lado): la sesión se cierra sola.
    motiova.state.refresh.clear();
    await assert.rejects(
      client.accessToken(true),
      (error: MotiovaError) => error.code === 'signed-out',
    );
    assert.equal(store.value, null);
  } finally {
    motiova.server.close();
  }
});

test('sin conexión: error "offline"', async () => {
  const motiova = await fakeMotiova();
  const api = motiova.api;
  motiova.server.close();
  const store = memoryStore();
  store.value = 'ref-guardado';
  const client = new MotiovaClient(
    { web: 'https://motiova.test', api, product: 'maquetario' },
    store,
  );
  await assert.rejects(
    client.requestLicense(device),
    (error: MotiovaError) => error.code === 'offline',
  );
  assert.equal(store.value, 'ref-guardado', 'sin conexión no se pierde la sesión');
});

test('el callback ignora un estado ajeno y vence si nadie vuelve', async () => {
  const listener = await listenForCallback('estado-correcto-123456', 5_000);
  const wrong = await fetch(`http://127.0.0.1:${listener.port}/callback?code=abc&state=otro`);
  assert.equal(wrong.status, 400);
  const right = await fetch(
    `http://127.0.0.1:${listener.port}/callback?code=el-codigo&state=estado-correcto-123456`,
  );
  assert.equal(right.status, 200);
  assert.equal(await listener.code, 'el-codigo');

  const late = await listenForCallback('otro-estado-1234567', 50);
  await assert.rejects(late.code, (error: MotiovaError) => error.code === 'timeout');

  const controller = new AbortController();
  const cancelled = await listenForCallback('estado-cancelado-12345', 5_000, controller.signal);
  controller.abort();
  await assert.rejects(cancelled.code, (error: MotiovaError) => error.code === 'cancelled');
});
