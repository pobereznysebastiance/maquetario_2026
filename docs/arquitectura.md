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

El inspector muestra tres pestañas: **Libro**, **Página** y **Selección**. Es un componente de React, `<Inspector/>` (`src/components/inspector/Inspector.tsx`), montado una vez en `#inspectorContent` por `src/inspector-views.tsx` (último import de `src/entries/app.ts`). Cada pestaña visible junta "pasadas", los nombres de pestaña de antes, que siguen siendo el prefijo de los paneles:

| Pestaña | Pasadas | `tab` después de `inspector()` |
|---|---|---|
| Libro | `structure`, `design` | `design` |
| Página | `pages` | `pages` |
| Selección | caja de texto: `object`, `text` · otro objeto o varios: `object` · nada: `selection` (estado vacío) | `text`, `object` o `selection` |

Sin libro abierto (`hasDocument` falso), las tres pestañas muestran sólo un estado vacío (`.inspector-empty`, "Creá o abrí un libro para ver sus propiedades.") y el consejo del pie se esconde.

**Índice** (`index`) y **Capas** (`layers`) son vistas del riel izquierdo, con su selector junto a Páginas (`src/components/rail/RailViews.tsx`). `showTab()` acepta los nombres viejos (`design`, `text`, `object`, `pages`, `structure`, `index`, `layers`) y los lleva a la pestaña o vista nueva; `inspectorTabFor(nombre)` dice cuál. La pestaña elegida se guarda en `maquetario-inspector-view`, y el orden y plegado de secciones guardados por pestaña vieja se pasaron a la nueva.

### Paneles de React en el inspector (etapa 3, D2): base hecha el 09-nov

**Cómo se arma (paso 10, hecho el 09-nov).**
- **Paneles:** cada módulo registra los suyos con `registerInspectorPanel('pasada:sección', () => <Panel />)` (`src/inspector-registry.ts`). La tabla `sectionsOf` de `Inspector.tsx` dice qué secciones tiene cada pasada, en qué orden y con qué marco (`<section class="section" data-section data-key>`, los mismos atributos de antes; "Carácter y párrafo" y los estados vacíos van en un `<div>`). La primera sección de cada pasada lleva `data-pass`.
- **`inspector()` es una fachada:** `studio.ts` la declara con `extensible('inspector', …)` y sólo avisa (`notifyEditorState()`). `<Inspector/>` escucha ese aviso (`useEditorState()`) y el idioma; los paneles no se suscriben por su cuenta. React cambia sólo lo que cambió: el DOM ya no se rehace en cada llamada, así que el scroll, el foco y los `<details>` abiertos se conservan solos.
- **Campos:** siguen sin ser controlados, pero cada uno lleva de `key` su valor (`fieldKey(nombre, valor)` de `fields.tsx`, que suma el idioma): cuando el valor del libro cambia (deshacer, otro panel, una prueba que asigna `book…` y llama a `inspector()`), React crea ese campo de nuevo. Después de cada `inspector()`, un campo numérico que quedó con un valor no grabado (fuera de rango) vuelve a su valor, como cuando se rehacía todo. Con el documento en otra unidad (mm/cm) se vuelve a crear todo el inspector.
- **Oyentes nativos:** `onNativeChange` engancha un solo oyente por nodo, que llama siempre al último `listener` de la ref (el nodo ahora dura entre dibujos: así no queda uno con datos viejos).
- **Pausa:** `pauseInspectorWhile(cond)` sigue igual (`extend.around`); además, mientras dura, `<Inspector/>` devuelve lo último que dibujó, aunque llegue otro aviso del estado.
- **Orden y plegado** (antes `inspector-sections.ts`, con un `MutationObserver`): los maneja `<Inspector/>` con las mismas claves (`data-order-key`: clase propia o ícono y su número) y los mismos `localStorage` (`maquetario-inspector-order`, `maquetario-inspector-collapsed`), por pestaña visible. El agarrador y la flecha los dibuja `SectionHeading` de `fields.tsx` dentro del título de la sección (contexto `SectionContext`), y el nombre (`SectionTitle`) también pliega. Ahora están al volver de `inspector()` (antes llegaban un instante después).
- **Después de `inspector()`** (`extend.after`): `inspector-views.tsx` deja `tab` con la pasada principal, `review-workspace.ts` marca la página activa (página, miniaturas y barra) y `tutorial.ts` vuelve a marcar el objetivo del paso del recorrido. Ninguno toca lo que dibuja React.

**Reglas para pasar un panel:**
- **Mismo marcado:** mismas clases, `data-bind`, ids, `aria-*` y rótulos que el HTML (`section()`, `row()`, `number()`, `options()` de `studio.ts`). Así no cambian los estilos, las pruebas ni la autoprueba.
- **Campos ligados con el `change` nativo:** cada campo se liga a su ruta con `commitBinding(el)` de `studio.ts`. No con el `onChange` de React: las pruebas escriben `.value` y disparan `new Event('change')`, que no sube. Es lo mismo que resuelve `useNativeChange` en `Form.tsx`, pero ligado en la ref y no en un efecto, para que el campo responda en cuanto se monta.
- **Los campos no son controlados** (`defaultValue`/`defaultChecked`): el valor vive en el elemento, como en HTML, y llevan `key={fieldKey(nombre, valor)}`.
- **Textos con `LibroI18n.tr`** (el traductor del DOM no entra en `data-react`). El texto en castellano queda en `data-text-source`; la ayuda de términos (`TermHelp`) la dibujan `Heading`, `SwitchHeading`, `Row` y los subtítulos de la Grilla.
- **Longitudes:** la unidad junto al campo es `lengthUnit()`; `document-units.ts` adapta cada campo nuevo una vez (`fieldAdapters`).
- **Nada de decoradores:** ya no existe `decorateInspector`. Lo que un módulo le agregaba al inspector va en el panel.

**Hecho:** Foliado (`src/components/inspector/FolioPanel.tsx`), con los deslizadores de ajuste fino que antes agregaba `folio-position.ts`. Comparado en Chrome sin ventana contra la versión en HTML (Libro en castellano, inglés y centímetros, después de cambiar valores, deslizar, plegar y reordenar): el marcado es igual salvo `data-text-source` y el atributo `value` de los campos que React actualiza al redibujar.
También Estructura del libro (paso 6, `src/components/inspector/StructurePanel.tsx`): la pasada `structure` deja su `inspectorSlot` y el panel suma "Formato y configuración" (antes, `addBookSettings` de `inspector-views.ts`) y "Reglas internas" (antes, un decorador de `editorial-rules.ts` lo ponía arriba de todo el inspector; ahora va dentro de la sección). Como esa pasada es un panel de pestaña entera en HTML (`extend.instead`), la extensión que monta las secciones de React no corría para ella: `inspector-registry.ts` ahora también las monta ahí (`mountSectionPanels`). Comparado en Chrome sin ventana: marcado igual en castellano, inglés y con otra página activa, salvo el lugar de "Reglas internas" y `data-pass`, que ahora queda en la sección.
También las vistas del riel (paso 9): Índice y Capas son componentes propios montados en `#railView` (`src/components/rail/RailViews.tsx`, con `IndexView.tsx` y `LayersView.tsx`), que registran `editorial.ts` y `layout-tools.ts` con `registerRailView` (`rail-views.ts`). Ya no pasan por la cadena del inspector: se fue la envoltura `extend.around` de `inspector-views.ts` y el riel no se vuelve a dibujar en cada `inspector()`; se redibuja con `useEditorState()`. El ojo y el candado de Capas pasan de caracteres a íconos con `aria-label` y `aria-pressed`. Comparado en Chrome sin ventana: marcado igual en castellano e inglés, con y sin selección, con objetos ocultos y bloqueados y con entradas manuales, salvo el ojo y el candado.

**Hecho (pasos 1 a 3):** Grilla (`GridPanel.tsx`), Cornisa y Titulillo (`MasterPanels.tsx`), con las piezas comunes en `src/components/inspector/fields.tsx` (`SwitchHeading`, `Row`, `NumberField`, `Options`, `CheckLine`, `MasterDetails`). La pestaña Libro en HTML queda en el lugar de cada panel y la sección Texto. La "Lectura lateral" que agregaba `master-refinement.ts` pasó a los paneles. Las guías individuales de `editorial.ts` se agregan al final de la Grilla de React y traducen sus textos con `LibroI18n.tr`, porque el traductor del DOM no entra ahí. Comparado en Chrome sin ventana contra la versión en HTML: mismo marcado y comportamiento en castellano, inglés y centímetros (valores, interruptores, ajuste de grilla, margen imposible, flechas en un campo, cornisa lateral y su sentido, plegar y reordenar).

**Hecho (paso 8):** Selección de una caja de texto en `TextPanels.tsx`: "Párrafo y estilos", "Tipografía" (tipo de letra, peso y estilo, ejes variables de la caja o del párrafo, muestra, cuerpo, interlineado, alineación, color) y "Carácter y párrafo". Absorbe el panel y el decorador de ejes de `paragraphs.ts`, lo de la caja de texto del decorador de `fonts.ts`, `extraTextControls` de `editorial.ts` y el decorador de glifos de `font-glyphs.tsx`. `studio.ts` publica `commitObjectField()` (lo que hacía `bindInspector` con data-object). "Carácter y párrafo" se monta ahora antes que los decoradores, así que el botón de glifos sí abre los glifos, la ayuda de términos llega a Tracking y Sangría inicial, y con la caja bloqueada sus campos quedan deshabilitados como el resto. `fields.tsx` suma `Heading`, `Btn` y `Row term`, que usan también Página, Misceláneas y Fuentes de tu equipo.

**Hecho (pasos 4 y 5):** Misceláneas y líneas (`RulesPanel.tsx`), Fuentes de tu equipo (`FontLibraryPanel.tsx`) y la pestaña Página entera (`PagePanel.tsx`: la página sola, Página N y Elementos automáticos). Misceláneas y fuentes las agregaba un decorador: ahora el decorador (`book-workflow.ts`, `fonts.ts`) deja el lugar vacío donde iba siempre y lo monta en el acto con `mountInspectorSlot(lugar)` (nuevo en `inspector-registry.ts`, para lugares que aparecen después de la pasada de montaje). La pestaña Página deja sus tres lugares en `studio.ts`; lo que hacían `page-exceptions.ts` (sacar las casillas de la base y anteponer su sección), el aviso de página activa de `review-workspace.ts` y `reshapePagePass` de `inspector-views.ts` (mover Agregar y Duplicar) quedó dentro del panel, y esos pasos se borraron. Comparado en Chrome sin ventana contra la versión en HTML (castellano, inglés, centímetros, con líneas activas y con excepciones de página): el marcado es igual salvo el orden de los atributos, `data-text-source` y el atributo `value`; las mismas acciones dan el mismo resultado.

