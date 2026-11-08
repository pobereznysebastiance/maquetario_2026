# Interfaz · revisión para la etapa 3 (08-nov)

> Método: revisión en un solo contexto, con la skill impeccable (crítica + auditoría). No se separó en dos subagentes porque la app de desarrollo es una sola ventana compartida (manejarla desde dos agentes a la vez rompe los estados). Evidencia: recorrido automático por 37 estados con `scripts/app-cdp.mjs` en 1536×1024, 1366×768 y 1150×700, medidas del DOM, lectura del código y del CSS, avisos de sistema capturados con una instancia aparte de Electron y el detector de impeccable (ver §3.9). Capturas y scripts en el scratchpad de la sesión (`…/scratchpad/revision/`).
>
> Ojo con las capturas por CDP: no incluyen Mica, así que los paneles translúcidos se ven más claros que en la app real. Para juzgarlas las compuse sobre un fondo `#202020` (Mica oscuro). El código cambió mientras revisaba (otros agentes pasando archivos a TypeScript): los conteos son de las 20:10 y los nombres de archivo pueden estar en `src/*.ts` en vez de `*.js`.

## 1. Resumen

La base del sistema de diseño está bien pensada y bien documentada: tokens semánticos, capas `@layer` con el libro abajo de todo, materiales con nombre, roles tipográficos de macOS, contraste de texto sobrado (secundario 9:1, terciario 6,5:1) y un control automático que ya no deja pasar valores sueltos. Lo que falla está arriba de eso. **Los componentes existen en CSS pero no en el marcado**: `ui/components.js` se usa en 7 lugares, mientras que 35 módulos arman su HTML a mano (260 plantillas de texto, 155 `<button>`, la clase `btn` escrita a mano 77 veces). La pantalla tampoco sigue el principio de que "la página manda": en una notebook de 1366×768 el lienzo es el 36 % de la ventana, y en 1150×700, el 30 %. Además, la interfaz todavía tiene rasgos que la hacen parecer genérica (dorado en todos lados, la chispa ✦ del asistente, la ruta numerada en círculos, degradés de ambiente). Las 5 cosas más importantes:

1. **El estado de guardado miente.** La barra de estado dice siempre "Guardado en tu equipo" (es texto fijo) y el indicador real ("Cambios sin guardar") está oculto con `display: none`. Lo verifiqué con `dirty = true`. Hay que arreglarlo ya.
2. **La página tiene poco lugar en notebooks.** La columna central gasta 335 px de alto en barras (superior, documento, ruta, plantillas y estado) contra 433 px de lienzo en 1366×768. Encima, la ventana tiene `minHeight: 760`, más que el alto útil de una notebook de 1366×768 con barra de tareas.
3. **El sistema de componentes no llega al marcado:** `UI.button` tiene 0 usos. La etapa 3 no puede migrar "por componente" sin tocar 35 módulos: hay que decidir el orden (ver §4).
4. **El dorado y los rasgos de "hecho por IA":** hay 45 usos de `--text-mark` en 12 hojas, más la chispa ✦, el "6 páginas" en número grande, los pasos de la ruta en círculos dorados, la etiqueta "SOLO ESTA PÁGINA" y los degradés radiales de `--ambient-window`. Va contra el CLAUDE.md y contra la dirección "glass" sobria.
5. **Diálogos e inspector sin un modelo claro.** Un solo `#modal` genérico sirve a unas 14 pantallas, siempre con "Cancelar + primario" (aparecen pares como Cancelar/Cerrar). La cubierta mide 1243 px de alto. Hay diálogo sobre diálogo (glifos → fuentes). El inspector tiene 7 pestañas y muestra 4 a cualquier tamaño, incluso a 1536.

**Puntaje (heurísticas de Nielsen): 23/40** (aceptable, con trabajo importante por delante). **Auditoría técnica: 11/20** (detalle en §3.8).

## 2. Hallazgos priorizados

Leyenda: **[Ya]** = conviene arreglarlo antes de la etapa 3 (es barato, o es un error de confianza o de datos); **[E3]** = se resuelve naturalmente al pasar a componentes, alcanza con no arrastrarlo; **[Decidir]** = hace falta una decisión de producto antes.

### Crítico

