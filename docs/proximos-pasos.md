# PrÃ³ximos pasos (rama version-juan)

Hoja de ruta para retomar. Estado al cierre: todo subido, `npm test` y `npm run self-test` en verde.

## Antes de cada commit

```bash
npm test            # licencias, lector de fuentes, control de diseÃ±o (y deuda)
npm run typecheck
npm run self-test   # 25+ pasos sobre la app real; capturas en %APPDATA%\Maquetario-autoprueba\self-test
```

Commits en castellano, sin lÃ­neas de autorÃ­a de IA.

## 1. Extensiones declaradas (hecho)

Una **cadena** es una funciÃ³n global que varios mÃ³dulos extienden, cada uno envolviendo a la versiÃ³n anterior (por ejemplo, 7 mÃ³dulos agregan algo a `render()`). Antes cada eslabÃ³n era una envoltura escrita a mano; ahora dice quÃ© hace:

| Forma (`extend.js`) | QuÃ© hace | DÃ³nde |
|---|---|---|
| `extend.after(f, fn)` | corre despuÃ©s, con los mismos argumentos | `render`, `coverEditor`, `setTool`, `updateStatus`, `modal`, `thumbs`â€¦ |
| `extend.before(f, fn)` | corre antes | `objectDown`, `upObject`, `outputDialog`, `pageDown`â€¦ |
| `extend.result(f, (resultado, ...args) => resultado)` | ajusta lo que devuelve; con `async` puede esperarlo | `paper`, `autoElement`, `prepareOutput`, `coverArtwork`, `showWelcome`, `saveProject`â€¦ |
| `extend.instead(f, cuÃ¡ndo, fn)` | en ese caso reemplaza (rutas y guardas) | cubierta en `prepareOutput`, objetos bloqueados, sin documentoâ€¦ |
| `extend.around(f, fn)` | envuelve la cadena completa, siempre por fuera | estado del inspector |

Encima de esas formas:

- Inspector (`src/inspector-registry.ts`): `decorateInspector`, `registerInspectorPanel` (Estructura, Objeto, Capas), `pauseInspectorWhile`. El scroll y los `<details>` abiertos se conservan una sola vez.
- Pruebas (`test-registry.js`): `registerIntegrationTest`, `registerNavigationTest`, `registerFontTest`. Las 25 cadenas de pruebas pasaron al registro.

Quedan **13 envolturas de verdad** con `extend(f, anterior => â€¦)`: miran el estado antes y despuÃ©s, o llaman a la anterior en el medio, y ahÃ­ la envoltura es la forma correcta. Son `renderPages` (2), `finishEditing` (2), `settingsNew` (2), `outputPreview` (2), `outputDialog`, `objectDown`, `commit`, `applyFace` y `startTutorial`. `npm run lint:design` las cuenta ("envolturas extend() escritas a mano"): una nueva tiene que justificarse.

Al cerrar la conversiÃ³n, los PDF y los JSON de verificaciÃ³n de la autoprueba salieron idÃ©nticos a los de antes, y las capturas difieren como mucho en 1/255 por canal (suavizado del renderizado).

Etapa 2 en marcha: ver "Etapa 2" mÃ¡s abajo.

## 2. Vaciar la capa legacy (hecho)

**Estado (8-nov):** no queda CSS fuera de `ui/`. Eran 21 hojas, 98,9 KB y 965 colores sueltos. La interfaz estÃ¡ en sus capas (tokens â†’ base â†’ Ã¡tomos â†’ molÃ©culas â†’ organismos â†’ plantillas) y lo que dibuja el libro estÃ¡ en `ui/book/`, en la capa `book`, la mÃ¡s baja:

| Hoja | QuÃ© tiene |
|---|---|
| `book/page.css` | pliego, pÃ¡gina, objetos (texto, marco, imagen), elementos automÃ¡ticos, Ã­ndice, pÃ¡rrafos, figuras |
| `book/selection.css` | selecciÃ³n y multiselecciÃ³n, rÃ³tulo, desborde, tiradores, imÃ¡n, pÃ¡gina activa, zona que recibe una imagen |
| `book/thumbs.css` | miniaturas de la tira de pÃ¡ginas y de las plantillas |
| `book/canvas.css` | mesa (desplazamiento, mano), pliego vertical, vista continua, vista previa |
| `book/print.css` | `#printRoot`, pliegos de salida, ficha de medidas y todo el `@media print` |