**Hecho (paso 7):** Selección del objeto (`ObjectPanel.tsx`): Objeto seleccionado, Posición y tamaño, Alinear, Distribuir, Orden y bloqueo, y el estado vacío "Nada seleccionado" (también con selección múltiple). La pasada `object` reemplaza al contenido base (`registerInspectorPanel('object', …)`), así que la pasada de montaje del registro no corre: `objectInspector` deja los cinco lugares y los monta con `mountInspectorSlot`; el estado vacío lo deja `inspector-views.ts`. El nombre de la figura en la etiqueta del objeto (antes lo escribía `shapes.ts` en el nodo) pasó al panel; la sección de la figura sigue en HTML. Los campos de posición y tamaño ahora siguen al objeto mientras se arrastra o se estira (antes quedaban quietos hasta soltar). Comparado en Chrome sin ventana contra la versión en HTML (marco, figura, caja de texto, bloqueado, selección múltiple, nada seleccionado, inglés y centímetros): marcado igual salvo el orden de los atributos y `value`; las mismas acciones dan el mismo resultado.

**Hecho (restos):**
- **Figura · relleno y trazo** pasó a `ShapePanel.tsx`. `objectInspector` le deja el lugar (`section.shape-appearance`) cuando lo elegido es un marco o una imagen. La unidad va dentro del campo, como la dejaba `unitsInsideFields`.
- **Guías individuales** (`<details class="guide-controls">`) pasaron al final de `GridPanel.tsx`. `openGuideDialog()` de `editorial.ts` abre la Hoja. Antes las agregaba la envoltura de `editorial.ts` después de dibujar, y con el inspector en pausa se repetían: había dos o tres cajas iguales.
- **Secciones que se dibujaban y se borraban enseguida:**
  - en Libro, "Texto" (`textControls`, ya borrada);
  - en la pasada `text`, "Transformar objeto" y "Edición";
  - la alineación que `review-workspace.ts` agregaba en el texto y en Capas.

  Las sacaba `inspector-organization.ts`, del que queda sólo quitar el par de medidas en Capas. Ahora ni se dibujan.
- Comparado en Chrome sin ventana contra la versión anterior: Libro, Página, Foliado, texto, figura (polígono, redonda, marco común), imagen, imagen bloqueada, varios, guías, Capas, Índice e inglés. Todo igual, salvo las guías repetidas.

**Hecho (paso 10): la cadena.** Se fueron las pasadas que se dibujaban y se juntaban en un fragmento, los lugares HTML (`inspectorSlot`), `mountInspectorSlot`, las raíces de React por sección, `bindInspector`, `unitsInsideFields`, `emptySelection`, `inspector-sections.ts` y `decorateInspector`. Los decoradores que quedaban:

| Decorador | Qué hacía | Dónde quedó |
|---|---|---|
| `book-workflow.ts` (pasada `structure` y `ruleControls`) | lugares de Estructura y de Misceláneas | tabla de `Inspector.tsx` |
| `fonts.ts` | lugar de Fuentes de tu equipo | tabla de `Inspector.tsx` |
| `inspector-organization.ts` (`objectInspector`) | lugares del objeto y de la figura | tabla de `Inspector.tsx` |
| `layout-tools.ts` (`updateSnapButton`) | avisar a la barra del imán | lo hace la fachada: `inspector()` avisa a todos |
| `review-workspace.ts` (`updateActivePage`) | marcar la página activa fuera del inspector | `extend.after('inspector')` |
| `document-units.ts` | mm → cm en etiquetas y campos | `lengthUnit()` en los paneles y `fieldAdapters` (cada campo nuevo, una vez) |
| `editorial-learning.ts` (`decorateGlossaryHints`, también tras `render`) | botón "Aprender" en los términos | `TermHelp` en `fields.tsx` |
| `font-browser.tsx` (`decorateFontBrowsers`) | botón visual junto al selector de fuente | `FontOptions` / `FontBrowserButton` en `fields.tsx` (`decorateFontBrowsers` sigue para la Hoja de estilo de párrafo) |
| `tutorial.ts` | deshabilitar campos con el objeto bloqueado; marcar el objetivo del recorrido | `disabled={locked}` en los paneles; `extend.after('inspector')` |

Tiempos (Chrome sin ventana, libro de muestra, 50 llamadas seguidas a `inspector()`): Libro de unos 930 a 2200 ms a unos 35-60 ms; Selección con caja de texto de 830-2380 ms a 30-50 ms; Página de 115-240 ms a unos 20 ms. Antes crecía en cada tanda porque las raíces viejas se desmontaban recién al terminar y seguían escuchando avisos. `render(true)` pasó de unos 14 ms a 5 ms y `showTab()` de 10 ms a 1,2 ms; `notifyEditorState()` sube un poco (de 0,5 a 0,8 ms), porque redibuja también el inspector.

**Orden para los demás paneles**, de menos a más acoplado:

| Paso | Panel | Qué hay que absorber o cuidar |
|---|---|---|
| 1 ✓ | Titulillo (Libro) | `master-refinement.ts` agrega "Lectura lateral" después de la posición y oculta "Rotar texto 90°" (lo comparte con Cornisa: el decorador queda para el que siga en HTML) |
| 2 ✓ | Cornisa (Libro) | lo mismo, más título del libro y sección general (`data-bind="title"`/`"chapter"`) |
| 3 ✓ | Grilla (Libro) | botones `data-fit`, validación de márgenes (`commitBinding` ya la tiene) y las plantillas, que redibujan aparte |
| 4 ✓ | Misceláneas y líneas, Biblioteca de fuentes (Libro) | secciones que hoy agregan decoradores (`book-workflow.ts`, `fonts.ts`): pasan a paneles registrados con su propio lugar |
| 5 ✓ | Página (pestaña Página) | `page-exceptions.ts` y `reshapePagePass` en `inspector-views.ts` mueven nodos entre secciones |
| 6 ✓ | Estructura (Libro) | `book-workflow.ts` dibuja la pasada `structure` entera con `registerInspectorPanel`; `addBookSettings` le inserta un botón |
| 7 ✓ | Selección: objeto | `inspector-organization.ts` (alinear, distribuir, capas), `shapes.ts`, `placed-artwork.ts` |
| 8 ✓ | Selección: texto y párrafo | lo más acoplado: `paragraphs.ts` (escucha `change` en el documento y envuelve `commit`), `hyphenation-controls.ts`, `font-glyphs.ts`, `editorial.ts` (controles extra) y la vista de variantes de `fonts.ts` |
| 9 ✓ | Vistas del riel (Índice, Capas) | se arman con la misma cadena y se mueven a `#railView`: van como pestaña entera de React |
| 10 ✓ | La cadena | `<Inspector/>` arma las tres pestañas; `inspector()` y `showTab()` quedan como fachada |

**Riesgos:**
- **Nodos que duran:** el DOM del inspector ya no se rehace. Lo que se le hace a mano a un nodo de React (una clase, `disabled`, un hijo agregado) queda hasta que React lo vuelva a crear; lo que React vuelve a escribir (un texto, un atributo que cambió) pisa lo agregado. Todo lo del inspector va en el panel.
- **Un campo sin `key`** con su valor no se entera de que el libro cambió (sigue mostrando el valor viejo).
- **Una ref que prepara el nodo una sola vez** (`firstTime`) no ve los datos nuevos: lo que dependa de ellos va en la `key` del elemento o en el render.
- **El traductor del DOM:** no traduce `data-react`.
- **`flushSync` desde un efecto de React:** si `inspector()` se llama dentro de un efecto, el dibujo sincrónico no se cumple (React avisa y dibuja después).

## El lienzo (etapa 3, D2): hecho

Es lo último del orden D2. Plan escrito el 09-nov y hecho el mismo día, en seis pasos (abajo, cada uno con lo que se hizo). Lo que quedó fuera está al final de la sección.

### Qué es hoy

El lienzo es lo que `studio.ts` y una decena de módulos dibujan alrededor del libro, en `#spreadStage` → `#spread`:

- **El papel.** `paper(i, px, print)` arma cada página: objetos, texto, imágenes y elementos automáticos.
  - La misma función sirve para la pantalla (`print` falso) y para lo que sale impreso: `#printRoot` (PDF), las pruebas de imprenta (`book-workflow.ts`), el asistente editorial y la medición del motor (`modules/compose.ts`).
  - La extienden 9 módulos con `extend.result`: `editorial` (Índice, tracking, sangrías), `fonts` (caras), `paragraphs` (párrafos `.mqt-paragraph`), `book-workflow` (líneas), `shapes` (figuras SVG), `layout-tools` (ocultos y bloqueados), `frame-handles` (controladores), `review-workspace` (página activa y selección múltiple) y `compose-loader` (el motor: `.mqt-line`).
- **Lo que es sólo de pantalla está mezclado adentro de `paper()`**, en ramas `if (!print)`:
  - la clase `selected`, la etiqueta del objeto y la manija de tamaño;
  - los oyentes de `pointerdown` por objeto, `dblclick` para editar y `input`/`blur` del texto;
  - la grilla y las guías (`gridSvg`, que extiende `editorial`) y el `pointerdown` de la página.
  - Los módulos de afuera le suman lo suyo: los 8 controladores (`frame-handles`), la marca de página activa y de selección múltiple (`review-workspace`) y el nombre de la figura en la etiqueta (`shapes`).
- **El dibujo:** `renderPages()` vacía `#spread` y lo vuelve a llenar con `paper()` en cada `render()`, y escribe las marcas de las reglas (`#rulerX`, `#rulerY`).
  - `continuous-canvas` lo cambia por filas virtualizadas (sólo las cercanas a la vista).
  - `canvas-navigation` guarda y restaura el punto bajo el cursor al hacer zoom (`canvasAnchor`).
  - Las dos extienden `renderPages`.
- **La interacción:**
  - `objectDown` lo reemplaza `frame-handles` y lo extienden `layout-tools`, `review-workspace` (×3) e `inspector-organization`.
  - `moveObject` lo reemplaza `frame-handles` y le suma el imán `layout-tools` (`.snap-indicator`). `upObject` y `pageDown` también se extienden.
  - El arrastre escribe `left/top/width/height` del nodo en cada `pointermove` y llama a `updateStatus()`, que avisa a React (hoy redibuja también el inspector, ~1 ms).
- **El texto en edición:** `startEditing` pone `contentEditable` en `.text-content` del mismo nodo del papel.
  - El motor (`compose-loader`, `restoreForEditing`) le devuelve el texto de CSS a ese cuadro mientras se edita.
  - `finishEditing` lo cierra, y `hyphenation-controls` y `paragraphs` lo extienden.
- **Ya está en React:** la barra del lienzo (`components/canvas-bar/`), el riel y las barras.

### Qué pasa a React y qué no

**No cambia (capa `book`): `paper()` con `print` verdadero y todo lo que dibuja el libro.**
- Los PDF tienen que salir idénticos.
- El motor reemplaza nodos adentro del texto.
- `paper` lo nombran el proceso principal y 5 pruebas (`paper(0, …, true)`; `layout-tools-tests` también con `false`).
- Siguen igual `autoElement`, las miniaturas, `#printRoot` y `ui/book/`.
- `paper()` sigue siendo una función que arma DOM. React no la reconcilia: sus extensiones la modifican después de armarla.