**C1. El indicador de guardado dice "Guardado" con cambios sin guardar** [Ya]
- Dónde: barra de estado (`index.html`, `.statusbar`: "Guardado en tu equipo" es texto fijo), `studio.js` → `syncNative()` escribe "Cambios sin guardar" en `#savedState`, que la barra superior oculta (`display: none`). El punto del nombre del documento (`.document-dot`) es dorado siempre, haya o no cambios.
- Qué pasa: con `dirty = true`, lo único visible sigue diciendo "Guardado en tu equipo". En Windows la barra de título es propia, así que tampoco se ve un "•" en el título.
- Por qué importa: es la confianza básica de una herramienta de trabajo. Un estudiante cierra creyendo que guardó (el aviso de cierre lo salva, pero una caída o un corte de luz, no). También duplica información con "Proyecto local" (evaluación de uso #7).

**C2. La ventana no entra en una notebook común** [Ya]
- Dónde: `desktop/src/main/main.ts` → `createWindow()`: `width 1536, height 1024, minWidth 1120, minHeight 760`.
- Qué pasa: una pantalla de 1366×768 deja 720–728 px útiles con la barra de tareas. Una de 1920×1080 al 150 % deja unos 1280×690. En los dos casos `minHeight 760` es más alto que la pantalla, y el tamaño inicial (1536×1024) también se pasa. Conviene verificarlo en un equipo real: con la ventana maximizada Windows puede ajustarla, pero al restaurarla la barra de estado queda debajo de la barra de tareas.
- Por qué importa: PRODUCT.md pone las notebooks de 13–15" como contexto principal (aula). Es lo primero que ven.

**C3. La página no manda en notebooks** [Ya: plantillas plegadas por defecto · E3: el resto]
- Dónde: plantilla `workspace` (columna central).
- Datos: proporción de la ventana que es lienzo: **45 % en 1536×1024, 36 % en 1366×768, 30 % en 1150×700**. En 1366×768: barra superior 48 + barra del documento 40 + ruta del libro 45 + plantillas 174 + estado 28 = **335 px de barras** contra 433 px de lienzo. "Ajustar" deja el pliego al 40 % en 1366 y al 32 % en 1150.
- Por qué importa: es el principio 1 de PRODUCT.md. Las plantillas de grilla (174 px) y la ruta (45 px) se ven siempre, aunque no se estén usando.

### Alto

**A1. Los componentes no se usan donde se arma la interfaz** [E3 · Decidir orden]
- `ui/components.js` define 9 funciones. Hay **7 llamadas en 5 archivos** (`toast`, `settingRow`, `checkItem` ×2, `actionItem`, `menuItem` ×2). `UI.button`, `UI.iconButton` y `UI.skeleton` tienen **0 usos**.
- 35 de 61 módulos arman HTML con plantillas de texto: 260 plantillas, 155 `<button>`, 46 `<select>`, 78 `<input>`, 8 `<details>`. La clase `btn` está escrita a mano 77 veces, `help` 60, `check-line` 24, `control` 23.
- Además hay 101 estilos en línea desde JS (99 según `lint:design`), 65 colores hex en JS y 520 llamadas `bw('es','en','pt')` con los tres idiomas escritos en el código.
- Por qué importa: la etapa 3 hereda módulos que mezclan lógica, textos y marcado. Ver tabla 3.3 y decisión D2.

**A2. El dorado significa todo** [Ya: reducir · E3: fijar en tokens]
- Dónde: `--text-mark` tiene 45 usos en 12 hojas (dialog-content 14, inspector 10, welcome 6, book-route 3…), más 32 de `--status-warning*`.
- Qué pasa: es dorado el foco, y también la página activa (borde y rótulo), el título "Página 1", la etiqueta "SOLO ESTA PÁGINA", "Desactivado en todo el libro" (advertencia), los encabezados de tabla de la cubierta, "Tapa" y "Lectura del lomo", los chips "1 · Datos…" del creador de novelas, los círculos de la ruta 1–5, el interruptor de Grilla encendido, el "73 %" del zoom, los subtítulos de las plantillas ("3 columnas · 6 filas"), las teclas en "Moverse por la maqueta" y la chispa del asistente.
- Por qué importa: si todo es acento, nada lo es. Y el foco, que tiene que verse, compite con decoración. La evaluación de uso #10 ya lo marcaba y sigue igual.

**A3. Rasgos de "panel genérico de IA"** [Ya: los baratos · E3: el resto]
- La chispa ✦ dorada en el botón "Asistente editorial" y en grande en el estado vacío del asistente.
- La ruta "1 Armar libro · 2 Estructura · 3 Cubierta · 4 Revisar libro · 5 PDF / Imprimir" en círculos dorados: parece una lista de bienvenida de SaaS.
- La tarjeta "6 / páginas · 148 × 210 mm" con el número grande (pestaña Páginas).
- La bienvenida armada como portada de una web de marketing ("Cada libro empieza con una idea.", a 58 px, más la ilustración).
- Degradés radiales de ambiente en `tokens/semantic.css` (`--ambient-window`: verde agua y dorado; `--ambient-canvas`; `--ambient-chrome`): en total hay 14 degradés en 6 hojas (contando los brillos de miniaturas y de carga). El aviso de sistema tiene un degradé de fondo y un filete dorado bajo el título.
- Etiquetas en mayúsculas: "SOLO ESTA PÁGINA" (`.page-only-tag`) y "MAQUETARIO" sobre la ilustración. Quedan 8 "eyebrows" en el código, ocultos por CSS pero vivos, uno en inglés (`'MAQUETARIO · PRINT'`, `'· ATELIER'`, `'· Aa'`), más "ESTUDIO EDITORIAL" oculto en la barra.
- Chips de pasos falsos en "Dale estructura a tu novela": "1 · Datos / 2 · Partes / 3 · Crear y revisar" parecen pasos o pestañas, pero no se pueden tocar.
- Por qué importa: CLAUDE.md prohíbe los degradés decorativos y las etiquetas en mayúsculas. Es justo lo que el equipo pidió evitar.

**A4. La interfaz pinta sobre el papel** [Decidir: choca con "no tocar lo que dibuja el libro"]
- Dónde: `ui/book/selection.css` (`--page-active-badge-*`, `--book-page-active*`) y el rótulo del objeto seleccionado ("Cuadro de texto", verde).
- Qué pasa: hay un rótulo naranja "Página activa 1" y un borde cobre dentro de la página, y el texto del inspector habla de "borde cobre". La evaluación de uso #3 lo marcaba y sigue.
- Por qué importa: tapa el contenido del libro y va contra el principio 1. Como está en la capa `book`, la regla del CLAUDE.md impide tocarlo "al cambiar la interfaz": hay que decidir explícitamente si la marca de página activa es del libro o de la interfaz (recomiendo que sea de la interfaz y que vaya en el marco, la regla o la tira de páginas).

**A5. Inspector** [E3 · Decidir modelo, D3]
- 7 pestañas (Libro, Diseño, Texto, Objeto, Páginas, Índice, Capas); se ven **4 a cualquier tamaño** (1536, 1366 y 1150), el resto queda detrás de un chevron. Las etiquetas miden 11 px. Hay `role="tab"` sin `aria-controls`, sin `tabpanel` y sin moverse con flechas.
- Jerarquía: los títulos de sección van a 17 px (`title2`) dentro de un panel de 320 px y pesan más que el contenido. El título queda unos 20 px más adentro que los campos (por el agarrador de sección), y eso desalinea el borde izquierdo.
- "Reglas internas" es un botón a todo el ancho, pegado a los bordes del panel, arriba de la pestaña Libro.
- Tarjeta anidada: "Separación silábica / Idioma del texto" va en una caja dentro de la sección "Párrafo y estilos". También aparecen "Documento" (tarjeta con número grande) y cajas de "Seleccioná un cuadro de texto…".
- Las unidades están a veces en la etiqueta ("Posición X · mm", "Grosor · mm", "Horizontal · columnas") y a veces dentro del campo ("mm"). Hay selectores cortados ("Todos los …", "Automáti…", "Márgenes …").
- Al pie va un consejo fijo ("La grilla es una guía: no se imprime…") en todas las pestañas (evaluación #2).

**A6. Diálogos sin un modelo** [E3 · Decidir variantes, D4]
- Un solo `<dialog id="modal">` (`studio.js → modal()`) sirve a unas 14 pantallas cambiando su clase (`dialogVariant`), más `#confirmDialog` (confirm.ts), el explorador de fuentes (otro `<dialog>`), la tarjeta del tutorial (`aside`) y los menús.
- El pie es siempre "Cancelar + primario", aunque el diálogo sólo informe. Así quedan pares redundantes: **Cancelar / Cerrar** (atajos, galería de retículas, glifos), **Cancelar / Listo** (pauta tipográfica) y **Cancelar / Volver al editor** (asistente).
- Diálogo sobre diálogo: Glifos → "Elegí una tipografía" (dos velos, dos pies).
- La cubierta es un formulario largo: 1280×922 con 1243 px de contenido (en 1366×768 se ve el **55 %**), 4 acciones en el pie, 6 párrafos de explicación y 2 tarjetas con borde dorado.
- Confirmaciones con dos diseños: `confirm-dialog` (420 px, sin ícono) y "¿Guardamos tu publicación?" (460 px, con ícono). Lo mismo se nombra distinto: "Descartar cambios" en un lado y "Cerrar sin guardar" en el otro.
- En 1366×768 tienen desplazamiento interno: Preparar PDF (columna de opciones 538/639), Cubierta (689/1243), Configuración (689/845), Asistente (689/765), Galería de retículas (689/812) y "Dale estructura a tu novela" (691/696). En 1150×700 se suma Glifos (628/682). Ver tabla 3.1.

**A7. Avisos (toasts) translúcidos y encima de los controles** [Ya: opacidad · E3: componente]
- Dónde: `ui/molecules/status.css` (4 reglas `#toast` que se pisan) y `templates/workspace.css` (2 más).
- Qué pasa: aparecen arriba al centro, encima de la barra del documento. El de éxito es verde agua con transparencia y deja ver el texto de abajo ("Configurar libro" se lee a través). El de error dura 7 s, tapa la barra del documento y no se puede cerrar ni trae acción.

**A8. La bienvenida se rompe en 1366×768 y 1150×700** [Ya]
- El pie ("Creado por Sebastián Poberezny") se monta sobre "Proyectos recientes" y su recuadro vacío (`ui/organisms/welcome.css`).

**A9. Doble clic en un .mqt no abre Maquetario** [Ya]
- Falta `fileAssociations` en `desktop/package.json → build`. No se maneja `open-file` (macOS) ni la ruta en `argv` (Windows), y `second-instance` sólo enfoca la ventana. El comentario de `main.ts:38` promete algo que no hace.

### Medio

**M1. Accesibilidad** [Ya: etiquetas y nombres · E3: el resto lo da Radix]
- Los diálogos no tienen `aria-labelledby` (`#modal`, `#confirmDialog`).
- Campos sin etiqueta asociada: `#tocTitle`, `#pageSection`, `#formatName`, `#coverText` y el interruptor de Grilla (input sin nombre). En total: 36 `aria-label`, 7 `aria-expanded`, 4 `aria-live`, 3 `aria-pressed` y 2 `aria-selected` en todo el código.
- Contraste: las letras de atajo de las herramientas inactivas van en `#6f8787` a 10 px: **4,2:1** (no llega a 4,5:1). El resto de los tokens de texto está bien (tabla 3.5). Texto chico: pestañas a 11 px, ayudas a 11–12 px en terciario, barra de estado y pista del lienzo a 11 px.
- Objetivos chicos: "?" de ayuda 22×22, bordes de panel de 7 px (tienen teclado), pista del zoom de 2 px de alto.
- Foco: el anillo dorado global (`:focus-visible`) está bien. Pero al abrir la app con copia de recuperación, el foco arranca en la cruz del diálogo y el anillo aparece sin haber usado el teclado (`ui/focus.js` empieza con `lastInput = 'keyboard'`).
- `prefers-reduced-motion`: bien resuelto en tokens (duraciones en 0).

**M2. Caracteres como íconos** [E3]
- → 31 · ↗ 9 · ← 6 · ‹ › 8 · ↓ ↑ 10 · ▾ ▴ ▸ ⌄ 6 · ¶ 3 · − 8 · ◇ ◉ ✦. Por ejemplo: "¶ Párrafo y estilos", "◇ Aprender", "Recorrido ▴", "|‹ ‹ › ›|" en la vista previa del PDF, "← Anterior / Siguiente →" en el tutorial, "−" y "+" del zoom. Tienen otro peso y otro tamaño que el set de `studio.js → paths` (evaluación #11).

**M3. Barra superior** [E3]
- Las 9 acciones de archivo son sólo íconos (Nuevo, Abrir, Guardar, Guardar como…, Empaquetar, Deshacer, Rehacer, Configuración, Espacio de trabajo): el nombre existe pero está oculto y sólo queda el `title`. "Guardar" y "Guardar como…" tienen íconos casi iguales. En 1150 px, "Asistente editorial" e "Imprimir" también quedan sólo con ícono (la chispa sola).

**M4. Demasiadas puertas de ayuda** [Decidir]
- Tutorial, Aprender, Recorrido, "?" del zoom, Glosario, "Tutorial guiado" en la bienvenida, "?" por sección, consejo fijo al pie del inspector y la pista del lienzo (hay dos textos distintos: el de `index.html` y "Espacio + arrastrar…"). El tutorial tiene 32 pasos (evaluación #1).

**M5. Textos** [Ya]
- El voseo es consistente (no encontré tú ni usted en castellano).
- Los sustantivos no: libro / publicación / documento / proyecto / novela para la misma cosa ("Crear un libro", "¿Guardamos tu publicación?", "Crear documento", "Abrir proyecto", "Tu libro tiene cambios sin guardar"). Lo mismo con grilla (21) y retícula (9): "Grilla" en el inspector y "Biblioteca de retículas" en la galería.
- Gramática: "1 columnas · 1 filas" en las plantillas.
- Verbos táctiles en escritorio: "Tocá" (3 veces).
- "Desktop" en el pie de la bienvenida.
- La versión aparece en 4 formatos: "v3.24.0", "Maquetario 3.24.0 · Desktop", "v3.24" y "v3.0" (fijo en `index.html`, se reemplaza al cargar).
- "Imán" en la barra del documento sin explicación.

**M6. Recuperación al abrir** [Ya]
- El primer diálogo que ve alguien con una copia de recuperación es "Retomá tu último libro", encima de la bienvenida, con **Cancelar / Recuperar proyecto**. No dice qué pasa con la copia si cancela (queda guardada) y "Cancelar" no describe la acción (evaluación #13).

**M7. Deuda del CSS migrado** [E3: desaparece con componentes · Ya: no sumar]
- 946 bloques; **188 selectores definidos en más de un bloque, 52 en más de un archivo**: `.leftpanel` en 19 bloques de 5 archivos, `.inspector` 18/6, `.statusbar` 16/3, `#toast` 6. La migración portó la cascada vieja tal cual.
- `atoms/field.css` no es un componente: estiliza `input/select/textarea` por zona (`:is(.topbar, .leftpanel, .documentbar, .template-panel, .statusbar, .inspector, #modal, dialog) select`). El átomo conoce a los organismos.
- `.btn` se define en 7 hojas (button.css 11 reglas, más assistant, dialog-content, inspector, settings, topbar y tutorial).
- 48 `!important`: 31 en `book` y 17 en las capas de interfaz, aunque el plan dice 0.
- 456 variables CSS: 189 semánticas, 38 primitivas, 56 del libro y unas 170 de componentes repartidas en organismos. **283 se usan una sola vez** (son medidas de un componente puestas como token) y **24 no se usan** (6 de los 8 petróleos, `--line-accent`, `--status-success*`, `--type-large-title`…). Siguen vivos 7 alias de tipo viejos (`--type-xs/sm/md/lg/xl/2xl/2xs`, 76 usos) junto a los 9 roles (84 usos).
- Selectores con `appearance: base-select` (función experimental de Chromium) y un `MutationObserver` sobre todo el `body` para meter `<button><selectedcontent>` en cada `<select>` (`ui/select.js`). Lo mismo en `ui/focus.js`.

**M8. El vidrio como efecto, no como material** [E3]
- Hay 10 `backdrop-filter` en paneles que, con Mica o vibrancy, no tienen nada propio detrás que desenfocar: cuestan GPU y no se ven.
- Al mismo tiempo, superficies como las tarjetas grises claras de la galería de retículas o el aviso teñido no salen de ningún material. Los materiales de `semantic.css` están bien definidos, pero no todo los usa.

### Bajo

- **B1.** "Proyecto local · v3.24" abajo a la izquierda repite la barra de estado (evaluación #7).
- **B2.** El glosario tiene una lista con desplazamiento propio (340/773) dentro de un diálogo de 650 px.
- **B3.** En la vista previa sólo cambia el botón (se pone primario) y se oculta la marca de página activa: no hay un estado de modo claro. En foco, "Restaurar pan…" aparece cortado.
- **B4.** El "?" del zoom abre "Moverse por la maqueta", que usa texto dorado en vez del átomo `kbd` que ya existe.
- **B5.** Las imágenes de bienvenida son dos PNG de 2 MB cada una (`assets/welcome-editorial*.png`).
- **B6.** Durante la revisión, después de una recarga, la interfaz mostró texto mal codificado ("DiseÃ±o", "PÃ¡ginas", "guÃ­a", "â−"). Se resolvió solo con el build siguiente: vino de la integración en curso, no de la interfaz. Sugerencia: que la autoprueba busque "Ã" en el texto visible.

## 3. Datos

### 3.1 Pantallas y diálogos: tamaño real

Ancho × alto del elemento; "despl." es el alto visible sobre el alto del contenido cuando hay desplazamiento interno. En 1366×768 todos entran en la ventana (ninguno se sale), pero varios necesitan desplazamiento.

| Pantalla / diálogo | Cómo se abre | 1536×1024 | 1366×768 | 1150×700 |
|---|---|---|---|---|
| Bienvenida | `showWelcome()` | pantalla completa | **pie montado sobre recientes** | **pie montado sobre recientes** |
| Editor (lienzo) | — | lienzo 1032×689 (45 %) | 862×433 (**36 %**) | 666×365 (**30 %**) |
| Configuración del libro | `settingsNew(false)` | 1040×566 | 1040×566 | 1040×566 |
| Dale estructura a tu novela (crear publicación) | `bookBuilder()` | 760×698 | 760×691, despl. 691/696 | — |
| Preparar PDF | `outputDialog('pdf')` | 1460×940 | 1325×710, opciones despl. 538/639 | 1116×662, 490/639 |
| Cubierta desplegada | `coverEditor()` | 1280×922, despl. 920/1243 | 1280×691, **despl. 689/1243** | 1093×630, 628/1298 |
| Exportar cubierta | `coverSheetDialog('pdf')` | 940×711 | 940×583 | — |
| Configuración (app, con Cuenta) | `openSettings()` | 980×845 | 980×691, despl. 689/845 | 980×630, 628/845 |
| Aprender diseño editorial (glosario) | `showGlossary()` | 1100×650, lista 340/773 | 1100×630, lista 280/773 | — |
| Tutorial (tarjeta) | `startTutorial(0)` | 420×487 | 420×487 | — |
| Asistente editorial | `openEditorialAssistant()` | 1140×767 | 1140×691, despl. 689/765 | 1104×630, 628/765 |
| Glifos (+ explorador de fuentes encima) | `showFontGlyphs()` | 1050×794, grilla 380/792 | 1050×684 | 1050×630, **despl. 628/682** |
| Explorador de fuentes | desde el selector de fuente | ~960 de ancho | — | — |
| Pauta de uso tipográfico | `editorialRulesDialog()` | 1260×466 | 1260×466 | — |
| Biblioteca de retículas | `gridGallery()` | 900×814 | 900×691, despl. 689/812 | — |
| Moverse por la maqueta (atajos) | "?" del zoom | 820×584 | 820×584 | — |
| Confirmación (eliminar, cambios) | `confirmAction()` | 420×143–161 | igual | — |
| ¿Guardamos tu publicación? | `prepareCloseNoticePreview()` | 460×292 | igual | — |
| Retomá tu último libro (recuperación) | al abrir | 820×198 aprox. | — | — |
| Menú Espacio de trabajo | `MaquetarioWorkspace.toggleMenu()` | 260×183 | igual | — |
| Avisos de sistema (ventana aparte) | licencia, error al iniciar | 680×380 fijo | igual | igual |
| Paquete para imprenta | `packageDialog()` | no se pudo abrir (la función no estaba publicada al momento de probar) | | |

Modos: **foco** (oculta los paneles; "Restaurar pan…" se corta), **interfaz grande** (×1,15; las pestañas siguen en 4 visibles), **vista continua** y **vista previa** (sólo cambia el botón) se recorrieron sin roturas de layout.

### 3.2 Componentes de interfaz que existen hoy

Cuántas veces aparece cada clase de control en vivo, sumando 14 estados (7 pestañas y 7 diálogos), y dónde vive su estilo. Sirve para dimensionar, no como conteo exacto.

| Componente | Variantes en uso | Apariciones (14 estados) | CSS | Marcado |
|---|---|---|---|---|
| Botón | `btn`, `btn.primary`, `btn.danger`, `btn.wide`, `btn.danger.wide`, `quiet`, `quiet.wide`, `assistant-entry.btn` | 197 + 93 + 14 + 29 + 140 (quiet) | `atoms/button.css` y otras 6 hojas | a mano (77 `btn` en JS), `UI.button` sin usos |
| Botón de ícono | `icon-btn`, `tool-action` (barra superior) | 130 + 126 | `atoms/button.css`, `topbar.css` | a mano |
| Herramienta (riel) | `tool` con atajo | 182 | `tool-rail.css` | `studio.js` |
| Botones sin clase | opciones de segmentado, acciones de página, alineación, etc. | ~1010 (incluye el `<button>` interno de cada `<select>`) | contextual | a mano |
| Selector | `<select>` nativo con `base-select` | 89 + `tutorial-jump` 14 + `font-native-hidden` 4 | `atoms/field.css` (por zona) | a mano (46) |
| Selector visual de fuente | `font-visual-select` + explorador | 4 | `font-browser.css` | `fonts.ts` |
| Campo numérico | `input[number]` (+ `unit-wrap`/`unit` en algunos) | 59 | `field.css` | a mano |
| Campo de texto / búsqueda / área | `input[text]`, `field-full`, `input[search]`, `textarea` | 9 + 18 + 15 + 14 | `field.css` | a mano |
| Casilla | `input[checkbox]` (`check-line`, `check-item`) | 31 | `field.css`, `check-item.css` | `UI.checkItem` en 2 lugares, `check-line` a mano 24 |
| Interruptor | `.switch` | 1–2 por pestaña | `field.css` | a mano |
| Deslizador | `input[range]` (zoom, ejes variables) | 16 | `field.css`, `zoom-bar.css` | a mano |
| Color | `input[color]` | 6 | `field.css` | a mano (`shapes`) |
| Control segmentado | `segmented`, botones de alineación, "A los márgenes / Al borde" | varios por pestaña | `inspector.css` | a mano |
| Pestañas | `tab` (inspector) | 7 | `inspector.css` | `index.html` + `studio.js` |
| Sección plegable | `<details>/<summary>` y secciones con `section-toggle` / `section-grip` | 8 `<details>` + secciones del inspector | `section-toggle.css`, `section-grip.css` | `inspector-sections.ts` |
| Fila de campo | `field-row`, `control`, `modal-grid`, `pair`, `setting-row` | 11 + 23 + 10 + 4 + `UI.settingRow` | `field-row.css`, `setting-row.css` | mayormente a mano |
| Ítem de acción | `action-item` (bienvenida, ayuda) | 70 | `action-item.css` | `UI.actionItem` en 1 lugar |
| Menú / ítem de menú | `menu`, `menu-item` | 56 | `menu.css`, `menu-item.css` | `UI.menuItem` (workspace) |
| Tarjeta de opción | `template`, `grid-card`, `format-option`, `font-browser-row`, `thumb`, `recent-project` | 140 + 10 + 8 + 140 + 42 | 5 hojas distintas | a mano |
| Lista ordenable | capas (`layer-row` + `layer-grip`), estructura (`structure-item`) | — | `inspector.css`, `structure.css` | a mano |
| Aviso en línea | `notice`, `help`, `settings-note`, `inline-error`, `active-page-notice` | 5 + 60 + 7 + 6 + 2 | `status.css`, `dialog-content.css` | a mano |
| Aviso flotante (toast) | success / info / warning / error | 1 | `status.css` (4 reglas) + `workspace.css` (2) | `UI.toast` |
| Diálogo | `#modal` + ~14 variantes, `#confirmDialog`, explorador de fuentes | — | `dialog.css` + `dialog-content.css` (188 bloques) | `modal()` + `dialogVariant()` |
| Ayuda de término | `term-help` ("?") | 7 | `term-help.css` | `editorial-learning.ts` |
| Tecla | `kbd` | pocas | `atoms/kbd.css` | a mano |
| Esqueleto de carga | `skeleton` | 0 visibles | `atoms/skeleton.css` | `UI.skeleton` sin usos |
| Tarjeta de tutorial | `tutorial-card` + máscara | 1 | `tutorial.css` | `tutorial.ts` |

**Conclusión para Radix:** los primitivos que hacen falta sí o sí son Dialog (con variantes *sheet*, *confirm*, *panel ancho*), AlertDialog, Popover, DropdownMenu/Menu, Tooltip, Tabs, ToggleGroup (segmentados, alineación), Select, Checkbox, Switch, Slider, Collapsible/Accordion (secciones del inspector), ScrollArea, Toast, ContextMenu (lienzo, capas) y Toolbar (barra superior y riel, con flechas). **Radix no trae** campo numérico con unidad, selector de color, lista ordenable ni árbol: esos tres son el corazón del inspector y hay que hacerlos propios (ver D1).

### 3.3 Dónde se arma el HTML (top 20 de 61 módulos)

| Módulo | Líneas | `UI.*` | Plantillas HTML | `<button>` | `<select>` | `<input>` | Estilos en línea | Hex | `bw()` | Caracteres-ícono |
|---|---|---|---|---|---|---|---|---|---|---|
| studio.js | 1575 | 1 | 49 | 20 | 7 | 20 | 17 | 5 | 12 | 34 |
| src/settings-panel.ts | 434 | 3 | 24 | 5 | 3 | 0 | 0 | 0 | 6 | 4 |
| src/book-workflow.ts | 700 | 0 | 19 | 11 | 1 | 8 | 4 | 5 | 84 | 19 |
| src/editorial.ts | 297 | 0 | 16 | 10 | 2 | 6 | 7 | 1 | 0 | 8 |
| src/paragraphs.ts | 823 | 0 | 13 | 6 | 5 | 2 | 4 | 1 | 1 | 14 |
| src/inspector-organization.ts | 264 | 0 | 12 | 9 | 1 | 3 | 0 | 0 | 25 | 7 |
| src/shapes.ts | 428 | 0 | 12 | 4 | 2 | 8 | 7 | 13 | 29 | 12 |
| src/editorial-rules.ts | 253 | 0 | 10 | 1 | 1 | 2 | 0 | 2 | 31 | 7 |
| src/fonts.ts | 476 | 1 | 9 | 2 | 1 | 1 | 10 | 0 | 0 | 2 |
| src/publications.ts | 664 | 0 | 9 | 6 | 2 | 6 | 8 | 11 | 41 | 23 |
| src/editorial-learning.ts | 662 | 0 | 7 | 5 | 2 | 1 | 1 | 0 | 27 | 13 |
| src/output.ts | 574 | 0 | 7 | 2 | 4 | 2 | 7 | 7 | 3 | 11 |
| src/welcome.ts | 262 | 0 | 7 | 8 | 1 | 0 | 1 | 0 | 0 | 9 |
| src/editorial-assistant.ts | 651 | 0 | 6 | 7 | 1 | 3 | 0 | 0 | 73 | 8 |
| src/review-workspace.ts | 538 | 0 | 6 | 7 | 1 | 1 | 5 | 0 | 0 | 3 |
| src/layout-tools.ts | 422 | 0 | 5 | 7 | 0 | 3 | 0 | 0 | 0 | 4 |
| src/print-proof.ts | 270 | 0 | 5 | 1 | 2 | 5 | 0 | 0 | 18 | 10 |
| src/readability.ts | 297 | 0 | 5 | 4 | 0 | 0 | 1 | 0 | 19 | 77 |
| src/page-exceptions.ts | 87 | 0 | 4 | 2 | 0 | 1 | 0 | 0 | 13 | 1 |
| src/font-glyphs.ts | 206 | 0 | 3 | 6 | 2 | 1 | 2 | 0 | 19 | 5 |
| **Total (61 archivos)** | | **8** en 5 archivos | **260** en 35 archivos | 155 | 46 | 78 | 101 | 65 | 520 | — |

("Caracteres-ícono" incluye `·` y `×` de medidas, que son legítimos; los que de verdad hacen de ícono están en M2.)

### 3.4 Tokens: uso real

| Grupo | Dato |
|---|---|
| Variables definidas | 456: semantic 189, book 56, primitives 38 y unas 170 de componentes en organismos (dialog-content 40, welcome 20, font-browser 17…) |
| Sin uso | 24: `--petrol-950/900/750/700/600/500`, `--gold-300/500`, `--paper-200`, `--red-400`, `--line-accent`, `--text-on-danger`, `--status-success*` (3), `--warning`, `--duration-slow`, `--layer-canvas`, `--layer-modal`, `--type-large-title`, `--tracking-small`, `--type-2xs`, `--size-20/40` |
| Usadas una vez | 283 (la mayoría son medidas de un solo componente: `--glyph-*`, `--font-row-*`, `--welcome-*`…) |
| Roles tipográficos | `callout` 26, `body` 18, `footnote` 20, `title2` 6, `title3` 5, `caption2` 5, `title1` 5, `headline` 4, `large-title` 0. Alias viejos todavía usados: `--type-md` 23, `--type-xs` 22, `--type-sm` 18, `--type-lg` 6, `--type-xl` 4, `--type-2xl` 3. `headline` y `body` miden lo mismo (13 px) |
| Tamaños vistos en pantalla | 10, 11, 12, 13, 15, 17 y 22 px (escala) más 9, 10,67, 11,5, 14,67, 16, 18,67, 28, 37,3, 48, 56,8 y 58 (muestras de fuente, glifos, bienvenida y reglas) |
| Formas | `radius-md` 28, `radius-sm` 25, `radius-lg` 18, `pill` 6 · `elevation-1/2/3` 3/4/4 · materiales: `popover` 6, `sheet` 5, `bar` 4, `sidebar` 1 |
| Acento | `--accent` 31, `--surface-selected` 16, `--text-accent` 5 · dorado `--text-mark` 45, `--status-warning*` 32, `--focus-ring` 4 |
| Movimiento | `--ease-out` 34, `--duration-fast` 26, `--duration-base` 8, `--duration-slow` 0 |

Se conserva tal cual: la estructura primitivos → semánticos, los materiales con nombre, los roles tipográficos con `--ui-scale`, los z-index con nombre, `book.css` aparte y el control de `lint:design`.

### 3.5 Contraste (WCAG, texto sobre superficies; panel = `--material-sidebar` sobre Mica oscuro)

| Texto | Panel | Barra | Diálogo `#17272d` | Ventana sólida | Mesa | Campo |
|---|---|---|---|---|---|---|
| primario `#f4f5ee` | 14,7 | 14,4 | 14,0 | 14,6 | 16,1 | 15,7 |
| secundario `#b8c9c6` | 9,4 | 9,2 | 9,0 | 9,3 | 10,3 | 10,0 |
| terciario `#93aaa8` | 6,6 | 6,4 | 6,3 | 6,5 | 7,2 | 7,0 |
| deshabilitado `#6f8787` | **4,2** | **4,1** | **4,0** | **4,2** | 4,6 | 4,5 |
| dorado `#e4b16c` | 8,3 | 8,1 | 7,9 | 8,2 | 9,1 | 8,9 |
| verde agua `#55d8c5` | 9,2 | 9,0 | 8,8 | 9,1 | 10,1 | 9,8 |
| error `#e5806c` | 5,9 | 5,7 | 5,6 | 5,8 | 6,4 | 6,3 |

Texto sobre botón primario: 7,3. Botón deshabilitado (opacidad 0,4): 3,5 (exento por estar deshabilitado). El problema no es el color sino **el tamaño**: mucho texto en 10–11 px, y `--text-disabled` usado para información real (las letras de atajo del riel).

### 3.6 Textos

| Tema | Dato |
|---|---|
| Tono | Voseo consistente en castellano (Elegí, Guardá, Retomá). No hay tú ni usted |
| Idiomas | 520 `bw('es','en','pt')` en el código; en la interfaz en castellano se escapan "Desktop" y un eyebrow oculto "MAQUETARIO · PRINT" |
| Mayúsculas | Visibles: "SOLO ESTA PÁGINA" y "MAQUETARIO" (sobre la ilustración). Ocultas en el código: 8 eyebrows y "ESTUDIO EDITORIAL" |
| Sustantivos | libro / publicación / documento / proyecto / novela; grilla (21) / retícula (9) |
| Errores | "1 columnas · 1 filas"; "Tocá" ×3 en escritorio |
| Largo | Cubierta con 6 párrafos de ayuda; consejo fijo al pie del inspector; 60 párrafos `help` armados en JS |
| Botones | "Cancelar" usado para cerrar diálogos que no cancelan nada (atajos, galería, pauta, glifos, asistente) |

### 3.7 Barra superior, riel y estado (1536 px)

- Barra superior, 48 px: marca, 9 acciones sólo ícono, "Asistente editorial" (✦), "Imprimir", "Vista previa", "Exportar PDF" (primario).
- Barra del documento, 40 px: "Página activa 1" (dorado), "• La caída", "~ Imán" · Configurar libro, Tutorial, Aprender, Recorrido ▴.
- Ruta del libro, 45 px: 5 pasos en círculos dorados.
- Riel, 184 px: 9 herramientas con su letra de atajo y 3 vistas (Índice, Capas, Cubierta) mezcladas (evaluación #6), más la tira de páginas.
- Plantillas, 174 px, más la barra de zoom: − / deslizador / + / 73 % / Continuo / Ajustar / ? / Ampliar área (evaluación #5).
- Barra de estado, 28 px: "Página 1 de 6 · Sin selección · Unidades: mm · Guardado en tu equipo" (fijo).

### 3.8 Puntajes

**Heurísticas de Nielsen (0–4)**

| # | Heurística | Puntaje | Hallazgo clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 1 | El guardado dice "Guardado" con cambios; el modo vista previa casi no se nota |
| 2 | Lenguaje del usuario | 3 | Vocabulario del oficio, en castellano y con voseo; sustantivos mezclados |
| 3 | Control y libertad | 3 | Deshacer y confirmaciones con foco en Cancelar; la recuperación es ambigua |
| 4 | Consistencia | 2 | Dos confirmaciones, pares Cancelar/Cerrar, unidades en dos lugares, el dorado con 15 sentidos |
| 5 | Prevención de errores | 3 | Buenas confirmaciones destructivas y avisos de cierre |
| 6 | Reconocer antes que recordar | 2 | 9 acciones sólo ícono, pestañas escondidas tras un chevron |
| 7 | Flexibilidad y eficiencia | 3 | Atajos por letra, espacios de trabajo, paneles redimensionables |
| 8 | Estética y minimalismo | 2 | Barras que comen la página, rasgos genéricos, mucha ayuda fija |
| 9 | Recuperarse de errores | 2 | Avisos de error de 7 s sin acción; los de Motiova, claros |
| 10 | Ayuda y documentación | 2 | Mucha, pero con 9 puertas distintas |
| | **Total** | **23/40** | Aceptable: trabajo importante |

**Auditoría técnica (0–4)**

| # | Dimensión | Puntaje | Hallazgo clave |
|---|---|---|---|
| 1 | Accesibilidad | 2 | Foco visible y contraste bien; faltan nombres de diálogos y campos, y el patrón de pestañas |
| 2 | Rendimiento | 3 | 10 `backdrop-filter` sin efecto sobre Mica, 2 `MutationObserver` globales, PNG de 2 MB |
| 3 | Temas y tokens | 3 | Cero valores sueltos en CSS, pero 283 tokens de un solo uso y alias duplicados |
| 4 | Tamaños de pantalla | 1 | `minHeight` 760, 36 % de lienzo en 1366, bienvenida rota en 1366 y 1150 |
| 5 | Integridad del sistema | 2 | Componentes sólo en CSS; 35 módulos con marcado a mano |
| | **Total** | **11/20** | Aceptable |

### 3.9 Detector de impeccable

- **En los archivos** (`impeccable detect` sobre `index.html`, `ui/`, `src/` y `desktop/src/notice/`): **0 hallazgos**. No es una buena señal: casi todo el marcado lo arma JS en tiempo de ejecución, así que el detector estático no tiene qué mirar.
- **En la app viva:** la CSP de `index.html` (`script-src 'self'`, sin `'unsafe-eval'`) bloquea el WebAssembly del detector. Lo intenté también en una instancia aparte de Electron, con la interfaz servida sin CSP, pero no terminó en el tiempo disponible. **El detector del navegador no corrió**: lo reemplacé con las mediciones propias de cada estado (objetivos chicos, controles sin nombre, textos cortados, mayúsculas, tamaños de letra, contraste por tokens), que son la base de M1, M5 y las tablas 3.1, 3.5 y 3.6.
- Para la próxima: correr el detector sobre `scripts/serve-ui.cjs` en un Chrome común, o sumar un modo "revisión" en desarrollo que agregue `'wasm-unsafe-eval'` a la CSP sólo con `--dev`.

## 4. Decisiones para la etapa 3

**D1. ¿Qué librería de componentes y cómo convive con la capa `book`?**
- A) Reusar `packages/shared/ui` de Motiova: shadcn 4 + Tailwind 4 + `radix-ui` + lucide.
- B) `radix-ui` (el mismo paquete y la misma versión que Motiova, 1.6.x) sin estilos, con el CSS propio de `ui/` (tokens, `@layer`, clases actuales) como capa de estilo de cada componente React.
- C) React Aria Components (Adobe), que trae NumberField, ColorPicker, GridList con arrastre, Tree y formato de números por idioma.
- **Recomiendo B.** shadcn trae densidad y aspecto web (botón `h-9`, radio 0,625 rem, Nunito/Google Sans): es exactamente el "panel genérico" que se quiere evitar, y meter Tailwind en el editor duplica el sistema de tokens que ya funciona. Con B, el libro sigue intacto en `@layer book`: React sólo monta el marco (barras, paneles, diálogos) y deja `#spread` y `#printRoot` como nodos que maneja el motor actual (un `ref` y un efecto que llama a `render()`), sin que React reconcilie el pliego. Los tres huecos de Radix (campo numérico con unidad, color, lista ordenable) se hacen propios. Si después aparecen más huecos, se pueden tomar sólo los *hooks* de React Aria (`useNumberField`, `useDrag`) sin adoptar toda la librería.

**D2. ¿Migrar pantalla por pantalla o componente por componente?**
- A) Por componente: primero botón, campo y selector en toda la app.
- B) Por pantalla: cada organismo pasa entero a React (de la periferia al centro).
- C) Mixta: primero se termina la **API de `components.js`** en el código actual (reemplazar los 77 `btn` y los 155 `<button>` a mano por `UI.button`, etc.) y después cada función se vuelve un componente React con la misma API, pantalla por pantalla.
- **Recomiendo C en dos tiempos.** Con 7 usos de `UI.*`, migrar por componente obliga a tocar 35 módulos dos veces. Orden de pantallas sugerido, de menos a más acoplada al lienzo: avisos de sistema y toasts → diálogos simples (confirmación, atajos, configuración) → bienvenida → diálogos grandes (salida, cubierta, asistente, glosario, fuentes) → barra superior y de estado → inspector → riel y tira de páginas. Lo que toca el lienzo va al final. Cada paso se verifica con la autoprueba y los PDF idénticos, como hasta ahora.

**D3. ¿Qué hacer con el inspector de 7 pestañas?**
- A) Dejar las 7, con desborde.
- B) Agruparlas en 3: **Libro** (estructura, diseño de página/grilla, índice) · **Página** (excepciones, capas) · **Selección** (texto/párrafo u objeto, según lo seleccionado), como el panel Propiedades de InDesign.
- C) Que el inspector sea contextual (sin pestañas fijas) y que Capas e Índice vayan como paneles del riel.
- **Recomiendo B, con Capas e Índice como vistas del riel izquierdo** (eso resuelve también la evaluación #6). Son 3 pestañas que entran en 320 px a 13 px, y "Selección" cambia sola según lo elegido. Además: títulos de sección a `headline` (13 px semibold) en vez de `title2`, la unidad siempre dentro del campo y el consejo del pie como ayuda que se puede descartar.

**D4. ¿Cuántas variantes de diálogo?**
- A) Una sola, configurable (como hoy).
- B) Tres: **Confirmación** (AlertDialog, 420 px, sin cruz, verbo en el botón), **Hoja** (sheet de macOS: formularios cortos, botones abajo a la derecha, sin "Cancelar" cuando sólo informa) y **Ventana de trabajo** (salida, cubierta, asistente, fuentes, glosario: pantalla casi completa con barra lateral propia, sin pie fijo de Cancelar/Aplicar).
- **Recomiendo B.** También: prohibir el diálogo sobre diálogo (el explorador de fuentes pasa a popover o a panel dentro de Glifos) y pasar la cubierta a vista de trabajo (no diálogo).

