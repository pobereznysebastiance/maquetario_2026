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

- Inspector (`inspector-registry.js`): `decorateInspector`, `registerInspectorPanel` (Estructura, Objeto, Capas), `pauseInspectorWhile`. El scroll y los `<details>` abiertos se conservan una sola vez.
- Pruebas (`test-registry.js`): `registerIntegrationTest`, `registerNavigationTest`, `registerFontTest`. Las 25 cadenas de pruebas pasaron al registro.

Quedan **13 envolturas de verdad** con `extend(f, anterior => …)`: miran el estado antes y después, o llaman a la anterior en el medio, y ahí la envoltura es la forma correcta. Son `renderPages` (2), `finishEditing` (2), `settingsNew` (2), `outputPreview` (2), `outputDialog`, `objectDown`, `commit`, `applyFace` y `startTutorial`. `npm run lint:design` las cuenta ("envolturas extend() escritas a mano"): una nueva tiene que justificarse.

Al cerrar la conversión, los PDF y los JSON de verificación de la autoprueba salieron idénticos a los de antes, y las capturas difieren como mucho en 1/255 por canal (suavizado del renderizado).

Sigue (etapa 2 de `arquitectura.md`): sacar del build de producción las pruebas que todavía viven dentro de módulos de la app (`output.js`, `shapes.js`, `layout-tools.js`…), pasándolas a archivos `*-tests.js`; después TypeScript y módulos.

## 2. Vaciar la capa legacy

**Estado (8-nov, fin del día):** la interfaz ya no tiene nada en legacy. Quedan **18,5 KB en 21 hojas, 97 colores** (eran 98,9 KB y 965 colores al empezar): lo que dibuja el libro en el editor (pliego, página, objetos, tiradores, guías, imán, figuras, miniaturas, página activa, vista continua), la impresión (`@media print`, `#printRoot`, hojas de la vista previa), `@font-face` de DM Sans, las variables de `:root` que usa eso, y `@media` viejas ya anuladas por `ui/`. `npm run lint:design` informa la deuda que queda.

Criterio: cuando una pieza ya está en su organismo de `ui/`, borrar sus reglas de las hojas viejas.

### Método

1. Servir la interfaz (`node scripts/serve-ui.cjs LibroStudio/v3/app 5179`, o la configuración `interfaz` del panel de navegador), cargar `scripts/legacy-probe.js` con `window.LEGACY_FILES = [...]` y recorrer los estados: bienvenida, sin documento, cada pestaña, con selección, multiselección, cambios sin guardar, vista continua, diálogos, tutorial, pantalla angosta.
2. `legacyProbe('estado')` en cada uno; `legacyReport()` da las candidatas a muertas.
3. `legacyConfirm('estado', candidatas)` en cada estado: borra de a una sin reponer, así los duplicados entre hojas no pasan como muertos. Lo que devuelve el último estado se borra con `node scripts/prune-css.cjs LibroStudio/v3/app lista.json` (antes, `--contar` tiene que coincidir con el CSSOM).
4. Para migrar una pieza: `legacyProps('estado')` dice qué declaración exacta de cada regla sigue pesando; sólo esas pasan a `ui/`, con tokens.
5. Guardar las capturas de la autoprueba antes, correr `npm run self-test` y comparar con `npx electron scripts/compare-captures.cjs <antes> <después> <salida>` (`UMBRAL=4` para lo fino). PDF y JSON de verificación tienen que salir idénticos.

**Lo que la sonda no ve** (y la autoprueba sí encontró): el estado real de la barra superior en Electron (controles de ventana), elementos dentro de algo oculto (sus estilos cambian pero no se ven), anchos de barra de desplazamiento, y formas cortas con `var()` (`border-radius: var(--radius-lg)`, `border-top: 1px solid var(--line)`): el CSSOM deja vacías sus propiedades largas. `legacyProps` ya recorre las declaraciones como están escritas, pero conviene revisar en vivo las formas cortas con `var()` de lo que se borra (así se perdieron las esquinas y la perilla del interruptor, y se recuperaron). `prune-css.cjs` nunca borra `html`, `body`, `:root`, `*`, `@font-face`, `@media`, impresión ni `::-webkit-*`.

**Sobre la app de escritorio** (lo que la sonda en el navegador no ve): levantar con `cd desktop && node scripts/build.mjs && npx electron . --dev --remote-debugging-port=9333` y usar `node scripts/app-cdp.mjs` (`eval`, `evalfile`, `shot`, `click`, `key`). Fija la vista en 1536 × 1024 a escala 1 en cada llamada, así las fotos de `style-snapshot` no dependen de la ventana. Para comparar: sacar dos fotos de base sin el cambio (la diferencia entre ellas es el ruido: foco, animaciones) y recién ahí la foto con el cambio.

