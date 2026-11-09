# Motor de composición propio (etapa 4) · prototipo

Estado al 09-nov: motor en `packages/compose` y **cargado en la app detrás de una llave apagada** (pasos 1 y 2 del plan). Todavía no dibuja: el libro se sigue dibujando con DOM/CSS y el PDF sale de Chromium, así que los PDF de la autoprueba no cambian. Con la llave prendida, `composeReport()` mide la paridad con los cortes de Chromium (números más abajo).

## Qué hay

| Pieza | Qué hace |
|---|---|
| `src/shape.ts` | `loadFont(bytes)` y `shape(font, texto, { size, language, features })`: conformado con **HarfBuzz 15** compilado a WASM (paquete `harfbuzzjs` 1.6.4, MIT, del proyecto HarfBuzz). Devuelve glifos con id, cluster, avance y desplazamientos en puntos, y la marca de HarfBuzz *unsafe to break*. Aplica ligaduras, interletraje y rasgos OpenType (`liga`, `-calt`, `onum`…). |
| `src/hyphenate.ts` | `hyphenationPoints(palabra, { language, hyphenator, leftMin, rightMin })`: **la misma separación silábica que la app** (`LibroStudio/v3/app/hyphenation`: hyphen.js con patrones de TeX es/en/pt). En Node la carga `src/hyphenate-node.ts` con `require` (los archivos son UMD); en la página se pasa el separador que ya tiene cargado (`hyphenator`). El mínimo de letras a cada lado lo decide el motor (por defecto 2 y 3). |
| `src/browser.ts` / `src/index.ts` | Entrada para la página (sin nada de Node) y para Node (la misma, más la carga de la separación silábica). |
| `src/knuth-plass.ts` | `knuthPlass(ítems, opciones)`: cortes de línea de Knuth y Plass (los de TeX) sobre cajas, pegamentos y penalizaciones, con clases de ajuste, deméritos por línea, por guiones seguidos y por saltos de holgura entre líneas (valores por defecto de TeX: `\linepenalty` 10, `\hyphenpenalty` 50, `\doublehyphendemerits` y `\adjdemerits` 10000). |
| `src/paragraph.ts` | `createParagraph(font, texto, opciones)` arma los ítems: cada palabra se conforma entera y, si tiene puntos de corte, se parte en cajas por sílaba. `breakLines(párrafo, ancho, opciones)` corta, con sangría de primera línea opcional (`indent`) (Knuth-Plass con tolerancia 200 → 1000 → sin límite y, si nada sirve, el corte voraz con `fallback: true`) y devuelve líneas con la posición de cada glifo ya justificada, el ancho natural, la holgura, el ancho final del espacio, la relación de ajuste, la maldad y si termina en guion. Los trozos que quedan en el borde de una línea se vuelven a conformar tal cual quedan (con su guion), porque cortar puede deshacer una ligadura. `greedyBreaks` y `paragraphDemerits` sirven para comparar. |

Pruebas (`npm test --workspace @maquetario/compose`, con la DM Sans de la app y un párrafo del Quijote):

- ligadura "ffi" e interletraje "AV" de la fuente; medidas proporcionales al cuerpo;
- toda línea justificada termina exactamente en el ancho pedido, la última queda con espacios naturales, y el texto se recompone igual sin los guiones;
- en una medida de libro (300 y 340 pt a 10 pt, unos 55–65 caracteres) ningún espacio se estira más de lo previsto, y no hay "ríos obvios" (espacios agrandados un 25 % o más, alineados en 3 líneas seguidas);
- los guiones respetan el mínimo de letras (2/3 y 3/3) y el último glifo de la línea es el guion;
- en seis anchos de 180 a 340 pt, Knuth-Plass tiene siempre menos deméritos que el corte voraz (por ejemplo, 113 mil contra 5,3 millones a 260 pt) y su peor línea nunca es peor que la del voraz.