**D5. ¿Cómo compartir tokens con Motiova?**
- A) Mismos valores: imposible, son identidades distintas (Motiova: violeta `#69398e` y teal `#52bdc1`, Nunito y Google Sans; Maquetario: petróleo, verde agua y dorado, DM Sans).
- B) **Mismo contrato de nombres, valores propios:** un paquete `@motiova/tokens` (o `packages/tokens` en cada repo) con los nombres semánticos que ya usa shadcn en Motiova (`background`, `foreground`, `primary`, `muted`, `border`, `ring`, `popover`, `destructive`…), más los que Maquetario necesita (`material-*`, `elevation-*`, `type-*` por rol). Cada producto define sus valores; Motiova los mapea en `@theme` de Tailwind 4 y Maquetario en `ui/tokens/semantic.css`.
- C) No compartir nada.
- **Recomiendo B.** Permite que un componente de Motiova (por ejemplo el login o la cuenta) se vea bien en Maquetario y al revés, sin forzar el aspecto. El formato puede ser JSON (DTCG) con un script que genere el CSS. Mantener el mismo `radix-ui` y, si se quiere, `lucide` como set de íconos común, o seguir con el set propio, que es más editorial.

**D6. ¿Qué se conserva tal cual?**
- Recomiendo conservar: `ui/tokens/primitives.css`, `semantic.css` (limpiando los 24 sin uso y los alias `--type-xs…`) y `book.css`; el orden de capas con `book` abajo; los materiales; los roles tipográficos con `--ui-scale`; `lint:design` (sumándole "no `className` a mano fuera de componentes"); `extend()` y `registerInspectorPanel()` como puente mientras convivan React y JS; `confirm.ts` (su API ya es la de un AlertDialog) y los avisos de sistema (rehacerlos con los mismos tokens).
- Se tira: `dialog-content.css` (188 bloques), las reglas de zona de `field.css`, `select.js`, los eyebrows ocultos y los 283 tokens de un solo uso (pasan a ser medidas internas del componente).

