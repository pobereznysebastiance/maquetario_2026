# Interfaz · revisión después de pasar a React (09-nov)

> **Método.** Revisión en un solo contexto con la skill impeccable (crítica + auditoría), igual que la del 08-nov: no la separé en subagentes porque hay un solo navegador de prueba y dos agentes manejándolo a la vez rompen los estados. Recorrí 32 estados (bienvenida, editor con cada pestaña del inspector, vistas del riel, plantillas, sin libro, confirmaciones, Hojas y Ventanas de trabajo, tutorial) en **1366×768 y 1180×720**, en **castellano e inglés**: unas 100 capturas con `scripts/serve-ui.cjs` y Chrome sin ventana por CDP. Además hice mediciones del DOM (tamaños, desplazamiento interno, nombres accesibles, etiquetas, objetivos chicos, foco al abrir) y una búsqueda de textos en castellano con la interfaz en inglés. Base: `version-juan` en 94da0b9.
>
> **Límites.** Sin Electron: no hay Mica (los paneles se ven más claros), no hay fuentes del sistema ni archivos de fuente (Elegí una tipografía y Glifos salen vacíos: lo marco "verificar en Electron") y no probé avisos (toasts), recuperación al abrir, modo foco ni vista previa. El detector estático de impeccable (`detect` sobre `index.html`, `src/` y `ui/`) da **0 hallazgos**, como el 08-nov: el marcado lo arma React en tiempo de ejecución y el detector no tiene qué mirar. El detector del navegador no corrió.
>
> Capturas en `docs/capturas/09-nov/` (sólo las que muestran un hallazgo).

## 1. Resumen

La migración cumplió lo grande. El estado de guardado dice la verdad, el inspector tiene 3 pestañas, Índice y Capas viven en el riel, hay tres tipos de diálogo con nombre accesible y una sola puerta de Ayuda. Además, la página ganó lugar: **el lienzo es el 45 % de la ventana en 1366×768 (antes 36 %) y el 41 % en 1180×720**. Lo que quedó flojo no es de arquitectura sino de terminación: textos que nombran pestañas que ya no existen, pantallas hechas por agentes distintos que resuelven igual cosas distintas (dos avisos de cambios sin guardar, dos "Página 9" en la misma pestaña), restos del editor cuando no hay libro y algunos textos en castellano con la interfaz en inglés.

**Los 5 hallazgos más importantes**

1. **Textos que mandan a pestañas que ya no existen** (bloquea). Seis textos del tutorial, la Ayuda y los diálogos dicen "en Diseño", "en Objeto", "en Texto", "en Páginas" o "en Texto y Capas". Un alumno que sigue el tutorial busca algo que no está. El arreglo es reescribir 6 cadenas.
2. **Sin libro, el editor muestra datos falsos** (bloquea). Dice "Capas · 1 / Esta página no tiene objetos" y "Página 1 de 2", deja un punto suelto y "Imán" en la barra del documento y el inspector en blanco. Revisar libro, Configurar libro y el Asistente siguen habilitados.
3. **Dos avisos distintos para "cambios sin guardar"** (conviene). Al cerrar aparece "¿Guardamos tu libro?" con "Cerrar sin guardar" (neutro). Al armar otro libro aparece "Tu libro tiene cambios sin guardar" con "Descartar cambios" (rojo). Es el momento de más confianza de la app y hoy lo resuelven dos agentes de dos maneras.
4. **Inglés incompleto** (conviene). El selector de capítulos del tutorial queda en castellano ("4. Construir la grilla" bajo "4. Build the grid"). Siete nombres accesibles o ayudas emergentes siguen en castellano: las vistas del riel, los tres bordes de panel, "Sección general", "Cuerpo del texto" y el ejemplo "Ej.: Capítulo 2".
5. **El inspector y el riel todavía no hablan igual** (conviene). La pestaña Página tiene dos secciones que se llaman "Página 9" (una dorada y otra blanca). Al elegir un Marco aparece la ayuda sobre la alineación del texto de una caja. Los títulos de sección quedan 20 px más adentro que los campos. Índice y Capas aparecen dos veces en el riel (como herramientas y como pestañas), y el riel cambia de ancho (184 ↔ 248 px) según la vista, así que la página salta 64 px.

