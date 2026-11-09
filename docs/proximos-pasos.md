# Próximos pasos (rama version-juan)

Hoja de ruta para retomar. Estado al cierre: todo subido, `npm test` y `npm run self-test` en verde.

## Antes de cada commit

```bash
npm test            # licencias, lector de fuentes, control de diseño (y deuda)
npm run typecheck
npm run self-test   # 25+ pasos sobre la app real; capturas en %APPDATA%\Maquetario-autoprueba\self-test
```

Commits en castellano, sin líneas de autoría de IA.

## 1. Extensiones declaradas (hecho)

Una **cadena** es una función global que varios módulos extienden, cada uno envolviendo a la versión anterior (por ejemplo, 7 módulos agregan algo a `render()`). Antes cada eslabón era una envoltura escrita a mano; ahora dice qué hace:

| Forma (`extend.js`) | Qué hace | Dónde |
|---|---|---|
| `extend.after(f, fn)` | corre después, con los mismos argumentos | `render`, `coverEditor`, `setTool`, `updateStatus`, `modal`, `thumbs`… |
| `extend.before(f, fn)` | corre antes | `objectDown`, `upObject`, `outputDialog`, `pageDown`… |
| `extend.result(f, (resultado, ...args) => resultado)` | ajusta lo que devuelve; con `async` puede esperarlo | `paper`, `autoElement`, `prepareOutput`, `coverArtwork`, `showWelcome`, `saveProject`… |
| `extend.instead(f, cuándo, fn)` | en ese caso reemplaza (rutas y guardas) | cubierta en `prepareOutput`, objetos bloqueados, sin documento… |
| `extend.around(f, fn)` | envuelve la cadena completa, siempre por fuera | estado del inspector |

Encima de esas formas:

- Inspector (`src/inspector-registry.ts`): `decorateInspector`, `registerInspectorPanel` (Estructura, Objeto, Capas), `pauseInspectorWhile`. El scroll y los `<details>` abiertos se conservan una sola vez.
- Pruebas (`test-registry.js`): `registerIntegrationTest`, `registerNavigationTest`, `registerFontTest`. Las 25 cadenas de pruebas pasaron al registro.

Quedan **13 envolturas de verdad** con `extend(f, anterior => …)`: miran el estado antes y después, o llaman a la anterior en el medio, y ahí la envoltura es la forma correcta. Son `renderPages` (2), `finishEditing` (2), `settingsNew` (2), `outputPreview` (2), `outputDialog`, `objectDown`, `commit`, `applyFace` y `startTutorial`. `npm run lint:design` las cuenta ("envolturas extend() escritas a mano"): una nueva tiene que justificarse.

Al cerrar la conversión, los PDF y los JSON de verificación de la autoprueba salieron idénticos a los de antes, y las capturas difieren como mucho en 1/255 por canal (suavizado del renderizado).

Etapa 2 en marcha: ver "Etapa 2" más abajo.

## 2. Vaciar la capa legacy (hecho)

**Estado (8-nov):** no queda CSS fuera de `ui/`. Eran 21 hojas, 98,9 KB y 965 colores sueltos. La interfaz está en sus capas (tokens → base → átomos → moléculas → organismos → plantillas) y lo que dibuja el libro está en `ui/book/`, en la capa `book`, la más baja:

| Hoja | Qué tiene |
|---|---|
| `book/page.css` | pliego, página, objetos (texto, marco, imagen), elementos automáticos, índice, párrafos, figuras |
| `book/selection.css` | selección y multiselección, rótulo, desborde, tiradores, imán, página activa, zona que recibe una imagen |
| `book/thumbs.css` | miniaturas de la tira de páginas y de las plantillas |
| `book/canvas.css` | mesa (desplazamiento, mano), pliego vertical, vista continua, vista previa |
| `book/print.css` | `#printRoot`, pliegos de salida, ficha de medidas y todo el `@media print` |

Los colores del libro son tokens de valor exacto en `ui/tokens/book.css` (`--book-*`), aparte del tema de la interfaz. `@font-face` de DM Sans en `ui/tokens/fonts.css`. El orden de las hojas de `book/` importa: reproduce el de las hojas viejas donde dos reglas de igual peso se pisan (por ejemplo, el texto en edición se desplaza aunque esté seleccionado).