Los colores del libro son tokens de valor exacto en `ui/tokens/book.css` (`--book-*`), aparte del tema de la interfaz. `@font-face` de DM Sans en `ui/tokens/fonts.css`. El orden de las hojas de `book/` importa: reproduce el de las hojas viejas donde dos reglas de igual peso se pisan (por ejemplo, el texto en ediciÃ³n se desplaza aunque estÃ© seleccionado).

Verificado al mudar: `style-snapshot` idÃ©ntico con las hojas viejas y con `book/` (a 1366 Ã— 768 y 1150 Ã— 700, sin filtrar ruido), capturas del lienzo iguales y los 7 PDF y 7 JSON de la autoprueba idÃ©nticos (`node scripts/compare-outputs.mjs <antes> <despuÃ©s>`).

`npm run lint:design` ahora tambiÃ©n falla si aparece una hoja `.css` fuera de `ui/`.

### CÃ³mo verificar un cambio de estilos

1. Levantar la app de escritorio: `cd desktop && node scripts/build.mjs && npx electron . --dev --no-throttle --remote-debugging-port=9333`, y manejarla con `node scripts/app-cdp.mjs` (`eval`, `evalfile`, `shot`, `click`, `key`). La vista queda fija (1536 Ã— 1024 o `APP_CDP_SIZE`), asÃ­ las fotos no dependen de la ventana.
2. `scripts/style-snapshot.js` (`styleSnapshot` / `styleDiff`) antes y despuÃ©s, en 1536 Ã— 1024 y en `APP_CDP_SIZE=1366x768` (entran `max-height: 850px` y `max-width: 1350px`); para lo angosto, tambiÃ©n 1150 Ã— 700. Sacar dos fotos de base: lo que cambia entre ellas es ruido (foco, animaciones, recientes).
3. Si la comparaciÃ³n da diferencias raras (pestaÃ±a activa, foco), volver un momento al estado anterior y sacar la foto en la misma sesiÃ³n: el estado de la app tambiÃ©n se mueve entre corridas.
4. Para lo que dibuja el libro: `npm run self-test` antes y despuÃ©s y `node scripts/compare-outputs.mjs`; los PDF tienen que salir idÃ©nticos.

**Lecciones de la migraciÃ³n:** portar sÃ³lo las declaraciones que de verdad pesaban (portar una anulada la hace ganar y cambia la interfaz); revisar `width: 100%` y `background: none`, que las herramientas no ven; usar propiedades largas en vez de `border:` cuando el organismo ya tiene `border-color`; y portar las `@media` junto con su regla, porque una regla de `ui/` le gana a cualquier `@media` de una capa mÃ¡s baja.

### Para retomar (orden sugerido)

1. ~~DiÃ¡logos que eran columnas largas~~ (hecho el 8-nov): ConfiguraciÃ³n del libro y Crear una publicaciÃ³n en dos columnas (tamaÃ±os de pÃ¡gina y nota de medidas a la izquierda, datos a la derecha; de 820 Ã— 747 a 1040 Ã— 564, entra sin desplazamiento en 1150 Ã— 700); glosario de 930 Ã— 737 a 1100 Ã— 649 con una sola acciÃ³n ("Volver al editor"); en Cubierta queda un solo par de botones de imagen.
2. Bajar los estilos en lÃ­nea desde JS (`lint:design` los cuenta; 99 al sacar las pruebas): la mayorÃ­a son posiciones del libro, que se quedan; los de la interfaz (punto de guardado, contornos de la cubierta, guÃ­as de salida, cursor de figuras) pasan a clases.
3. Etapa 2: sigue abajo.

## Etapa 2: TypeScript y mÃ³dulos

**Hecho (8-nov):**