**Puntaje (heurísticas de Nielsen): 27/40** (el 08-nov fue 23/40). **Auditoría técnica: 15/20** (el 08-nov fue 11/20). Detalle en §5.

## 2. Qué pasó con la revisión del 08-nov

| Hallazgo | Estado | Qué queda |
|---|---|---|
| C1 Guardado que miente | **Resuelto** | La barra de estado muestra "Cambios sin guardar" y "Guardado en tu equipo" según corresponde. |
| C2 Ventana más alta que la notebook | **Resuelto** en el código | El tamaño inicial y el mínimo salen de la pantalla (`main.ts`). Falta probarlo en un equipo de 1366×768 real. |
| C3 La página no manda | **Mejoró mucho** | El lienzo pasó de 36 % a 45 % (1366) y la ruta 1–5 ya no está. Las plantillas están plegadas (48 px) y desplegadas ocupan 140 px. Quedan la marca de página activa (ver A4) y la pista del lienzo. |
| A1 Componentes que no se usan | **Resuelto** en lo migrado | No volví a contar lo que sigue armado a mano. |
| A2 El dorado significa todo | **Parcial** | El zoom, los subtítulos de las plantillas y los encabezados de tablas ya son neutros. Siguen en dorado: "Página activa 9" (barra y papel), el título "Página 9" de la pestaña Página, el aviso "Desactivado para todo el libro", la chispa y el doble anillo del tutorial. |
| A3 Rasgos de "panel de IA" | **Parcial** | Ya no están la ruta en círculos, el número grande ni las etiquetas en mayúsculas. Siguen la chispa ✦ (barra y estado vacío del asistente), los pasos falsos "1 · Datos · 2 · Partes y manuscrito · 3 · Crear y revisar" del armador y la bienvenida tipo portada (decisión, ver P5). |
| A4 La interfaz pinta sobre el papel | **Sin decidir** | "Página activa 9" aparece tres veces: en la barra del documento, en el rótulo sobre el papel y en la barra de estado (P1). |
| A5 Inspector | **Casi resuelto** | Tiene 3 pestañas con su patrón de pestañas. Quedan: el título de sección desalineado (N7), la tarjeta anidada de "Separación silábica", los selectores cortados ("Márgenes …", "Todos los párra…", "Título de c…"), el consejo fijo al pie y unidades dentro de la etiqueta en la hoja Configuración del libro ("Ancho · mm"). |
| A6 Diálogos sin modelo | **Resuelto el modelo** | Hay 3 tipos, nombre accesible, foco en Cancelar en las destructivas y ningún diálogo sobre otro. Quedan: los dos avisos de cambios sin guardar (N3), "Cancelar / Listo" en la Pauta (N13) y "Cerrar" como primario en la Biblioteca de grillas (N12). La Cubierta todavía se desplaza (666 de 1121 px en 1366). |
| A7 Avisos translúcidos | No verificado | — |
| A8 Bienvenida rota | **Resuelto** | Se ve bien en 1366 y 1180, en los dos idiomas. |
| A9 Doble clic en .mqt | **Resuelto** en la configuración | Hay `fileAssociations` en `desktop/package.json`. No lo probé instalado. |
| M1 Accesibilidad | **Parcial** | Los diálogos tienen nombre y descripción, las destructivas enfocan Cancelar y el ojo y el candado tienen nombre. Quedan las etiquetas sin asociar (N10), el foco del tutorial (N9) y los capítulos de Ayuda de 20 px de alto. |
| M2 Caracteres como íconos | **Sin cambios** | → ← ¶ ⇄ ✓ ‹ › \|‹ ›\| ▸ ↗ ✦ (D1). |
| M3 Barra superior | **Parcial** | En pantallas angostas los botones pasan a íconos de 32×32. Las 9 acciones de archivo siguen sólo con ícono. |
| M4 Muchas puertas de ayuda | **Resuelto lo grande** | Hay una sola Ayuda. Quedan el "?" del zoom, el consejo fijo al pie del inspector y la pista del lienzo. |
| M5 Textos | **Parcial** | En los avisos de guardado ganó "libro", pero sigue "Abrir proyecto" junto a "Crear un libro". "Imán" sigue sin explicación. Y apareció algo nuevo: textos con pestañas viejas (N1). |
| M6 Recuperación al abrir | No verificado | — |
| M8 Vidrio | **Parcial** | Las tarjetas gris claro de la Biblioteca de grillas siguen sin salir de un material (N12). |
| B1 Versión repetida abajo | **Resuelto** en el editor | En la bienvenida la versión aparece dos veces (D6). |
| B2 Glosario con lista propia | **Peor proporción** | La lista mide 280 px en una ventana de 720 (N8). |
| B4 Atajos en dorado | **Parcial** | Ahora está en Ayuda › Atajos, en negrita y no con `kbd`. |