Lo que el prototipo **no** hace todavía: varias fuentes o estilos dentro de un párrafo, alineación en bandera (izquierda, centro, derecha) con su propio criterio de corte, tope de guiones seguidos (TeX sólo los encarece: en columnas muy angostas aparecen cuatro seguidos), largo mínimo de la última línea, márgenes ópticos, interletraje o escala de glifos para justificar, texto bidireccional y evitar ríos a propósito (Knuth-Plass no los mira: en columnas de unos 40 caracteres aparecen alineaciones de 4 o 5 espacios).

## Cómo se dibuja hoy

- **Pantalla:** `paper()` en `src/global/studio.ts` crea un `div` por objeto; en un cuadro de texto, el texto va como contenido del `div` con `font-family`, tamaño, interlineado y `text-align` en CSS. `paragraphs.ts` le agrega el formato por párrafo y `hyphenation-controls.ts` (`setHyphenatedText`) inserta guiones discrecionales (U+00AD) con `hyphens: manual`. **Los cortes de línea los decide Chromium**, primero-que-entra (como el corte voraz), y también la justificación (reparte el sobrante en los espacios de cada línea, sin mirar las demás).
- **Desborde:** `checkOverflow()` compara `scrollHeight` con `clientHeight`.
- **PDF:** `handlers/output.ts` imprime la página con `webContents.printToPDF`: el mismo DOM con estilos de impresión (`ui/book/print.css`). Chromium vuelve a cortar las líneas a la escala de impresión.
- **Fuentes:** el proceso principal lee el catálogo del sistema y de las carpetas elegidas (`desktop/src/main/fonts/catalog.ts` y `opentype.ts`) y las sirve en `maquetario://app/__fonts/<id>.ttf`; la página las registra con `FontFace` (`fonts.ts`). Un objeto guarda `font` (familia), y además `fontFaceId` y `fontAxes` cuando se eligió una cara concreta o un eje variable.

## Carga en la app (hecho)

- **Llave:** `localStorage.setItem('maquetario-compose', '1')` y recargar. Con la llave apagada (lo normal) la página no pide nada más: ni el módulo ni el WASM (verificado: `scripts/compose-parity.mjs` revisa `performance.getEntriesByType('resource')` con la llave apagada y prendida). Sólo existe la función `composeReport`, que explica cómo prender la llave.
- **Cómo se carga:** `src/compose-loader.ts` (dentro de `build/app.js`) hace `import()` de `build/compose.mjs`, con la dirección armada en tiempo de ejecución para que esbuild no lo meta en `app.js`. `build/compose.mjs` es un módulo ES aparte (`src/modules/compose.ts` → `desktop/scripts/build.mjs`, nueva tanda `src/modules/*.ts` en formato ESM) con `packages/compose` y HarfBuzz adentro (113 KB). `harfbuzz.wasm` (444 KB) se copia al lado, donde lo busca `harfbuzzjs` (`new URL('harfbuzz.wasm', import.meta.url)`).
- **CSP:**
  - `script-src 'self' 'wasm-unsafe-eval'`, en la cabecera (`desktop/src/main/protocol.ts`) y en el meta de `index.html`. Permite compilar WebAssembly; no habilita `eval` de JavaScript.
  - `connect-src` pasa de `'none'` a:
    - cabecera de Electron: `maquetario://app/build/harfbuzz.wasm maquetario://app/__fonts/`, sólo esos dos caminos;
    - meta de `index.html`: `'self'`, para el modo navegador (`scripts/serve-ui.cjs`).
  - Como valen las dos políticas a la vez, en Electron manda la de la cabecera. Sigue sin haber red.
  - `protocol.ts` sirve `.wasm` como `application/wasm`.
- **Fuentes:** con catálogo (Electron), la cara que resuelve `selectedFace(paragraphFormat)` se lee de `MaquetarioHost.fontUrl(id)` (`/__fonts/<id>.ttf`) y queda en caché por dirección. Sin catálogo (navegador), `composeReport({ fonts })` recibe "familia|peso|estilo" → archivo.

