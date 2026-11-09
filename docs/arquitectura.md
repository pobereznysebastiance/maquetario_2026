# Arquitectura de Maquetario

Estado: **etapa 1 cerrada** (programa de escritorio en Electron; la versión C#/WebView2 se retiró el 08-nov). Queda pendiente sólo lo que depende de Motiova y de la venta: URLs y clave pública de producción, `licenseMode: "enforce"` y firma de código. Etapa 2 casi terminada y etapa 3 en marcha (ver "Etapas").

## Mapa del repositorio

```
LibroStudio/v3/app/        Interfaz (HTML/CSS, fuentes TypeScript en src/ que se compilan a build/).
  src/host.ts              Única parte que sabe en qué programa corre (Electron o navegador).
LibroStudio/v3/installer-brand/  Imágenes de marca del instalador anterior (pueden servir para el de Electron).
desktop/                   Programa de escritorio en Electron + TypeScript (Windows, macOS, Linux).
  src/main/main.ts         Ventana, seguridad, cierre con cambios sin guardar.
  src/main/bridge.ts       Tabla de acciones que la interfaz le puede pedir al sistema.
  src/main/handlers/       Una acción o grupo de acciones por archivo (proyecto, salida, paquete, fuentes…).
  src/main/fonts/          Lectura de fuentes OpenType y catálogo del sistema.
  src/main/license.ts      Verificación de la licencia que entrega el launcher.
  src/main/selftest.ts     Autoprueba de regresión (npm run self-test).
  src/preload/preload.ts   Puente mínimo: sólo mensajes, sin acceso a Node desde la interfaz.
packages/license/          Formato y verificación de licencias firmadas (Ed25519). Lo comparten app, launcher y backend.
packages/compose/          Prototipo del motor de composición (HarfBuzz WASM + Knuth-Plass). Todavía no lo usa la app.
Maquetario/Servicio-aula/  Servicio opcional del asistente con IA (se reemplaza por Motiova en la etapa 4).
```

## Cómo trabajar

```bash
npm install                 # una vez, en la raíz
npm run dev                 # abre Maquetario en modo desarrollo (F12 = herramientas, Ctrl+R = recargar)
npm test                    # pruebas unitarias (licencias, lector de fuentes, formato del proyecto)
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
- Para PDF/impresión el proceso principal llama funciones de la página (`window.prepareOutput`, `window.clearPrint`).

Acciones disponibles (todas en `bridge.ts`): `ready`, `appInfo`, `dirty`, `locale`, `newProject`, `open`, `openRecent`, `save`, `saveAs`, `fontCatalog`, `refreshFonts`, `chooseFontFolder`, `fontGlyphs`, `printers`, `print`, `outputPdf`, `export`, `savePdf`, `packageProject`, `clipboardSvg`, `assistantStatus`, `assistantConfigure`, `assistantReview`, `closeSaved`, `closeDiscard`, `closeCancelled`.

## Versión

Fuente única: `desktop/package.json` → `version`. La app la informa con `appInfo`.

## Formato del proyecto y migraciones

Un proyecto (`.mqt`) es el JSON del libro con su `version`. La versión del formato vive en un solo lugar: `CURRENT_VERSION` en `LibroStudio/v3/app/src/model-migrations.ts` (hoy 3). El proceso principal la importa de ahí.

- **Al abrir**, `M.validate` llama primero a `migrateProject`, que aplica en orden los pasos `{ from, to, migrate }` de `MIGRATIONS` hasta la versión actual, y recién después valida con las reglas de hoy. Como todo lo que viene de afuera pasa por `M.validate` (Abrir, recientes, doble clic en un `.mqt`, paquete, copia de recuperación), ningún camino se saltea la migración. Las validaciones que agregan `master-refinement` y `shapes` envuelven a `M.validate` y siguen corriendo después, sobre el proyecto ya migrado.
- **Proyecto de una versión más nueva:** error para mostrar ("Este proyecto se hizo con una versión más nueva de Maquetario: actualizá el programa para abrirlo."). El proceso principal lo detecta antes de tomar el archivo como proyecto actual (`handlers/project.ts → checkOpened`): no se anota en recientes ni queda como destino de Guardar, así que el archivo no se puede pisar. Lo mismo para un archivo que no es JSON.
- **Agregar un cambio de formato:** subir `CURRENT_VERSION`, sumar al final de `MIGRATIONS` el paso desde la versión anterior (puro: sin pantalla ni globales; recibe una copia) y una prueba con un proyecto real de la versión anterior en `desktop/test/project-format.test.ts`. Los pasos publicados no se borran ni se editan.
- Hoy no hay pasos. Los campos opcionales de la versión 3 (`measurementUnit`, `paragraphStyles`, `cover`, `guides`, `toc`…) se completan donde se leen (`|| []`, "mm" por defecto) y no con una normalización al cargar: se decidió así para no cambiar lo que se guarda. Si un formato nuevo los vuelve obligatorios, su paso los completa.

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
| src/inspector-organization.ts | ruta | pestaña `object` → `objectInspector()`; reorganiza `design` |
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

### Tres pestañas y vistas del riel (etapa 3, D3)

El inspector muestra tres pestañas: **Libro**, **Página** y **Selección**. Los módulos siguen dibujando por pestaña interna (`tab`), y `src/inspector-views.ts` (último import de `src/entries/app.ts`) arma cada pestaña visible juntando pasadas de la cadena del inspector:

| Pestaña | Pasadas (`tab`) | `tab` al terminar |
|---|---|---|
| Libro | `structure`, `design` | `design` |
| Página | `pages` (sin la tarjeta del documento) | `pages` |
| Selección | caja de texto: `object`, `text` · otro objeto o varios: `object` · nada: estado vacío | `text`, `object` o `selection` |

**Índice** (`index`) y **Capas** (`layers`) son vistas del riel izquierdo, con su selector junto a Páginas: una envoltura `extend.around` registrada al final dibuja esa pestaña con la misma cadena y pasa el resultado a `#railView`. `showTab()` acepta los nombres viejos (`design`, `text`, `object`, `pages`, `structure`, `index`, `layers`) y los lleva a la pestaña o vista nueva; `inspectorTabFor(nombre)` dice cuál. La pestaña elegida se guarda en `maquetario-inspector-view`, y el orden y plegado de secciones guardados por pestaña vieja se pasaron a la nueva. Después de cada armado, las unidades que venían en la etiqueta ("Grosor · mm") pasan adentro del campo.

### Paneles de React en el inspector (etapa 3, D2): base hecha el 09-nov

**Cómo conviven.** La cadena del inspector sigue igual. Lo nuevo:
- **Una sección en React:** la pestaña en HTML deja su lugar con `inspectorSlot(nombre, título, clave)` de `studio.ts`. Es un `<section class="section" data-section data-key>` vacío, en su orden, y el panel se registra con `registerInspectorPanel('pestaña:nombre', () => <Panel />)`.
- **Una pestaña entera:** `registerInspectorPanel(tab, render)` con un `render` que devuelve un elemento de React.
- **Cuándo se monta:** `inspector-registry.ts` monta los paneles apenas se dibuja la pasada, antes que cualquier decorador, y de forma sincrónica (`mount(…, { sync: true })`). Al volver de `inspector()` el DOM ya está completo.
- **Qué sigue funcionando igual:** el orden, el plegado y el reordenamiento de `inspector-sections.ts` (trabajan sobre el `<section>`, que es el mismo), los `<details>` abiertos y los decoradores que buscan nodos con `$()`.
- **Cada dibujo vuelve a montar:** cada dibujo del inspector reemplaza el contenido, y el panel se vuelve a montar con él, como el HTML. Las raíces cuyo nodo salió de la página se desmontan. Las que esperan en el fragmento de las pasadas no se tocan.
- **Entre dibujos,** el panel se actualiza con `useEditorState()`.

**Reglas para pasar un panel:**
- **Mismo marcado:** mismas clases, `data-bind`, ids, `aria-*` y rótulos que el HTML (`section()`, `row()`, `number()`, `options()` de `studio.ts`). Así no cambian los estilos, las pruebas ni la autoprueba.
- **Campos ligados con el `change` nativo:** cada campo se liga a su ruta con `commitBinding(el)` de `studio.ts`, la misma validación de `bindInspector`. No con el `onChange` de React: las pruebas escriben `.value` y disparan `new Event('change')`, que no sube. Es lo mismo que resuelve `useNativeChange` en `Form.tsx`, pero ligado en la ref y no en un efecto, para que el campo responda en cuanto se monta.
- **Los campos no son controlados** (`defaultValue`/`defaultChecked`): el valor vive en el elemento, como en HTML.
- **Textos con `LibroI18n.tr`** (el traductor del DOM no entra en `data-react`). Si un decorador busca por el texto en castellano, el elemento lleva `data-text-source` (lo usa la ayuda de términos de `editorial-learning.ts`).
- **Lo que hacía un decorador** moviendo o insertando nodos dentro de la sección pasa al panel. Un decorador puede agregar al final de un nodo de React, pero no mover lo que React dibuja.

**Hecho:** Foliado (`src/components/inspector/FolioPanel.tsx`), con los deslizadores de ajuste fino que antes agregaba `folio-position.ts`. Comparado en Chrome sin ventana contra la versión en HTML (Libro en castellano, inglés y centímetros, después de cambiar valores, deslizar, plegar y reordenar): el marcado es igual salvo `data-text-source` y el atributo `value` de los campos que React actualiza al redibujar.
También Estructura del libro (paso 6, `src/components/inspector/StructurePanel.tsx`): la pasada `structure` deja su `inspectorSlot` y el panel suma "Formato y configuración" (antes, `addBookSettings` de `inspector-views.ts`) y "Reglas internas" (antes, un decorador de `editorial-rules.ts` lo ponía arriba de todo el inspector; ahora va dentro de la sección). Como esa pasada es un panel de pestaña entera en HTML (`extend.instead`), la extensión que monta las secciones de React no corría para ella: `inspector-registry.ts` ahora también las monta ahí (`mountSectionPanels`). Comparado en Chrome sin ventana: marcado igual en castellano, inglés y con otra página activa, salvo el lugar de "Reglas internas" y `data-pass`, que ahora queda en la sección.

**Hecho (pasos 1 a 3):** Grilla (`GridPanel.tsx`), Cornisa y Titulillo (`MasterPanels.tsx`), con las piezas comunes en `src/components/inspector/fields.tsx` (`SwitchHeading`, `Row`, `NumberField`, `Options`, `CheckLine`, `MasterDetails`). La pestaña Libro en HTML queda en el lugar de cada panel y la sección Texto. La "Lectura lateral" que agregaba `master-refinement.ts` pasó a los paneles. Las guías individuales de `editorial.ts` se agregan al final de la Grilla de React y traducen sus textos con `LibroI18n.tr`, porque el traductor del DOM no entra ahí. Comparado en Chrome sin ventana contra la versión en HTML: mismo marcado y comportamiento en castellano, inglés y centímetros (valores, interruptores, ajuste de grilla, margen imposible, flechas en un campo, cornisa lateral y su sentido, plegar y reordenar).

**Hecho (paso 8):** Selección de una caja de texto en `TextPanels.tsx`: "Párrafo y estilos", "Tipografía" (tipo de letra, peso y estilo, ejes variables de la caja o del párrafo, muestra, cuerpo, interlineado, alineación, color) y "Carácter y párrafo". Absorbe el panel y el decorador de ejes de `paragraphs.ts`, lo de la caja de texto del decorador de `fonts.ts`, `extraTextControls` de `editorial.ts` y el decorador de glifos de `font-glyphs.tsx`. `studio.ts` publica `commitObjectField()` (lo que hacía `bindInspector` con data-object). "Carácter y párrafo" se monta ahora antes que los decoradores, así que el botón de glifos sí abre los glifos, la ayuda de términos llega a Tracking y Sangría inicial, y con la caja bloqueada sus campos quedan deshabilitados como el resto. `fields.tsx` suma `Heading`, `Btn` y `Row term`, que usan también Página, Misceláneas y Fuentes de tu equipo.

**Hecho (pasos 4 y 5):** Misceláneas y líneas (`RulesPanel.tsx`), Fuentes de tu equipo (`FontLibraryPanel.tsx`) y la pestaña Página entera (`PagePanel.tsx`: la página sola, Página N y Elementos automáticos). Misceláneas y fuentes las agregaba un decorador: ahora el decorador (`book-workflow.ts`, `fonts.ts`) deja el lugar vacío donde iba siempre y lo monta en el acto con `mountInspectorSlot(lugar)` (nuevo en `inspector-registry.ts`, para lugares que aparecen después de la pasada de montaje). La pestaña Página deja sus tres lugares en `studio.ts`; lo que hacían `page-exceptions.ts` (sacar las casillas de la base y anteponer su sección), el aviso de página activa de `review-workspace.ts` y `reshapePagePass` de `inspector-views.ts` (mover Agregar y Duplicar) quedó dentro del panel, y esos pasos se borraron. Comparado en Chrome sin ventana contra la versión en HTML (castellano, inglés, centímetros, con líneas activas y con excepciones de página): el marcado es igual salvo el orden de los atributos, `data-text-source` y el atributo `value`; las mismas acciones dan el mismo resultado.

**Hecho (paso 7):** Selección del objeto (`ObjectPanel.tsx`): Objeto seleccionado, Posición y tamaño, Alinear, Distribuir, Orden y bloqueo, y el estado vacío "Nada seleccionado" (también con selección múltiple). La pasada `object` reemplaza al contenido base (`registerInspectorPanel('object', …)`), así que la pasada de montaje del registro no corre: `objectInspector` deja los cinco lugares y los monta con `mountInspectorSlot`; el estado vacío lo deja `inspector-views.ts`. El nombre de la figura en la etiqueta del objeto (antes lo escribía `shapes.ts` en el nodo) pasó al panel; la sección de la figura sigue en HTML. Los campos de posición y tamaño ahora siguen al objeto mientras se arrastra o se estira (antes quedaban quietos hasta soltar). Comparado en Chrome sin ventana contra la versión en HTML (marco, figura, caja de texto, bloqueado, selección múltiple, nada seleccionado, inglés y centímetros): marcado igual salvo el orden de los atributos y `value`; las mismas acciones dan el mismo resultado.

**Orden para los demás paneles**, de menos a más acoplado:

| Paso | Panel | Qué hay que absorber o cuidar |
|---|---|---|
| 1 ✓ | Titulillo (Libro) | `master-refinement.ts` agrega "Lectura lateral" después de la posición y oculta "Rotar texto 90°" (lo comparte con Cornisa: el decorador queda para el que siga en HTML) |
| 2 ✓ | Cornisa (Libro) | lo mismo, más título del libro y sección general (`data-bind="title"`/`"chapter"`) |
| 3 ✓ | Grilla (Libro) | botones `data-fit`, validación de márgenes (`commitBinding` ya la tiene) y las plantillas, que redibujan aparte |
| 4 | Misceláneas y líneas, Biblioteca de fuentes (Libro) | secciones que hoy agregan decoradores (`book-workflow.ts`, `fonts.ts`): pasan a paneles registrados con su propio lugar |
| 5 | Página (pestaña Página) | `page-exceptions.ts` y `reshapePagePass` en `inspector-views.ts` mueven nodos entre secciones |
| 6 | Estructura (Libro) | `book-workflow.ts` dibuja la pasada `structure` entera con `registerInspectorPanel`; `addBookSettings` le inserta un botón |
| 7 | Selección: objeto | `inspector-organization.ts` (alinear, distribuir, capas), `shapes.ts`, `placed-artwork.ts` |
| 8 ✓ | Selección: texto y párrafo | lo más acoplado: `paragraphs.ts` (escucha `change` en el documento y envuelve `commit`), `hyphenation-controls.ts`, `font-glyphs.ts`, `editorial.ts` (controles extra) y la vista de variantes de `fonts.ts` |
| 9 | Vistas del riel (Índice, Capas) | se arman con la misma cadena y se mueven a `#railView`: van como pestaña entera de React |
| 10 | La cadena | con todo en React, `inspector-views.ts` pasa a ser un componente con las tres pestañas, y `decorateInspector` queda sólo para lo que no es del inspector |

**Riesgos:**
- **Decoradores que buscan nodos con `$()`:** si un decorador busca por texto, por posición o mueve nodos, deja de encontrarlos o rompe a React. Antes de pasar cada panel hay que revisar `decorateInspector` y los `$('#inspectorContent …')` que lo tocan, y absorberlos.
- **`document-units.ts`:** cambia "mm" por "cm" en los textos y redefine `value` en los campos. Funciona sobre React porque React no vuelve a escribir un texto que no cambió. Si un panel cambia el texto de una unidad, hay que pasarlo a `documentUnit()` en el panel.
- **El traductor del DOM:** no traduce `data-react`. Un decorador que inserta texto en castellano dentro de un panel de React queda sin traducir (los de hoy usan `bw()`).
- **Volver a montar en cada dibujo:** mientras la cadena siga, cada `render(true)` vuelve a montar los paneles. Es barato con pocos paneles; con muchos conviene que la cadena deje de reemplazar todo (paso 10).
- **`flushSync` desde un efecto de React:** si `inspector()` se llama dentro de un efecto de React, el montaje sincrónico no se cumple (React avisa y dibuja después).

## Pasar una pantalla a React (etapa 3)

Convención única: la resume el comentario de `src/react/mount.tsx`. Cada regla salió de algo que falló al integrar.

**Dónde y cómo se monta**
- Una carpeta por pantalla en `src/components/`: el componente (`PascalCase.tsx`) y, si hace falta, su servicio (lo que llama el resto de la app). Lo que tiene que seguir siendo global se publica desde el servicio, y si otros lo extienden por nombre, con `extend.replace`.
- `mount(nodo, <X />)` en un nodo que ya existe. Las barras fijas van con `{ sync: true }`, montadas después de `book-workflow.ts` (`bw`).
- Mismo marcado que el HTML de antes: clases, ids, `data-*`, `aria-*`. Así no cambian los estilos, las pruebas, la autoprueba ni el tutorial. Estilos sólo con las clases y tokens de `ui/`.
- Nada de React toca lo que dibuja el libro (`#spread`, `#printRoot`, miniaturas, `ui/book/`).

**Textos.** El traductor del DOM no entra en lo que dibuja React (`mount` lo marca con `data-react`).
- Textos fijos con `bw(es, en, pt)` o `LibroI18n.tr('castellano')` (con su fila en `src/i18n.ts`), más `useLanguage()` para redibujar al cambiar de idioma.
- Lo que otro módulo agrega dentro de un nodo de React tiene que llegar ya traducido.

**Campos y eventos**
- Los campos no son controlados (`defaultValue`/`defaultChecked`): las pruebas y otros módulos escriben `.value` y llaman a la función que lee el formulario.
- El `onChange` de React no recibe un `new Event('change')`, porque no sube:
  - en selectores, `Select` de `Form.tsx` (usa `useNativeChange`);
  - para un formulario entero, `useFieldEvents` (`change`/`input` en captura).
- En casillas sí sirve el `onChange` de React: viaja con el `click`.

**Diálogos** (`src/components/dialog/dialogs.tsx`)
- Hoja (`openSheet`, o `modal.sheet`/`modal.info` con un elemento de React) y Ventana de trabajo (`openWorkWindow` o `modal.workspace`). Hay una sola a la vez y abrir una cierra `#modal`.
- La única que se aloja encima de otra es la Ventana con `keepModal` (el explorador de fuentes desde el estilo de párrafo).
- `closeSheet()` cierra en el acto. Las pruebas y la autoprueba usan eso, no `#modal`.
- Los efectos de los hijos corren antes de que la ref del `<dialog>` lo abra con `showModal()`. Si un hijo mide o desplaza y no hay alto, lo hace en el cuadro siguiente (`requestAnimationFrame`).
- Al abrir, el foco va al `<dialog>` y el primer Tab lleva al primer control. Las confirmaciones destructivas arrancan en Cancelar.

**Estado del editor** (`src/react/editor-state.ts`)
- El componente lee los globales del núcleo (`book`, `active`, `tool`…) y se redibuja con `useEditorState()`.
- Quien cambia estado fuera de `render`/`updateStatus` llama a `notifyEditorState()`, que redibuja en el acto con `flushSync`. Por eso nunca se llama desde el render de un componente ni desde sus efectos.
- Si algo cambia muy seguido, conviene un aviso propio que redibuje sólo lo suyo. Ejemplo: `refreshCanvasBar()` del zoom, que se avisa en cada `renderPages`.

**Registros** (en lugar de agregar nodos al DOM)
- Riel: `registerTool({ tool, id, icon, label, after, onSelect })`, en `components/rail/rail-tools.ts`.
- Inspector:
  - `registerInspectorPanel('pestaña:nombre', () => <Panel />)` con su lugar `inspectorSlot(…)` en la pestaña;
  - `mountInspectorSlot(lugar)` si el lugar aparece después de la pasada;
  - reglas en "Paneles de React en el inspector".
- Ayuda: `registerHelpSection({ id, label, order, render })`, en `components/help/help-center.tsx`.

**Proceso principal.** Los cambios del proceso principal (CSP, protocolo `maquetario://`, manejadores) piden reiniciar la app. Ctrl+R sólo recarga la interfaz.

## Etapas

1. **Electron con la interfaz actual** (cerrada el 08-nov). Funciona en macOS y Linux además de Windows; la versión C#/WebView2 (`Host*.cs`, `Build*.ps1`, `Maquetario.iss`) y su rama en la interfaz se retiraron. Pendiente, porque depende de Motiova o de la venta: URLs y clave pública de producción, `licenseMode: "enforce"` y la firma de código (ver "Licencias y conexión con Motiova").
2. **TypeScript + módulos** (cerrada el 08-nov, salvo la parte B): pruebas fuera del build de producción (`app/tests/`), prettier, reemplazos de funciones globales por `extend`, toda la interfaz en `.ts` estricto con dos puntos de entrada (`src/entries/`) y migraciones del `.mqt` (ver "Formato del proyecto y migraciones"). Queda la **parte B** (cambiar los globales por `import` reales: objeto de estado y un `extend` que no dependa de `window`), que va con la etapa 3. Detalle en `docs/proximos-pasos.md` → "Etapa 2".
3. **Interfaz con componentes** (atomic design, React + Radix, tokens de diseño compartidos con Motiova), revisada con impeccable. Dirección visual: "glass" de macOS, sin que parezca un panel genérico de IA. Decisiones tomadas el 08-nov: `docs/INTERFAZ_08-nov_decisiones-etapa3.md` (Radix sin estilos + CSS propio; inspector en 3 pestañas; tres tipos de diálogo; tokens con los nombres de Motiova). En curso: cómo se pasa una pantalla, en "Pasar una pantalla a React"; qué falta, en `docs/proximos-pasos.md`.
4. **Motor de composición propio** (HarfBuzz/WASM, justificación Knuth-Plass) y PDF de imprenta (CMYK, PDF/X, TrimBox/BleedBox exactas). Hecho:
   - el motor cargado en la app detrás de una llave apagada (todavía no dibuja), en `docs/MOTOR_09-nov_composicion.md`;
   - cajas exactas;
   - PDF/X-4 con RGB etiquetado y FOGRA39 (sin CMYK), en `docs/IMPRENTA_09-nov_pdfx.md`.

## Problemas conocidos

- ~~El tamaño de hoja de los PDF puede diferir 0,1–0,3 mm del pedido~~ (resuelto el 09-nov, etapa 4): `desktop/src/main/print-boxes.ts` reescribe en cada página MediaBox (la hoja exacta, anclada arriba a la izquierda), CropBox, TrimBox (el corte: el libro o el desplegado de la cubierta con su demasía) y BleedBox (corte + sangrado). Usa la copia de pdf-lib de la interfaz. Si pdf-lib no puede con un archivo, sale el PDF de Chromium tal cual. CMYK y PDF/X: `docs/IMPRENTA_09-nov_pdfx.md`.
- En Electron no se sabe si una impresora tiene doble faz: se ofrece siempre y, si no puede, falla al imprimir.
- El catálogo de fuentes en Windows no lee el registro (sí las carpetas del sistema y del usuario).
- El código de aula guardado por la versión C# (DPAPI) no se migra: hay que volver a conectar el aula una vez.