## 3. Hallazgos priorizados

**Bloquea** = arreglar antes de dárselo a alumnos. **Conviene** = vale la pena en esta etapa. **Detalle** = cuando se toque esa pantalla. Cada uno trae el arreglo barato, si lo hay.

### Bloquea

**N1. Textos que nombran pestañas que ya no existen.**
- Dónde: `src/components/grid-gallery/GridGallery.tsx:38` ("personalizá sus medianiles desde Diseño"), `src/components/shape-gallery/ShapeGallery.tsx:25` ("ajustá relleno y trazo en Objeto"), `src/editorial-assistant.ts:158` ("Revisá posición y tamaño en Objeto"), `src/review-tutorial.ts:34` ("Alinear objetos está en Texto y Capas"), `src/tutorial.ts:245` ("buscá una familia en Texto") y `src/tutorial.ts:381` ("usá su excepción en Páginas").
- Por qué: el tutorial es la puerta de entrada de los alumnos (PRODUCT.md: "enseñar sin estorbar") y hoy manda a lugares que no están.
- Arreglo: reescribirlos con las pestañas nuevas ("en Libro › Grilla", "en Selección", "en Página") y, en inglés y portugués, la misma cadena. Para que no vuelva a pasar: una prueba en `tests/` que busque "en (Diseño|Objeto|Texto|Páginas)\b" en las cadenas.

**N2. Sin libro, el editor muestra restos** (captura 03).
- Qué pasa: con `activateBlankDocument()`, el riel muestra la vista Capas con "Capas · 1 / Esta página no tiene objetos". La barra de estado dice "Página 1 de 2" y la del documento muestra un punto verde suelto e "Imán". El inspector queda en la pestaña Selección sin ningún texto. Revisar libro, Configurar libro y Asistente editorial siguen habilitados, mientras que Imprimir, Vista previa y Exportar se apagan.
- Arreglo: todo depende de `hasDocument`. Si no hay libro, `RailViews` muestra la vista Páginas (vacía) y el inspector, un estado vacío ("Creá o abrí un libro para ver sus propiedades"). La barra de estado y la del documento esconden el número de página, el punto y el imán, y Revisar, Configurar y Asistente se apagan como Exportar.

### Conviene