**Pasa a React lo que es sólo de pantalla, encima del papel:**
- selección, etiqueta y controladores;
- selección múltiple, página activa y desborde (`+`);
- grilla y guías, indicadores del imán, reglas;
- el contenedor que decide qué páginas o filas se ven.

**No pasa a React:**
- el contenido editable: React nunca dibuja adentro de `.text-content`;
- el arrastre en sí (captura del puntero y estilo del nodo);
- el cálculo de zoom y desplazamiento, que es aritmética sobre `#spreadStage` y sigue en `canvas-navigation`, pasado a un estado con aviso propio.

### Orden

Cada paso es una entrega con la autoprueba en verde, PDF idénticos (`compare-outputs`) y el marcado de `#spread` comparado en Chrome sin ventana, como en el inspector.

1. ✓ **Separar el papel de la pantalla, sin React.**
   - `paper(i, px, print)` queda con la rama del libro.
   - Lo de pantalla (clase `selected`, etiqueta, manija, grilla y guías, `pointerdown` de la página) pasa a una función extensible aparte, `screenPage(page, i)`, que llaman `renderPages` y la vista continua después de `paper()`.
   - Las extensiones de pantalla (`frame-handles`, `review-workspace`, el nombre de `shapes`, la parte de bloqueados de `layout-tools`) se mudan de `paper` a `screenPage`.
   - Prueba: `paper(i, px, true)` y los PDF idénticos; `#spread` igual.
   - **Hecho (09-nov).**
     - `screenPage(page, i, px)` es extensible en `studio.ts`. La llaman `renderPages` y la vista continua (`screenPage(paper(i, scale), i, scale)`).
     - Se mudaron a `screenPage` los controladores (`frame-handles`), la página activa y la selección múltiple (`review-workspace`), los bloqueados (`layout-tools`; los ocultos siguen en `paper`, porque tampoco se imprimen), el nombre de la figura en la etiqueta (`shapes`) y el doble clic del Índice (`editorial`).
     - `paper()` ya no lleva `selected`, `active-page`, etiqueta, manija, guías ni oyentes, tampoco con `print` falso.
     - Autoprueba completa: los 7 PDF y los JSON salen idénticos. Sólo cambia `verificacion-extensiones.json`: `paper` pierde `frame-handles` y `review-workspace`, y aparece `screenPage` con `editorial`, `frame-handles`, `layout-tools`, `review-workspace` y `shapes`.
     - `#spread` comparado en Chrome sin ventana: igual en texto, marco, figura, bloqueado, varios, edición, clic, inglés y vista continua. Hay dos diferencias, ninguna visible:
       - en una línea decorativa elegida, la línea va antes que la etiqueta (antes, después de los controladores);
       - lo impreso ya no lleva la clase `locked`, que sólo cambia el cursor.
2. ✓ **Eventos delegados.**
   - Un solo oyente en `#spread` (`pointerdown`, `dblclick`, `input`, `blur`) que busca el `[data-id]` y la página, y llama a `objectDown`/`pageDown`/`startEditing` con los mismos argumentos.
   - Las 13 extensiones de esas funciones no cambian.
   - Ningún nodo del papel lleva oyentes: React puede dibujar al lado sin perderlos.
   - **Hecho (09-nov).**
     - En `studio.ts` ("Eventos del lienzo"), `#spread` atiende `pointerdown`, `dblclick`, `input` y `focusout` (`blur` no sube).
     - `canvasHit()` busca la página y el objeto del libro por `data-id` en el momento del evento.
     - Un `pointerdown` sobre un objeto llama a `objectDown`. Desde una manija lleva `true`, y desde un controlador su `data-handle`. Si `objectDown` no detuvo el evento (`cancelBubble`), sigue a `pageDown`, como cuando cada nodo tenía su oyente.
     - La captura del puntero y el arrastre (`moveObject`/`upObject` sobre el nodo) no cambian.
     - Se fueron los oyentes de `screenPage`, de los controladores (`frame-handles`) y la extensión de `screenPage` de `editorial`. El doble clic en el Índice pasa por `startEditing`, que `editorial` ya desvía a la vista del Índice.
     - Autoprueba completa: PDF y JSON idénticos, salvo `verificacion-extensiones.json` (`screenPage` pierde `editorial`).
     - `#spread` igual en los recorridos. Con eventos de puntero reales (CDP) dan lo mismo antes y después: elegir, arrastrar, controladores, Mayús + clic, clic en la página vacía, doble clic, escribir y salir, mano con Espacio, botón del medio, vista continua y Escape.
3. ✓ **Capa de selección en React (`components/canvas/SelectionLayer.tsx`).**
   - Dibuja con `createPortal` dentro del `.paper-object` elegido: etiqueta, 8 controladores y manija.
   - También la marca de selección múltiple, la de página activa y el `+` de desborde.
   - El marcado es el mismo: `frame-handles-tests` sigue contando `.paper-object.selected > .frame-handle`.
   - Se redibuja con un aviso propio, `pagesDrawn`, que da `renderPages` con `flushSync` (los nodos del papel son nuevos en cada dibujo), y con la selección.
   - Salen las ramas de pantalla de `frame-handles`, `review-workspace` y `shapes`, y `checkOverflow` deja de escribir el DOM.
   - **Hecho (09-nov).**
     - **Qué dibuja:** `SelectionLayer.tsx` pone, con portales dentro de los nodos del papel, la etiqueta y los 8 controladores del objeto elegido (bloqueado, sólo la etiqueta), la marca + y el rótulo de página activa.
     - **Clases:** `selected`, `multi-selected`, `locked`, `active-page` e `is-page-active` se ponen después de cada dibujo.
     - **Cuándo se dibuja:**
       - `canvas-layer.ts` la engancha a `screenPage` (`trackPage`, en el acto: cada página nueva, también en la vista continua);
       - `objectDown` de `frame-handles` llama a `refreshSelection()` en lugar de escribir clases y controladores;
       - también se redibuja con el aviso del estado y con el idioma.
     - **Desborde:** `checkOverflow` lo mide `canvas-layer.ts` (`extend.replace`), y la capa se redibuja sólo si cambió qué cajas desbordan. Durante el arrastre se mide en cada movimiento, pero no redibuja.
     - **Lo que se fue:** las extensiones de `screenPage` de `frame-handles`, `layout-tools`, `review-workspace` y `shapes`, y la reescritura del rótulo en `updateActivePage`. `frameDirections` y los nombres de los controladores viven en la capa.
     - **Pruebas:**
       - La autoprueba da PDF y JSON idénticos, salvo `verificacion-extensiones.json`: `screenPage` queda sólo con `canvas-layer`, y `checkOverflow` suma `canvas-layer`.
       - `#spread` sale igual en los recorridos, y con eventos de puntero reales dan lo mismo antes y después.
       - El arrastre cuesta lo mismo: ~0,9 ms por movimiento y ~1 ms por cuadro, antes y después.
       - Única diferencia: si la selección cambia sólo con el aviso del estado, sin redibujar el pliego, la capa la sigue; antes quedaban los controladores viejos.
4. ✓ **Grilla, guías, imán y reglas.**
   - `<PageGuides/>` por página, en lugar de `gridSvg` + la extensión de `editorial`.
   - `<SnapIndicators/>` con un estado propio que escribe `moveObject`.
   - `<Rulers/>` con las marcas de `#rulerX`/`#rulerY` y la preferencia de `rulers.ts`.
   - **Hecho (09-nov), en `components/canvas/CanvasGuides.tsx`, dibujado por la capa de selección:**
     - `PageGrid` dibuja la grilla, la caja de márgenes y las guías propias de cada página, con el mismo SVG de antes. Salieron `gridSvg` de `studio.ts` y su extensión de `editorial`; `screenPage` ya no dibuja nada.
     - `SnapMarks` dibuja las líneas del imán: `layout-tools` las pasa con `setSnapMarks()` y la capa se redibuja sólo cuando cambian.
     - `Rulers` pone las marcas de `#rulerX`/`#rulerY` con las mismas cuentas del pliego y de la vista continua (mm o cm). Salieron las escrituras de `renderPages` y de `continuous-canvas`. La preferencia de mostrar u ocultar sigue en `rulers.ts`.
     - La grilla, las guías y los márgenes del PDF siguen en `output.ts` (`overlaySvg`), sin cambios.
     - **Pruebas:**
       - La autoprueba da PDF y JSON idénticos, salvo `verificacion-extensiones.json` (se va `gridSvg`).
       - Salen iguales `#spread` y las reglas: con y sin grilla, con guías, en cm, con zoom, con la última página sola y en la vista continua.
       - La salida con y sin "Grilla de filas y columnas" da el mismo marcado.
       - Con eventos de puntero reales, el imán muestra las mismas líneas a mitad del arrastre y ninguna al soltar.
       - El arrastre cuesta lo mismo: ~0,8 ms por movimiento y ~1 ms por cuadro.
5. ✓ **El contenedor del pliego (`<Spread/>`).**
   - React decide qué páginas o filas existen: un pliego, o las filas virtualizadas de la vista continua.
   - Cada lugar se llena con `paper(i, scale)` en un `useLayoutEffect`: el papel sigue siendo una isla imperativa.
   - `renderPages()` queda como fachada, como `inspector()`: avisa y dibuja en el acto.
   - El ancla del zoom (`canvasAnchor`/`restoreCanvasAnchor`) se restaura en el mismo efecto, cuando los tamaños ya están puestos.
   - Las dos extensiones de `continuous-canvas` y las de `canvas-navigation` sobre `renderPages` pasan adentro del componente.
   - **Hecho (09-nov), en `components/canvas/Spread.tsx`:**
     - `renderPages()` de `studio.ts` quedó vacía, como fachada. `canvas-layer.ts` le engancha `drawSpread()`, que:
       - antes de dibujar calcula el plan: la escala, el ancla y la clave del pliego, o las filas de la vista continua;
       - dibuja en el acto con `flushSync`.
     - **Pliego:** el lugar es `#spread`. Las páginas van directo ahí, como siempre.
     - **Vista continua:** React dibuja una `<section class="continuous-row">` por pliego. Cada fila se llena con `paper()` y `screenPage()` en un `useLayoutEffect` cuando está cerca de la vista, y se vacía lejos.
     - **Después del dibujo:** tamaño de la superficie, posición del pliego y desplazamiento o ancla.
     - **Al desplazarse:** la página visible y las filas cercanas; `canvas-layer.ts` escucha el `scroll`.
     - **Lo que se absorbió:**
       - las extensiones de `renderPages` de `canvas-navigation` (antes y después) y de `continuous-canvas` (`instead` y antes);
       - las de `canvasAnchor`/`restoreCanvasAnchor` de `continuous-canvas` (ahora esas funciones conocen la fila);
       - `paintContinuousRows`, `markVisiblePage` y el oyente de `scroll`.
       - En `continuous-canvas` quedan el estado, el botón y lo que elige el pliego.
     - **La capa de selección:** mientras se llenan los lugares (`drawingPages`), sólo anota las páginas y se redibuja una vez, al final del mismo dibujo.
     - **Orden de carga:** `canvas-layer.ts` va después de `continuous-canvas.ts` en `src/entries/app.ts`. Hasta ahí, `renderPages()` no dibuja nada.
     - **Pruebas:**
       - La autoprueba da PDF y JSON idénticos, salvo `verificacion-extensiones.json`: `renderPages` queda sólo con `canvas-layer`, se van `canvasAnchor` y `restoreCanvasAnchor`, y `screenPage` cambia de lugar en la lista.
       - Dan igual `#spread`, la escala, la superficie y el desplazamiento: pliego, zoom con ancla ida y vuelta, ajustar, redibujo, vista continua de punta a punta, zoom en la vista continua y vuelta al pliego.
       - Con eventos de puntero reales, el mismo resultado.
     - **Tiempos** (50 `renderPages`):
       - pliego, de 116 a 152 ms (de ~2,3 a ~3 ms cada una);
       - vista continua, de 133 a 121 ms.
       - El cuadro de desplazamiento y el arrastre cuestan lo mismo (~0,9 ms por movimiento).
