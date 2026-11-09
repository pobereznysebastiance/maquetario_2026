# Próximos pasos (rama version-juan)

Hoja de ruta para retomar. Estado al cierre (09-nov, noche): todo subido, `npm test`, `npm run typecheck` y `npm run self-test` en verde. Versión **BETA 0.2** (`0.2.0-beta`) con todo el pedido de la cátedra; la BETA 0.1 (instalador y PDF de presentación) quedó entregada a Seba.

## Estado (09-nov)

- **Etapa 1** (Electron): cerrada. Falta lo que depende de Motiova y de la venta (ver "Distribución").
- **Etapa 2** (TypeScript y módulos): cerrada, con la parte B.
  - Los globales pasaron a `import` reales.
  - El estado es un objeto (`src/state/editor.ts`) y `extend` usa un registro (`extensible`).
  - El proceso principal le habla a la página por un contrato tipado (`src/contract/`).
  - `studio.ts` ya no existe: el núcleo es `src/core/`.
- **Etapa 3** (interfaz con componentes): cerrada, con el lienzo. Barras, pantallas, diálogos, inspector y lienzo están en React. Lo que quedó fuera:
  - **Lienzo:**
    - las dos restauraciones del cuadro en edición (motor y separación silábica);
    - las clases de página activa que todavía pone `updateActivePage`;
    - dos cálculos de escala (`calculateScale` y `Spread.tsx`);
    - las miniaturas, que son de la capa `book`.
  - **Inspector y alrededores:**
    - `decorateFontBrowsers` sigue para la Hoja de estilo de párrafo;
    - la API de cadenas de `src/ui/components.ts` (`UI.templateCard`, `UI.pageThumb`…) sigue para las plantillas y las miniaturas.
- **Etapa 4** (motor de composición e imprenta): en curso.
  - **Lo que hace hoy el motor:** detrás de la llave (`localStorage['maquetario-compose'] = '1'`), dibuja los párrafos con HarfBuzz y Knuth-Plass en pantalla, en la vista continua y en el PDF, con los mismos cortes.
    - Maneja ejes variables, interletraje, colecciones, reglas del castellano, espacios duros y tramos con distinto estilo.
    - La salida espera a que esté compuesta, y `npm run self-test -- --compose` arma la novela aparte.
    - Con la llave apagada no se carga nada.
  - **Imprenta:** cajas exactas y PDF/X-4 con RGB etiquetado y FOGRA39 (sin CMYK).
  - **Falta:**
    - prender la llave para todos y dejar el camino de Chromium sólo para la edición;
    - el tope de guiones y el largo mínimo de la última línea en la interfaz;
    - confirmar en macOS y Linux la regla del cuerpo truncado;
    - probar la espera de la salida con una exportación real;
    - CMYK y PDF/X-1a, si una imprenta los pide.
  - **Decisiones pendientes:**
    - **Estilos de carácter:** el formato definitivo de los tramos, cómo se crean en el editor y cómo se ven sin el motor (hoy el motor lee `paragraphMap[i].runs`, provisorio).
    - **Valores por defecto, con Seba:** revisar a ojo el PDF de `--compose` y decidir el algoritmo, el tope de guiones y la última línea.
    - **Validar el PDF/X-4** con un preflight (callas pdfToolbox o Acrobat Pro) y con una imprenta real, digital y offset (`docs/IMPRENTA_09-nov_pdfx.md`).
- **Deuda que cuenta `npm test`** (`check-design-tokens`, tiene que bajar):
  - 4 envolturas `extend()` escritas a mano;
  - 61 estilos en línea desde JS, la mayoría posiciones del libro;
  - 1 botón creado a mano;
  - 244 globales publicados con `globalThis.x =`. La mayoría los publica `src/core/core-wiring.ts` para los módulos, las pruebas y el lienzo, que todavía los leen por nombre; `node scripts/globals-report.mjs` dice quién usa cada uno.

## BETA 0.1 (09-nov, tarde)

- **Versión:** `desktop/package.json` → `0.1.0-beta`. Lo que se lee dice "BETA 0.1" (`src/version-label.ts` en la interfaz, `appVersionLabel()` en `desktop/src/main/env.ts`); los metadatos del PDF guardan la versión técnica. Como la licencia usa `maxMajor: null`, el cambio de número no la afecta.
- **Instalador:** en esta compu `npm run dist` falla al comprimir (7-Zip: "Internal Error: The failure in hardware (RAM or CPU)"); sale con `npm run dist -- -c.compression=normal`. Revisar el equipo (memoria y temperatura): también se apagó de golpe.
- **Interfaz, hecho hoy:**
  - El inspector sigue a lo que se toca (objeto → Selección; vacío de la página desde Selección → Página). Con una caja de texto, Tipografía y Párrafo van primero.
  - Riel con las seis herramientas del lienzo; Texto unifica "Crear texto" y "Caja de texto"; Grilla, Foliado y Cornisa salen del riel; Cubierta pasa a la barra del documento.
  - Vistas del riel: Páginas · Estructura · Índice · Capas (Estructura del libro salió de la pestaña Libro).
  - Pestaña Libro: "Formato y márgenes" primero (los márgenes estaban dentro de Grilla); el ajuste fino del foliado es un desplegable común.
  - Guías desde las reglas (`src/ruler-guides.ts`): arrastrar para sacar, mover o quitar.
  - Doble clic en el tirador inferior de una caja de texto la ajusta a su texto (`fitTextFrame`, `frame-handles.ts`). Arreglado el 09-nov a la noche: con el mouse no andaba, porque el arrastre del tirador captura el puntero y el doble clic le llega a la caja (ahora se mira el último `pointerdown`; la prueba reproduce esa secuencia).
