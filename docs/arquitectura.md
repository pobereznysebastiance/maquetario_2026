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