**N3. Dos avisos de cambios sin guardar** (capturas 06a y 06b).
- `src/app-notices.tsx:61`: "¿Guardamos tu libro?", con el nombre del libro como subtítulo más grande que la pregunta, y los botones Cerrar sin guardar · Cancelar · Guardar y cerrar.
- `src/global/studio.ts:1156`: "Tu libro tiene cambios sin guardar", con los botones Cancelar · **Descartar cambios** (rojo) · Guardar y continuar.
- Arreglo: una sola función, `askUnsaved({ verb: 'cerrar' | 'continuar' })`, con el mismo título, el mismo orden y el mismo tono. Propongo "¿Guardamos los cambios de *El atlas…*?", con No guardar · Cancelar · Guardar y cerrar/continuar, como en macOS. Que "No guardar" sea rojo o neutro se decide una vez para las dos.

**N4. Inglés incompleto** (captura 08).
- El selector de capítulos del tutorial muestra la opción en castellano después de cambiar de idioma. El `<select>` personalizable de Chromium no actualiza `<selectedcontent>` cuando cambia el texto de la opción. Arreglo: `key={lang}` en el `<select>` de `TutorialCard.tsx`, que lo vuelve a montar.
- Nombres accesibles y ayudas emergentes que quedan en castellano:
  - "Vistas del panel": está en la tabla, pero el traductor del DOM no entra a `.rail-switch`. Arreglo: ponerle el `aria-label` desde React.
  - Los tres bordes de panel ("Ancho del panel de herramientas…"): `panel-resize.ts:89` resuelve `bw()` una sola vez al cargar. Arreglo: volver a calcularlo al cambiar el idioma.
  - "Sección general" (`MasterPanels.tsx:85`), "Cuerpo del texto" (`TextPanels.tsx:539`) y "Ej.: Capítulo 2" (`PagePanel.tsx:133`) usan `tt()` pero no están en `i18n.ts`. Arreglo: sumar las tres filas.
- Para que no vuelva a pasar: una prueba que, con la interfaz en inglés, busque letras con acento en `title`, `aria-label` y `placeholder` fuera del libro (como hice yo).

**N5. Dos secciones "Página 9" en la pestaña Página** (captura 04).
- La primera es dorada (elementos automáticos de esta página) y la segunda, blanca (comienzo de sección). Además, "Mostrar titulillo" aparece marcado con "Desactivado para todo el libro en la pestaña Libro" en dorado: el control dice "sí" y el aviso dice "no".
- Arreglo: llamar a las secciones "En esta página" y "Comienzo de sección", sacar el dorado del título y, si el titulillo está apagado en todo el libro, mostrar la casilla deshabilitada con el aviso en `--text-secondary` y un enlace a Libro.

**N6. Ayuda equivocada al elegir un Marco** (captura 05).
- Con un Marco seleccionado, el inspector dice "La alineación del texto dentro de la caja está más abajo, en Párrafo y estilos".
- Arreglo: mostrar ese texto sólo cuando el objeto es de texto.

**N7. Títulos de sección 20 px más adentro que los campos** (capturas 01 y 04).
- "Estructura del libro", "Objeto seleccionado", "Posición y tamaño" y "Grilla" empiezan en x = 1091, y los campos y botones en x = 1071. Ya estaba en el 08-nov (A5) y quedó igual en los paneles React. Arreglo: sacarle el relleno izquierdo al encabezado de sección (el agarrador o el chevron van a la derecha).

**N8. La Ayuda desperdicia la ventana** (capturas 07 y 09).
- La Ayuda es una Ventana de trabajo (1318×720), pero su contenido es de lectura. En Tutorial, la lista de capítulos ocupa la mitad de arriba. En Glosario, la lista de términos tiene una altura fija de 280 px con desplazamiento propio (280 de 773) y debajo quedan 200 px vacíos.
- La lista de capítulos numera mal: "Tu primer libro…" sin número, 1 a 28, y tres al final sin número. La tarjeta dice "5 / 32" mientras el título dice "4. Construir la grilla". Los capítulos son botones de 20 px de alto que se ven como texto suelto.
- Arreglo barato: que la lista del glosario ocupe el alto disponible (`flex: 1; min-height: 0`), que el contador de la tarjeta use la numeración del capítulo ("Capítulo 4 de 28"), numerar o agrupar los 3 extras ("Para seguir") y darles a los capítulos 32 px de alto y un estado al pasar el puntero. La pregunta de fondo es P6.

