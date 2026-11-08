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

1. Diálogos que todavía son columnas largas: Configuración del libro (formatos a la izquierda y campos a la derecha), glosario. En Cubierta, "Imagen de esta zona / Quitar imagen" aparece dos veces (arriba y abajo de la zona): dejar una.
2. Bajar los 107 estilos en línea desde JS (`lint:design` los cuenta): la mayoría son posiciones del libro, que se quedan; los de la interfaz pasan a clases.
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