6. ✓ **Edición y arrastre: se ordenan, no se pasan.**
   - `editing` y `drag` ya viven en `editor`.
   - Durante el arrastre, el aviso a React se junta en un `requestAnimationFrame` (`editor-state`, dc629ce), y el inspector sólo se entera de la geometría (`GeometryPanel`).
   - **Hecho (09-nov).** El ciclo quedó así:
     - **La edición.**
       - El nodo editable es el `.text-content` que arma `paper()`. No se crea uno aparte.
       - `startEditing(el)` (doble clic, desde `#spread`) cierra la edición anterior y guarda un paso de deshacer. Pone `editing`, la clase `editing` y `contentEditable`, y le da el foco.
       - Al empezar, el motor (`restoreForEditing`, `compose-loader`) y la separación silábica (`hyphenation-controls`) devuelven el cuadro al texto de CSS.
       - Cada `input` escribe `o.text` (`changed()`, sin redibujar). Funciona igual con un IME, y deshacer adentro (Ctrl+Z) es el del navegador.
       - `finishEditing()` la cierra: con `focusout` (clic afuera), Escape, zoom, otro objeto, deshacer afuera o un dibujo.
       - Después, `paragraphs` redibuja en el próximo cuadro, si no hay otra edición ni un arrastre.
       - **React nunca tiene hijos dentro del nodo editable.** La capa de selección dibuja en el `.paper-object`, al lado del `.text-content`, y la clase `editing` la ponen `startEditing` y `finishEditing`, no la capa.
     - **El arrastre.**
       - `objectDown` y `moveObject` los arma `frame-handles`; en `studio.ts` sólo está su nombre (extensible).
       - `objectDown` elige el objeto, guarda `drag` y captura el puntero en el `.paper-object`.
       - `moveObject` escribe el estilo del nodo; el imán (`layout-tools`) lo ajusta y pasa sus líneas a la capa. El aviso a React va por cuadro.
       - `upObject` suelta la captura y, si se movió, guarda y redibuja. Escape o `pointercancel` vuelven atrás (`frame-handles`).
       - Los controladores van dentro del nodo que se mueve, así siguen al estilo sin redibujar.
     - **Cambiar de página, de zoom o redibujar en el medio:**
       - Durante un arrastre, el zoom no cambia: `zoomCanvasTo` y la rueda lo ignoran, y Ctrl + "+" también.
       - Un dibujo pedido durante un arrastre (`renderPages`) espera a que termine. Antes reemplazaba el nodo que tenía la captura y el arrastre quedaba abierto.
       - Durante una edición, el zoom, las miniaturas y deshacer afuera la cierran primero. Un dibujo también: `drawSpread` llama a `finishEditing()` antes de reemplazar el papel.
       - En la vista continua, una fila con la edición o con el arrastre no se vacía al desplazarse.
     - **Código que salió:**
       - las bases muertas de `objectDown` y `moveObject` en `studio.ts`, que `frame-handles` reemplazaba enteras;
       - las clases de página activa que `markVisiblePage` repetía a mano: ya las pone la capa.
     - **Pruebas:**
       - La autoprueba da PDF y JSON idénticos; esta vez la lista de extensiones no cambia.
       - Con eventos reales dan igual antes y después: escribir con IME (`Input.insertText`), deshacer adentro y afuera de la edición, y arrastrar mientras se intenta el zoom con Ctrl + rueda y Ctrl + "+".
       - Diferencia buscada: un `renderPages()` a mitad del arrastre ya no lo rompe.
       - Vista continua de punta a punta, con las clases de página activa en cada paso, igual.
       - El arrastre cuesta lo mismo (~0,8 ms por movimiento).

### Lo que quedó fuera

- **Dos restauraciones del cuadro en edición.** El motor (`restoreForEditing`) y la separación silábica (`hyphenation-controls`) devuelven, cada uno por su lado, el texto de CSS al empezar a editar; al terminar, `hyphenation-controls` y `paragraphs` lo rehacen. Podrían ser un solo paso del ciclo de edición.
- **Clases de página activa repetidas.** `updateActivePage` (`review-workspace`) todavía las pone a mano además de la capa.
- **El cálculo de la escala** sigue en `studio.ts` (`calculateScale`, para el pliego) y en `Spread.tsx` (para la vista continua).
- **Las miniaturas** siguen fuera de React: son de la capa `book`.
- **Rendimiento:** `renderPages` en el pliego cuesta ~0,5 ms más que antes del paso 5 (React decide los lugares).

### Convivencia con el motor de composición

- El motor trabaja sobre el DOM que arma `paper()` (`.mqt-paragraph` → `.mqt-composed` con `.mqt-line`) y no se toca.
- Las capas de React se dibujan al lado de `.text-content`, nunca adentro, y no dependen de su estructura.
- Al editar, `restoreForEditing` sigue devolviendo el cuadro a CSS. React no reconcilia ese nodo, así que no hay choque.
- El desborde sigue midiendo `.text-content` (con el motor, alto fijo por líneas); sólo cambia quién dibuja el `+`.

### Riesgos

- **Rendimiento del arrastre.** Cada `pointermove` escribe el estilo del nodo y avisa a React: hoy cuesta ~1 ms, con el inspector incluido. Si la capa de selección también se redibuja, puede pasar los 4 ms por cuadro.
  - Medir antes de cada paso: tiempo por `pointermove` y `render(true)`.
  - Los controladores van adentro del nodo que se mueve, así siguen al CSS sin redibujar.
  - El aviso se junta por cuadro.
- **Eventos de puntero.**
  - La captura (`setPointerCapture`) está en el `.paper-object`. Si React vuelve a crear el controlador desde el que empezó el arrastre, la captura no se pierde, porque no está en él.
  - El `stopPropagation` de `objectDown` hoy evita el `pageDown` del papel; con oyentes delegados, el orden lo decide el oyente único.
  - Los eventos sintéticos de React se registran en su raíz, no en `#spread`.
- **`contenteditable`.**
  - React no puede tener hijos dentro del nodo editable: el método de entrada (IME), la selección y el `innerText` dependen de que nadie reescriba ese DOM.
  - El portal de la capa de selección va en el `.paper-object`, al lado de `.text-content`.
- **Pruebas que tocan el DOM del pliego.**
  - `frame-handles-tests`: 8 controladores en `#spread .paper-object.selected`.
  - `feedback-tests`: `#spread .page` y eventos sobre `#spread`.
  - `document-view-tests`: `continuousRows` y `#spread .page[data-page]`.
  - `layout-tools-tests`: `paper(0, 1, false)` sin controladores en un objeto bloqueado.
  - Todas leen el DOM en el acto después de `render()`/`renderPages()`: cada fachada dibuja con `flushSync`. Desde el paso 3, `paper(…, false)` ya no trae controladores; esa prueba sigue valiendo, porque busca que no estén.
- **Globales que asignan las pruebas** (`scripts/globals-report.mjs`):
  - `selected` (13 archivos), `active` (12), `spread` (9), `zoom` (3), `tool`, `canvasSpreadKey` (2 cada uno), `continuousKey`, `spaceHand` y `multiSelection` (1 cada uno).
  - Siguen funcionando porque cada prueba llama a `render()` después de asignar, y el lienzo se dibuja desde el estado.
  - Leen además `render` (21), `paper` (5), `renderPages` (3), `continuousRows`, `canvasStage`, `canvasAnchor`, `frameGeometry` y `snappedFrame`.
  - La autoprueba nombra `render`, `tool` y `showHandlePreview`, y el proceso principal nombra `paper`: no cambian de nombre ni de firma.
- **Extensiones por nombre.** `paper` (9), `objectDown` (6), `startEditing` (4), `renderPages` (4), `pageDown` (3), `moveObject` y `upObject` (2).
  - Los pasos 1 y 2 sólo mudan extensiones de pantalla a `screenPage`. `MaquetarioExtensions.list()` cambia en esas entradas, y hay que avisarlo en cada entrega.
- **Nodos que se rehacen.** `renderPages` crea páginas nuevas en cada dibujo, y un portal cuyo contenedor salió de la página se pierde.
  - Hasta el paso 5, la capa de selección se vuelve a dibujar en el acto después de cada `renderPages`.
  - Con `<Spread/>`, los lugares de página duran y sólo se rehace el papel de adentro.

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
- Hoja (`openSheet`, o `modal.sheet`/`modal.info` con un elemento de React) y Ventana de trabajo (`openWorkWindow` o `modal.workspace`). Hay una sola a la vez: abrir una reemplaza a la que esté abierta.
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
  - `registerInspectorPanel('pasada:sección', () => <Panel />)`, con su lugar en la tabla `sectionsOf` de `components/inspector/Inspector.tsx`;
  - reglas en "Paneles de React en el inspector".
- Ayuda: `registerHelpSection({ id, label, order, render })`, en `components/help/help-center.tsx`.

**Proceso principal.** Los cambios del proceso principal (CSP, protocolo `maquetario://`, manejadores) piden reiniciar la app. Ctrl+R sólo recarga la interfaz.

## Etapa 2, parte B: de globales a `import` (plan)

Hoy la interfaz se arma con dos entradas (`src/entries/core.ts` y `app.ts`) y el núcleo `src/global/studio.ts`, que es un script global. Los módulos se comunican por `globalThis`: el núcleo comparte sus `let`/`function` de nivel superior, los módulos publican con `globalThis.x = …` y `declare global`, y `extend` envuelve funciones buscándolas por nombre en `window`. La parte B cambia eso por `import` reales sin cortar la autoprueba en ningún paso.

### Inventario (`node scripts/globals-report.mjs`)