**N9. El tutorial no lleva el foco a la tarjeta.**
- Al abrir la tarjeta, el foco queda en `body`, así que con el teclado no se llega a Anterior y Siguiente sin recorrer toda la interfaz.
- Arreglo: enfocar el título de la tarjeta (`tabIndex={-1}`) al abrirla y cuando cambia el paso.

**N10. Etiquetas que no están asociadas a su campo.**
- Hojas: `pageUnits` y `orientation` (Configuración del libro); `settingsLanguage`, `settingsInterfaceSize` y `settingsWorkspace` (Configuración); `outMode` y `outPaper` (Preparar PDF); `fontBrowserSample` (Elegí una tipografía). Pestaña Libro: `folio.odd/even`, `header.odd/even`, `titulillo.odd/even` y el selector de dirección del titulillo.
- La etiqueta se ve, pero no está unida al campo, y el lector de pantalla anuncia "cuadro combinado" sin nombre.
- Arreglo: `htmlFor` + `id` o `aria-labelledby` en cada uno. Son componentes React, así que es una línea por campo.

**N11. Riel apretado y con entradas repetidas** (capturas 01 y 02).
- La lista de herramientas (10 filas de 34 px) deja unos 270 px para la vista de abajo en 768 de alto. En 720, "Capas" queda escondida detrás del desplazamiento de la lista. Hay tres zonas con desplazamiento propio en la misma columna: herramientas, vista y miniaturas.
- **Índice y Capas están dos veces:** como herramientas y como pestañas del riel.
- El ancho cambia con la vista (`--layout-left` 184 px y `--layout-left-wide` 248 px, `ui/templates/workspace.css:146-147, 276`), así que la página salta 64 px al pasar de Páginas a Capas.
- Arreglo: sacar Índice y Capas de la lista de herramientas, porque son vistas y no herramientas (libera 70 px). El ancho, ver P4.

**N12. Biblioteca de grillas** (captura 11).
- Las tarjetas son gris claro opaco y no salen de ningún material (en el oscuro, la tarjeta pesa más que la miniatura). El único botón del pie es "Cerrar" en primario. El texto dice "desde Diseño" (N1).
- Arreglo: tarjetas con `--material-sidebar` o la superficie elevada de la Hoja, con borde `--line-subtle`. Además, "Cerrar" como botón secundario, o directamente sin pie si elegir una grilla ya la aplica.

**N13. Pauta de uso tipográfico con "Cancelar / Listo"** (captura 14).
- Es una tabla que sólo informa. Arreglo: `modal.info(…, 'Listo')`.

**N14. Armador: la mitad de la ventana vacía** (captura 10).
- "Dale estructura a tu libro" es una Ventana de trabajo, pero el manuscrito va en un área de texto de 188 px (con 1890 px de contenido) y debajo quedan unos 180 px vacíos. Arriba están los pasos falsos "1 · Datos · 2 · Partes y manuscrito · 3 · Crear y revisar" (A3), que no se pueden tocar.
- Arreglo: que el área de texto crezca hasta el pie (`flex: 1`) y sacar los pasos, o convertirlos en el título de cada bloque.

**N15. Dos revisiones con nombres distintos.**
- "Revisar libro", en la barra del documento, abre una Hoja ("Revisar el libro completo": texto sobrante y objetos fuera de página). "Revisión automática", en el Asistente, revisa casi lo mismo y algo más (fuentes, resolución). El alumno no sabe cuál usar. Ver P3.

**N16. Nombres de la configuración.**
- Hay "Configuración" (preferencias de la app, ícono de la barra), "Configuración del libro" (Hoja), "Configurar libro" (barra del documento) y "Formato y configuración" (pestaña Libro), y los dos últimos abren lo mismo.
- En Configuración, la casilla "Reglas" queda suelta en el medio de la columna, desalineada de los selectores de su fila.
- Arreglo: "Preferencias" para la app (como en macOS) y un solo nombre para la Hoja del libro ("Formato del libro"), con el mismo texto en sus dos puertas. La casilla, alineada con la columna de controles.