1. **Formato.** Todo el cÃ³digo con prettier (`.prettierrc.json`: comillas simples, punto y coma, 100 columnas; fuera: pdf-lib, imagen de muestra y separaciÃ³n silÃ¡bica, que son de terceros). La app pasÃ³ de 3357 lÃ­neas casi ilegibles a 16 454. `npm test` incluye `format:check`; `npm run format` formatea. `node scripts/check-same-code.mjs HEAD <archivos>` prueba que un cambio de formato no cambiÃ³ el cÃ³digo (minifica antes y despuÃ©s y compara).
2. **Pruebas fuera del instalador.** Todas en `LibroStudio/v3/app/tests/` (30 archivos): las 13 que ya eran aparte y 17 que vivÃ­an dentro de mÃ³dulos (`studio`, `editorial`, `i18n`, `output`, `fonts`, `shapes`â€¦), incluidas las bases `runIntegrationTests` y `runFontIntegrationTests`. `test-loader.js` las carga sÃ³lo en la autoprueba, en el mismo orden de registro (`verificacion.json` saliÃ³ idÃ©ntico). `desktop/package.json â†’ build.files` excluye `tests/**`. En el programa instalado, la autoprueba omite los 11 pasos que dependen de ellas (probado escondiendo `tests/`).

**Sigue:**

3. **Tipos sin reescribir** (en curso). `LibroStudio/v3/app/tsconfig.json` (`allowJs` + `checkJs`, sin modo estricto) y `globals.d.ts` con lo que comparten los scripts; `npm run typecheck:app` informa (todavÃ­a no es parte de `npm run typecheck`). Hecho:
   - Las 11 funciones globales que se reasignaban a mano (`inspector`, `paper`, `startEditing`, `gridSvg`, `canvasAnchor`, `restoreCanvasAnchor`, `setZoom`, `objectDown`, `moveObject`, `renderTemplates`, `offerRecovery`) pasan por `extend`. Nueva forma `extend.replace(f, fn, origen)` para el reemplazo completo. La de `inspector` es `extend.around` registrada despuÃ©s de la de `inspector-registry`: queda por fuera de todo, igual que antes. `lint:design` cuenta `f = function` en el nivel superior para que no vuelva.
   - `$()` y `$$()` tipados (`UIElement`: `HTMLElement` con el resto libre). Al tiparlos aparecen los manejadores que leen `e.target.value` sin decir quÃ© control es (unos 290 avisos en total): se resuelven archivo por archivo con `// @ts-check`.
   - Ojo: la prueba de navegaciÃ³n de la vista continua guarda posiciones de desplazamiento que dependen del tamaÃ±o de la pantalla; si cambia el monitor, `verificacion-navegacion.json` cambia aunque el cÃ³digo no.
4. **Pasar a `.ts` y a mÃ³dulos** (en curso).
   - Armado: las fuentes van en `LibroStudio/v3/app/src/*.ts`; `desktop/scripts/build.mjs` las compila con esbuild a `app/build/` (generado, fuera de git) y `index.html` carga `build/<archivo>.js`. Lo corren `npm run dev`, `self-test` y `dist`; el instalador lleva `build/` sin `src/` ni mapas.
   - Por ahora cada archivo compila a un script que publica su global (`globalThis.X = â€¦` con `declare global` para el tipo), asÃ­ el resto de la app no cambia. Cuando estÃ©n pasados los que dependen entre sÃ­, se cambia a `import` y un solo punto de entrada.
   - Tipos: `src/` es estricto y entra en `npm run typecheck` (0 errores). El chequeo del JS (`typecheck:app`) incluye `src/`, asÃ­ que el JS ya ve los tipos reales de lo pasado.
   - Hecho: **`model.ts`** (el modelo del libro: tipos `Book`, `Page`, `BookObject`, `AutoElement`, `TocEntry`). Comparado con el viejo en Node con el mismo azar: mismas salidas en todas sus funciones. Sigue siendo un objeto comÃºn porque `master-refinement.js` y `shapes.js` reemplazan `M.validate` (pendiente: pasarlo a un registro de validaciones).
   - Hecho tambiÃ©n: **`extend.ts`** (con el tipo `Extend` de toda la API), **`test-registry.ts`** (`TestResult`), **`document-units.ts`** y **`editorial-rules.ts`**. En paralelo (otros agentes, integrados con la autoprueba): **`confirm.ts`**, **`rulers.ts`**, **`welcome-links.ts`**, **`host.ts`** (tipos del puente con el preload), **`inspector-registry.ts`** (`inspectorPaused` e `inspectorDetailKey` quedan privados) y **`page-priority.ts`**; **`i18n.ts`** (`LibroI18n` con su tipo; las traducciones extra pasan a `src/data/i18n-extra.ts`, un módulo que importa). Segunda tanda: `book-proof`, `focus-layout`, `review-tutorial`, `page-exceptions`, `app-notices`, `hyphenation-controls`, `novel-sample` y `binding-estimate`. Van 21 de 70. Convención: lo que está directo en `src/` es un script que carga `index.html`; las subcarpetas (`src/data/`…) son módulos que se importan.
   - CÃ³mo se pasa un archivo de interfaz: sus globales que usan otros archivos (o las pruebas, o `selftest.ts`) se publican con `globalThis.X = â€¦` y `declare global`; lo demÃ¡s queda privado. Los globales del JS que usa se declaran en `src/js-globals.d.ts` (sÃ³lo para el chequeo estricto de `src/`). Se verifica con la autoprueba (PDF y JSON idÃ©nticos).
   - Siguen: los archivos con menos dependencias primero (`confirm.js`, `welcome-links.js`, `rulers.js`, `i18n.js`), despuÃ©s los centrales (`studio.js`, `paragraphs.js`, `fonts.js`). El cambio a `import` y un solo punto de entrada va cuando `studio.js` estÃ© pasado: es el que define casi todos los globales.
   - La versiÃ³n C# (`LibroStudio/v3/Host*.cs`) no compila `src/`: necesita que `build/` exista. Se retira al cerrar la etapa 1.