**D7. ¿El dorado qué significa?**
- **Recomiendo:** dorado = foco y "estás acá" (página activa en la tira, paso actual). Verde agua = acción y selección. Advertencias = ámbar propio (hoy `--status-warning` es el mismo dorado). Todo lo demás (subtítulos de plantillas, zoom, encabezados de tabla, chips, la chispa) pasa a neutros. Se decide antes de componentes para que entre en los tokens.

**D8. ¿Una sola puerta de ayuda?**
- **Recomiendo** un centro de Ayuda único (Tutorial, Glosario, Atajos, Recorridos) con una entrada fija en la barra superior. Se sacan Aprender y Recorrido de la barra del documento, y los "?" de sección abren el término en ese centro. La ruta 1–5 pasa a ser un indicador sobrio de etapa (o parte de la ayuda), no círculos dorados permanentes.

**D9. ¿Qué es "glass" en concreto?**
- **Recomiendo:** el material del sistema (Mica / vibrancy) sólo en el fondo de la ventana y las barras. Paneles laterales opacos (`--material-sidebar` al 92–95 %, sin `backdrop-filter`, porque no hay nada detrás que desenfocar). Popovers y diálogos opacos con velo. **Sin degradés de ambiente.** El "vidrio" se nota en el canto de luz de 1 px (`--material-edge`), en las sombras de `elevation` y en dejar ver el escritorio en la barra superior; no en tintes. Así queda serio y legible con brillo bajo.