El script lista cada global, quién lo define, qué archivos lo leen o lo asignan, qué pruebas lo usan, si lo nombran las cadenas que el proceso principal evalúa en la página (autoprueba y `main.ts`) y cuántas extensiones `extend()` tiene. Con `--state` muestra sólo el estado y quién lo asigna; con `--json`, todo, para comparar entre entregas. `npm run lint:design` suma a la deuda la línea "globales publicados por módulos (globalThis.x =)".

Punto de partida (09-nov):

| | |
|---|---|
| Globales | 328: 94 del núcleo (`studio.ts`) y 234 publicados por módulos |
| Por tipo | 232 funciones, 30 objetos de servicio (`M`, `UI`, `LibroI18n`, `extend`…), 66 variables de estado |
| Estado asignado desde otros archivos | 22. Los más repartidos: `selected` (lo asignan 11 archivos), `active` (8), `spread` (6), `tool` (5), `book` (4), `dirty` (3) |
| Lo más leído | `bw` (51 archivos), `book` (49), `$` (41), `extend` (37), `LibroI18n` (31), `finishEditing` (23), `commit` (22), `M` (22) |
| Pruebas | leen 141 globales y asignan 31 (`book` lo asignan 20 archivos de prueba; `selected` 13, `active` 12, `spread` 9, `dirty` 8) |
| Proceso principal | las cadenas de la autoprueba nombran 29 globales y las de `main.ts`, 22 (aviso de cierre, actualizaciones, PDF): son un contrato sin tipos |
| Extensiones | 43 funciones extendidas por nombre, 106 registros. Las más extendidas: `paper` (9), `inspector` (7), `render` (5), `autoElement` (5), y con 4: `outputDialog`, `prepareOutput`, `setTool`, `objectDown`, `updateCoverPreview`, `startEditing` |
| Sin usos fuera de su archivo | 25 (por ejemplo `bindInspector`, `hyphenationFields`, `renderBookRoute`, `setLanguage`): son los primeros en dejar de ser globales |

### Estado: un objeto, con accesores mientras se migra

- **Qué pasa al objeto.** `src/state/editor.ts` (en `core`, antes que `studio.ts`) exporta `editor`, con lo que hoy es `let` del núcleo y asignan otros archivos:
  - `book`, `active`, `spread`, `selected`, `dirty`, `tool`, `zoom`, `scale`, `tab`, `busy`, `preview`, `editing`, `drag`, `native`, `fontList`, `undoStack` y `redoStack`;
  - y de los módulos: `hasDocument`, `multiSelection`, `paragraphScope`, `coverDraft` y `coverPart`.

  El estado propio de una pantalla (zoom continuo, explorador de fuentes, glifos) queda en su módulo, exportado.
- **Cómo convive.** Por cada nombre, `editor.ts` instala un accesor en `globalThis` (`Object.defineProperty(globalThis, 'book', { get, set })`), como ya hace `editorial-assistant.ts` con su informe.
  - `studio.ts` deja de declarar esos `let`, así que `book = b`, `active = 0` y `({ book, active } = previous)` siguen andando en el núcleo, en los módulos, en las pruebas y en las cadenas de la autoprueba, sin cambiar una línea.
  - Después, cada módulo pasa a `import { editor } …` y `editor.book`.
  - El accesor se va cuando el inventario muestra que ya nadie usa el nombre suelto. En las pruebas queda hasta el último grupo (ver abajo).
- **Avisos.** El objeto no avisa por su cuenta en el primer paso (sería un cambio de comportamiento). Cuando el estado esté en un solo lugar, `notifyEditorState()` puede salir de los setters y dejar de colgarse de `updateStatus` y `syncNative`.
- **Rendimiento.** `book` se lee miles de veces por dibujo: medir `render(true)` con y sin accesor (por ejemplo, 200 llamadas, como se midió la barra de estado) antes de seguir.

### Funciones y objetos: `export` + publicación de compatibilidad

- Cada módulo exporta lo que hoy publica. Mientras alguien lo use por el nombre global (otro módulo, una prueba, una cadena del proceso principal), sigue también `globalThis.x = x`, y el inventario dice cuándo sacarlo.
- **Orden de carga.** Un `import` adelanta la evaluación del módulo importado. Ya pasó: una Hoja importó `document-units.ts` y su `extend.after('coverEditor', …)` corrió antes de que existiera `coverEditor`, y la app no arrancó. Regla:
  - lo que se importa desde otros archivos no tiene efectos al cargar (sólo exporta);
  - los efectos (registrar extensiones, montar React, escuchar eventos) van en un archivo que sólo importa `src/entries/app.ts`, o en una función `init()` que la entrada llama en orden.
- **Los módulos de React ya importan** su base (`mount`, `dialogs`, `editor-state`, `Form`). Siguen:
  - cambiar los globales que usan adentro (`book`, `bw`, `closeSheet`, `openSheet`…) por `import`;
  - y que su servicio exporte en vez de publicar. La publicación queda sólo para quien llama desde afuera.

### `extend`: registro con nombre por módulo

- **Hoy.** `extend('render', …)` busca `window.render`, la reemplaza por una envoltura y compone la cadena. Un `import { render }` apuntaría a la función sin extensiones. Por eso los módulos que se extienden se llaman a sí mismos por `globalThis`.
- **Propuesta.** El dueño de la función la declara extensible:

  ```ts
  export const render = extensible('render', function render(full = true) { … });
  ```

  - `extensible` registra la base en el registro y devuelve una envoltura estable que siempre corre la cadena compuesta.
  - `extend('render', …)` y sus variantes (`after`, `result`, `around`…) buscan primero en el registro. Sólo caen a `window` mientras quede alguna función sin pasar.
  - Así `import { render }`, el global de compatibilidad y las llamadas internas del mismo módulo pasan todos por las extensiones.
  - `MaquetarioExtensions.list()` sigue igual y sirve de comparación: la lista (qué, en qué orden y desde qué módulo) tiene que salir idéntica antes y después de cada paso.
- **Nombre del registro.** Es el nombre de la función, como hoy. El tercer argumento (el módulo de origen) pasa a ser obligatorio.
- **Más adelante.** Las 12 envolturas a mano que cuenta la deuda pueden pasar a `after`/`result`/`instead`, o a registros propios como `registerInspectorPanel` y `registerTool`.

### Orden por grupos

Cada grupo es una entrega con la autoprueba en verde, los PDF idénticos y el inventario más bajo:

1. **Herramientas.** El inventario en la deuda (hecho) y una regla: no sumar `globalThis.x` nuevos sin anotarlo.
2. **`extend` con registro.** `extensible()` y la búsqueda en el registro, todavía sin cambiar quién define qué. Prueba: `MaquetarioExtensions.list()` idéntica. **Hecho el 09-nov** para el núcleo: `paper`, `render`, `autoElement`, `renderPages`, `objectDown`, `startEditing`, `setTool`, `applyBookSettings` y `pageDown` son `const x = extensible('x', function …)` en `studio.ts`; la lista salió idéntica (con el mismo orden) y la autoprueba la guarda en `verificacion-extensiones.json`. Falta `inspector` (lo está pasando a componente otra tanda) y las de los módulos (`prepareOutput`, `outputDialog`, `outputPreview`, `updateCoverPreview`…), que hoy se llaman a sí mismas por `globalThis`.
3. **Objeto de estado con accesores.** `studio.ts` deja sus `let` de estado. Prueba: autoprueba y JSON idénticos, sin tocar pruebas. Además, medir rendimiento. **Hecho el 09-nov:** `src/state/editor.ts` (en `core`, entre el modelo y `studio.ts`) exporta `editor` con `book`, `active`, `spread`, `selected`, `tool`, `tab`, `zoom`, `scale`, `preview`, `dirty`, `busy`, `fontList`, `native`, `undoStack`, `redoStack`, `editing` y `drag` (que dejaron de ser `let` del núcleo) y `hasDocument`, `multiSelection`, `paragraphScope`, `coverDraft` y `coverPart` (sus módulos siguen asignando el valor inicial, ahora por el accesor). Cada nombre es un accesor en `globalThis`; `maquetarioEditor` deja ver el objeto desde las pruebas. Medido en Chrome con la novela de muestra (mediana de 7): `renderPages` ×50 26 → 27 ms, `paper` de la novela ×3 4,4 → 4,1 ms, `render(true)` ×20 380 → 365 ms, `moveObject` ×2000 3,6 → 3,7 s (ruido: cada movimiento cuesta 1,8 ms por el redibujo de las barras, no por el estado), `composeReport` 5,2 → 5,0 ms. La lectura cruda sí es más cara (2 millones de lecturas de `book`/`active`: 0,5 → 29,6 ms, unos 15 ns por lectura), pero no se nota en ningún camino real; si algún día aparece en un perfil, ese código usa `editor.x` directo. **Arrastre (09-nov):** con el inspector en React, cada movimiento costaba 3,1 ms (dos redibujos sincrónicos de todas las raíces: `updateStatus` y `checkOverflow`; 1,9 ms de trabajo de React y 0,7 de commit). Ahora, mientras hay `drag`, `notifyEditorState()` junta los avisos y redibuja una vez por cuadro (`requestAnimationFrame`); al soltar vuelve a redibujar en el acto: 0,14 ms por movimiento, y los campos de Posición y tamaño siguen al objeto en cada cuadro.
4. **Servicios hoja.** `bw` y `LibroI18n` (`i18n.ts`, `book-workflow.ts`), `M` (`model.ts`), `UI`, los diálogos y `editor-state`. Exportan, y sus lectores importan. La publicación queda para pruebas y cadenas. **Hecho el 09-nov.** Lo que se importa no tiene efectos al cargar; los efectos quedaron aparte:
   - `src/i18n/language.ts`: diccionario, `tr`, `bw`, `i18n` (`tr` y `language`) y el idioma actual. `i18n.ts` queda con el DOM (traducir, `#language`, `LibroI18n.set`) y `book-workflow.ts` sólo publica `bw`.
   - `dialogs.tsx` es el servicio; `dialog-host.tsx` monta la raíz, corta el teclado y publica los globales.
   - `react/editor-state.ts` sin efectos; `editor-state-wiring.ts` engancha `updateStatus`/`syncNative`/`checkOverflow` en el mismo lugar del orden de carga.
   - `src/core-api.ts` da `M`, `UI` y `editor` a los módulos de app: core es otro bundle y un `import` directo duplicaría el modelo y el estado. Los componentes (`components/` y los `.tsx` de `src/`) leen y asignan `editor.x`.

   Lista de extensiones y recorridos de las Hojas idénticos. Inventario: lecturas y asignaciones de globales desde módulos 2575 → 1703 (en `components/` 956 → 391; de estado 761 → 516). Quedan publicados `bw`, `LibroI18n`, `M`/`UI`, los diálogos y `notifyEditorState` para `studio.ts`, las pruebas y la autoprueba.
