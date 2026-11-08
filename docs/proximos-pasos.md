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

`npm run lint:design` informa la deuda: 811 colores (eran 965), 137 anchos fijos, 63 `!important`, 111 estilos desde JS. Criterio: cuando una pieza ya está en su organismo de `ui/`, borrar sus reglas de las hojas viejas.

**Método** (probado con `glass.css` y `crystal.css`):

1. Servir la interfaz (`node scripts/serve-ui.cjs LibroStudio/v3/app 5179`), pegar `scripts/legacy-probe.js` en la consola y correr `legacyProbe('estado')` en cada estado: bienvenida, sin documento, cada pestaña, con selección, multiselección, diálogos, tutorial, pantalla angosta.
2. `legacyReport()` separa las reglas en muertas, efectivas, `:hover`/`:focus` sin cubrir y sin probar. Borrar las muertas con `node scripts/prune-css.cjs`.
3. Guardar las capturas de la autoprueba antes, correr `npm run self-test` y compararlas con `npx electron scripts/compare-captures.cjs <antes> <después> <salida>` (`UMBRAL=4` para lo fino). Lo que la sonda no visitó aparece ahí: devolver esas reglas y repetir hasta que la diferencia máxima sea 1/255 (ruido del renderizado).

**Hecho:** 70 reglas muertas borradas de `glass.css` (145 → 93) y `crystal.css` (47 → 29). Capturas idénticas.

**Queda en esas dos hojas** (122 reglas): unas 80 efectivas que corresponden a piezas sin organismo en `ui/`, y unas 30 sin probar.

- Piezas sin organismo: bienvenida con la escultura de páginas; ruta del libro (`book-route`); estructura (`structure-item`, `structure-summary`); marca y etiqueta de página activa; selección y multiselección de objetos; filas de capas; índice (`toc-entry`); armador de libros (`builder-*`); controles de figuras; interruptor; botones de alineación activos; aviso flotante (`#toast`).
- `:hover`/`:focus` que `ui/` no fija: `.btn`, `.btn.primary`, foco de campos, `.tool`, `.tool-action`, botones de la ruta y de las solapas de cubierta. Van a `atoms/button.css` y `atoms/field.css`.
- Sin probar (sus elementos no aparecieron en la sonda): figuras dibujadas, imán, preflight, armador, recientes.

Siguiente: crear los organismos que faltan, revisados con impeccable, y borrar sus reglas de legacy. Después, el mismo método con las otras 21 hojas.

## 3. Experiencia de uso

Observaciones en `docs/evaluacion-uso.md` (13 puntos). Las más visibles: la etiqueta "Página activa N" pintada sobre el papel, las siete pestañas del inspector, y las muchas puertas de ayuda (Tutorial, Aprender, Recorrido, "?", glosario).

## 4. Distribución

- Launcher y backend en Motiova (contrato en `docs/arquitectura.md` → "Licencias y launcher" e "Instalación y actualizaciones").
- Activar `licenseMode: "enforce"` en `desktop/package.json` cuando exista el launcher.
- Firma de código: certificado de Windows (Azure Trusted Signing u OV/EV) y Apple Developer.

## Decisiones abiertas

Edición o versión en la licencia; pago único o suscripción; días sin conexión.

## Informe para Seba

Fuente: `docs/informe/informe.html`. Regenerar el PDF:

```bash
npx electron scripts/render-pdf.cjs docs/informe/informe.html "docs/informe/Maquetario - Informe técnico version-juan.pdf" "Maquetario · Informe técnico de la rama version-juan"
```

Pendiente de sumar al próximo informe: registro de extensiones (127 cadenas convertidas).