## 5. Instalador y primera experiencia

### Hallazgos

| # | Qué | Dónde | Prioridad |
|---|---|---|---|
| I1 | **No hay asociación de archivos .mqt** ni manejo de `open-file` o de `argv`: doble clic en un proyecto no lo abre, y con la app abierta sólo la enfoca | `desktop/package.json → build` (falta `fileAssociations`), `main.ts` (`second-instance`) | Alto · Ya |
| I2 | **macOS y Linux sin ícono propio:** sólo `win.icon` apunta al `.ico`; no hay `mac.icon` (`.icns`) ni `build/icon.png`, así que el DMG y el AppImage salen con el ícono de Electron (confirmar con un `npm run dist` en Mac) | `desktop/package.json` | Alto · Ya |
| I3 | Instalador NSIS `oneClick` por usuario: no muestra páginas, así que la identidad de `LibroStudio/v3/installer-brand/` (`welcome.bmp`, `mark.bmp`) no se usa. Lo primero que ve la persona es SmartScreen ("editor desconocido", sin firma) y después la app abierta (`runAfterFinish`) | `nsis` | Medio · Decidir |
| I4 | DMG sin configuración (fondo, posición de íconos, enlace a Aplicaciones) | `mac` / `dmg` | Medio |
| I5 | `minHeight 760` y tamaño inicial 1536×1024 (ver C2): en una notebook la primera ventana ya no entra | `main.ts` | Crítico · Ya |
| I6 | Primera apertura con una copia de recuperación: el primer contacto es un diálogo con foco en la cruz y "Cancelar" ambiguo (M6) | `studio.js → offerRecovery()` | Medio · Ya |
| I7 | Avisos de sistema (680×380): tienen su propio sistema (tokens propios, cuerpo de 14,5 px, radio de 7 px, colores escritos), un degradé de fondo y un filete dorado bajo el título que repite el de la ilustración (`brand-art.jpg` ya trae "Maquetario" y su filete) | `desktop/src/notice/notice.css` | Medio · E3 |
| I8 | "Seguí en el navegador" no muestra progreso ni tiempo de espera. Con el tope de equipos, el aviso vuelve a ofrecer "Conectar con Motiova" (lo mismo que falló) en vez de un enlace a Mi cuenta → Mis programas | `main.ts → licenseGate()` | Medio · Ya |
| I9 | La página que ve el navegador al volver de Motiova (`motiova/client.ts → PAGE`) usa `system-ui` y otra paleta: es una cuarta identidad visual | `desktop/src/main/motiova/client.ts` | Bajo |
| I10 | Nombre y descripción con mayúsculas distintas: título de ventana "Maquetación y Diseño de Libros", `description` "Maquetación y diseño de libros" | `main.ts`, `package.json`, `index.html` | Bajo |
| I11 | En Windows no hay menú (`Menu.setApplicationMenu(null)`): los atajos sólo se descubren en "Moverse por la maqueta" y en los `title` | `main.ts → applicationMenu()` | Bajo · Decidir |
| I12 | Bienvenida: la portada de marketing a 58 px y la ilustración se comen la mitad derecha. "Crear un libro", "Abrir proyecto" y "Armar una novela" quedan al mismo nivel que 4–5 accesos de "Para empezar"; el pie se superpone en notebooks (A8) | `src/welcome.ts`, `welcome.css` | Medio |