## Paridad con Chromium (medida)

`composeReport()` arma cada página con el mismo `paper(i, 96/25,4, true)` que usan la salida y la revisión del libro (fuera de la pantalla, como `preflightBook`), lee dónde empieza cada línea con `Range.getClientRects()` y compone cada párrafo con el motor al ancho de su caja (menos sangrías, con la sangría de primera línea y el mismo separador silábico que la página), con dos cortes:

- el **voraz** del motor, que imita lo que hace Chromium y sirve para medir si las medidas coinciden;
- el **Knuth-Plass**, que muestra lo que cambiaría al dibujar con el motor.

Informa por párrafo y en total:
- líneas iguales (mismo comienzo y final);
- párrafos idénticos;
- diferencia de cantidad de líneas;
- desborde de cada caja según Chromium y según el motor.

Saltea, contando el motivo:
- los párrafos sin cara del catálogo;
- la negrita o cursiva inventada por el navegador;
- los ejes variables;
- el interletraje;
- los espacios múltiples.

Corrida en Chrome sin ventana (`node desktop/scripts/build.mjs && node scripts/compose-parity.mjs`), con Georgia de Windows, que es la que usa el navegador para el mismo texto:

| Libro | Párrafos medidos | Líneas Chromium | Voraz: párrafos idénticos | Voraz: líneas iguales | Knuth-Plass: párrafos idénticos | Knuth-Plass: líneas iguales | Knuth-Plass: diferencia de líneas | Cajas: desborde distinto |
|---|---|---|---|---|---|---|---|---|
| Libro de muestra | 4 | 15 | 4 / 4 | 15 / 15 | 1 / 4 | 1 / 15 | +1 en uno, −1 en otro | 0 de 3 |
| Novela de la autoprueba | 85 | 279 | 80 / 85 | 265 / 280 | 47 / 85 | 162 / 274 | −1 en 5 párrafos | 0 de 30 |
| La novela con separación silábica | 85 | 275 | 80 / 85 | 260 / 275 | 40 / 85 | 96 / 268 | −1 en 7 párrafos | 0 de 30 |

Lo que se lee:
- **Las medidas coinciden.** Con el mismo criterio de corte, el motor reproduce a Chromium en 164 de 174 párrafos, también con separación silábica. Los 10 que difieren son de dos tipos:
  - **Rayas de diálogo:** 2 párrafos por versión de la novela. Chromium corta después de una raya (Unicode lo permite) y deja "casas —" al final de una línea o empieza una con ". Pero". El motor sólo corta en espacios y en guiones de sílaba, y mantiene "—dijo—." junto, que es lo correcto en castellano.
  - **Líneas al borde,** por menos de 0,1 px (0,07 pt): el motor mide la línea apenas más ancha que el espacio y pasa una palabra o sílaba a la siguiente; Chromium la deja. Las tres que revisé entran si cada avance de glifo se trunca a 1/64 de píxel. Eso sugiere que Chromium mide en esa unidad (*LayoutUnit*), pero no está verificado en su código.
- **Knuth-Plass cambia mucho:** sólo la mitad de los párrafos queda igual. En la novela nunca alarga un párrafo y en 5 a 7 ahorra una línea; en el libro de muestra alarga uno y acorta otro. Al dibujar con el motor, el libro se va a ver distinto a propósito. Ninguna caja cambia de "desborda" a "no desborda" en estos libros (no hay cajas llenas al límite).
- Tiempo: 20 a 80 ms por libro, con la carga de las fuentes.

## Qué falta para dibujar con el motor

