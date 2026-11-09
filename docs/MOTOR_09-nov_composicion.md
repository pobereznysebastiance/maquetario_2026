# Motor de composición propio (etapa 4) · prototipo

Estado al 09-nov: motor en `packages/compose` y **cargado en la app detrás de una llave apagada** (pasos 1 y 2 del plan). Todavía no dibuja: el libro se sigue dibujando con DOM/CSS y el PDF sale de Chromium, así que los PDF de la autoprueba no cambian. Con la llave prendida, `composeReport()` mide la paridad con los cortes de Chromium (números más abajo). En Electron, la carga del WASM y la CSP quedaron probadas (hay que reiniciar la app para que tome la CSP nueva).

## Qué hay

| Pieza | Qué hace |
|---|---|
| `src/shape.ts` | `loadFont(bytes, índice)` y `shape(font, texto, { size, language, features, letterSpacing })`: conformado con **HarfBuzz 15** compilado a WASM (paquete `harfbuzzjs` 1.6.4, MIT, del proyecto HarfBuzz). Devuelve glifos con id, cluster, avance y desplazamientos en puntos, y la marca de HarfBuzz *unsafe to break*. Aplica ligaduras, interletraje y rasgos OpenType (`liga`, `-calt`, `onum`…). El índice elige la cara de una colección `.ttc`. `letterSpacing` agrega espacio después de cada carácter y apaga las ligaduras optativas, como el navegador. `withVariations(font, { wght, wdth, opsz… })` da la instancia de una fuente variable: ignora los ejes que no tiene, limita los valores a su rango y queda en caché. |
| `src/hyphenate.ts` | `hyphenationPoints(palabra, { language, hyphenator, leftMin, rightMin })`: **la misma separación silábica que la app** (`LibroStudio/v3/app/hyphenation`: hyphen.js con patrones de TeX es/en/pt). En Node la carga `src/hyphenate-node.ts` con `require` (los archivos son UMD); en la página se pasa el separador que ya tiene cargado (`hyphenator`). El mínimo de letras a cada lado lo decide el motor (por defecto 2 y 3). |
| `src/browser.ts` / `src/index.ts` | Entrada para la página (sin nada de Node) y para Node (la misma, más la carga de la separación silábica). |
| `src/knuth-plass.ts` | `knuthPlass(ítems, opciones)`: cortes de línea de Knuth y Plass (los de TeX) sobre cajas, pegamentos y penalizaciones, con clases de ajuste, deméritos por línea, por guiones seguidos y por saltos de holgura entre líneas (valores por defecto de TeX: `\linepenalty` 10, `\hyphenpenalty` 50, `\doublehyphendemerits` y `\adjdemerits` 10000). Dos reglas opcionales, como en InDesign: `maxConsecutiveHyphens` (tope de líneas seguidas con guion) y `minLastLine` (largo mínimo de la última línea). Si con ellas no hay solución, `breakLines` compone sin ellas y avisa (`relaxed: true`). |
| `src/paragraph.ts` | `createParagraph(font, texto, opciones)` arma los ítems: cada palabra se conforma entera y, si tiene puntos de corte, se parte en cajas por sílaba. Aplica las reglas de corte del castellano (ver abajo). `breakLines(párrafo, ancho, opciones)` corta, con sangría de primera línea opcional (`indent`) (Knuth-Plass con tolerancia 200 → 1000 → sin límite y, si nada sirve, el corte voraz con `fallback: true`) y devuelve líneas con la posición de cada glifo ya justificada, el ancho natural, la holgura, el ancho final del espacio, la relación de ajuste, la maldad y si termina en guion. Los trozos que quedan en el borde de una línea se vuelven a conformar tal cual quedan (con su guion), porque cortar puede deshacer una ligadura. `greedyBreaks` y `paragraphDemerits` sirven para comparar. |

Pruebas (`npm test --workspace @maquetario/compose`, con la DM Sans de la app y un párrafo del Quijote):