## 3. Experiencia de uso

Observaciones en `docs/evaluacion-uso.md` (13 puntos). Las mÃ¡s visibles: la etiqueta "PÃ¡gina activa N" pintada sobre el papel, las siete pestaÃ±as del inspector, y las muchas puertas de ayuda (Tutorial, Aprender, Recorrido, "?", glosario).

## 4. DistribuciÃ³n

- **Hecho (08-nov):** la conexiÃ³n con Motiova va desde el propio programa (ConfiguraciÃ³n â†’ Cuenta, y el aviso de arranque en modo enforce): login con PKCE, licencia de este equipo, renovaciÃ³n al abrir, versiÃ³n nueva y cerrar sesiÃ³n. Contrato en `docs/arquitectura.md` â†’ "Licencias y conexiÃ³n con Motiova". El backend de Motiova ya estÃ¡.
- **Para probar contra Motiova local:** levantar Motiova (`localhost:5183` y `localhost:8010`, con la clave dev: `npm run license:dev-keys`) y `npm run dev`; la app apunta ahÃ­ en desarrollo.
- **Para la versiÃ³n a la venta:** confirmar las URLs de producciÃ³n en `desktop/package.json â†’ maquetario.motiova` (hoy `https://motiova.com` y `https://api.motiova.com/api/v1`), poner `licenseMode: "enforce"`, sumar la clave pÃºblica de producciÃ³n que mande Motiova, y entregar versiÃ³n + notas + un instalador firmado por sistema.
- Firma de cÃ³digo: certificado de Windows (Azure Trusted Signing u OV/EV) y Apple Developer. Definir quiÃ©n los gestiona y avisar a Motiova.
- Launcher y descargable Ãºnico: **despuÃ©s de terminar las 4 etapas de `arquitectura.md`** (decisiÃ³n del 8-nov). Usa los mismos endpoints; el plan estÃ¡ en `arquitectura.md` â†’ distribuciÃ³n.

## Decisiones cerradas

Pago Ãºnico con actualizaciones (`maxMajor: null`), ediciÃ³n `estandar`, 2 computadoras por compra, 7 dÃ­as sin conexiÃ³n. Detalle en `docs/arquitectura.md`.

## Informe para Seba

Fuente: `docs/informe/informe.html`. Regenerar el PDF:

```bash
npx electron scripts/render-pdf.cjs docs/informe/informe.html "docs/informe/Maquetario - Informe tÃ©cnico version-juan.pdf" "Maquetario Â· Informe tÃ©cnico de la rama version-juan"
```

Pendiente de sumar al prÃ³ximo informe: registro de extensiones (127 cadenas convertidas).