Verificado al mudar: `style-snapshot` idéntico con las hojas viejas y con `book/` (a 1366 × 768 y 1150 × 700, sin filtrar ruido), capturas del lienzo iguales y los 7 PDF y 7 JSON de la autoprueba idénticos (`node scripts/compare-outputs.mjs <antes> <después>`).

`npm run lint:design` ahora también falla si aparece una hoja `.css` fuera de `ui/`.

### Cómo verificar un cambio de estilos

1. Levantar la app de escritorio: `cd desktop && node scripts/build.mjs && npx electron . --dev --no-throttle --remote-debugging-port=9333`, y manejarla con `node scripts/app-cdp.mjs` (`eval`, `evalfile`, `shot`, `click`, `key`). La vista queda fija (1536 × 1024 o `APP_CDP_SIZE`), así las fotos no dependen de la ventana.
2. `scripts/style-snapshot.js` (`styleSnapshot` / `styleDiff`) antes y después, en 1536 × 1024 y en `APP_CDP_SIZE=1366x768` (entran `max-height: 850px` y `max-width: 1350px`); para lo angosto, también 1150 × 700. Sacar dos fotos de base: lo que cambia entre ellas es ruido (foco, animaciones, recientes).
3. Si la comparación da diferencias raras (pestaña activa, foco), volver un momento al estado anterior y sacar la foto en la misma sesión: el estado de la app también se mueve entre corridas.
4. Para lo que dibuja el libro: `npm run self-test` antes y después y `node scripts/compare-outputs.mjs`; los PDF tienen que salir idénticos.

**Lecciones de la migración:** portar sólo las declaraciones que de verdad pesaban (portar una anulada la hace ganar y cambia la interfaz); revisar `width: 100%` y `background: none`, que las herramientas no ven; usar propiedades largas en vez de `border:` cuando el organismo ya tiene `border-color`; y portar las `@media` junto con su regla, porque una regla de `ui/` le gana a cualquier `@media` de una capa más baja.

### Para retomar (orden sugerido)

1. ~~Diálogos que eran columnas largas~~ (hecho el 8-nov): Configuración del libro y Crear una publicación en dos columnas (tamaños de página y nota de medidas a la izquierda, datos a la derecha; de 820 × 747 a 1040 × 564, entra sin desplazamiento en 1150 × 700); glosario de 930 × 737 a 1100 × 649 con una sola acción ("Volver al editor"); en Cubierta queda un solo par de botones de imagen.
2. Bajar los estilos en línea desde JS (`lint:design` los cuenta; 99 al sacar las pruebas): la mayoría son posiciones del libro, que se quedan; los de la interfaz (punto de guardado, contornos de la cubierta, guías de salida, cursor de figuras) pasan a clases.
3. Etapa 2: sigue abajo.

## Etapa 2: TypeScript y módulos

**Hecho (8-nov):**

1. **Formato.** Todo el código con prettier (`.prettierrc.json`: comillas simples, punto y coma, 100 columnas; fuera: pdf-lib, imagen de muestra y separación silábica, que son de terceros). La app pasó de 3357 líneas casi ilegibles a 16 454. `npm test` incluye `format:check`; `npm run format` formatea. `node scripts/check-same-code.mjs HEAD <archivos>` prueba que un cambio de formato no cambió el código (minifica antes y después y compara).
2. **Pruebas fuera del instalador.** Todas en `LibroStudio/v3/app/tests/` (30 archivos): las 13 que ya eran aparte y 17 que vivían dentro de módulos (`studio`, `editorial`, `i18n`, `output`, `fonts`, `shapes`…), incluidas las bases `runIntegrationTests` y `runFontIntegrationTests`. `test-loader.js` las carga sólo en la autoprueba, en el mismo orden de registro (`verificacion.json` salió idéntico). `desktop/package.json → build.files` excluye `tests/**`. En el programa instalado, la autoprueba omite los 11 pasos que dependen de ellas (probado escondiendo `tests/`).

**Sigue:**

