# Arquitectura de Maquetario

Estado: **etapa 1 en curso** (programa de escritorio en Electron). La versión C#/WebView2 sigue compilando y funcionando mientras dure la transición.

## Mapa del repositorio

```
LibroStudio/v3/app/        Interfaz (HTML/CSS/JS). La misma para Electron y para el .exe C#.
  src/host.ts              Única parte que sabe en qué programa corre (Electron, WebView2 o navegador).
LibroStudio/v3/Host*.cs    Programa C# anterior (WebView2, sólo Windows). Se retira al terminar la etapa 1.
desktop/                   Programa de escritorio en Electron + TypeScript (Windows, macOS, Linux).
  src/main/main.ts         Ventana, seguridad, cierre con cambios sin guardar.
  src/main/bridge.ts       Tabla de acciones que la interfaz le puede pedir al sistema.
  src/main/handlers/       Una acción o grupo de acciones por archivo (proyecto, salida, paquete, fuentes…).
  src/main/fonts/          Lectura de fuentes OpenType y catálogo del sistema.
  src/main/license.ts      Verificación de la licencia que entrega el launcher.
  src/main/selftest.ts     Autoprueba de regresión (npm run self-test).
  src/preload/preload.ts   Puente mínimo: sólo mensajes, sin acceso a Node desde la interfaz.
packages/license/          Formato y verificación de licencias firmadas (Ed25519). Lo comparten app, launcher y backend.
Maquetario/Servicio-aula/  Servicio opcional del asistente con IA (se reemplaza por Motiova en la etapa 4).
```

## Cómo trabajar

```bash
npm install                 # una vez, en la raíz
npm run dev                 # abre Maquetario en modo desarrollo (F12 = herramientas, Ctrl+R = recargar)
npm test                    # pruebas unitarias (licencias, lector de fuentes)
npm run typecheck
npm run self-test           # autoprueba completa: interfaz, PDF reales, guardado, paquete
npm run dist                # instalador para el sistema actual (desktop/release/)
```

En desarrollo la interfaz se carga directo desde `LibroStudio/v3/app`: un cambio en un `.js` o `.css` se ve con **Ctrl+R**, sin compilar.

> Si `npm install` no descarga Electron (`node_modules/electron/path.txt` no existe), correr `node node_modules/electron/install.js`.

## Cómo se comunican la interfaz y el sistema

```
Interfaz (página, sin Node)            Proceso principal (Node + Electron)
nativeCall('save', {...})  ──IPC──▶    bridge.ts → handlers/project.ts → disco
           ◀──────────── {id, result, error}
```

- La página se sirve desde `maquetario://app/` (esquema propio, no `file://`), con CSP estricta y sin red (`connect-src 'none'`).
- Las fuentes del catálogo se sirven en el mismo origen: `maquetario://app/__fonts/<id>.ttf`.
- `contextIsolation`, `sandbox`, sin `nodeIntegration`, navegación y ventanas nuevas bloqueadas, permisos denegados.
- Para PDF/impresión el proceso principal llama funciones de la página (`window.prepareOutput`, `window.clearPrint`) igual que hacía el C#.

Acciones disponibles (todas en `bridge.ts`): `ready`, `appInfo`, `dirty`, `locale`, `newProject`, `open`, `openRecent`, `save`, `saveAs`, `fontCatalog`, `refreshFonts`, `chooseFontFolder`, `fontGlyphs`, `printers`, `print`, `outputPdf`, `export`, `savePdf`, `packageProject`, `clipboardSvg`, `assistantStatus`, `assistantConfigure`, `assistantReview`, `closeSaved`, `closeDiscard`, `closeCancelled`.

## Versión