- ligadura "ffi" e interletraje "AV" de la fuente; medidas proporcionales al cuerpo;
- toda línea justificada termina exactamente en el ancho pedido, la última queda con espacios naturales, y el texto se recompone igual sin los guiones;
- en una medida de libro (300 y 340 pt a 10 pt, unos 55–65 caracteres) ningún espacio se estira más de lo previsto, y no hay "ríos obvios" (espacios agrandados un 25 % o más, alineados en 3 líneas seguidas);
- los guiones respetan el mínimo de letras (2/3 y 3/3) y el último glifo de la línea es el guion;
- en seis anchos de 180 a 340 pt, Knuth-Plass tiene siempre menos deméritos que el corte voraz (por ejemplo, 113 mil contra 5,3 millones a 260 pt) y su peor línea nunca es peor que la del voraz;
- interletraje: suma lo pedido después de cada carácter y apaga la ligadura "ffi";
- rayas de diálogo, en 45 anchos y con los dos cortes: ninguna línea empieza con puntuación ni deja una raya suelta en el borde, y sólo termina en raya la de cierre ("dijo—");
- compuestas: al cortar "franco-argentino", la línea siguiente empieza con "-argentino" y ese guion es un glifo de guion;
- con `maxConsecutiveHyphens: 2` nunca hay más de dos guiones seguidos (sin el tope había hasta cuatro), y con `minLastLine` la última línea alcanza el mínimo; un párrafo de una sola línea no se mide;
- con fuentes del sistema, si están (Windows): Bahnschrift variable (el eje `wdth` cambia los anchos, los ejes que no tiene se ignoran, los valores se limitan al rango) y Cambria `.ttc` (las caras 0 y 1 son distintas). Donde no están, esas dos pruebas se saltean.

**Reglas de corte del castellano** (`createParagraph`):
- dentro de una palabra sólo se corta por sílaba (agrega un guion) o en el guion de una palabra compuesta, y entonces el guion se repite al comienzo de la línea siguiente, como recomienda la RAE ("franco-" / "-argentino");
- nunca después de una raya o un guion de rango pegados ("—dijo—.", "1990–2000"): la raya de apertura no queda al final de línea ni la de cierre al comienzo;
- una raya suelta, entre espacios, queda pegada a sus vecinas;
- el espacio duro (U+00A0) no corta.

Lo que el prototipo **no** hace todavía: varias fuentes o estilos dentro de un párrafo, alineación en bandera (izquierda, centro, derecha) con su propio criterio de corte, márgenes ópticos, interletraje o escala de glifos para justificar, texto bidireccional y evitar ríos a propósito (Knuth-Plass no los mira: en columnas de unos 40 caracteres aparecen alineaciones de 4 o 5 espacios).

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
- **Fuentes:**
  - Con catálogo (Electron), la cara que resuelve `selectedFace(paragraphFormat)` se lee de `MaquetarioHost.fontUrl(id)` (`/__fonts/<id>.ttf`) y queda en caché por dirección.
  - El proceso principal ya entrega una cara suelta aunque venga de una colección `.ttc` (`opentype.ts → faceBytes`).
  - Sin catálogo (navegador), `composeReport({ fonts })` recibe "familia|peso|estilo" → archivo. En una colección, la cara va con `#`: `cambria.ttc#0`.
  - Las caras variables se componen con los mismos ejes que usa Chromium: `wght` del peso CSS, `wdth` 100 y `opsz` igual al cuerpo en px (`font-optical-sizing: auto`). Encima van los `fontAxes` del párrafo (`font-variation-settings`).
  - El interletraje del párrafo (`tracking`, en milésimas de eme) pasa como `letterSpacing`.

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
- los espacios múltiples.

Ya no saltea los ejes variables, el interletraje ni las colecciones.

Además del voraz con las medidas exactas, compone un **voraz con el cuerpo como lo usa Chromium** (ver "Medida") y separa las diferencias **esperadas**: párrafos en los que Chromium corta donde el castellano no deja (después de una raya pegada, junto a una raya suelta). Ahí el motor hace lo correcto a propósito, y el informe cuenta esos cortes por motivo (`chromiumForbiddenBreaks`).