**N17. 1180 px: textos cortados y el pliego sin ajustar** (captura 02).
- El nombre del libro queda en "El atlas de las c…" y "Ampliar área" en "Ampliar ár…" ("Expand w…" en inglés). Después de achicar la ventana, el pliego queda cortado a la derecha hasta que se toca Ajustar.
- Arreglo: en ≤ 1279 px, "Ampliar área" pasa a ícono con nombre accesible (como la barra superior) y el nombre del libro toma el espacio libre. Verificar en Electron si al cambiar el tamaño de la ventana se vuelve a ajustar el zoom cuando el modo es "Ajustar".

**N18. Elegí una tipografía y Glifos vacíos sin explicación** (verificar en Electron).
- En el navegador, "Peso / estilo" queda vacío y Glifos muestra "0 caracteres · 1 / 1" sin decir por qué. Puede ser sólo el entorno (no hay archivos de fuente), pero si en Electron una fuente no se puede leer, pasaría lo mismo.
- Arreglo: un estado vacío ("No pudimos leer el archivo de esta fuente. Probá con otra o volvé a leer las fuentes en Configuración").

### Detalle

- **D1. Caracteres como íconos** (M2 sin cambios): "Editar tipografía y párrafos →", "Encontrarlo en Maquetario →", "← Anterior / Siguiente →", "¶ Párrafo y estilos", "⇄ Intercambiar", "✓ Sin desbordamientos…", "‹ ›" en Glifos, "|‹ ‹ › ›|" en Preparar PDF, "▸ Plantillas", "Cargar novela de prueba ↗". Arreglo: los íconos de `studio.ts` (paths) o sacar la flecha. Esto es lo que más "parece generado" de lo que queda.
- **D2.** El interruptor de Grilla apagado se ve como un punto suelto: el riel del interruptor no se distingue del fondo.
- **D3.** En Selección › Figura, "Relleno" y "Trazo" van en negrita y las demás etiquetas no. "⇄Intercambiar" va pegado al carácter.
- **D4.** Vista Índice del riel: el párrafo de ayuda va pegado a "Título del índice", sin espacio entre los dos.
- **D5.** Miniaturas: el código "#- C- T-" (sin número, sin cornisa, sin titulillo) tapa el papel y no se entiende. Arreglo: un punto o un ícono con el detalle en la ayuda emergente, o mostrarlo sólo al pasar el puntero.
- **D6.** En la bienvenida, la versión aparece dos veces ("v3.6.0" arriba y "Maquetario v3.6.0" abajo).
- **D7.** Filas de Capas: tarjetas con borde de 48 px. Pesan más que las miniaturas. Con filas planas de 32 px (y la seleccionada con fondo, sin borde) entran el doble.
- **D8.** Cubierta: el párrafo de arriba y la caja gris repiten la explicación. "Lectura del lomo" es una caja dentro de la columna (tarjeta en tarjeta). Los botones de zona (Solapa de contratapa… Solapa de tapa) repiten las filas de la tabla de medidas, que también se pueden elegir.
- **D9.** Atajos: las teclas van en negrita y no con el átomo `kbd`.

## 4. Preguntas para Juan Cruz

**P1. Marca de página activa.** Hoy "Página activa 9" aparece en la barra del documento, en un rótulo dorado sobre el papel y en la barra de estado. ¿El rótulo sobre el papel se va (y alcanza con el borde de la miniatura y la barra)? Está en la capa `book`, así que sacarlo requiere comparar los PDF de la autoprueba.