Fuente única: `desktop/package.json` → `version`. La app la informa con `appInfo`. (El `.exe` C# todavía la tiene escrita a mano; se elimina con él.)

## Licencias y conexión con Motiova

### Conexión desde el programa (primera versión, sin launcher)

Maquetario hace él mismo la conexión con la cuenta (`desktop/src/main/motiova/`): no hace falta esperar al launcher. El detalle de cada endpoint (respuestas y errores) está en el repo de Motiova: `docs/SOFTWARE_08-NOV_LICENCIAS.md`.

```
Configuración → Cuenta → "Conectar con Motiova" (o el aviso de arranque, en modo enforce)
  → abre el navegador en {WEB}/activar-programa?puerto=<p>&estado=<state>&desafio=<challenge>   (PKCE S256)
  → escucha en 127.0.0.1:<p>/callback, verifica el estado y canjea: POST /desktop/token {code, code_verifier}
  → guarda el refresh_token cifrado con el almacén del sistema (safeStorage: DPAPI / Keychain / libsecret)
  → crea <appData>/Motiova/device.json una sola vez y pide POST /desktop/licenses {product, device_id, device_name, platform}
  → guarda la licencia en <appData>/Motiova/licenses/maquetario.lic y la aplica sin reiniciar
Al abrir con conexión: POST /auth/refresh (cada refresh se usa una vez: siempre se guarda el nuevo),
  renueva la licencia y mira GET /desktop/resources; si hay versión nueva, avisa y se descarga desde Cuenta.
"Cerrar sesión en esta computadora": POST /desktop/licenses/release + POST /auth/logout, y borra licencia y token.
```

- **Dónde está Motiova:** `desktop/package.json → maquetario.motiova` (`web`, `api` y `dev` para Motiova local en `localhost:5183` / `localhost:8010`). Se fija al compilar; en desarrollo se puede cambiar con `MOTIOVA_WEB` / `MOTIOVA_API`, en una instalación no.
- **Errores:** Motiova responde `{"detail": "texto listo para mostrar"}`; la app lo muestra tal cual (403 sin compra, 409 tope de equipos, 503 sin clave de firma). Sin conexión, el arranque no se interrumpe y la licencia guardada sigue valiendo hasta vencer.
- **Login:** lo hace Motiova, no Google directo: el programa nunca ve credenciales de Google.
- **Pruebas:** `desktop/test/motiova.test.ts` contra un Motiova falso (PKCE, rotación del refresh, errores, callback). Probado también de punta a punta en la app con una licencia firmada con la clave de desarrollo.
- **Launcher:** puede venir más adelante con los mismos endpoints y los mismos archivos; en Motiova no cambia nada.

### Archivos compartidos

| Qué | Dónde |
|---|---|
| Licencia | `<appData>/Motiova/licenses/maquetario.lic` (o `--license-file=<ruta>`) |
| Equipo | `<appData>/Motiova/device.json` → `{"deviceId": "..."}` (el mismo que firma la licencia) |
| Sesión (refresh_token cifrado) | `<userData>/motiova.session` (`%APPDATA%/Maquetario` en Windows) |
| Versiones instaladas (launcher) | `<localAppData>/Motiova/apps/maquetario/<versión>/` (lado a lado, para volver atrás) |

`<appData>` es `%APPDATA%` en Windows y `~/Library/Application Support` en macOS.

### Formato de la licencia

`MQL1.<payload base64url>.<firma Ed25519 base64url>`; la firma cubre los bytes ASCII de `MQL1.<payload>`. Campos del payload en `packages/license/src/index.ts` (`LicenseClaims`): usuario, producto, edición, `maxMajor`, equipo, emisión y vencimiento.

- El backend firma con la clave privada (nunca sale del servidor). En Python: `cryptography.hazmat.primitives.asymmetric.ed25519`.
- Maquetario verifica con las claves públicas de `desktop/src/main/license-keys.ts`, sin conexión, hasta el vencimiento.
- El `kid` permite rotar claves sin romper licencias vigentes.

### Modos

`desktop/package.json → maquetario.licenseMode` (se fija al compilar, no se puede cambiar en una instalación):

- `off`: no bloquea ni avisa; la licencia igual se verifica para mostrarla en Cuenta. **Valor actual**, hasta la versión a la venta.
- `warn`: se verifica y se registra.
- `enforce`: sin licencia válida, la app no abre el editor: el aviso de arranque ofrece **Conectar con Motiova** (y antes intenta renovarla sola si hay sesión y conexión).

Para probar en desarrollo:

```bash
npm run license:dev-keys
npm run license:dev-issue -- --out licencia-prueba.lic
MAQUETARIO_LICENSE_MODE=enforce npx electron desktop --license-file=licencia-prueba.lic
```

Ninguna verificación del lado del cliente es inviolable: el objetivo es que el uso legítimo sea simple y que copiar la app dé trabajo.

### Motiova (backend): hecho el 08-nov

Endpoints de login del programa, recursos, descarga, licencias y liberación de equipos, probados contra `verifyLicense` (válida, otro equipo, vencida y adulterada). Pendiente del lado de Motiova: que el asistente con IA pase por Motiova con la sesión del usuario (reemplaza el código de aula).

### Decisiones (cerradas el 08-nov)

- **Pago único**, con todas las actualizaciones incluidas: `maxMajor: null`.
- Edición **`estandar`** (se cambia en el CRM de Motiova).
- **Hasta 2 computadoras** por compra. Se liberan desde Mi cuenta → Mis programas, o con "Cerrar sesión en esta computadora".
- **7 días sin conexión**: la licencia vence a la semana y se renueva cada vez que se abre con internet.
- Los archivos se bajan **del servidor de Motiova** (no de Bunny), con link de 10 minutos y sha256.
- En la licencia, `product: "maquetario"`.
- Devolución o contracargo: la licencia queda revocada y la que ya estaba en la computadora deja de valer al vencer.

### Entrega de cada versión a Motiova

- Número de versión (`desktop/package.json → version`) y notas de cambios en castellano, para quien usa el programa.
- Un instalador por sistema: Windows `.exe` firmado; macOS `.dmg` firmado y notarizado; Linux `.AppImage` si sale.
- Para la versión a la venta: `licenseMode: "enforce"` y la clave pública de producción en `desktop/src/main/license-keys.ts` → `PRODUCTION_PUBLIC_KEYS['<kid>']` (la manda Motiova al generarla; la privada nunca sale del servidor).
- Pendiente: certificado de firma de código de Windows (o Azure Trusted Signing) y cuenta de Apple Developer, antes de vender. Hay que definir quién los gestiona.

## Instalación y actualizaciones

### Lo que baja la persona

- **Un solo archivo por versión**: `Maquetario-<versión>-win-x64.zip` (o `-mac-*.zip`). El launcher lo descarga de Motiova, verifica sha256 y firma, y lo descomprime en **una sola carpeta**: `<localAppData>/Motiova/apps/maquetario/<versión>/`. Nada más.
- Sin pasos posteriores: Electron trae su motor (no se instala WebView2 ni .NET), las fuentes y la interfaz van adentro, y la app no descarga nada al abrirse.
- Fuera de esa carpeta sólo quedan las preferencias (`userData`) y la licencia (`<appData>/Motiova/`), para poder actualizar sin perderlas.
- También se genera un instalador clásico (NSIS en Windows, DMG en macOS) para quien no use el launcher. Se instala por usuario: **no pide permisos de administrador**.

### Chequeo de actualizaciones

**Hoy (sin launcher):** al abrir con conexión y la cuenta conectada, Maquetario pide `GET /desktop/resources`. Si `latest.version` es más nueva que la instalada, muestra un aviso y en Configuración → Cuenta aparece **Descargar**: baja el instalador del sistema con `POST /me/products/maquetario/download`, verifica el sha256 antes de dejarlo y lo muestra en la carpeta Descargas. La instalación la hace la persona con ese instalador.

**Con el launcher (más adelante):**

1. Cada vez que la persona inicia sesión en el launcher (y al abrirlo, si la sesión sigue activa), el launcher pide `GET /desktop/resources`, que responde la última versión a la que tiene derecho para cada recurso.
2. Si hay una versión más nueva que la instalada, el launcher la descarga e instala **al lado** de la actual, sin tocarla.
3. La próxima vez que se abre Maquetario, abre la versión nueva. Si algo falla, el launcher vuelve a la anterior.

### Endurecimiento del ejecutable

Configurado en `desktop/package.json` (`build.electronFuses`):

- No puede usarse como Node (`runAsNode: false`) ni recibir opciones de inspección o `NODE_OPTIONS`.
- Sólo carga la app desde `app.asar`, con **verificación de integridad**. La interfaz va dentro del asar (`app.asar/renderer`): modificar un archivo hace que la app no abra.
- Cookies y almacenamiento cifrados.

### Firma de código (pendiente: requiere comprar el certificado)

Sin firma, Windows muestra "editor desconocido" (SmartScreen) y macOS bloquea la app. **Ejecutar como administrador no lo evita**: el aviso es por falta de firma, no por permisos, y pedir administrador suma otra advertencia (UAC). La solución es firmar:

- **Windows**: certificado de firma de código de una autoridad reconocida. La opción más simple hoy es **Azure Trusted Signing** (servicio mensual; la reputación de SmartScreen se gana enseguida). Alternativa: certificado OV/EV (Sectigo, DigiCert…). electron-builder firma solo si encuentra `CSC_LINK` y `CSC_KEY_PASSWORD` (archivo .pfx) o la configuración `win.azureSignOptions`.
- **macOS**: cuenta de Apple Developer (Developer ID) y notarización. electron-builder firma y notariza con `CSC_LINK` + `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID`.
- El launcher también va firmado, y verifica que cada versión descargada esté firmada con el mismo certificado antes de abrirla.

## Registro de extensiones (hecho)

Las 127 cadenas en las que un módulo reemplazaba una función global (`const anterior = f; f = function () {…}`) se convirtieron a `extend('f', anterior => function () {…}, 'módulo')` (`LibroStudio/v3/app/extend.js`). El orden de ejecución es el mismo; ninguna pieza reasigna funciones globales y `MaquetarioExtensions.list()` muestra qué módulo extiende cada función. `npm run lint:design` cuenta los reemplazos hechos a mano para que no vuelvan.

## El inspector como registro (hecho)

`inspector()` es la función más reemplazada por otros módulos (12 veces; el patrón completo aparece 127 veces, ver `npm run lint:design`). Relevamiento de las 12 cadenas:

| Archivo | Tipo | Qué hace |
|---|---|---|
| book-workflow.js | ruta | pestaña `structure` → `structurePanel()`; en `design`, además `ruleControls()` |
| inspector-organization.js | ruta | pestaña `object` → `objectInspector()`; reorganiza `design` |
| src/master-refinement.ts | envoltura | si `liveMasterAdjustment`, no redibuja; conserva scroll y `<details>` abiertos |
| editorial-learning.js | decorador | `decorateGlossaryHints()` |
| font-browser.js | decorador | `decorateFontBrowsers(#inspectorContent)` |
| font-glyphs.js | decorador | habilita el botón de glifos |
| page-exceptions.js | decorador (`pages`) | ajustes de la página activa |
| paragraphs.js (×2) | decorador (`text`) | controles y detalle de párrafo |
| review-workspace.js | decorador (`pages`) | aviso de página activa |
| shapes.js | decorador | `shapeAppearance()` |
| tutorial.js | decorador | bloquea controles si el objeto está bloqueado |

Diseño (en `src/inspector-registry.ts`, cargado justo después de `studio.js`):

- `registerInspectorPanel(tab, render)`: una pestaña con panel propio reemplaza el contenido base (estructura, objeto).
- `decorateInspector(fn, { tab })`: corre después del contenido base, en orden de registro (el mismo orden que hoy).
- `pauseInspectorWhile(cond)`: mientras `cond()` sea verdadera, `inspector()` no redibuja (master-refinement, durante el ajuste en vivo de maestras).
- Una envoltura externa (`extend.around`, siempre por fuera de la cadena) guarda y restaura el scroll y los `<details>` abiertos una sola vez, con claves estables (`inspectorDetailKey`: campo, id o título). La base ya no lo hace por posición.

Cada cadena es una línea de registro; ningún módulo reasigna `inspector`. El mismo enfoque se aplicó a todas las funciones extendidas: `extend.after`, `extend.before`, `extend.result` y `extend.instead` declaran la forma de cada eslabón, y las pruebas usan `test-registry.js`. Quedan 13 envolturas escritas a mano (detalle en `docs/proximos-pasos.md`). Los PDF de la autoprueba salen idénticos antes y después.

Criterio de aceptación: autoprueba completa en verde, contador de reemplazos de funciones globales en baja en `npm run lint:design`.

## Etapas

1. **Electron con la interfaz actual** ← en curso. Funciona en macOS y Linux además de Windows.
2. **TypeScript + módulos**: sacar las pruebas del build de producción (hecho: `app/tests/`), formateador (hecho: prettier), terminar con los reemplazos de funciones globales (hecho: `extend`), tipos sobre el JS actual (`checkJs`) y después `.ts` con módulos; migraciones del `.mqt`. Avance en `docs/proximos-pasos.md` → "Etapa 2".
3. **Interfaz con componentes** (atomic design, React + Radix, tokens de diseño compartidos con Motiova), revisada con impeccable. Dirección visual: "glass" de macOS, sin que parezca un panel genérico de IA.
4. **Motor de composición propio** (HarfBuzz/WASM, justificación Knuth-Plass) y PDF de imprenta (CMYK, PDF/X, TrimBox/BleedBox exactas).

## Problemas conocidos

- El tamaño de hoja de los PDF puede diferir 0,1–0,3 mm del pedido (Chromium redondea; la versión C# tenía lo mismo). Se corrige fijando MediaBox/TrimBox al post-procesar (etapa 4).
- En Electron no se sabe si una impresora tiene doble faz: se ofrece siempre y, si no puede, falla al imprimir.
- El catálogo de fuentes en Windows no lee el registro (sí las carpetas del sistema y del usuario).
- El código de aula guardado por la versión C# (DPAPI) no se migra: hay que volver a conectar el aula una vez.