Corrida en Chrome sin ventana (`node desktop/scripts/build.mjs && node scripts/compose-parity.mjs`), con los archivos de Windows que usa el navegador para el mismo texto. Para la fuente variable, Bahnschrift se registra como `FontFace` desde el archivo, igual que en la app. Con la fuente del sistema, Chromium en Windows ignora `font-variation-settings` y sólo usa las instancias con nombre de Bahnschrift.

| Libro | Párrafos | Líneas Chromium | Voraz exacto: idénticos | Voraz con cuerpo de Chromium: idénticos (esperadas / sin explicar) | Knuth-Plass: idénticos · diferencia de líneas | Cajas: desborde distinto |
|---|---|---|---|---|---|---|
| Libro de muestra (Georgia) | 4 | 15 | 4 / 4 | 4 / 4 (0 / 0) | 1 / 4 · +1 en uno, −1 en otro | 0 de 3 |
| Novela de la autoprueba (Georgia) | 85 | 279 | 80 / 85 | **83 / 85 (2 / 0)** | 47 / 85 · −1 en 5 | 0 de 30 |
| … con separación silábica | 85 | 275 | 80 / 85 | **83 / 85 (2 / 0)** | 40 / 85 · −1 en 7 | 0 de 30 |
| … con interletraje 30/1000 | 85 | 291 | 83 / 85 | **84 / 85 (1 / 0)** | 37 / 85 · −1 en 6 | 0 de 30 |
| … en Bahnschrift variable, `wdth` 85 | 85 | 242 | 85 / 85 | **85 / 85 (0 / 0)** | 48 / 85 · −1 en 5 | 0 de 30 |
| … en Cambria, cara 0 de `cambria.ttc` | 85 | 264 | 83 / 85 | **84 / 85 (1 / 0)** | 46 / 85 · +1 en uno, −1 en 6 | 0 de 30 |

Lo que se lee:
- **Paridad completa salvo lo esperado.** Con el cuerpo como lo usa Chromium, el voraz del motor reproduce a Chromium en todos los párrafos menos los de rayas de diálogo, donde difiere a propósito. En la novela son 83 de 85: los 2 restantes son las dos rayas. No queda ninguna diferencia sin explicar en ninguna de las seis corridas.
- **Rayas:** Chromium corta después de una raya pegada (Unicode lo permite). Deja "casas —" al final de una línea o empieza una con ". Pero". El motor mantiene "—dijo—." junto.
- **Interletraje, ejes variables y colecciones** dan la misma paridad que la fuente común.
- **Knuth-Plass cambia mucho, a propósito:**
  - sólo la mitad de los párrafos queda igual;
  - casi siempre ahorra una línea o deja la cantidad igual;
  - en el libro de muestra y en Cambria alarga un párrafo.
- **Desborde:** ninguna caja cambia de "desborda" a "no desborda" en estos libros, porque no hay cajas llenas al límite.
- **Tiempo:** de 20 a 160 ms por libro, con la carga de las fuentes.

## Medida: cómo mide Chromium

La hipótesis anterior (Chromium trunca cada avance a 1/64 de píxel) **era falsa**.

**Primera medición: el avance de cada letra.** Midiendo en Chrome sin ventana el ancho de 64 o 256 letras iguales, sin interletraje ni ligaduras (`--eval`), los avances de Chromium no caen en múltiplos de 1/64 px. Salen todos más chicos que los de HarfBuzz en la misma proporción: por ejemplo, ×0,99955 a 11 pt en Georgia.

**Segunda medición: varios cuerpos y fuentes.** Con Georgia, Times New Roman y Arial en cuerpos de 8 a 48 pt, el cuerpo que explica los anchos de Chromium es **el tamaño en px truncado a centésimas**:

| Cuerpo pedido | Cuerpo efectivo |
|---|---|
| 11 pt = 14,6667 px | 14,66 px |
| 10 pt = 13,3333 px | 13,33 px |
| 8 pt = 10,6667 px | 10,66 px |
| 16 pt = 21,3333 px | 21,33 px |
| 9, 10,5, 12, 24 y 48 pt (px exactos) | sin cambio |

