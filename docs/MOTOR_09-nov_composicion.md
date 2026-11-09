# Motor de composición propio (etapa 4) · prototipo

Estado al 09-nov: **prototipo aislado** en `packages/compose`. La app no lo usa todavía: el libro se sigue dibujando con DOM/CSS y el PDF sale de Chromium, así que los PDF de la autoprueba no cambian.

## Qué hay

| Pieza | Qué hace |
|---|---|
| `src/shape.ts` | `loadFont(bytes)` y `shape(font, texto, { size, language, features })`: conformado con **HarfBuzz 15** compilado a WASM (paquete `harfbuzzjs` 1.6.4, MIT, del proyecto HarfBuzz). Devuelve glifos con id, cluster, avance y desplazamientos en puntos, y la marca de HarfBuzz *unsafe to break*. Aplica ligaduras, interletraje y rasgos OpenType (`liga`, `-calt`, `onum`…). |
| `src/hyphenate.ts` | `hyphenationPoints(palabra, { language, leftMin, rightMin })`: **la misma separación silábica que la app** (`LibroStudio/v3/app/hyphenation`: hyphen.js con patrones de TeX es/en/pt), cargada con `require` porque los archivos son UMD. El mínimo de letras a cada lado lo decide el motor (por defecto 2 y 3). |
| `src/knuth-plass.ts` | `knuthPlass(ítems, opciones)`: cortes de línea de Knuth y Plass (los de TeX) sobre cajas, pegamentos y penalizaciones, con clases de ajuste, deméritos por línea, por guiones seguidos y por saltos de holgura entre líneas (valores por defecto de TeX: `\linepenalty` 10, `\hyphenpenalty` 50, `\doublehyphendemerits` y `\adjdemerits` 10000). |
| `src/paragraph.ts` | `createParagraph(font, texto, opciones)` arma los ítems: cada palabra se conforma entera y, si tiene puntos de corte, se parte en cajas por sílaba. `breakLines(párrafo, ancho, opciones)` corta (Knuth-Plass con tolerancia 200 → 1000 → sin límite y, si nada sirve, el corte voraz con `fallback: true`) y devuelve líneas con la posición de cada glifo ya justificada, el ancho natural, la holgura, el ancho final del espacio, la relación de ajuste, la maldad y si termina en guion. Los trozos que quedan en el borde de una línea se vuelven a conformar tal cual quedan (con su guion), porque cortar puede deshacer una ligadura. `greedyBreaks` y `paragraphDemerits` sirven para comparar. |

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

- **WASM bajo la CSP de la app.** La página tiene `script-src 'self'` y `connect-src 'none'` (`desktop/src/main/protocol.ts` e `index.html`). HarfBuzz necesita compilar WebAssembly (`'wasm-unsafe-eval'`) y leer su `.wasm` y los bytes de cada fuente. Además, `harfbuzzjs` usa `await` de nivel superior e `import.meta.url`, y las entradas de la interfaz se compilan como IIFE. Hay dos salidas:
  - **El motor en la página:** agregar `'wasm-unsafe-eval'` y `connect-src 'self'` sólo para el `.wasm` y `/__fonts/`, y compilar el motor como módulo ES aparte. Es la recomendada, porque el dibujo es sincrónico y no conviene un viaje al proceso principal por párrafo.
  - **El motor en el proceso principal:** ahí ya están los bytes de las fuentes y no hace falta tocar la CSP, pero el dibujo pasa a esperar una respuesta por párrafo; serviría con una caché de líneas.
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
2. **Carga en la app:** módulo ES del motor, CSP con `'wasm-unsafe-eval'` y `connect-src 'self'` acotado, bytes de fuente desde `/__fonts/<id>.ttf`, caché de `ComposeFont` por `fontFaceId` con ejes variables. Probar el arranque y la memoria con el catálogo completo.
3. **Adaptador del modelo:** de `BookObject` + `paragraphFormat` (cuerpo, interlineado, sangría, espacio antes y después, alineación, separación silábica e idioma) a párrafos del motor, con tramos de distinto estilo dentro del párrafo (extender `createParagraph` a varios tramos).
4. **Dibujo con llave** (por libro, en beta): líneas posicionadas en `paper()` mediante `extend.result('paper', …)` sin tocar el camino de hoy. Desborde por cuenta de líneas. Autoprueba con la llave apagada (PDF idénticos) y una corrida aparte con la llave prendida para revisar.
5. **Calidad tipográfica:** bandera izquierda/centro/derecha, tope de guiones seguidos y largo mínimo de la última línea (como en InDesign), viudas y huérfanas al encadenar cuadros, márgenes ópticos, y después interletraje y escala de glifos dentro de un rango para justificar mejor.
6. **PDF propio** con las mismas líneas (pdf-lib + subset de HarfBuzz), MediaBox/TrimBox/BleedBox exactas, y después CMYK y PDF/X.
7. Con los PDF revisados con Seba, la llave pasa a prendida por defecto y el camino de Chromium queda para la vista mientras se edita.