**P2. La chispa ✦ del Asistente.** Es el símbolo genérico de "IA" (barra superior y estado vacío del Asistente). ¿La reemplazamos por un ícono propio (lupa sobre página, lista de chequeo) y usamos "IA" sólo en la sección "IA del aula"?

**P3. ¿Una sola revisión?** "Revisar libro" (barra del documento) y "Revisión automática" (Asistente) se superponen. Opciones: (a) que la barra abra la revisión del Asistente; (b) que la Hoja sea la revisión rápida y diga "Revisión completa en el Asistente"; (c) dejar las dos con nombres que expliquen la diferencia.

**P4. Ancho del riel.** ¿Fijo (por ejemplo 220 px, para que la página no salte) o que cambie según la vista, como ahora (184 ↔ 248)?

**P5. Bienvenida.** Sigue como portada ("Cada libro empieza con una idea." + ilustración). Funciona y se ve cuidada, pero es lo más "web de producto" de la app. ¿Se queda así o pasa a algo más de herramienta (recientes primero, acciones a un costado)?

**P6. Ayuda: ¿Ventana o Hoja grande?** Su contenido es de lectura. En una Hoja grande (1040 px) se leería mejor y no dejaría media pantalla vacía. Como Ventana, queda igual que Salida o Cubierta, que son de trabajo.

**P7. Índice y Capas en la lista de herramientas.** ¿Los sacamos (son vistas del riel, ya tienen pestaña) o se quedan como atajo?

## 5. Datos

### 5.1 Lienzo y diálogos (medidos)

| | 1366×768 | 1180×720 |
|---|---|---|
| Lienzo (área visible del pliego) | 844×562 · **45 %** de la ventana | 678×514 · **41 %** |
| Barras | superior 48 · documento 40 · plantillas plegadas 48 · estado 28 | igual |
| Configuración del libro (Hoja lg) | 1040×566 | 1040×566 |
| Configuración (Hoja lg) | 1040×691, se desplaza | 1040×648, se desplaza |
| Confirmación | 420×143 | igual |
| ¿Guardamos tu libro? | 420×236 | igual |
| Revisar el libro completo (Hoja md) | 820×288 | igual |
| Pauta tipográfica · Biblioteca de grillas (Hoja lg) | 1040×691, se desplazan | 1040×648 |
| Preparar PDF (Ventana) | 1318×720, opciones 618/799 | 1132×672, opciones 570/799 |
| Cubierta desplegada (Ventana) | 1318×720, cuerpo 666/1121 | 1132×672, cuerpo 618/1159 |
| Asistente (Ventana) | 1318×720 | 1132×672, cuerpo 618/643 |
| Ayuda (Ventana) | 1318×720, glosario 280/773 | 1132×672, glosario 280/773 |
| Armador (Ventana) | 1318×720, manuscrito 188/1890 | 1132×672, 188/1983 |

### 5.2 Accesibilidad (chequeo propio por estado)

- Los botones sin nombre accesible son 0 en todos los estados recorridos, y no hay botones que dependan sólo del `title`.
- Los diálogos tienen `role="dialog"` o `alertdialog`, con `aria-labelledby`, y la confirmación también tiene `aria-describedby`. Al abrir una Hoja o una Ventana, el foco va al diálogo; en Elegí una tipografía, a la búsqueda. En una confirmación destructiva va a Cancelar.
- Campos sin etiqueta asociada: 7 en la pestaña Libro y entre 1 y 3 por Hoja (N10).
- Objetivos de menos de 24 px: los capítulos de Ayuda (20 px de alto), las "?" de sección (22×22) y los agarradores de Capas (18×26).

### 5.3 Puntajes