5. **El núcleo en piezas.** De `studio.ts` salen módulos sin efectos en `core` y lo que corre al cargar queda como cableado, hasta que `studio.ts` deja de ser un script. Plan y resultados en «Grupo 5: `studio.ts` en módulos», más abajo. **Hecho el 09-nov:** `studio.ts` ya no existe; el núcleo es `src/core/`.
6. **Módulos y pantallas.** Por inventario, de menos a más lectores. Primero los 25 sin usos externos, que pasan a privados; después cada módulo con su `import`. **Primera tanda el 09-nov** (sin tocar el lienzo: `studio.ts`, `frame-handles`, `review-workspace`, `layout-tools`, `shapes`, `canvas-navigation`, `continuous-canvas` y `editorial` quedan para su tanda):
   - Sin usos externos, dejan de ser globales: `askChoice`, `openSheetContent`, `browserCurrentVariant`, `currentInspectorView`, `fontLibraryReady`, `hideToast`, `novelProofReport`, `renderBookRoute` y `setLanguage`; `hyphenationFields` y `bindParagraphHyphenation` se borran (nadie los llamaba). `composeReady` y `composeAlgorithm` siguen: son la consola de desarrollo del motor.
   - Partes sin efectos que se importan (el módulo con efectos las usa y publica sólo lo que piden pruebas, proceso principal o `studio.ts`): `inspector-registry.ts` (la pausa sobre `inspector()` pasó a `inspector-registry-wiring.ts`), `hyphenation.ts`, `paragraph-format.ts`, `font-catalog.ts` (`nativeFaces` es un accesor sobre su estado), `output-words.ts`, `length-fields.ts` (las Hojas ya no necesitan el global `adaptLengthControls`), `inspector-tabs.ts`, `book-navigation.ts`, `save-as.ts` y `text-fold.ts`.
   - El orden de evaluación de los módulos en `build/app.js` quedó igual (comparado módulo por módulo), y también la lista de extensiones y los recorridos. Inventario: 329 → 298 globales (31 menos), publicados por módulos 253 → 222, usos de globales desde módulos 1708 → 1603.
   - Quedan para otra tanda, porque arrastran estado de su módulo: `refreshHelp`, `refreshRail`, `setOutputReviewScale`, `packageDialog`, `bookBuilder`, los del tutorial, `readPrinters` y `sendOutput`. `toggleGridStrip` y `toggleFocusLayout` son del lienzo. `selectedFace` y `fontLoadErrors` los lee el motor de composición, que es otro bundle (`build/compose.mjs`).
   - **Segunda tanda (09-nov):** el estado de cada módulo pasa a una parte sin efectos y el módulo con efectos queda como cableado.
     - Partes nuevas: `tutorial-lessons.ts` (lecciones, paso y tarjeta), `components/rail/rail-registry.ts`, `output-send.ts` (impresoras y envío) y `output-review-scale.ts`. En `paragraph-format.ts` se suman `asParagraphOperation()` e `inParagraphOperation()`, en lugar del global `paragraphOperation` que asignaban tres archivos.
     - `help-center.tsx` y `project-package.tsx` quedan sin efectos. Sus globales y la tecla F1 pasan a `help-center-wiring.ts` y `project-package-wiring.ts`, en el mismo lugar del orden de carga.
     - `bookBuilder` llega al panel de Estructura por parámetro (`structurePanelFor`), como `titleOfPart`.
     - Salen 14 globales, 298 → 284: los 11 de la lista y 3 declaraciones que habían quedado sin publicar. "Estado asignado desde otros archivos" baja de 25 a 24 y los usos desde módulos de 1598 a 1551.
     - Los módulos con efectos se evalúan en el mismo orden. Sólo se adelantan los que quedaron sin efectos (`help-center.tsx`, `project-package.tsx`, `paragraph-format.ts`).
     - Lista de extensiones y recorridos idénticos.
7. **Contrato con pruebas y proceso principal.** **Hecho el 09-nov** (salvo sacar los últimos accesores):
   - `src/contract/page-contract.ts`: los tipos, sin dependencias, que importan la app y desktop. `maquetarioMain` lo publica `src/contract/main-contract.ts`: cada función llama al global en el momento, así pasa por las extensiones. `maquetarioTests` lo arma `test-loader.js`.
   - El proceso principal (`main.ts`, `open-file.ts`, `handlers/output.ts`, `handlers/package.ts`, `selftest.ts`) usa `callMain`, `mainExpression` y `testsExpression` de `desktop/src/main/page.ts`, con los nombres verificados por TypeScript. Lo que antes eran cadenas con lógica (abrir el proyecto pedido, el corte de la salida, el aviso de cierre) pasó a la página.
   - `globals-report` controla el contrato: nombres sueltos en el código que evalúa el proceso principal (42 → 0), miembros que usa y no están en el contrato, y que la lista de `test-loader.js` coincida con `MaquetarioTestsApi`.
   - Las pruebas de `tests/` usan el estado por `maquetarioEditor` (368 usos). Los globales que asignan las pruebas bajan de 31 a 17 y los que leen, de 145 a 129. Las suites de integración, asistente, navegación y avisos dan resultados idénticos.
   - Las pruebas reciben un objeto de prueba (por ejemplo, `window.maquetarioTest` con `editor`, `M` y las funciones que llaman) en lugar de los nombres sueltos.
   - Lo que nombran las cadenas de `selftest.ts` y de `main.ts` queda en una lista explícita, publicada por un solo módulo, que el inventario verifica.
   - Recién ahí se sacan los últimos accesores.

**Terminado cuando** el inventario dé:
- 0 estado asignado desde otros archivos;
- 0 extensiones que busquen en `window`;
- y los globales publicados reducidos al contrato (objeto de prueba y lista del proceso principal).

### Grupo 5: `studio.ts` en módulos (plan, 09-nov)

`src/global/studio.ts` tiene 1349 líneas (después del paso 5 del lienzo) y se compila sin envoltorio a `build/studio.js`, que carga entre `core.js` y `app.js`. Es un script: sus `function` de nivel superior son propiedades de `window` y sus `const`/`let` son globales léxicos (`$`, `M`, `paper`… se leen por nombre, pero `window.$` no existe). Todo `src/` ve sus declaraciones sin `declare global`, y no puede importar nada. El inventario cuenta 75 globales del núcleo.

**Mapa por bloques** (`globals-report`; «afuera» = archivos de `src/` que lo leen o asignan):

| Bloque | Líneas | Globales | Afuera | Pruebas | Contrato | Extensiones por nombre | Efectos al cargar | Lienzo |
|---|---|---|---|---|---|---|---|---|
| 1. Utilidades e íconos: `$`, `$$`, `esc`, `M`, `paths`, `icon`, `icons` | 16–105 | 7 | 45 (`$` 39, `$$` 9, `icon` 5) | `$` 26, `M` 21, `$$` 9 | — | — | — | no |
| 2. Anfitrión y avisos: `nativeCall`, `toast`, `syncNative`, `selectObject`, `pending`, `overflowCount` | 106–158 | 8 | 34 (`toast` 19, `selectObject` 15, `nativeCall` 14) | `selectObject` 4, `syncNative` 3, `nativeCall` 2 | `nativeCall`, `toast` | `toast` 1, `syncNative` (nombre calculado) | `window.nativeCall`, `MaquetarioHost.onMessage` | no |
| 3. Deshacer: `snapshot`, `changed`, `commit`, `undo`, `redo` | 159–209 | 5 | 27 (`commit` 25) | 4 nombres | — | `commit` 1 | — | no |
| 4. Medidas, rutas y marcado del inspector: `documentUnit`, `displayMeasure`, `displayDimensions`, `get`, `set`, `positions`, `folioPositions`, `inspector`, `commitBinding`, `commitObjectField`, `section`, `toggle`, `row`, `number`, `options` | 210–334 | 15 | 27 (`documentUnit` 13, `inspector` 8) | 3 nombres | — | `inspector` 4 | — | no |
| 5. Plantillas y miniaturas: `templates`, `templateMini`, `renderTemplates`, `thumbs` | 335–410 | 4 | 0 | `renderTemplates` 1 | — | `renderTemplates` 1, `thumbs` 2 | — | las miniaturas dibujan el libro (`ui/book`) |
| 6. Dibujo del pliego: `verticalSpread`, `calculateScale`, `autoElement`, `paper`, `screenPage`, `renderPages`, `render`, `updateStatus`, `checkOverflow` | 411–589 | 9 | 27 (`renderPages` 13, `render` 9) | `render` 21, `paper` 5, `autoElement` 3, `renderPages` 3 | — | `paper` 7, `autoElement` 5, `render` 4, `updateStatus` 2, `renderPages` 1, `checkOverflow` 1, `screenPage` 1 | — | sí (pasos 1–5: `renderPages` ya es la fachada de `<Spread/>`) |
| 7. Edición y arrastre: `startEditing`, `finishEditing`, `objectDown`, `moveObject`, `upObject`, `pageDown` | 590–736 | 6 | 25 (`finishEditing` 25) | 2 nombres | — | `objectDown` 6, `startEditing` 4, `pageDown` 3, `finishEditing`, `moveObject`, `upObject` 2 | — | sí (paso 6) |
| 8. Eventos del lienzo: `canvasHit` y los oyentes de `#spread` | 737–795 | 1 | 0 | — | — | — | oyentes de `#spread` | sí (paso 2, hecho) |
| 9. Imágenes: `chooseImage`, `imageTarget` | 796–849 | 2 | 2 | — | — | — | `#imageInput.onchange` | inserta en la página |
| 10. Pestañas y herramientas: `showTab`, `setTool` | 850–874 | 2 | 21 (`showTab` 19) | `showTab` 16 | `showTab` | `setTool` 4, `showTab` 2 | — | `setTool` (herramientas del lienzo) |
| 11. Diálogos: `modal()` y `modal.sheet/info/workspace/confirm` | 875–966 | 1 | 11 | — | — | — | asigna `modal.*` | no |
| 12. Formato del libro: `settings`, `applyBookSettings` | 967–1068 | 2 | 10 | `settings` 1 | — | `applyBookSettings` 4 | — | no |
| 13. Archivo y guardado: `confirmChanges`, `saveProject`, `download`, `openBook`, `loadProject` | 1069–1162 | 5 | 9 | `saveProject` 1 | `confirmChanges` | `saveProject` 2, `loadProject` 2 | `window.saveProject`, `#openInput.onchange` | no |
| 14. Comandos: `command` | 1163–1245 | 1 | 3 | — | — | `command` 1 | — | en parte (agrega, borra y ordena objetos y páginas) |
| 15. Salida: `preparePrint`, `clearPrint` | 1246–1261 | 2 | 7 | `clearPrint` 5, `preparePrint` 2 | los dos | `preparePrint` 1 | `window.preparePrint`, `window.clearPrint` | no (dibuja `#printRoot`) |
| 16. Recuperación: `recoveryDb`, `storeRecovery`, `recoveryTimer` | 1262–1277 | 2 | 1 | — | — | — | — | no |
| 17. Arranque y atajos: `buildToolbar`, `togglePreview`, `setZoom` | 1278–1349 | 3 | 1 | — | — | `setZoom` 1 | `buildToolbar()`, pestañas, `#addPage`, atajos de teclado, `ResizeObserver`, `beforeunload`, `render(true)`, aviso de listo al anfitrión | zoom y atajos |