3. **Tipos sin reescribir** (en curso). `LibroStudio/v3/app/tsconfig.json` (`allowJs` + `checkJs`, sin modo estricto) y `globals.d.ts` con lo que comparten los scripts; `npm run typecheck:app` informa (todavía no es parte de `npm run typecheck`). Hecho:
   - Las 11 funciones globales que se reasignaban a mano (`inspector`, `paper`, `startEditing`, `gridSvg`, `canvasAnchor`, `restoreCanvasAnchor`, `setZoom`, `objectDown`, `moveObject`, `renderTemplates`, `offerRecovery`) pasan por `extend`. Nueva forma `extend.replace(f, fn, origen)` para el reemplazo completo. La de `inspector` es `extend.around` registrada después de la de `inspector-registry`: queda por fuera de todo, igual que antes. `lint:design` cuenta `f = function` en el nivel superior para que no vuelva.
   - `$()` y `$$()` tipados (`UIElement`: `HTMLElement` con el resto libre). Al tiparlos aparecen los manejadores que leen `e.target.value` sin decir qué control es (unos 290 avisos en total): se resuelven archivo por archivo con `// @ts-check`.
   - Ojo: la prueba de navegación de la vista continua guarda posiciones de desplazamiento que dependen del tamaño de la pantalla; si cambia el monitor, `verificacion-navegacion.json` cambia aunque el código no.
4. **Pasar a `.ts` y a módulos** (en curso).
   - Armado: las fuentes van en `LibroStudio/v3/app/src/*.ts`; `desktop/scripts/build.mjs` las compila con esbuild a `app/build/` (generado, fuera de git) y `index.html` carga `build/<archivo>.js`. Lo corren `npm run dev`, `self-test` y `dist`; el instalador lleva `build/` sin `src/` ni mapas.
   - Por ahora cada archivo compila a un script que publica su global (`globalThis.X = …` con `declare global` para el tipo), así el resto de la app no cambia. Cuando estén pasados los que dependen entre sí, se cambia a `import` y un solo punto de entrada.
   - Tipos: `src/` es estricto y entra en `npm run typecheck` (0 errores). El chequeo del JS (`typecheck:app`) incluye `src/`, así que el JS ya ve los tipos reales de lo pasado.
   - Hecho: **`model.ts`** (el modelo del libro: tipos `Book`, `Page`, `BookObject`, `AutoElement`, `TocEntry`). Comparado con el viejo en Node con el mismo azar: mismas salidas en todas sus funciones. Sigue siendo un objeto común porque `src/master-refinement.ts` y `shapes.js` reemplazan `M.validate` (pendiente: pasarlo a un registro de validaciones).
   - Hecho también: todo el resto de la interfaz, en tandas con agentes en paralelo (cada uno en su copia del repo; la integración, de a uno, con la autoprueba y la comparación de PDF): 54 scripts compilados desde `src/`, y por último **`studio.ts`**. Sólo quedan en JavaScript `ui/*.js`, `test-loader.js` y lo de terceros (pdf-lib, imagen de muestra, separación silábica).
   - Cómo se pasó un archivo de interfaz: sus globales que usan otros archivos (o las pruebas, o `selftest.ts`, o el anfitrión) se publican con `globalThis.X = …` y `declare global`; lo demás queda privado. Si otro archivo **extiende** una función por nombre (`extend('x', …)`), se define directamente como `globalThis.x = function …` y adentro se llama por el global, así las llamadas internas pasan por las extensiones. Si otro archivo o una prueba **asigna** un estado, ese estado vive en `globalThis`.
   - **`studio.ts` es un script global** (`src/global/studio.ts`): sin `import`/`export`, y `build.mjs` compila `src/global/*.ts` sin envoltorio (esbuild sólo saca los tipos). Así sus `let`/`const`/`function` de nivel superior siguen siendo globales como en el `studio.js` original: `book = …`, `active = …` desde otros archivos y `extend('render', …)` funcionan igual, con el mismo orden y elevación. En TypeScript sus declaraciones las ven todos los `src/*.ts` sin `declare global`; los tipos del modelo los toma con `import('../model.ts').X`. Ya no hace falta `src/js-globals.d.ts`. Comparado minificado con `studio.js`: idéntico salvo dos `String()` que no cambian el resultado (`dataset.page` y `aria-selected`).
   - **Puntos de entrada (hecho, 8-nov):** `ui/*.js` pasó a `src/ui/*.ts` y la interfaz se arma con dos entradas en `src/entries/`: `core.ts` (anfitrión, ventana, extensiones, registro de pruebas y modelo) y `app.ts` (el resto), que importan los módulos en el orden de carga de antes. `index.html` carga 10 scripts en lugar de 66: terceros (pdf-lib, imagen de muestra, separación silábica) → `build/core.js` → `build/studio.js` → `build/app.js` → `test-loader.js`. Verificado: la lista completa de extensiones (qué, en qué orden y desde qué módulo) es idéntica, y la autoprueba con PDF y JSON idénticos. Diferencia a propósito: si un módulo falla al cargar, ahora corta la carga entera en vez de dejar la app a medias.
   - **Sigue (parte B, a decidir con la etapa 3):** reemplazar los globales por `import` reales entre módulos. Pide dos cambios de arquitectura: un objeto de estado (con `import` no se puede reasignar `book` desde otro archivo) y rediseñar `extend` (hoy extiende por nombre en `window`; un `import` apunta a la función original). Conviene hacerlo junto con el paso a componentes (`docs/INTERFAZ_08-nov_revision.md`, decisiones D1–D2).