**Antes de borrar o migrar, siempre:** (1) emular 1536 × 1024 en el panel del navegador (a 1024 px se activan las reglas @media (max-width:1250px) y tapan a las de base: así se perdió el tamaño del título de la bienvenida); (2) abrir los paneles que arrancan plegados (plantillas con #toggleGridStrip, recorrido con #toggleWorkflow): con el panel de plantillas plegado su regla base parecía muerta y se borró; (3) comparar con `scripts/style-snapshot.js` antes y después (`styleSnapshot` / `styleDiff`), no sólo con las capturas de la autoprueba, que no cubren esos estados.

**Al portar, las @media también** (encontrado en la tanda del 8-nov): una regla de `ui/` le gana a cualquier `@media` vieja, así que la variante de pantalla baja o angosta de lo portado se pierde (el glosario se estiraba, la bienvenida perdía su título compacto). Portar la `@media` junto con la regla base, cambiando las variables locales. Para encontrarlas: cruzar las `@media` de legacy con las reglas de `ui/` de igual selector y propiedad. Y comparar `style-snapshot` en dos tamaños: `APP_CDP_SIZE=1366x768` (entran `max-height: 850px` y `max-width: 1350px`) además de 1536 × 1024.

**La sonda no ve lo que se dibuja tarde** (lista del glosario) ni lo dinámico (`:hover`): antes de borrar, leer el texto original de cada regla y confirmar que cada declaración que no se porta la cubre `ui/`. `style-snapshot` ahora recorre también glosario, cerrar sin guardar, modo foco e interfaz grande.

**Capturas de la autoprueba:** su tamaño depende de la ventana real; si cambia la pantalla o su escala durante la corrida, salen de tamaños distintos y no se pueden comparar. Ahí vale `style-snapshot` (la vista la fija `app-cdp`).

Cuidado al migrar una regla de varios selectores: la sonda la marca efectiva si pesa en uno solo. Pasar los demás a una capa de `ui/` les gana a otros organismos (pasó con `.tool#indexTool`). Portar selector por selector.

### Hecho

- `glass.css` (145 → 11 reglas) y `crystal.css` (47 → 9): queda sólo lo que dibuja el libro en el editor (papel, selección, página activa, imán, figuras, sombra del pliego), la impresión y el aviso flotante.
- Organismos nuevos: `organisms/book-route.css` (ruta del libro y barra del documento) y `organisms/structure.css` (estructura y revisión previa). Lo demás se sumó a barra superior, herramientas, inspector (alineación, capas, índice, color de figura), campos, interruptor, diálogos (salida, glifos, armador, figuras), bienvenida, tutorial y ventana.
- Barrido de reglas muertas en las otras 21 hojas: 158 reglas menos.
- `readability.css` (130 → 56 reglas) y `studio.css` (192 → 111) migradas por pieza: armazón de barra, panel izquierdo, tira de páginas, área central y reglas del lienzo, inspector, interruptor, campos con unidad, diálogos, cubierta, tutorial, bienvenida y aviso. Molécula nueva `panel-resizer.css`. Medidas de componentes como tokens en `semantic.css`.
- En `studio.css` queda a propósito: lo que dibuja el libro (pliego, página, objetos, guías, grilla, elementos automáticos, miniaturas, `#printRoot`) y los resets de elemento (`*`, `html`, `body`, `button`, `input`, `select`, `svg.icon`), que en una capa de `ui/` le ganarían a todo lo viejo; se mueven a `base.css` cuando legacy esté vacío.
- Cambios visuales buscados: colores de tokens (dorado `--text-mark`, verde agua `--accent`, superficies `--surface-*`), alineación activa con contorno verde agua en lugar de relleno lleno, interruptor dorado liso (sin degradé), estructura un poco más compacta.

### Hecho el 8-nov (segunda tanda)

- App revisada abierta en Electron con plantillas y recorrido desplegados: sin roturas salvo lo de abajo.
- Selectores: el valor largo pasaba por debajo de la flecha. Átomo `ui/select.js` (cada selector recibe su `<button><selectedcontent>`) y regla base de campos con el filtro de tipos en `:where` (pisaba el lugar de la flecha).
- Diálogos: `ui/dialog.js` con `dialogVariant(clase)` y `onDialogClose(fn)`. El `close` llega tarde y, al saltar de un diálogo a otro, borraba la clase del nuevo (Preparar PDF y Cubierta quedaban en 540 px). Ningún módulo escribe ya `$('#modal').addEventListener('close', …)`.
- Diálogos apaisados: tamaños en `organisms/dialog.css` con tokens (820 px por defecto; cada variante el suyo). Configuración en dos columnas sin desplazamiento; Cubierta en dos columnas (zona a la izquierda, medidas a la derecha), de 2040 a 1248 px de alto.
- Avisos con tipo: `toast(mensaje, 'success' | 'info' | 'warning' | 'error')`, color e ícono por tipo; las 44 llamadas pasan el suyo. La regla vieja de `#toast` en `glass.css` se borró sin cambio visible.
- `scripts/app-cdp.mjs` para medir y capturar sobre la app de escritorio.

### Hecho el 8-nov (tandas 3 a 5)

- Interfaz migrada por completo: workspace, page-priority, editorial-learning, canvas-navigation, revisión de salida, asistente, paneles del inspector, pestañas por categoría, buscador y biblioteca de fuentes, glifos, pauta tipográfica, cubierta, ficha de medidas, galería de grillas, atajos, recientes, tutorial, barra superior y átomos (campo de color, campo con unidad, interruptor, tecla `kbd`). Barrido de 81 reglas muertas. `fonts.css` y `category-design.css` quedaron vacías y se quitaron.
- Reinicio de elementos (`*`, `html/body`, botones y campos) a `base.css`.
- Escultura oculta de la bienvenida y `.welcome-eyebrow`: fuera.
- Pauta tipográfica: el interlineado ya no muestra decimales de más (19,6 pt).
- `scripts/app-cdp.mjs`: `APP_CDP_SIZE` y `APP_CDP_TIMEOUT`. Electron en desarrollo con `--no-throttle` para que la sonda no se frene con la ventana minimizada (de 50 minutos a 3).
- `style-snapshot.js` recorre además: glosario, cerrar sin guardar, foco, interfaz grande, asistente, buscador de fuentes, glifos, pauta tipográfica, galería, atajos, ficha de medidas, recientes y sin documento.

**Errores que se repitieron y cómo evitarlos:** (1) portar declaraciones que en legacy ya no pesaban (`ui/` les ganaba) las hace ganar y cambia la interfaz: portar sólo lo que marca `legacyProps`, y por texto sólo lo que la sonda no recorre; (2) `width: 100%` en grillas dentro de flex y `background: none` en botones a veces no salen en `legacyProps` pero hacen falta: revisar el texto original; (3) formas cortas (`border:`) que pisan el `border-color` que el organismo ya tenía: usar propiedades largas.

### Para retomar (orden sugerido)

1. **Lo que dibuja el libro y la impresión** (lo último de legacy): pasarlo a su propia hoja de `ui/` (por ejemplo `ui/book/`), en una capa del mismo lugar que hoy ocupa legacy (debajo de `tokens`), con los colores del papel, guías y selección como tokens de valor exacto. Verificar con la autoprueba: los PDF y JSON de verificación tienen que salir idénticos, y comparar capturas del editor (el lienzo no lo cubre `style-snapshot`). Con legacy vacío, sacar la capa y los `:root` viejos.
2. Diálogos que todavía son columnas largas: Configuración del libro (formatos a la izquierda y campos a la derecha), glosario. En Cubierta, "Imagen de esta zona / Quitar imagen" aparece dos veces (arriba y abajo de la zona): dejar una.
3. Después: etapa 2 de `arquitectura.md` (pruebas fuera del build, TypeScript y módulos).

## 3. Experiencia de uso

Observaciones en `docs/evaluacion-uso.md` (13 puntos). Las más visibles: la etiqueta "Página activa N" pintada sobre el papel, las siete pestañas del inspector, y las muchas puertas de ayuda (Tutorial, Aprender, Recorrido, "?", glosario).

## 4. Distribución

- **Hecho (08-nov):** la conexión con Motiova va desde el propio programa (Configuración → Cuenta, y el aviso de arranque en modo enforce): login con PKCE, licencia de este equipo, renovación al abrir, versión nueva y cerrar sesión. Contrato en `docs/arquitectura.md` → "Licencias y conexión con Motiova". El backend de Motiova ya está.
- **Para probar contra Motiova local:** levantar Motiova (`localhost:5183` y `localhost:8010`, con la clave dev: `npm run license:dev-keys`) y `npm run dev`; la app apunta ahí en desarrollo.
- **Para la versión a la venta:** confirmar las URLs de producción en `desktop/package.json → maquetario.motiova` (hoy `https://motiova.com` y `https://api.motiova.com/api/v1`), poner `licenseMode: "enforce"`, sumar la clave pública de producción que mande Motiova, y entregar versión + notas + un instalador firmado por sistema.
- Firma de código: certificado de Windows (Azure Trusted Signing u OV/EV) y Apple Developer. Definir quién los gestiona y avisar a Motiova.
- Launcher: más adelante, con los mismos endpoints.

## Decisiones cerradas

Pago único con actualizaciones (`maxMajor: null`), edición `estandar`, 2 computadoras por compra, 7 días sin conexión. Detalle en `docs/arquitectura.md`.

## Informe para Seba

Fuente: `docs/informe/informe.html`. Regenerar el PDF:

```bash
npx electron scripts/render-pdf.cjs docs/informe/informe.html "docs/informe/Maquetario - Informe técnico version-juan.pdf" "Maquetario · Informe técnico de la rama version-juan"
```

Pendiente de sumar al próximo informe: registro de extensiones (127 cadenas convertidas).