- Sin usos fuera de `studio.ts`, pasan a privados al cortar: `icons`, `pending`, `recoveryTimer`, `section`, `toggle`, `row`, `number`, `options`, `templateMini`, `templates`, `canvasHit`, `imageTarget`, `storeRecovery` y `buildToolbar`.
- `editor-state-wiring.ts` extiende `updateStatus`, `syncNative` y `checkOverflow` con un nombre calculado: el inventario no lo ve. Contarlas a mano.
- **Lo del lienzo** son los bloques 6, 7 y 8, más `setTool`, `chooseImage`, `setZoom`, los atajos de teclado y la parte de `command` que toca objetos y páginas. El paso 5 (`<Spread/>`, hecho) dejó `renderPages` como fachada vacía y pasó el dibujo a `components/canvas/Spread.tsx`; el 6 ordena la edición y el arrastre. Esos bloques se cortan al final, con el agente del lienzo o después de él.

**Cómo se corta un bloque**
- **Destino.** Un módulo sin efectos en `src/core/`, importado desde `src/entries/core.ts` después de `state/editor.ts`. Va en `core` porque carga antes que `studio.js`. Así `studio.ts`, que sigue siendo un script, encuentra los nombres ya publicados. Y los módulos de `app` que los extienden por nombre los encuentran registrados.
- **Publicación.** `globalThis.x = x` con su `declare global`, mientras lo use `studio.ts`, las pruebas o `scripts/style-snapshot.js`. Desde `app` se toma por `core-api.ts`; nunca con un `import` directo, que lo duplicaría en el otro bundle.
- **Extensiones.** Toda función que otros extienden por nombre pasa a `extensible('x', …)` en el mismo corte. Hoy las funciones comunes del script funcionan porque `extend` reemplaza `window.x` y las llamadas internas pasan por `window`. En un módulo, las llamadas internas a la función local saltearían la extensión. Son `toast`, `commit`, `syncNative`, `updateStatus`, `checkOverflow`, `showTab`, `saveProject`, `loadProject`, `command`, `preparePrint`, `renderTemplates`, `thumbs`, `finishEditing`, `moveObject`, `upObject` y `setZoom`.
- **Efectos.** Lo que corre al cargar (oyentes, `MaquetarioHost.onMessage`, `window.x = …`, `render(true)`) no va al módulo: queda en `studio.ts`, que se va achicando hasta ser sólo el cableado.
- **La declaración sale de `studio.ts` en el mismo corte.** Si quedan las dos, un `const` o `let` del script tapa al global del módulo, y un `function` del script lo reemplaza.

**Orden de cortes** (un commit cada uno; los cinco primeros no tocan el lienzo):
1. **Utilidades:** `src/core/dom.ts` (`$`, `$$`, `esc`) y `src/core/icons.ts` (`paths`, `icon`, `icons`). `M` pasa a publicarse desde `core` (`globalThis.M = LibroModel`). No tienen efectos ni extensiones, y es el bloque con más lectores (44 archivos, 26 pruebas leen `$`). `category-design.ts` amplía `paths` con `Object.assign`: tiene que seguir siendo el mismo objeto.
2. **Anfitrión y avisos:** `src/core/host-bridge.ts` (`pending`, `nativeCall`, `toast` con su cola, `syncNative`). `toast` y `syncNative` pasan a `extensible`. `window.nativeCall` y `MaquetarioHost.onMessage` quedan en el cableado.

   **Pasos 1 y 2 hechos (09-nov).**
   - Los módulos sin efectos son `src/core/utils.ts` (`$`, `$$`, `esc` y `M`; `M` va acá y no en un `dom.ts` aparte), `src/core/icons.ts` y `src/core/host-bridge.ts`.
   - `src/core/core-wiring.ts`, al final de `entries/core.ts`, hace tres cosas:
     - publica los once nombres que siguen leyendo `studio.ts`, los módulos y las pruebas;
     - registra `toast` y `syncNative` con `extensible`;
     - escucha las respuestas del anfitrión: es el único oyente de `MaquetarioHost.onMessage`, y ahora se engancha un poco antes, al cargar `core`.
   - `pending` deja de ser global. Las declaraciones salieron de `studio.ts`.
   - Resultados:
     - globales del núcleo 75 → 63 y globales en total 284 → 283;
     - el orden de los módulos con efectos en `app.js` y `core.js` no cambia (sólo se suman los cuatro de `core` al final);
     - la lista de extensiones sale idéntica, y las de `editor-state-wiring` se contaron a mano: `syncNative`, `updateStatus` y `checkOverflow` siguen con `editor-state`;
     - los recorridos y las suites de `tests/` salen idénticos.
3. **Deshacer y recuperación:** `src/core/history.ts` (`snapshot`, `changed`, `commit`, `undo`, `redo`) y `src/core/recovery.ts` (`recoveryDb`, `storeRecovery`, `recoveryTimer`). `changed` programa la copia de recuperación, así que van juntos. `commit` pasa a `extensible`.
4. **Medidas, rutas y la fachada del inspector:** `src/core/book-paths.ts` (`get`, `set`, `selectObject`, `documentUnit`, `displayMeasure`, `displayDimensions`, `positions`, `folioPositions`) y `src/core/inspector.ts` (`inspector`, `commitBinding`, `commitObjectField`). Los ayudantes de marcado (`section`, `toggle`, `row`, `number`, `options`) quedan privados del módulo que todavía los use. Si sólo los usa código que ya no se llama, se borran.

   **Pasos 3 y 4 hechos (09-nov).**
   - Módulos nuevos sin efectos:
     - `src/core/history.ts`: `snapshot`, `changed`, `undo` y `redo`, más `commit`, que se publica con `extensible`;
     - `src/core/recovery.ts`: `recoveryDb` y la copia programada; `storeRecovery` y `recoveryTimer` quedan privados;
     - `src/core/book-paths.ts`: `get`, `set`, `selectObject`, la unidad, las medidas y las posiciones;
     - `src/core/inspector.ts`: `inspector()` con `extensible`, más `commitBinding` y `commitObjectField`.
   - Lo que llaman del resto del núcleo (`render`, `updateStatus`, `finishEditing`, `inspector`, `commit`) va por el nombre global, así pasa por las extensiones.
   - `section`, `toggle`, `row`, `number` y `options` se borraron: nadie los llamaba desde que el inspector es React.
   - Resultados:
     - globales del núcleo 63 → 39 y globales en total 283 → 276;
     - el orden de los módulos con efectos en `app.js` y `core.js` no cambia;
     - la lista de extensiones sale idéntica (`commit`: `paragraphs`; `inspector`: cuatro);
     - los recorridos y las suites salen idénticos;
     - la copia de recuperación se probó en Chrome con un anfitrión simulado: guardar, ofrecer al arrancar, recuperar y descartar dan lo mismo que antes.
5. **Diálogos, archivo, formato, salida y recuperación de cambios:**
   - `modal()` va a `app` (`components/dialog/modal.ts`), porque lo que llama (`openSheet`, `openWorkWindow`, `openConfirmSheet`) está en `app`. Se publica para `studio.ts`, que lo usa sólo al llamarse.
   - En `core`: `src/core/project-file.ts` (`confirmChanges`, `saveProject`, `download`, `openBook`, `loadProject`), `src/core/book-settings.ts` (`settings`, `applyBookSettings`) y `src/core/print.ts` (`preparePrint`, `clearPrint`).
   - `confirmChanges`, `preparePrint` y `clearPrint` están en el contrato: `main-contract.ts` los sigue llamando por el nombre global hasta que los tome de `core-api.ts`.
   **Paso 5 hecho (09-nov).**
   - `modal()` pasó a `src/components/dialog/modal.ts`, en `app`, con `modal.sheet`, `.info`, `.workspace` y `.confirm`.
     - Los módulos lo importan.
     - `dialog-host.tsx` lo sigue publicando, porque `editorial.ts` y `shapes.ts` (del lienzo) lo llaman por el nombre global.
     - `output.ts` también lo usa por el global: carga antes que la capa de diálogos, e importarlo adelantaría `components/dialog/native.ts`, que agrega `#dialogLayer` al `body` al cargar.
   - En `src/core/` quedan tres módulos sin efectos:
     - `book-settings.ts`: `settings` y `applyBookSettings`;
     - `project-file.ts`: `confirmChanges`, `saveProject`, `download`, `openBook` y `loadProject`;
     - `print.ts`: `preparePrint` y `clearPrint`.
   - `saveProject`, `loadProject`, `preparePrint` y `applyBookSettings` pasan a `extensible`.
   - El oyente de `#openInput` queda en `studio.ts` como cableado.
   - Resultados:
     - globales del núcleo 39 → 29;
     - `modal` pasa de 11 lectores por el global a 3;
     - el orden de los módulos con efectos en `app.js` y `core.js` no cambia;
     - la autoprueba completa, corrida en el worktree con Electron contra la base, da PDF y JSON idénticos (sólo cambia la carpeta en `resumen.json`);
     - los recorridos, las suites y la copia de recuperación salen idénticos.