Es igual en las tres fuentes. No encontré en qué parte del código de Chromium pasa: es una medición, hecha con Chrome en Windows (DirectWrite). Puede ser distinta en macOS y Linux.

**Resultado:** el voraz con ese cuerpo pasa de 80 a 83 de 85 en la novela, y los 2 que quedan son las rayas. Para el dibujo esto importa poco: el motor va a decidir los cortes con sus medidas exactas. Pero conviene usar el mismo cuerpo truncado si en el paso 1 Chromium sigue dibujando las palabras, para que no queden 0,1 px de diferencia por línea.

## Qué falta para dibujar con el motor

1. Tramos con distinto estilo dentro de un párrafo. Hoy el motor compone el párrafo con su formato; la app no tiene estilos de carácter, pero sí índices y figuras que conviene excluir.
2. El dibujo en sí (paso 4 del plan): líneas posicionadas en `paper()` con `extend.result('paper', …)` detrás de la llave, el desborde por cuenta de líneas, y la autoprueba con la llave apagada (PDF idénticos) más una corrida con la llave prendida para revisar a ojo.
3. Usar en la app el tope de guiones y el largo mínimo de la última línea: hoy son opciones del motor sin control en la interfaz. Hay que decidir los valores por defecto con Seba.
4. Confirmar en macOS y Linux la regla del cuerpo truncado.

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

- **WASM bajo la CSP de la app (resuelto y probado en Electron).** Se eligió el motor en la página (ver "Carga en la app"): el dibujo es sincrónico y no conviene un viaje al proceso principal por párrafo. En Electron, la cabecera limita `connect-src` a `maquetario://app/build/harfbuzz.wasm` y `maquetario://app/__fonts/`; el WASM cargó y la red siguió bloqueada. Después de cambiar la CSP hay que reiniciar la app (Ctrl+R no alcanza).
- **El cuerpo truncado es una medición, no una regla documentada de Chromium** (ver "Medida"). Si cambia con otra versión de Chromium u otro sistema, `composeReport` lo va a mostrar como diferencias sin explicar.
- **Fuentes variables del sistema en el navegador común:** Chromium en Windows ignora `font-variation-settings` con la fuente instalada y sólo usa sus instancias con nombre. En la app no pasa, porque las caras se registran como `FontFace` desde los bytes.
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
2. **(Hecho y probado en Electron)** Carga en la app: módulo ES del motor detrás de una llave, CSP con `'wasm-unsafe-eval'` y `connect-src` acotado, bytes de fuente desde `/__fonts/<id>.ttf`, caché de `ComposeFont` por dirección, y `composeReport()` para medir la paridad. Ejes variables, interletraje y colecciones, también. Pendiente: la memoria con el catálogo completo.
3. **Adaptador del modelo** (empezado en `composeReport`: cuerpo, sangrías, sangría de primera línea, alineación, separación silábica e idioma): de `BookObject` + `paragraphFormat` (cuerpo, interlineado, sangría, espacio antes y después, alineación, separación silábica e idioma) a párrafos del motor, con tramos de distinto estilo dentro del párrafo (extender `createParagraph` a varios tramos).
4. **Dibujo con llave** (por libro, en beta): líneas posicionadas en `paper()` mediante `extend.result('paper', …)` sin tocar el camino de hoy. Desborde por cuenta de líneas. Autoprueba con la llave apagada (PDF idénticos) y una corrida aparte con la llave prendida para revisar.
5. **Calidad tipográfica:** reglas de corte del castellano, tope de guiones seguidos y largo mínimo de la última línea (hechos en el motor); falta bandera izquierda/centro/derecha, viudas y huérfanas al encadenar cuadros, márgenes ópticos, y después interletraje y escala de glifos dentro de un rango para justificar mejor.
6. **PDF propio** con las mismas líneas (pdf-lib + subset de HarfBuzz), MediaBox/TrimBox/BleedBox exactas, y después CMYK y PDF/X.
7. Con los PDF revisados con Seba, la llave pasa a prendida por defecto y el camino de Chromium queda para la vista mientras se edita.