| # | Heurística | 08-nov | 09-nov | Por qué |
|---|---|---|---|---|
| 1 | Visibilidad del estado | 1 | 3 | El guardado es real. Sin libro muestra datos falsos (N2). |
| 2 | Lenguaje del usuario | 3 | 3 | Vocabulario del oficio y voseo parejo. Pestañas viejas en los textos (N1). |
| 3 | Control y libertad | 3 | 3 | Deshacer y confirmaciones con foco en Cancelar. |
| 4 | Consistencia | 2 | 2 | Dos avisos de cambios (N3), dos "Página 9" (N5), cuatro nombres de configuración (N16) y caracteres como íconos. |
| 5 | Prevención de errores | 3 | 3 | Sin cambios. |
| 6 | Reconocer antes que recordar | 2 | 3 | 3 pestañas visibles. Siguen las 9 acciones sólo con ícono y "#- C- T-". |
| 7 | Flexibilidad y eficiencia | 3 | 3 | Atajos, espacios de trabajo y paneles redimensionables. |
| 8 | Estética y minimalismo | 2 | 3 | La página manda más. Quedan la chispa, tarjetas pesadas y ventanas medio vacías. |
| 9 | Recuperarse de errores | 2 | 2 | No verificado (avisos). |
| 10 | Ayuda y documentación | 2 | 3 | Una sola puerta. La numeración y la proporción de la Ayuda fallan (N8). |
| | **Total** | **23** | **27/40** | Bueno, con terminación pendiente. |

| # | Auditoría técnica | 08-nov | 09-nov | Por qué |
|---|---|---|---|---|
| 1 | Accesibilidad | 2 | 3 | Diálogos con nombre y pestañas con su patrón. Faltan etiquetas (N10) y el foco del tutorial (N9). |
| 2 | Rendimiento | 3 | 3 | No lo medí de nuevo. |
| 3 | Temas y tokens | 3 | 3 | `lint:design` sigue en cero. Las tarjetas de grillas no salen de un material. |
| 4 | Tamaños de pantalla | 1 | 3 | Lienzo al 45 % y 41 %, y una ventana que entra en la pantalla. Hay textos cortados en 1180. |
| 5 | Integridad del sistema | 2 | 3 | Componentes React y tres tipos de diálogo. Quedan pantallas que resuelven distinto lo mismo. |
| | **Total** | **11** | **15/20** | Bueno. |

### 5.4 Capturas

| Archivo | Qué muestra |
|---|---|
| `01-editor-1366-es.png` | Editor en 1366: riel (herramientas + miniaturas con "#- C- T-"), títulos de sección desalineados, consejo al pie. |
| `02-editor-1180-en.png` | 1180 en inglés: barra superior angosta, "Expand w…", título del libro cortado, riel en 248 px. |
| `03-sin-libro-1366-es.png` | Sin libro: "Capas · 1", "Página 1 de 2", punto suelto e "Imán", inspector en blanco (N2). |
| `04-inspector-pagina-1366-es.png` | Dos "Página 9" y la casilla marcada con "Desactivado…" (N5). |
| `05-inspector-marco-1180-es.png` | Marco seleccionado con la ayuda de alineación de texto (N6). |
| `06a-cambios-cierre-1366-es.png`, `06b-cambios-armador-1366-es.png` | Los dos avisos de cambios sin guardar (N3). |
| `07-ayuda-capitulos-1366-es.png` | Capítulos con numeración despareja y media ventana vacía (N8). |
| `08-tutorial-1180-en.png` | Tutorial en inglés con el selector en castellano (N4) y el contador "5 / 32" frente a "4." (N8). |
| `09-glosario-1366-es.png` | Lista del glosario de 280 px en una ventana de 720 (N8). |
| `10-armador-1366-es.png` | Pasos falsos y área de texto chica con la mitad de la ventana vacía (N14). |
| `11-grillas-1366-es.png` | Tarjetas gris claro, "Cerrar" primario y "desde Diseño" (N1, N12). |
| `12-asistente-1366-es.png` | La chispa ✦ en el estado vacío (P2). |
| `13-cubierta-1366-es.png` | Cubierta: explicación repetida y tarjeta dentro de columna (D8). |
| `14-pauta-1366-es.png` | Pauta con "Cancelar / Listo" (N13). |