5. **Migraciones del `.mqt` (hecho, 8-nov).** `src/model-migrations.ts`: `CURRENT_VERSION` (3), la lista ordenada `MIGRATIONS` de pasos `{ from, to, migrate }` (vacía: todo es v3) y `migrateProject`, que `M.validate` llama antes de validar; así lo usan todos los caminos de carga (Abrir, recientes, doble clic, paquete, recuperación) y las validaciones de `master-refinement` y `shapes` siguen corriendo después, en el mismo orden. Un proyecto de una versión más nueva da "Este proyecto se hizo con una versión más nueva de Maquetario: actualizá el programa para abrirlo." El proceso principal lo rechaza antes de tomar el archivo (`handlers/project.ts → checkOpened`, con la misma regla importada de la interfaz), para que no quede como destino de Guardar ni en recientes; antes, en el proceso principal sólo recientes miraba la versión ("Proyecto incompatible."). Pruebas en Node: `desktop/test/project-format.test.ts` (entra en `npm test`). Cómo agregar un paso: comentario al principio de `model-migrations.ts` y `docs/arquitectura.md` → "Formato del proyecto y migraciones".
   - Sin normalización v3→v3: `measurementUnit`, `paragraphStyles`, `cover`, `guides` y `toc` son opcionales en la v3 y se completan donde se leen. Pasarlos a un paso al cargar cambiaría el JSON que se guarda (la autoprueba compara JSON idénticos) sin arreglar nada, y las lecturas con valor por defecto tendrían que quedar igual para los libros que no pasan por `validate` (`M.create`, el documento en blanco). Cuando haya una v4 que los vuelva obligatorios, su paso los completa y se pueden sacar esos `|| []`.

**Etapa 2 cerrada** salvo la parte B (imports reales), que va con la etapa 3.

## Etapa 3: React y Radix (D1/D2, `docs/INTERFAZ_08-nov_decisiones-etapa3.md`)