1. Tramos con distinto estilo dentro de un párrafo. Hoy el motor compone el párrafo con su formato; la app no tiene estilos de carácter, pero sí índices y figuras que conviene excluir.
2. Ejes variables (`hb.Font.setVariations` con `fontAxes`), interletraje (`tracking`) y colecciones `.ttc` con su índice.
3. Cortes en rayas y guiones de palabra compuesta según las reglas del castellano, en vez de los de Unicode.
4. El dibujo en sí (paso 4 del plan): líneas posicionadas en `paper()` con `extend.result('paper', …)` detrás de la llave, el desborde por cuenta de líneas, y la autoprueba con la llave apagada (PDF idénticos) más una corrida con la llave prendida para revisar a ojo.
5. Probar la llave en Electron: la carga del WASM con la CSP de la cabecera (caminos `maquetario://app/…`) no se pudo probar acá; ver Riesgos.

## Cómo se enchufaría

La idea es que el motor decida **qué va en cada línea y dónde va cada palabra**, y que el dibujo sólo coloque lo que el motor ya midió.

1. **Medir con el motor, dibujar con DOM (primer paso).** Por cada cuadro de texto, `breakLines` con el ancho del cuadro en puntos. Cada línea se dibuja como un bloque propio en su `top` (interlineado × número de línea), con cada palabra en su `left` (o la línea con `white-space: pre` y `word-spacing` igual al espacio calculado). Chromium sigue conformando las palabras, también con HarfBuzz y sobre el mismo archivo de fuente, así que dentro de la palabra el resultado es el mismo. Lo que cambia es que ya no corta ni justifica él. El PDF sigue saliendo de `printToPDF` con ese mismo DOM, así que **pantalla y PDF tienen los mismos cortes** a cualquier escala (hoy pueden diferir porque Chromium corta a la escala de cada uno).
2. **El desborde y el encadenado salen de la cuenta de líneas** (líneas × interlineado contra el alto del cuadro), sin `scrollHeight`.
3. **PDF propio (la otra mitad de la etapa 4).** Con las mismas líneas se escribe el PDF directamente (pdf-lib ya está en la app): fuentes recortadas (el paquete trae `harfbuzz-subset.wasm`), ids de glifo y posiciones exactas, MediaBox/TrimBox/BleedBox correctas, CMYK y PDF/X. Ahí Chromium deja de intervenir en el libro impreso.

**Mientras se edita** el cuadro sigue siendo `contenteditable` con el corte de Chromium, como hoy con la separación silábica (se muestra el manuscrito y se vuelve a componer al terminar de editar).

### Qué cambia

- **En pantalla:** párrafos más parejos (menos líneas flojas, menos guiones seguidos, sin una línea muy apretada debajo de una muy floja). Los cortes ya no dependen del zoom. Los guiones respetan un mínimo de letras configurable.
- **En el PDF:** en el paso 1, los mismos cortes que en pantalla y la misma justificación. En el paso 3, el PDF deja de depender de Chromium: se corrige de paso el error de 0,1–0,3 mm del tamaño de hoja (`arquitectura.md` → problemas conocidos).
- **En la autoprueba:** los PDF de los libros con el motor **cambian a propósito** (otros cortes). Por eso conviene una llave: el motor se activa por libro o por cuadro, y la autoprueba compara los PDF con la llave apagada (idénticos a los de hoy) y aparte guarda los PDF con el motor para revisarlos a ojo.

## Riesgos

