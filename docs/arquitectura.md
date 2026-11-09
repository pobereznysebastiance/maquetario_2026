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
3. **Objeto de estado con accesores.** `studio.ts` deja sus `let` de estado. Prueba: autoprueba y JSON idénticos, sin tocar pruebas. Además, medir rendimiento. **Hecho el 09-nov:** `src/state/editor.ts` (en `core`, entre el modelo y `studio.ts`) exporta `editor` con `book`, `active`, `spread`, `selected`, `tool`, `tab`, `zoom`, `scale`, `preview`, `dirty`, `busy`, `fontList`, `native`, `undoStack`, `redoStack`, `editing` y `drag` (que dejaron de ser `let` del núcleo) y `hasDocument`, `multiSelection`, `paragraphScope`, `coverDraft` y `coverPart` (sus módulos siguen asignando el valor inicial, ahora por el accesor). Cada nombre es un accesor en `globalThis`; `maquetarioEditor` deja ver el objeto desde las pruebas. Medido en Chrome con la novela de muestra (mediana de 7): `renderPages` ×50 26 → 27 ms, `paper` de la novela ×3 4,4 → 4,1 ms, `render(true)` ×20 380 → 365 ms, `moveObject` ×2000 3,6 → 3,7 s (ruido: cada movimiento cuesta 1,8 ms por el redibujo de las barras, no por el estado), `composeReport` 5,2 → 5,0 ms. La lectura cruda sí es más cara (2 millones de lecturas de `book`/`active`: 0,5 → 29,6 ms, unos 15 ns por lectura), pero no se nota en ningún camino real; si algún día aparece en un perfil, ese código usa `editor.x` directo.
4. **Servicios hoja.** `bw` y `LibroI18n` (`i18n.ts`, `book-workflow.ts`), `M` (`model.ts`), `UI`, los diálogos y `editor-state`. Exportan, y sus lectores importan. La publicación queda para pruebas y cadenas.
5. **El núcleo en piezas.** De `studio.ts` salen módulos con `export`:
   - utilidades: `$`, `$$`, `esc`, `icon`, medidas;
   - dibujo: `paper`, `renderPages`, `autoElement`, que es lo más extendido;
   - inspector, comandos, guardar/abrir.

   Cada función extendida pasa por `extensible`. Al final `studio.ts` deja de ser un script global y entra como módulo en `core`.
6. **Módulos y pantallas.** Por inventario, de menos a más lectores. Primero los 25 sin usos externos, que pasan a privados; después cada módulo con su `import`.
7. **Contrato con pruebas y proceso principal.**
   - Las pruebas reciben un objeto de prueba (por ejemplo, `window.maquetarioTest` con `editor`, `M` y las funciones que llaman) en lugar de los nombres sueltos.
   - Lo que nombran las cadenas de `selftest.ts` y de `main.ts` queda en una lista explícita, publicada por un solo módulo, que el inventario verifica.
   - Recién ahí se sacan los últimos accesores.

**Terminado cuando** el inventario dé:
- 0 estado asignado desde otros archivos;
- 0 extensiones que busquen en `window`;
- y los globales publicados reducidos al contrato (objeto de prueba y lista del proceso principal).

### Riesgos

- **Pruebas que asignan globales.** Son 31 nombres; `book` lo asignan 20 archivos de prueba. Los accesores las cubren hasta el grupo 7. Hasta entonces, cada paso deja intactos los nombres que el inventario marca como asignados por pruebas.
- **Cadenas que evalúa el proceso principal.** Las de `selftest.ts` (29 nombres) y `main.ts` (22: `requestCloseConfirmation`, `showBusyCloseNotice`, `outputReady`, `maquetarioUpdateAvailable`…) no tienen tipos: renombrar o privatizar uno rompe en silencio. El inventario los marca (columna a/p). Antes de privatizar un nombre, revisar esa columna.
- **Orden de evaluación de los `import`.** Ver la regla de arriba.
- **Llamadas internas que saltean las extensiones.** Las resuelve `extensible`. Hasta entonces, sigue la regla de llamar por `globalThis` dentro del módulo que se extiende.
- **Rendimiento de los accesores** en `book`, `active` y `tool`, que se leen en cada dibujo y en cada movimiento del puntero.
- **Ciclos de `import`** entre el núcleo y los módulos que lo extienden (el inspector importa el núcleo y el núcleo llama al inspector). Se cortan con el registro de extensiones y con `init()`: el núcleo no importa a quien lo extiende.

## Etapas

1. **Electron con la interfaz actual** (cerrada el 08-nov). Funciona en macOS y Linux además de Windows; la versión C#/WebView2 (`Host*.cs`, `Build*.ps1`, `Maquetario.iss`) y su rama en la interfaz se retiraron. Pendiente, porque depende de Motiova o de la venta: URLs y clave pública de producción, `licenseMode: "enforce"` y la firma de código (ver "Licencias y conexión con Motiova").
2. **TypeScript + módulos** (cerrada el 08-nov, salvo la parte B): pruebas fuera del build de producción (`app/tests/`), prettier, reemplazos de funciones globales por `extend`, toda la interfaz en `.ts` estricto con dos puntos de entrada (`src/entries/`) y migraciones del `.mqt` (ver "Formato del proyecto y migraciones"). Queda la **parte B** (cambiar los globales por `import` reales: objeto de estado y un `extend` que no dependa de `window`), que va con la etapa 3: plan e inventario en "Etapa 2, parte B: de globales a `import` (plan)".
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