El ícono de Windows está bien: `maquetario.ico` trae 16, 24, 32, 48, 64, 128 y 256 px a 32 bits.

### Decisiones

- **¿El instalador de Windows muestra marca?** A) Seguir con `oneClick` (rápido; la marca aparece recién en la app) o B) asistente con páginas y `installerSidebar` con la identidad de `installer-brand`. **Recomiendo A** hasta que exista el launcher: menos pasos para estudiantes. La primera impresión se cuida en la primera pantalla de la app, y la firma de código (pendiente) pesa más que cualquier imagen del instalador.
- **¿Qué ve alguien la primera vez?** **Recomiendo** una bienvenida de herramienta, no de marketing: dos acciones claras (Crear un libro, Abrir), el libro de ejemplo como tercera, recientes y una sola entrada a la Ayuda. La ilustración puede quedar más chica o pasar al aviso de licencia, donde ya está. Y que la recuperación no sea un diálogo encima, sino una fila destacada en Recientes ("Copia de recuperación de *La caída* · Abrir · Descartar").
- **¿Los avisos de sistema usan los tokens de la app?** **Recomiendo** sí, cuando exista el paquete de tokens (D5). Mientras tanto: sacar el degradé y uno de los dos filetes.
- **Asociación de .mqt e íconos por sistema:** no es una decisión, es lo que falta para que el programa se comporte como uno instalado. Agregarlo antes de la versión a la venta.