- **WASM bajo la CSP de la app (resuelto con el módulo aparte; falta probarlo en Electron).** Se eligió el motor en la página (ver "Carga en la app"): el dibujo es sincrónico y no conviene un viaje al proceso principal por párrafo. En el navegador está probado. En Electron, la cabecera limita `connect-src` a `maquetario://app/build/harfbuzz.wasm` y `maquetario://app/__fonts/`. Si Chromium no aplicara bien los caminos en un esquema propio, el motor no cargaría (con la llave apagada no cambia nada) y la salida es `connect-src 'self'`, que tampoco abre la red. Hay que mirarlo en la primera corrida con la llave prendida (`[motor de composición]` en la consola).
- **Que el motor y Chromium usen la misma fuente.** El motor necesita el archivo exacto. Hoy un objeto puede tener sólo una familia (`Georgia`) y CSS elige la cara, o cae en otra fuente si falta, o **inventa** la negrita o la cursiva si la familia no las tiene (`fontWeight: 700` sin cara negrita). El motor no puede medir lo que Chromium inventa. Para usar el motor, el texto tiene que resolver a una cara concreta del catálogo (`selectedFace` → `fontFaceId`); si no resuelve, ese cuadro se queda con CSS.
- **Fuentes del sistema.**
  - El identificador de cara (`opentype.ts → faceId`) depende de la ruta y de la fecha del archivo: si el sistema actualiza la fuente, cambia el id y también pueden cambiar las métricas, y con ellas los cortes de un libro ya armado. Conviene guardar en el libro un resumen de la fuente usada (versión de la tabla `head`) y avisar si cambió.
  - Las colecciones `.ttc` llevan índice de cara (`loadFont(bytes, index)`). Las variables necesitan aplicar `fontAxes` al `hb.Font` (`setVariations`), igual que hoy `font-variation-settings` en CSS. Si no, mide la instancia por defecto.
  - Para el PDF propio, el permiso de incrustación de la fuente (`OS/2 fsType`): hay fuentes del sistema que no se pueden incrustar ni recortar.
  - Windows: el catálogo no lee el registro (problema conocido), así que una fuente instalada sólo por registro existe para CSS pero no para el motor.
- **Memoria y velocidad.** El WASM pesa 444 KB y cada fuente se carga una vez (se queda en memoria de WASM: hay que liberar las que no se usan). Conformar palabra por palabra en cada dibujo es caro en libros de 200 páginas: hace falta una caché por (cara, cuerpo, rasgos, palabra) y recomponer sólo los párrafos que cambiaron.
- **Diferencias finas de medida.** Chromium redondea posiciones a la escala de pantalla. En el paso 1, colocar cada palabra en su `left` evita que el error se acumule a lo largo de la línea.
- **Licencias.** `harfbuzzjs` (MIT) y HarfBuzz (licencia "Old MIT") se suman a `LibroStudio/v3/app/licenses/` cuando el motor entre en el instalador.

## Plan por pasos

1. **(Hecho)** Prototipo y pruebas: `packages/compose`.
2. **(Hecho, falta probar en Electron)** Carga en la app: módulo ES del motor detrás de una llave, CSP con `'wasm-unsafe-eval'` y `connect-src` acotado, bytes de fuente desde `/__fonts/<id>.ttf`, caché de `ComposeFont` por dirección, y `composeReport()` para medir la paridad. Pendiente: ejes variables y memoria con el catálogo completo.
3. **Adaptador del modelo** (empezado en `composeReport`: cuerpo, sangrías, sangría de primera línea, alineación, separación silábica e idioma): de `BookObject` + `paragraphFormat` (cuerpo, interlineado, sangría, espacio antes y después, alineación, separación silábica e idioma) a párrafos del motor, con tramos de distinto estilo dentro del párrafo (extender `createParagraph` a varios tramos).
4. **Dibujo con llave** (por libro, en beta): líneas posicionadas en `paper()` mediante `extend.result('paper', …)` sin tocar el camino de hoy. Desborde por cuenta de líneas. Autoprueba con la llave apagada (PDF idénticos) y una corrida aparte con la llave prendida para revisar.
5. **Calidad tipográfica:** bandera izquierda/centro/derecha, tope de guiones seguidos y largo mínimo de la última línea (como en InDesign), viudas y huérfanas al encadenar cuadros, márgenes ópticos, y después interletraje y escala de glifos dentro de un rango para justificar mejor.
6. **PDF propio** con las mismas líneas (pdf-lib + subset de HarfBuzz), MediaBox/TrimBox/BleedBox exactas, y después CMYK y PDF/X.
7. Con los PDF revisados con Seba, la llave pasa a prendida por defecto y el camino de Chromium queda para la vista mientras se edita.