- **Informes:** `docs/informe/beta-0.1.html` (para Seba: novedades respecto de la 3.24, qué probar, qué devolución sirve) y `docs/informe/beta-0.1-presentacion.html` (para quienes prueban, a partir del texto de la 3.20). Cómo regenerarlos, en "Informes" al final.
- **Pendiente:**
  - Juntar la devolución de Seba y de quienes prueben, y ordenarla antes de seguir.
  - Proyecto de la 3.24: probado el 09-nov. La novela de ejemplo armada y guardada con el código de la 3.24 (rama `main`) se abre tal cual, sin migración, y el pliego se ve igual que en la 3.24; queda como prueba fija (`desktop/test/fixtures/novela-3.24.mqt`). Proyecto de la 3.20: probado a mano el 09-nov, abre bien.
  - Hecho el 09-nov: la Alineación de Tipografía ya no queda cortada (llena la columna del control) y los botones de tipo de letra se ven como los otros campos.
  - Revisión con impeccable antes del instalador (09-nov, noche): barrido automático de botones, selectores y campos en todas las pantallas, en 1366 × 768 y 1920 × 1080. Quedaron sin valores cortados ni botones partidos: el inspector da más lugar al control (1 a 1,35), Rol y Estilo de párrafo van a todo el ancho (`.field-row.stacked`), textos de opciones más cortos, la pauta es una ventana de trabajo, átomo `.link-button` y `Btn keepFocus` en lugar de botones armados a mano. Los "?" de ayuda de términos se ven de 22 px pero su zona para apuntar mide 30 px.
  - El `git stash` local "tanda workspace/page-priority/…" es obsoleto (la capa legacy ya se vació): se puede borrar.

## Antes de cada commit

