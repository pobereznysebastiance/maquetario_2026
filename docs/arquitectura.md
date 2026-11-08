# Arquitectura de Maquetario

Estado: **etapa 1 en curso** (programa de escritorio en Electron). La versión C#/WebView2 sigue compilando y funcionando mientras dure la transición.

## Mapa del repositorio

```
LibroStudio/v3/app/        Interfaz (HTML/CSS/JS). La misma para Electron y para el .exe C#.
  host.js                  Única parte que sabe en qué programa corre (Electron, WebView2 o navegador).
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

## Licencias y launcher de Motiova

### Flujo previsto

```
motiova.com/recursos/maquetario → descarga "Motiova Launcher"
Launcher → abre el navegador del sistema en motiova.com (Google o contraseña)
        → vuelve con un código (OAuth 2.0 + PKCE, redirección a 127.0.0.1:<puerto>)
        → canjea el código por tokens de Motiova
        → GET /desktop/resources: qué recursos, edición y versiones le corresponden
        → descarga la versión (link firmado de corta duración), verifica sha256 y firma
        → POST /desktop/licenses: recibe la licencia firmada para este equipo
        → escribe la licencia y abre Maquetario
```

El login lo hace **Motiova**, no Google directo: el launcher nunca ve credenciales de Google y las compras ya están asociadas al usuario de Motiova.

### Contrato launcher → Maquetario

| Qué | Dónde |
|---|---|
| Licencia | `<appData>/Motiova/licenses/maquetario.lic` (o `--license-file=<ruta>`) |
| Equipo | `<appData>/Motiova/device.json` → `{"deviceId": "..."}` |
| Versiones instaladas | `<localAppData>/Motiova/apps/maquetario/<versión>/` (lado a lado, para volver atrás) |

`<appData>` es `%APPDATA%` en Windows y `~/Library/Application Support` en macOS.

### Formato de la licencia

`MQL1.<payload base64url>.<firma Ed25519 base64url>`; la firma cubre los bytes ASCII de `MQL1.<payload>`. Campos del payload en `packages/license/src/index.ts` (`LicenseClaims`): usuario, producto, edición, `maxMajor`, equipo, emisión y vencimiento.

- El backend firma con la clave privada (nunca sale del servidor). En Python: `cryptography.hazmat.primitives.asymmetric.ed25519`.
- Maquetario verifica con las claves públicas de `desktop/src/main/license-keys.ts`, sin conexión, hasta el vencimiento.
- El `kid` permite rotar claves sin romper licencias vigentes.

### Modos

`desktop/package.json → maquetario.licenseMode` (se fija al compilar, no se puede cambiar en una instalación):

- `off`: no se verifica. **Valor actual**, hasta que exista el launcher.
- `warn`: se verifica y se registra.
- `enforce`: sin licencia válida, la app no abre.

Para probar en desarrollo:

```bash
npm run license:dev-keys
npm run license:dev-issue -- --out licencia-prueba.lic
MAQUETARIO_LICENSE_MODE=enforce npx electron desktop --license-file=licencia-prueba.lic
```

Ninguna verificación del lado del cliente es inviolable: el objetivo es que el uso legítimo sea simple y que copiar la app dé trabajo.

### Pendiente en Motiova (backend)

- Recursos descargables y sus versiones publicadas (archivo en Bunny, sha256, firma, canal, versión mínima del launcher).
- Accesos a recursos (como `CourseAccessGrant`) y `OrderItem` que pueda apuntar a un curso o a un recurso.
- Endpoints: autorizar dispositivo y canjear el código, listar recursos, link de descarga firmado, emitir y renovar licencias, dar de baja equipos.
- El asistente con IA pasa por Motiova con la sesión del usuario (reemplaza el código de aula).

### Decisiones abiertas

- Qué controla la licencia: **edición/plan** (`edition`) o **versión comprada** (`maxMajor`). El formato soporta las dos.
- Pago único o suscripción (define cuánto dura la licencia).
- Cuántos días puede funcionar sin conexión.
- Certificado de firma de código (Windows) y cuenta de Apple Developer (notarización en macOS).

## Instalación y actualizaciones

### Lo que baja la persona

- **Un solo archivo por versión**: `Maquetario-<versión>-win-x64.zip` (o `-mac-*.zip`). El launcher lo descarga de Motiova, verifica sha256 y firma, y lo descomprime en **una sola carpeta**: `<localAppData>/Motiova/apps/maquetario/<versión>/`. Nada más.
- Sin pasos posteriores: Electron trae su motor (no se instala WebView2 ni .NET), las fuentes y la interfaz van adentro, y la app no descarga nada al abrirse.
- Fuera de esa carpeta sólo quedan las preferencias (`userData`) y la licencia (`<appData>/Motiova/`), para poder actualizar sin perderlas.
- También se genera un instalador clásico (NSIS en Windows, DMG en macOS) para quien no use el launcher. Se instala por usuario: **no pide permisos de administrador**.

### Chequeo de actualizaciones (al iniciar sesión)

1. Cada vez que la persona inicia sesión en el launcher (y al abrirlo, si la sesión sigue activa), el launcher pide `GET /desktop/resources`, que responde la última versión a la que tiene derecho para cada recurso.
2. Si hay una versión más nueva que la instalada, el launcher la descarga e instala **al lado** de la actual, sin tocarla.
3. La próxima vez que se abre Maquetario, abre la versión nueva. Si algo falla, el launcher vuelve a la anterior.
4. Maquetario no se actualiza solo ni se conecta para eso: lo hace el launcher, que es quien tiene la sesión.

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
| master-refinement.js | envoltura | si `liveMasterAdjustment`, no redibuja; conserva scroll y `<details>` abiertos |
| editorial-learning.js | decorador | `decorateGlossaryHints()` |
| font-browser.js | decorador | `decorateFontBrowsers(#inspectorContent)` |
| font-glyphs.js | decorador | habilita el botón de glifos |
| page-exceptions.js | decorador (`pages`) | ajustes de la página activa |
| paragraphs.js (×2) | decorador (`text`) | controles y detalle de párrafo |
| review-workspace.js | decorador (`pages`) | aviso de página activa |
| shapes.js | decorador | `shapeAppearance()` |
| tutorial.js | decorador | bloquea controles si el objeto está bloqueado |

Diseño (en `inspector-registry.js`, cargado justo después de `studio.js`):

- `registerInspectorPanel(tab, render)`: una pestaña con panel propio reemplaza el contenido base (estructura, objeto).
- `decorateInspector(fn, { tab })`: corre después del contenido base, en orden de registro (el mismo orden que hoy).
- `pauseInspectorWhile(cond)`: mientras `cond()` sea verdadera, `inspector()` no redibuja (master-refinement, durante el ajuste en vivo de maestras).
- Una envoltura externa (`extend.around`, siempre por fuera de la cadena) guarda y restaura el scroll y los `<details>` abiertos una sola vez, con claves estables (`inspectorDetailKey`: campo, id o título). La base ya no lo hace por posición.

Cada cadena es una línea de registro; ningún módulo reasigna `inspector`. `render` (7) y `coverEditor` (7) usan `extend.after(nombre, fn)`, que corre fn después de la función con los mismos argumentos. `paper`, `autoElement` y `prepareOutput` usan `extend.result` (ajusta lo que devuelve la función) y la cubierta de `prepareOutput` usa `extend.instead` (una ruta). Los PDF de la autoprueba salen idénticos antes y después. Las 14 de `runIntegrationTests` pasan a un registro de pruebas (`registerIntegrationTest`).

Criterio de aceptación: autoprueba completa en verde, contador de reemplazos de funciones globales en baja en `npm run lint:design`.

## Etapas

1. **Electron con la interfaz actual** ← en curso. Funciona en macOS y Linux además de Windows.
2. **TypeScript + módulos**: sacar las pruebas del build de producción, terminar con los reemplazos de funciones globales (`render=`, `saveProject=`), formateador, migraciones del `.mqt`.
3. **Interfaz con componentes** (atomic design, React + Radix, tokens de diseño compartidos con Motiova), revisada con impeccable. Dirección visual: "glass" de macOS, sin que parezca un panel genérico de IA.
4. **Motor de composición propio** (HarfBuzz/WASM, justificación Knuth-Plass) y PDF de imprenta (CMYK, PDF/X, TrimBox/BleedBox exactas).

## Problemas conocidos

- El tamaño de hoja de los PDF puede diferir 0,1–0,3 mm del pedido (Chromium redondea; la versión C# tenía lo mismo). Se corrige fijando MediaBox/TrimBox al post-procesar (etapa 4).
- En Electron no se sabe si una impresora tiene doble faz: se ofrece siempre y, si no puede, falla al imprimir.
- El catálogo de fuentes en Windows no lee el registro (sí las carpetas del sistema y del usuario).
- El código de aula guardado por la versión C# (DPAPI) no se migra: hay que volver a conectar el aula una vez.