6. **Comandos:** `command`, coordinado con el lienzo, porque agrega, borra y ordena objetos y páginas. Quedó en `src/core/tools.ts`.
7. **Lo del lienzo, después de su paso 6:** plantillas y miniaturas (las miniaturas dibujan el libro: los PDF tienen que salir idénticos), dibujo del pliego, edición y arrastre, eventos, imágenes, pestañas y herramientas, `setZoom` y los atajos.
8. **Fin del script:**
   - Lo que queda de `studio.ts` es el arranque. Pasa a `src/core/studio-wiring.ts`, importado al final de `entries/core.ts`.
   - Se borran `src/global/`, `build/studio.js`, su `<script>` en `index.html` y su entrada en `desktop/scripts/build.mjs`.
   - Los efectos corren en el mismo lugar que hoy: después de `core` y antes de `app`.
   - Con un solo punto de entrada para la interfaz, `core-api.ts` pasa a ser un re-export.

   **Pasos 6, 7 y 8 hechos (09-nov): `studio.ts` ya no existe.** Con el lienzo terminado, lo que quedaba salió a módulos sin efectos de `src/core/`:
   - `templates.ts`: plantillas y miniaturas.
   - `canvas.ts`: `verticalSpread`, `calculateScale`, `autoElement`, `paper`, `screenPage`, `renderPages`, `render`, `updateStatus` y `checkOverflow`.
   - `editing.ts`: edición, arrastre, `pageDown`, `canvasHit` y las imágenes.
   - `tools.ts`: `showTab`, `setTool`, `togglePreview`, `setZoom` y `command`. `command` va acá y no en un `commands.ts` aparte.

   Cómo quedó armado:
   - **Publicación.** `core-wiring.ts` publica todo. Registra con `extensible` las que se extienden por nombre, también las que antes se extendían por la vuelta de `window`: `renderTemplates`, `thumbs`, `updateStatus`, `checkOverflow`, `finishEditing`, `moveObject`, `upObject`, `showTab`, `setZoom` y `command`.
   - **Llamadas internas.** Entre estas funciones van por el nombre global, así pasan por sus extensiones. `upObject` saca el oyente de `pointermove` con el mismo `moveObject` que puso `frame-handles`.
   - **Estado.** `overflowCount` pasó al estado del editor y `ObjectDrag` a `state/editor.ts`.
   - **Arranque.** Es `src/core/studio-wiring.ts`, al final de `entries/core.ts`, con los efectos en el mismo orden. En orden:
     1. los oyentes de `#spread`;
     2. `#imageInput` y `#openInput`;
     3. los íconos;
     4. las pestañas y `#addPage`;
     5. los atajos de teclado;
     6. el `ResizeObserver`;
     7. `beforeunload`;
     8. `render(true)`;
     9. el aviso de listo.
   - **Lo que se borró:** `src/global/`, `build/studio.js` (de `index.html` y de `desktop/scripts/build.mjs`). `globals-report` cuenta el núcleo por `core-wiring.ts`.

   Resultados:
   - Los globales bajan de 276 a 271: `buildToolbar`, `canvasHit`, `imageTarget`, `templateMini` y `templates` quedan privados.
   - Orden de carga:
     - los módulos con efectos de `app.js` no cambian;
     - en `core.js` se suman los cinco nuevos al final;
     - los oyentes de `document` (45), `window` (9) y `#spread` (4) quedan en el mismo orden, con el mismo texto y la misma fase;
     - los hijos de `body` quedan en el mismo orden, salvo el `<script>` que ya no está.
   - La autoprueba con Electron, en un perfil propio (`--user-data-dir`), contra la base: PDF y JSON idénticos.
   - Los recorridos, las suites, la copia de recuperación y el recorrido de archivo dan lo mismo.

   `check-design-tokens` recorre ahora `src/core/` en lugar de `src/global/`, que ya no existe. La deuda «globales publicados por módulos» sube de 219 a 242 sólo porque ahora cuenta las publicaciones de `core-wiring.ts`, que antes no recorría.

   Quedan comentarios en otros archivos que nombran `studio.ts` como origen de algo (por ejemplo «`section()` de `studio.ts`»). Se corrigen cuando se toquen esos archivos.

**Riesgos**
- **Orden de carga.** `core.js` → `studio.js` → `app.js`. Un módulo de `core` corre antes que `studio.js`: al cargar no puede usar nada de `studio.ts`, sólo cuando lo llaman. Lo que `studio.ts` usa al cargar (`buildToolbar()`, `render(true)`) tiene que estar publicado antes, y `core` lo cumple. En cada corte se compara el orden de los módulos con efectos en `core.js` y en `app.js`, como en el grupo 6.
- **`extensible`.**
  - Las llamadas internas, como se explicó arriba.
  - `extensible` lanza un error si el nombre ya está registrado, y `extend` lanza uno si el nombre todavía no existe. El registro tiene que ocurrir antes de cualquier `extend`: otra razón para `core`.
  - `MaquetarioExtensions.list()` sigue el orden de la primera extensión, no el del registro, así que mover el registro no lo cambia. Lo confirma `verificacion-extensiones.json`.
- **Cadenas del contrato.** El proceso principal ya sólo nombra `maquetarioMain`, y `main-contract.ts` llama por nombre a `showTab`, `confirmChanges`, `nativeCall`, `toast`, `preparePrint` y `clearPrint`. Si uno deja de ser global, `main-contract.ts` lo toma de `core-api.ts`. `globals-report` marca lo que alcanza el contrato y controla que haya 0 nombres sueltos.
- **`core` frente a `app`.** Son bundles separados: un módulo de `core` importado desde `app` se duplica (dos copias, dos estados, efectos dos veces). Desde `app` se usa `core-api.ts`. Por eso `modal` va a `app`.
- **`studio.ts` es un script aparte.**
  - No puede importar: sólo usa lo publicado.
  - Sus `const`/`let` son globales léxicos. Al publicarlos con `globalThis` pasan a ser propiedades: quien los lee por nombre no nota la diferencia, pero algo que leía `window.x` y no lo encontraba, empieza a encontrarlo.
  - Los tipos: hoy `src/` ve todas sus declaraciones sin `declare global`, y el módulo nuevo tiene que declararlas.
- **Choque con el lienzo.** Se corta de arriba (bloques 1 a 4) y de abajo (11 a 16), no del medio (líneas 411 a 849, ni `setZoom` y los atajos). Cada corte se rebasa sobre el último paso del lienzo antes de entregarse.
- **Pruebas que leen o asignan.** `$` 26 archivos, `M` 21, `render` 21, `showTab` 16, `clearPrint` 5… siguen publicados hasta que tengan su objeto de prueba. El estado ya va por `maquetarioEditor`.

**Pruebas de cada corte.**
- Autoprueba idéntica (PDF y JSON) y `verificacion-extensiones.json` igual.
- `globals-report` antes y después: los globales del núcleo bajan y los publicados por módulos suben mientras dura la mudanza.
- El orden de los módulos con efectos en `core.js` y `app.js`.
- Los recorridos de la interfaz y las suites de `tests/` en Chrome: integración, asistente, navegación y avisos.

### Riesgos

- **Pruebas que asignan globales.** Son 31 nombres; `book` lo asignan 20 archivos de prueba. Los accesores las cubren hasta el grupo 7. Hasta entonces, cada paso deja intactos los nombres que el inventario marca como asignados por pruebas.
- **Cadenas que evalúa el proceso principal.** Las de `selftest.ts` (29 nombres) y `main.ts` (22: `requestCloseConfirmation`, `showBusyCloseNotice`, `outputReady`, `maquetarioUpdateAvailable`…) no tienen tipos: renombrar o privatizar uno rompe en silencio. El inventario los marca (columna a/p). Antes de privatizar un nombre, revisar esa columna.
- **Orden de evaluación de los `import`.** Ver la regla de arriba.
- **Llamadas internas que saltean las extensiones.** Las resuelve `extensible`. Hasta entonces, sigue la regla de llamar por `globalThis` dentro del módulo que se extiende.
- **Rendimiento de los accesores** en `book`, `active` y `tool`, que se leen en cada dibujo y en cada movimiento del puntero.
- **Ciclos de `import`** entre el núcleo y los módulos que lo extienden (el inspector importa el núcleo y el núcleo llama al inspector). Se cortan con el registro de extensiones y con `init()`: el núcleo no importa a quien lo extiende.

## Etapas

1. **Electron con la interfaz actual** (cerrada el 08-nov). Funciona en macOS y Linux además de Windows; la versión C#/WebView2 (`Host*.cs`, `Build*.ps1`, `Maquetario.iss`) y su rama en la interfaz se retiraron. Pendiente, porque depende de Motiova o de la venta: URLs y clave pública de producción, `licenseMode: "enforce"` y la firma de código (ver "Licencias y conexión con Motiova").
2. **TypeScript + módulos** (cerrada el 09-nov, con la parte B).
   - Pruebas fuera del build de producción (`app/tests/`) y prettier.
   - `extend` con registro (`extensible`).
   - Toda la interfaz en `.ts` estricto con dos puntos de entrada (`src/entries/`) y migraciones del `.mqt`.
   - Globales cambiados por `import`, con el estado en un objeto (`src/state/editor.ts`).
   - Contrato tipado con el proceso principal (`src/contract/`).
   - El núcleo en módulos de `src/core/`: `studio.ts` ya no existe.

   Lo que siguen leyendo por nombre los módulos, las pruebas y el lienzo lo lista `node scripts/globals-report.mjs`. Detalle en "Etapa 2, parte B".
3. **Interfaz con componentes** (cerrada el 09-nov, con el lienzo): React + Radix sin estilos, CSS propio por capas y tokens con los nombres de Motiova (`docs/INTERFAZ_08-nov_decisiones-etapa3.md`).
   - Barras, pantallas, diálogos, inspector (tres pestañas) y lienzo están en React.
   - Cómo se pasa una pantalla: "Pasar una pantalla a React".
   - **Lo que quedó fuera:**
     - del lienzo, "El lienzo" → "Lo que quedó fuera" (restauraciones del cuadro en edición, página activa, escala, miniaturas);
     - del inspector, `decorateFontBrowsers` en la Hoja de estilo de párrafo;
     - la API de cadenas `UI` para plantillas y miniaturas.
4. **Motor de composición propio** (HarfBuzz/WASM, justificación Knuth-Plass) y PDF de imprenta (en curso).
   - **Hecho:**
     - detrás de una llave apagada, el motor dibuja pantalla, vista continua y PDF con los mismos cortes (ejes variables, interletraje, castellano, espacios duros, tramos), y la salida espera a que esté compuesto (`docs/MOTOR_09-nov_composicion.md`);
     - con la llave prendida, un PDF propio sin Chromium (fuentes recortadas con harfbuzz-subset, ToUnicode, cajas y PDF/X-4), por ahora sólo en `npm run self-test -- --compose`: en la novela coinciden las 319 líneas y el texto copiable, 46 KB contra 103 KB;
     - cajas exactas;
     - PDF/X-4 con RGB etiquetado y FOGRA39, sin CMYK (`docs/IMPRENTA_09-nov_pdfx.md`).
   - **Falta:** prender la llave para todos; que el PDF propio dibuje figuras SVG, texto girado, cubierta y marcas, y un camino real de exportación; el tope de guiones y la última línea en la interfaz; macOS y Linux; CMYK si una imprenta lo pide.
   - **Decisiones pendientes:**
     - los estilos de carácter (formato de los tramos, cómo se crean y cómo se ven sin el motor);
     - los valores por defecto, con Seba, mirando el PDF de `--compose`;
     - validar el PDF/X-4 con un preflight y con una imprenta real.
   - **Deuda que sigue contando `check-design-tokens`:** 4 envolturas `extend()` a mano, 61 estilos en línea desde JS, 1 botón a mano y 242 publicaciones `globalThis.x =`. Ver `docs/proximos-pasos.md` → "Estado".

## Problemas conocidos

- ~~El tamaño de hoja de los PDF puede diferir 0,1–0,3 mm del pedido~~ (resuelto el 09-nov, etapa 4): `desktop/src/main/print-boxes.ts` reescribe en cada página MediaBox (la hoja exacta, anclada arriba a la izquierda), CropBox, TrimBox (el corte: el libro o el desplegado de la cubierta con su demasía) y BleedBox (corte + sangrado). Usa la copia de pdf-lib de la interfaz. Si pdf-lib no puede con un archivo, sale el PDF de Chromium tal cual. CMYK y PDF/X: `docs/IMPRENTA_09-nov_pdfx.md`.
- En Electron no se sabe si una impresora tiene doble faz: se ofrece siempre y, si no puede, falla al imprimir.
- El catálogo de fuentes en Windows no lee el registro (sí las carpetas del sistema y del usuario).
- El código de aula guardado por la versión C# (DPAPI) no se migra: hay que volver a conectar el aula una vez.