```bash
npm test            # licencias, lector de fuentes, control de diseño (y deuda)
npm run typecheck
npm run self-test   # 25+ pasos sobre la app real; capturas en %APPDATA%\Maquetario-autoprueba\self-test
                    # dos a la vez: cada una con su perfil (-- --user-data-dir=<carpeta> --out=<carpeta>)
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

- Inspector (`src/inspector-registry.ts`): `registerInspectorPanel` (cada sección, por pasada) y `pauseInspectorWhile`. Desde el paso 10 de la etapa 3 el inspector es un componente de React (`<Inspector/>`) y `decorateInspector` ya no existe.
- Pruebas (`test-registry.js`): `registerIntegrationTest`, `registerNavigationTest`, `registerFontTest`. Las 25 cadenas de pruebas pasaron al registro.

Quedaban **13 envolturas de verdad** (hoy son 4: ver la deuda en "Estado") con `extend(f, anterior => …)`: miran el estado antes y después, o llaman a la anterior en el medio, y ahí la envoltura es la forma correcta. Son `renderPages` (2), `finishEditing` (2), `settingsNew` (2), `outputPreview` (2), `outputDialog`, `objectDown`, `commit`, `applyFace` y `startTutorial`. `npm run lint:design` las cuenta ("envolturas extend() escritas a mano"): una nueva tiene que justificarse.

Al cerrar la conversión, los PDF y los JSON de verificación de la autoprueba salieron idénticos a los de antes, y las capturas difieren como mucho en 1/255 por canal (suavizado del renderizado).

Etapa 2: ver "Etapa 2" más abajo (cerrada).

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
   - **(Historia: ya no es así desde el grupo 5 de la parte B, `studio.ts` no existe.)** `studio.ts` era un script global (`src/global/studio.ts`): sin `import`/`export`, y `build.mjs` compila `src/global/*.ts` sin envoltorio (esbuild sólo saca los tipos). Así sus `let`/`const`/`function` de nivel superior siguen siendo globales como en el `studio.js` original: `book = …`, `active = …` desde otros archivos y `extend('render', …)` funcionan igual, con el mismo orden y elevación. En TypeScript sus declaraciones las ven todos los `src/*.ts` sin `declare global`; los tipos del modelo los toma con `import('../model.ts').X`. Ya no hace falta `src/js-globals.d.ts`. Comparado minificado con `studio.js`: idéntico salvo dos `String()` que no cambian el resultado (`dataset.page` y `aria-selected`).
   - **Puntos de entrada (hecho, 8-nov):** `ui/*.js` pasó a `src/ui/*.ts` y la interfaz se arma con dos entradas en `src/entries/`: `core.ts` (anfitrión, ventana, extensiones, registro de pruebas y modelo) y `app.ts` (el resto), que importan los módulos en el orden de carga de antes. `index.html` carga 10 scripts en lugar de 66: terceros (pdf-lib, imagen de muestra, separación silábica) → `build/core.js` → `build/studio.js` → `build/app.js` → `test-loader.js`. Verificado: la lista completa de extensiones (qué, en qué orden y desde qué módulo) es idéntica, y la autoprueba con PDF y JSON idénticos. Diferencia a propósito: si un módulo falla al cargar, ahora corta la carga entera en vez de dejar la app a medias.
   - **Parte B (hecha el 09-nov, `docs/arquitectura.md` → "Etapa 2, parte B"):** reemplazar los globales por `import` reales entre módulos. Pide dos cambios de arquitectura: un objeto de estado (con `import` no se puede reasignar `book` desde otro archivo) y rediseñar `extend` (hoy extiende por nombre en `window`; un `import` apunta a la función original). Conviene hacerlo junto con el paso a componentes (`docs/INTERFAZ_08-nov_revision.md`, decisiones D1–D2).
5. **Migraciones del `.mqt` (hecho, 8-nov).** `src/model-migrations.ts`: `CURRENT_VERSION` (3), la lista ordenada `MIGRATIONS` de pasos `{ from, to, migrate }` (vacía: todo es v3) y `migrateProject`, que `M.validate` llama antes de validar; así lo usan todos los caminos de carga (Abrir, recientes, doble clic, paquete, recuperación) y las validaciones de `master-refinement` y `shapes` siguen corriendo después, en el mismo orden. Un proyecto de una versión más nueva da "Este proyecto se hizo con una versión más nueva de Maquetario: actualizá el programa para abrirlo." El proceso principal lo rechaza antes de tomar el archivo (`handlers/project.ts → checkOpened`, con la misma regla importada de la interfaz), para que no quede como destino de Guardar ni en recientes; antes, en el proceso principal sólo recientes miraba la versión ("Proyecto incompatible."). Pruebas en Node: `desktop/test/project-format.test.ts` (entra en `npm test`). Cómo agregar un paso: comentario al principio de `model-migrations.ts` y `docs/arquitectura.md` → "Formato del proyecto y migraciones".
   - Sin normalización v3→v3: `measurementUnit`, `paragraphStyles`, `cover`, `guides` y `toc` son opcionales en la v3 y se completan donde se leen. Pasarlos a un paso al cargar cambiaría el JSON que se guarda (la autoprueba compara JSON idénticos) sin arreglar nada, y las lecturas con valor por defecto tendrían que quedar igual para los libros que no pasan por `validate` (`M.create`, el documento en blanco). Cuando haya una v4 que los vuelva obligatorios, su paso los completa y se pueden sacar esos `|| []`.

**Etapa 2 cerrada**, con la parte B (09-nov).

## Etapa 3: React y Radix (D1/D2, `docs/INTERFAZ_08-nov_decisiones-etapa3.md`)

- **Armado (hecho, 8-nov):** `react`/`react-dom` 19.2.8 y `radix-ui` 1.6.7 (sin estilos) se empaquetan dentro de `build/app.js`; no hay scripts aparte. `src/tsconfig.json` y `app/tsconfig.json` tienen `jsx: react-jsx` y los componentes van en `.tsx`; `build.mjs` compila con JSX automático y React en modo producción (`MAQUETARIO_REACT_DEV=1` arma con el React de desarrollo, para ver sus avisos en la consola). `format`/`format:check` incluyen `.tsx`. `build/app.js` pasó de 522 KB a 1,2 MB sin minificar (react-dom 561 KB, Radix 92 KB, react 20 KB, scheduler 11 KB); minificado serían 605 KB. Por ahora no se minifica (se lee y se depura igual que antes).
- **Cómo se monta React en la interfaz actual:** `src/react/mount.tsx` → `mount(nodo, <Componente />)` crea una raíz en un nodo que ya existe en `index.html`; el resto de la página no cambia. `useLanguage()` vuelve a dibujar cuando cambia el idioma.
- **Convención de componentes** (comentario completo en `src/react/mount.tsx`): una carpeta por componente en `src/components/` (`toast/Toast.tsx`), nombres en inglés y en PascalCase; comportamiento y accesibilidad con Radix (`import { Toast } from 'radix-ui'`); estilos **sólo** con las clases y tokens de `ui/` (nada de estilos en línea, Tailwind ni CSS-in-JS); textos fijos con `bw()`, y los que llegan en castellano se traducen con `LibroI18n.tr()` antes de dibujarlos; íconos con `<Icon name>` (`src/components/Icon.tsx`, el mismo set de `icon()`). Si una función global tiene que seguir existiendo (como `toast()`), el componente la reemplaza con `extend.replace`.
- **Primer componente: los avisos (hecho, 8-nov).** `src/components/toast/Toast.tsx` (`<Toaster>` con Radix Toast, montado en `#toast`). `toast(mensaje, tipo)` mantiene la firma global: `studio.ts` la declara y junta en cola lo que llegue antes de cargar `build/app.js`; el componente la reemplaza y muestra la cola. `hideToast()` esconde el aviso (lo usa la autoprueba de capturas). Mismo aspecto y tiempos (4,3 s; error 7 s con botón de cerrar), y lo que suma Radix: anuncio a lectores de pantalla (el error con prioridad), pausa con el puntero o el foco encima y con la ventana sin foco, Escape cierra el aviso y F8 lleva el foco a los avisos. El CSS es `.toast` en `ui/molecules/status.css`, con animaciones de entrada y salida (Radix lo desmonta al terminar la de salida). `UI.toast` de `src/ui/components.ts` quedó sin uso: se borra al integrar la API de componentes.
- **Base de diálogos y confirmaciones en React (hecho, 9-nov).** `src/components/dialog/`: `ConfirmDialog` (Radix AlertDialog), `Sheet` y `WorkWindow` (Radix Dialog), con el mismo marcado y clases que `#modal` (`ui/organisms/dialog.css`). Se dibujan sobre un `<dialog>` nativo abierto con `showModal()` (`native.ts`): así quedan en la capa superior, por encima de `#modal` (una confirmación desde una Hoja), con su `::backdrop` y el resto inerte; Radix pone role, `aria-labelledby`/`describedby`, foco y `aria-hidden` sobre el resto. `dialogs.tsx` es el servicio: `confirmAction` y `askChoice` (antes `confirm.ts`) mantienen la firma global y el comportamiento (`#confirmDialog` con `data-kind="confirm"`, se abre al instante, Escape cancela, foco en Cancelar si es destructiva, teclado y clics aislados de los atajos, sin espera en la autoprueba); `openSheet(<Contenido />, opciones)` y `openWorkWindow(<Contenido />, opciones)` abren una Hoja o Ventana de React (una a la vez; cierran `#modal`), y `modal.sheet`/`modal.info`/`modal.workspace` las usan si reciben un elemento de React en lugar de HTML. Las pantallas que arman HTML siguen con `modal()` hasta que pasen una por una.
- **Hojas de configuración en React (hecho, 9-nov).** Configurar libro (`settingsNew`, `src/components/book-setup/BookSetup.tsx`), Configuración (`openSettings`, `src/components/settings/settings-panel.tsx`) y la biblioteca de grillas (`gridGallery`, `src/components/grid-gallery/GridGallery.tsx`) se abren con `openSheet`. Mismo contenido, mismos ids y mismas filas de `i18n.ts` (los textos se traducen en el componente). La validación y el cambio del libro quedaron en `applyBookSettings(isNew, valores)` (studio.ts), que extienden por nombre review-workspace (ya hay documento), publications (grilla del producto editorial) y `tests/welcome-tests.js`; ya nadie envuelve `#modalApply`. `settings(isNew)` y `settingsNew` devuelven la promesa de la Hoja (el tutorial sin documento sigue cuando se cierra). Componentes de formulario reutilizables en `src/components/form/Form.tsx`: `Control`, `Field`, `Select`, `SettingRow`, `CheckItem` (mismo marcado que `control()`, `UI.settingRow` y `UI.checkItem`; campos no controlados, así las pruebas y los módulos pueden escribir `.value`). La Hoja tiene `#sheetApply` y `#sheetCancel`, y `closeSheet()` la cierra en el acto: las pruebas y la autoprueba usan eso en lugar de `#modal` para estas tres pantallas.
- **Cubierta como vista de trabajo en React (hecho, 9-nov).** `coverEditor()` abre `src/components/cover/CoverEditor.tsx` con `openWorkWindow`: el mismo marcado, ids y clases que armaban entre publications, cover-actions, panel-resize, cover-measurements, editorial-learning, binding-estimate y print-proof (esos módulos ya no inyectan HTML al abrirla; `binding-estimate.ts` pasó al componente). El dibujo no cambió: `updateCoverPreview` sigue pintando `#coverPreview` y escribiendo las medidas, la zona y sus campos, y sus extensiones siguen marcando solapas, pestañas, la tabla de medidas y la zona de la imagen; React deja vacíos esos elementos y los campos no son controlados (el borrador `coverDraft` es la única fuente). Los cambios se atienden con `useFieldEvents` (Form.tsx: "change"/"input" nativos en captura, así llegan los `new Event('change')` de las pruebas). La salida (`#printRoot` de la cubierta) es idéntica a la anterior. Exportar e imprimir van en la barra del título (`extraActions` de la Ventana).
- **Cómo se pasa una pantalla:** convención única en `docs/arquitectura.md` → "Pasar una pantalla a React", resumida en el comentario de `src/react/mount.tsx`.

**Estado al 09-nov**

En React (`src/components/`):
- **Barras:** avisos, barra superior, barra del documento, barra de estado, riel (herramientas con `registerTool`, y vistas Páginas · Índice · Capas) y barra del lienzo (zoom y franja de plantillas).
- **Pantallas:** bienvenida y centro de Ayuda (tutorial, glosario, atajos, recorrido, "Revisar libro").
- **Diálogos:**
  - confirmaciones;
  - Configurar libro, Configuración, biblioteca de grillas;
  - asistente editorial, cubierta (vista de trabajo), salida (PDF, imprimir, cubierta sobre hoja, PDF/X-4);
  - glifos, explorador de fuentes;
  - los que abre el inspector: guía, entrada de índice, estilo de párrafo, figuras, aula;
  - pauta tipográfica, armador "Dale estructura a tu libro", empaquetar y el aviso al cerrar. `modal()` es una fachada de los componentes de React y `#modal` ya no se abre.
- **Inspector**, pestaña Libro: entera (Estructura, Grilla, Misceláneas y líneas, Foliado, Cornisa, Titulillo, Fuentes de tu equipo).
- **Inspector**, pestaña Página: entera. Selección: el objeto (posición, medidas, alinear, distribuir, orden y bloqueo) y el estado vacío.
- **Inspector:** Selección de texto y párrafo, las vistas Índice y Capas del riel, y la cadena: `<Inspector/>` arma las tres pestañas e `inspector()` es una fachada (pasos 8 a 10).
- **Lienzo** (seis pasos, `docs/arquitectura.md` → "El lienzo"):
  - el papel separado de la pantalla y los eventos delegados en `#spread`;
  - en React con portales: capa de selección, grilla y guías, imán y reglas;
  - `<Spread/>` decide qué páginas o filas se ven, también en la vista continua.
  - Edición y arrastre quedan fuera de React, con su ciclo escrito.
  - El papel y lo impreso no cambiaron: PDF idénticos.

**Etapa 3 cerrada**, con el lienzo. `#modal` se retiró y la parte B de la etapa 2 está hecha. Lo que quedó fuera, en "Estado", arriba.
- Detalle del lienzo en `docs/arquitectura.md` → "El lienzo" → "Lo que quedó fuera".

## Etapa 4: motor de composición y PDF de imprenta

- **Cajas exactas (hecho):** MediaBox, TrimBox y BleedBox en cada página (`desktop/src/main/print-boxes.ts`).
- **PDF/X-4 (hecho):** con RGB etiquetado (sRGB) y FOGRA39. La opción "PDF para imprenta (PDF/X-4)" está en Preparar PDF; se recuerda en el programa y el error se muestra en la ventana.
  - No hay conversión a CMYK: una imprenta que pida PDF/X-1a lo rechaza.
  - Falta validarlo con un preflight externo y con una imprenta real.
  - Detalle y contrato en `docs/IMPRENTA_09-nov_pdfx.md`.
- **Motor (`packages/compose`, HarfBuzz en WASM y Knuth-Plass):** detrás de una llave apagada (`localStorage maquetario-compose = 1`).
  - Con la llave prendida, dibuja en `paper()`: pantalla, vista continua y PDF con los mismos cortes, y tramos con distinto estilo. `composeReport()` mide la paridad con Chromium.
  - La autoprueba compara con la llave apagada; `--compose` suma la novela compuesta aparte.
  - Lo que falta y las decisiones pendientes están en "Estado", arriba, y en `docs/MOTOR_09-nov_composicion.md` → "Qué falta".

## 3. Experiencia de uso

Observaciones en `docs/evaluacion-uso.md` (13 puntos). Resueltas: las siete pestañas del inspector (ahora tres, que siguen a la selección), las muchas puertas de ayuda (una sola: Ayuda) y el riel mezclado (sólo herramientas del lienzo). Sigue a la vista: la etiqueta "Página activa N" pintada sobre el papel. La próxima tanda sale de la devolución de BETA 0.1.

## 5. Pedido de la cátedra (Tipografía I, FAU-UNNE)

Llegó el 09-nov por Seba (pedido de Tomás), con la planilla "Pauta de uso tipográfico" de la clase 3. En orden:

1. **Notas al pie: hechas (09-nov, noche).** Cómo funcionan, en `docs/arquitectura.md` → "Notas al pie".
2. **Roles: hechos (09-nov, noche).** Selección → Rol; cómo funcionan, en `docs/arquitectura.md` → "Roles de texto". Lo pedido: cada texto tiene un rol con los nombres exactos de la planilla: Título, Subtítulo (con variables), Texto principal, Texto secundario A/B, Frases destacadas A/B/C, Listados A/B/C, Otros. Se arma sobre lo que ya hay (`book.paragraphStyles` + `paragraphMap[].styleId` con retoques), no un sistema nuevo. Tocar una caja con rol pregunta "¿sólo acá o en todo el rol?". El ancho de caja en columnas es del rol. Pendiente: qué quiere decir "Subtítulo (con variables)" (preguntar), y la pregunta "¿sólo acá o en todo el rol?" es un aviso en el panel, no un diálogo en cada cambio (confirmar con la cátedra que les sirve así).
3. **La tabla: hecha (09-nov, noche).** Pauta tipográfica (vista Estructura, o Selección → Rol); cómo funciona, en `docs/arquitectura.md` → "Pauta de uso tipográfico". Provisorio hasta que conteste la cátedra: los cortes de Amplio/Normal/Ajustado (`LEADING_LIMITS`, 1,2 y 1,4) y "Operación tipográfica" como texto libre. Lo pedido: Se ve, se edita (cambia el libro entero), marca las excepciones y se descarga. Columnas como la planilla: Tipografía y cuerpo; Variable (Escritura, Peso, Rendimiento, Inclinación); Alineación (izquierda, derecha, centrado, justificado); Ancho de caja; Interlineado (amplio, normal, ajustado, con el valor); Operación tipográfica; Zonas activas de la grilla en tres dobles páginas representativas. Folio y cornisa se llenan solos en Otros. Leyenda obligatoria, en la vista y en el descargable: "Pautas tipográficas Material adaptado y desarrollado por la Cátedra de Tipografía I de la UNNE (Universidad Nacional del Nordeste) para fines académicos y editoriales."
4. **Cubierta, Aprendizaje y partes del libro: hechos (09-nov, noche).** Cómo funcionan, en `docs/arquitectura.md` → "Partes del libro, Interior | Cubierta y Aprender". Pendiente: que la cátedra mande su bibliografía para sumarla, y confirmar la lista de partes. Lo pedido: Conmutador visible Interior/Cubierta; acceso a bibliografía y tutoriales siempre a la vista; Estructura del libro como lista de partes de Lupton para tildar (portadilla, portada, créditos, dedicatoria, índice, prólogo, cuerpo, colofón…).

**Notas al pie: qué hay.**
- Selección → Notas al pie: "Insertar nota al pie" (donde está el cursor si se está escribiendo; si no, al final del párrafo elegido) y la lista de notas de la caja para escribirlas o quitarlas. Atajo mientras se escribe: Ctrl+Alt+F (⌘⌥F).
- Libro → Notas al pie (aparece cuando hay alguna): tipo de letra, cuerpo, interlineado, espacio sobre las notas, filete y numeración (continua, por sección o por página).
- En la página: número volado en el texto y, al pie de la caja tipográfica, filete corto y "N  texto". La caja que baja hasta las notas se achica en el dibujo; lo que no entra queda como texto sobrante.
- Copiar y pegar duplica la nota; cortar y pegar la mueve. Un libro sin notas sale idéntico (los PDF de la autoprueba no cambian).

**Notas al pie: pendiente.**
- No hay reflujo entre cajas: si la llamada queda en el texto sobrante, la nota igual sale en esa página. Una nota que no entra en su página no pasa a la siguiente.
- Probarlo con la cátedra: estilo de la llamada (volada o entre paréntesis), número de la nota volado o no, largo del filete (hoy 25 % de la caja), y si quieren notas al final del capítulo.
- Las notas son texto plano (sin cursiva ni estilos de carácter: dependen de la decisión de estilos de carácter de la etapa 4).
- El motor de composición deja con el dibujo de Chromium los párrafos con llamadas.
- El tirador inferior de una caja achicada por las notas se dibuja donde termina la caja en el dibujo, no en `o.h`.

**Respuestas de la cátedra (09-nov, noche):**
1. Llamada volada en el texto: así está bien.
2. Número de la nota al pie: las dos opciones (Libro → Notas al pie → Número al pie: normal o volado). Filete, opcional como ya estaba.
3. Numeración: quedan las opciones (continua, por sección, por página).
4. Amplio/Normal/Ajustado: el corte propuesto queda (interlineado / cuerpo < 1,2 ajustado, hasta 1,4 normal, más amplio), con ajuste manual.
5. "Operación tipográfica" son estilos: texto libre más lo que se detecta solo (color aplicado, interletrado).
6. Logo de Tipografía I y leyenda: van, en la vista y en lo descargado (el logo, sacado de la planilla de la clase 3: `assets/catedra-tipografia-1.png`).
7. Escritura y Rendimiento: alcanza. Escritura ya es una propiedad del párrafo (alta y baja, mayúsculas, versalitas); el rendimiento se lee de la fuente (condensada, normal, expandida).

**Ajustes del 09-nov, noche, con el pedido completo (y la planilla en PDF):**
- La pauta tiene todas las filas de la planilla, también las dos "Variable" del Subtítulo (roles `subtitle-variant-a`/`-b`), aunque no se usen; Otros suma las notas al pie y la Cita.
- Se descarga en PDF (A3 apaisado) e imagen (PNG), además de la planilla CSV, con la leyenda en dos renglones y el logo.
- El ancho de caja del rol se aplica a todas sus cajas del libro; una caja con otro ancho ofrece "Esta caja al rol" o "Este ancho al rol".
- Citas: Selección → Notas al pie y citas → "Marcar como cita" (estilo Cita, sangrado y un punto menor, en el rol Otros si está libre).
- Interior | Cubierta y solapas pasó a la barra principal (en 1366 Imprimir, Vista previa y Asistente quedan de ícono para que entre).

## 6. Segunda tanda de la cátedra (09-nov, noche): plan, sin código todavía

### 6.1 Cubierta y solapas pasa al riel izquierdo

**Pedido:** sacar "Cubierta y solapas" de la barra superior y ponerlo como un ícono más del riel izquierdo, junto a Páginas, Estructura, Índice y Capas. Arriba quedan las acciones del programa y del archivo (crear, espacio de trabajo, guardar, imprimir, vista, exportar); la cubierta es parte del esquema del libro. Ojo: contradice el primer pedido ("botón destacado en el header"); esto lo reemplaza.

**Cómo está hoy:** `PieceSwitch piece="interior"` en `src/components/topbar/Topbar.tsx` (zona `.topright`, al lado de Aprender) y `PieceSwitch piece="cover"` en la barra propia de `src/components/cover/CoverEditor.tsx`. El botón de Cubierta tiene `id="coverTool"` y el de Interior `#interiorTool`; los usan el recorrido de la Ayuda, `src/workspace.ts` (selector `#coverTool`) y las pruebas (`tests/studio-tests.js:44` y `tests/book-parts-tests.js:120` buscan `.topbar #coverTool`).

**Plan:**
1. `src/components/rail/Rail.tsx`: después de las cuatro vistas (`VIEWS`), un botón más con el ícono `book` (el que ya usa la cubierta en `PieceSwitch.tsx`), etiqueta "Cubierta" y título "Cubierta y solapas". No es una vista con panel (`railView`): abre la pieza, como hoy `PieceSwitch` (misma función). Conserva `id="coverTool"`. Separado de las vistas por el mismo espacio que hay entre grupos del riel; sin línea ni color propio.
2. Sacar `<PieceSwitch piece="interior" />` de `Topbar.tsx` (y su comentario). En 1366 vuelven a tener nombre Imprimir, Vista previa y Asistente si entran (se habían pasado a ícono para hacerle lugar; revisar `ui/` de la barra).
3. Dentro de la cubierta: mirar si el riel sigue a la vista. Si sigue, el botón queda marcado (`aria-pressed`) y Páginas vuelve al interior. Si la cubierta tapa el riel, queda la vuelta "Interior" de la barra de `CoverEditor.tsx`, como hoy.
4. Actualizar `tests/studio-tests.js` y `tests/book-parts-tests.js` (`.rail #coverTool`), el comentario del encabezado de `Rail.tsx`, `docs/arquitectura.md` (sección "Partes del libro, Interior | Cubierta y Aprender") y la lección del recorrido si nombra la barra.

### 6.2 Flechitas para subir y bajar en los campos numéricos, con decimales

**Pedido:** flechitas de más y menos dentro de las cajas de valores (Inferior 22 mm, Exterior 20 mm…). En la Cuenca y en la UNNE los alumnos ajustan con clics en las flechitas y decimales (2,1; 2,5), no tipeando.

**Cómo está hoy:** `ui/atoms/field.css` (`.unit-wrap input[type='number']`, cerca de la línea 175) apaga las flechas del navegador porque se montaban sobre la unidad. `NumberField` (`src/components/inspector/fields.tsx`) usa `step` 0,5 por defecto y escribe con el `change` nativo (`bind` → `commitBinding`: un paso de deshacer y un redibujo por cambio). Hay otros `input type="number"` sueltos en `FolioPanel`, `FootnotePanels`, `ObjectPanel`, `RulesPanel`, `ShapePanel`, `TextPanels`, `CoverEditor`, `OutputWindow`, `editorial-rules.tsx` e `inspector-views.tsx`.

**Ojo, hay dos mundos (aviso de la cátedra, 09-nov):** en los diálogos (Libro nuevo: "Ancho · cm", "Alto"; también `BookBuilder`, `GuideForm`, `ParagraphStyleForm`, `TocEntryForm`, `RulesPanel`) **sí** aparecen flechitas, pero son las del navegador: `Field` de `src/components/form/Form.tsx` es un `<input type="number">` sin `.unit-wrap`, con `step` 0,1, y nadie le apagó las flechas nativas. Se ven distintas según el sistema y no siguen el diseño. Además `review-workspace.ts` arma otro a mano en una cadena (`#reviewFaceInput`). El arreglo es uno solo para todos: apagar las flechas nativas en cualquier `input[type='number']` (no sólo en `.unit-wrap`) y usar el mismo `Stepper` en `NumberField` y en `Field`.

**Plan:**
1. Componente `Stepper` (átomo; marcado compartido, para que `Field` de `Form.tsx` lo use igual) en `fields.tsx` (dos botones chicos, arriba y abajo, con el ícono `chevron`) dentro de `.unit-wrap`, a la derecha de la unidad. Se ven sólo con el puntero encima o el foco en el campo (`:hover` / `:focus-within`); el resto del tiempo el campo queda como ahora. Sin color propio, con los tokens de `field.css` (el control lo pide `lint:design`).
2. Clic: `input.stepUp()` / `stepDown()` y `change` nativo, así graba igual que tipear. Mantener apretado repite (espera ~400 ms, después cada ~60 ms) mostrando el valor y graba **una sola vez** al soltar, para que deshacer no tenga un paso por cada décima. `pointerdown` con `preventDefault` para no sacarle el foco al campo.
3. Pasos: las medidas en mm van de a **0,1** (hoy 0,5); con **Mayúscula**, de a 1. Lo mismo con las flechas del teclado (hoy el navegador usa `step`; sumar Mayúscula + flecha = ±1 en el `keydown`). Cuidado: `stepUp` acomoda al múltiplo de `step` contando desde `min`, y 22,25 con paso 0,1 pasaría a 22,3; revisar que los `min` sean múltiplos razonables. Campos de enteros (columnas, filas, comenzar en) siguen de a 1.
4. Mostrar el valor con coma o punto según el idioma, como hoy (no cambia).
5. Que lo usen también los campos sueltos de la lista de arriba (cambiarlos a `NumberField` donde se pueda; si no, sumarles el `Stepper`).
6. Revisar con impeccable en 1366 × 768 y 1920 × 1080 que con las flechitas a la vista ningún valor quede cortado (los campos del inspector son angostos: Inferior y Exterior van de a dos por fila).
7. Pruebas en `tests/` (`fields` o `studio-tests.js`): clic sube 0,1; Mayúscula + clic sube 1; mantener apretado deja un solo paso de deshacer; Mayúscula + flecha del teclado sube 1; respeta `min` y `max`.

### 6.3 Clic derecho con las funciones de siempre

**Pedido (09-nov, noche):** el menú del clic derecho que tienen todos los programas.

**Cómo está hoy:** no hay ningún menú contextual (ni `contextmenu` en `src/`), y Electron no trae uno: con clic derecho no pasa nada, tampoco en un campo o en el texto que se escribe. No existe copiar y pegar objetos (los atajos son Ctrl+S, Z, Y, P y Supr). Lo que sí existe y se puede llamar: `command(name)` en `src/core/tools.ts` (`editText`, `addPage`, `duplicate` (página), `deletePage`, `deleteObject`, al frente y al fondo), bloquear y ocultar (`ObjectPanel.tsx`, sección Orden y bloqueo), `fitTextFrame` (`frame-handles.ts`), insertar nota al pie y marcar como cita (`footnotes.ts`), roles (`roles.ts`), guías (`ruler-guides.ts`).

**Plan:**
1. **Texto y campos (menú del sistema):** en el proceso principal, `webContents.on('context-menu')` (`desktop/src/main/`) con un `Menu` nativo cuando `params.isEditable` o hay texto elegido: Deshacer, Rehacer, Cortar, Copiar, Pegar, Seleccionar todo, y las sugerencias de ortografía (`params.dictionarySuggestions`, `replaceMisspelling`, "Agregar al diccionario"). Usa los `role` de Electron: no hace falta sumar nada al contrato de la página. Traducido según el idioma del programa.
2. **Lienzo y paneles (menú propio):** `ContextMenu` de Radix (viene en `radix-ui`, ya instalado), un componente en `src/components/context-menu/`, con un registro (como `registerInspectorPanel`) para que cada módulo sume sus acciones según dónde se hizo clic. Clic derecho sobre un objeto lo elige primero. Cada acción muestra su atajo.
   - **Objeto:** Cortar, Copiar, Pegar, Duplicar, Eliminar · Traer al frente, Enviar al fondo · Bloquear / Desbloquear, Ocultar · Alinear ▸ (los de Alinear objetos).
   - **Además, caja de texto:** Editar texto, Ajustar caja al texto, Rol ▸, Insertar nota al pie, Marcar como cita.
   - **Además, imagen:** Reemplazar imagen.
   - **Página (sin objeto):** Pegar, Pegar en el mismo lugar · Agregar página después, Duplicar página, Eliminar página · Agregar guía, Mostrar u ocultar grilla.
   - **Miniatura en Páginas:** Insertar página antes y después, Duplicar, Eliminar.
3. **Copiar y pegar objetos (nuevo, lo necesita el menú):** portapapeles propio con el JSON de los objetos elegidos (ids nuevos al pegar; las notas al pie con `adoptPastedNotes` de `footnote-model.ts`). Pegar desplazado 5 mm, o en el mismo lugar en otra página. Atajos Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+D (duplicar objeto) en `src/core/studio-wiring.ts`, sólo si no se está escribiendo (si se escribe, son los del texto).
4. Diseño: el menú con los tokens del sistema (átomo o molécula en `ui/`), sin íconos de colores; lo que no se puede hacer queda deshabilitado, no se esconde.
5. Pruebas en `tests/`: clic derecho sobre un objeto lo elige y abre el menú con sus acciones; copiar y pegar crea un objeto con id nuevo; Ctrl+D duplica; las acciones deshabilitadas (Pegar sin nada copiado, Eliminar página con una sola).

## 4. Distribución

- **Etapa 1 cerrada (08-nov):** se retiró la versión C#/WebView2 (`LibroStudio/v3/Host*.cs`, `Build.ps1`, `Build-Installer.ps1`, `Maquetario.iss`), su rama en `src/host.ts` y las vistas de captura que sólo llamaba ese programa. Se conserva `LibroStudio/v3/installer-brand/` (imágenes del instalador). Queda lo que depende de Motiova y de la venta (abajo).
- **Hecho (08-nov):** la conexión con Motiova va desde el propio programa (Configuración → Cuenta, y el aviso de arranque en modo enforce): login con PKCE, licencia de este equipo, renovación al abrir, versión nueva y cerrar sesión. Contrato en `docs/arquitectura.md` → "Licencias y conexión con Motiova". El backend de Motiova ya está.
- **Para probar contra Motiova local:** levantar Motiova (`localhost:5183` y `localhost:8010`, con la clave dev: `npm run license:dev-keys`) y `npm run dev`; la app apunta ahí en desarrollo.
- **Para la versión a la venta:** confirmar las URLs de producción en `desktop/package.json → maquetario.motiova` (hoy `https://motiova.com` y `https://api.motiova.com/api/v1`), poner `licenseMode: "enforce"`, sumar la clave pública de producción que mande Motiova, y entregar versión + notas + un instalador firmado por sistema.
- Firma de código: certificado de Windows (Azure Trusted Signing u OV/EV) y Apple Developer. Definir quién los gestiona y avisar a Motiova.
- Launcher y descargable único: **después de terminar las 4 etapas de `arquitectura.md`** (decisión del 8-nov). Usa los mismos endpoints; el plan está en `arquitectura.md` → distribución.

## Decisiones cerradas

Pago único con actualizaciones (`maxMajor: null`), edición `estandar`, 2 computadoras por compra, 7 días sin conexión. Detalle en `docs/arquitectura.md`.

## Informes

PDF con la tipografía de la app (`scripts/render-pdf.cjs`). BETA 0.2 (09-nov, noche; las capturas están en `docs/informe/img/beta02-*.png`), para Seba y para quienes prueban:

```bash
npx electron scripts/render-pdf.cjs docs/informe/beta-0.2.html "Maquetario BETA 0.2 - Para Seba.pdf" "Maquetario BETA 0.2 · Qué se sumó y qué probar"
npx electron scripts/render-pdf.cjs docs/informe/beta-0.2-presentacion.html "Maquetario BETA 0.2 - Presentación y prueba.pdf" "Maquetario BETA 0.2 · Presentación y prueba"
```

BETA 0.1:

```bash
npx electron scripts/render-pdf.cjs docs/informe/beta-0.1.html "Maquetario BETA 0.1 - Novedades y qué probar.pdf" "Maquetario BETA 0.1 · Novedades y qué probar"
npx electron scripts/render-pdf.cjs docs/informe/beta-0.1-presentacion.html "Maquetario BETA 0.1 - Presentación y prueba.pdf" "Maquetario BETA 0.1 · Presentación y prueba"
```

Informe técnico de la rama (fuente `docs/informe/informe.html`):

```bash
npx electron scripts/render-pdf.cjs docs/informe/informe.html "docs/informe/Maquetario - Informe técnico version-juan.pdf" "Maquetario · Informe técnico de la rama version-juan"
```

Pendiente de sumar al próximo informe: registro de extensiones (127 cadenas convertidas).