- **Armado (hecho, 8-nov):** `react`/`react-dom` 19.2.8 y `radix-ui` 1.6.7 (sin estilos) se empaquetan dentro de `build/app.js`; no hay scripts aparte. `src/tsconfig.json` y `app/tsconfig.json` tienen `jsx: react-jsx` y los componentes van en `.tsx`; `build.mjs` compila con JSX automático y React en modo producción (`MAQUETARIO_REACT_DEV=1` arma con el React de desarrollo, para ver sus avisos en la consola). `format`/`format:check` incluyen `.tsx`. `build/app.js` pasó de 522 KB a 1,2 MB sin minificar (react-dom 561 KB, Radix 92 KB, react 20 KB, scheduler 11 KB); minificado serían 605 KB. Por ahora no se minifica (se lee y se depura igual que antes).
- **Cómo se monta React en la interfaz actual:** `src/react/mount.tsx` → `mount(nodo, <Componente />)` crea una raíz en un nodo que ya existe en `index.html`; el resto de la página no cambia. `useLanguage()` vuelve a dibujar cuando cambia el idioma.
- **Convención de componentes** (comentario completo en `src/react/mount.tsx`): una carpeta por componente en `src/components/` (`toast/Toast.tsx`), nombres en inglés y en PascalCase; comportamiento y accesibilidad con Radix (`import { Toast } from 'radix-ui'`); estilos **sólo** con las clases y tokens de `ui/` (nada de estilos en línea, Tailwind ni CSS-in-JS); textos fijos con `bw()`, y los que llegan en castellano se traducen con `LibroI18n.tr()` antes de dibujarlos; íconos con `<Icon name>` (`src/components/Icon.tsx`, el mismo set de `icon()`). Si una función global tiene que seguir existiendo (como `toast()`), el componente la reemplaza con `extend.replace`.
- **Primer componente: los avisos (hecho, 8-nov).** `src/components/toast/Toast.tsx` (`<Toaster>` con Radix Toast, montado en `#toast`). `toast(mensaje, tipo)` mantiene la firma global: `studio.ts` la declara y junta en cola lo que llegue antes de cargar `build/app.js`; el componente la reemplaza y muestra la cola. `hideToast()` esconde el aviso (lo usa la autoprueba de capturas). Mismo aspecto y tiempos (4,3 s; error 7 s con botón de cerrar), y lo que suma Radix: anuncio a lectores de pantalla (el error con prioridad), pausa con el puntero o el foco encima y con la ventana sin foco, Escape cierra el aviso y F8 lleva el foco a los avisos. El CSS es `.toast` en `ui/molecules/status.css`, con animaciones de entrada y salida (Radix lo desmonta al terminar la de salida). `UI.toast` de `src/ui/components.ts` quedó sin uso: se borra al integrar la API de componentes.
- **Sigue:** diálogos simples → bienvenida → diálogos grandes → barras → inspector → riel (D2, tiempo 2).

## 3. Experiencia de uso

Observaciones en `docs/evaluacion-uso.md` (13 puntos). Las más visibles: la etiqueta "Página activa N" pintada sobre el papel, las siete pestañas del inspector, y las muchas puertas de ayuda (Tutorial, Aprender, Recorrido, "?", glosario).

## 4. Distribución

- **Etapa 1 cerrada (08-nov):** se retiró la versión C#/WebView2 (`LibroStudio/v3/Host*.cs`, `Build.ps1`, `Build-Installer.ps1`, `Maquetario.iss`), su rama en `src/host.ts` y las vistas de captura que sólo llamaba ese programa. Se conserva `LibroStudio/v3/installer-brand/` (imágenes del instalador). Queda lo que depende de Motiova y de la venta (abajo).
- **Hecho (08-nov):** la conexión con Motiova va desde el propio programa (Configuración → Cuenta, y el aviso de arranque en modo enforce): login con PKCE, licencia de este equipo, renovación al abrir, versión nueva y cerrar sesión. Contrato en `docs/arquitectura.md` → "Licencias y conexión con Motiova". El backend de Motiova ya está.
- **Para probar contra Motiova local:** levantar Motiova (`localhost:5183` y `localhost:8010`, con la clave dev: `npm run license:dev-keys`) y `npm run dev`; la app apunta ahí en desarrollo.
- **Para la versión a la venta:** confirmar las URLs de producción en `desktop/package.json → maquetario.motiova` (hoy `https://motiova.com` y `https://api.motiova.com/api/v1`), poner `licenseMode: "enforce"`, sumar la clave pública de producción que mande Motiova, y entregar versión + notas + un instalador firmado por sistema.
- Firma de código: certificado de Windows (Azure Trusted Signing u OV/EV) y Apple Developer. Definir quién los gestiona y avisar a Motiova.
- Launcher y descargable único: **después de terminar las 4 etapas de `arquitectura.md`** (decisión del 8-nov). Usa los mismos endpoints; el plan está en `arquitectura.md` → distribución.

## Decisiones cerradas

Pago único con actualizaciones (`maxMajor: null`), edición `estandar`, 2 computadoras por compra, 7 días sin conexión. Detalle en `docs/arquitectura.md`.

## Informe para Seba

Fuente: `docs/informe/informe.html`. Regenerar el PDF:

```bash
npx electron scripts/render-pdf.cjs docs/informe/informe.html "docs/informe/Maquetario - Informe técnico version-juan.pdf" "Maquetario · Informe técnico de la rama version-juan"
```

Pendiente de sumar al próximo informe: registro de extensiones (127 cadenas convertidas).
