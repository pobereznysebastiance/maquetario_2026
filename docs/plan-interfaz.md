# Plan de interfaz: sistema de diseño de Maquetario

Etapa 3 del plan general (ver `arquitectura.md`). Contexto de producto en `/PRODUCT.md`.

## Diagnóstico (medido sobre `LibroStudio/v3/app`, 23 hojas de estilo, 98 KB)

| Medida | Hoy | Meta |
|---|---|---|
| Colores escritos a mano en CSS | 974 usos, **633 distintos** | 0 fuera de los tokens |
| Colores escritos en JS | 61 | 0 |
| Estilos inline desde JS (`style=`, `.style.x=`) | 98 | Sólo geometría del documento (posición y tamaño de lo que el usuario dibuja) |
| Sombras distintas | 56 | 3 niveles de elevación |
| Radios distintos | 31 | 3 |
| Tamaños de letra distintos | 34 | 6 en la escala de interfaz |
| Desenfoques (`backdrop-filter`) | 5 valores sueltos | 3 materiales |
| `!important` | 70 | 0 (las capas de cascada lo vuelven innecesario) |
| Variables CSS definidas | 19, con `:root` redefinido en 4 archivos | Un solo origen de tokens |
| Archivos que redefinen `.btn` | **15** (29 reglas) | 1 componente |

La causa es estructural: cada función nueva trajo su hoja de estilos y pisó a la anterior (`studio.css` → `maquetario.css` → `glass.css` → `crystal.css`). El "glass" actual son capas de degradés y desenfoques sumados encima, no un material definido. Por eso se ve genérico: no hay un sistema que decida, hay acumulación.

## Principios

1. **La página manda.** El papel es contenido del usuario: nunca translúcido, nunca teñido. El vidrio es para lo que rodea al libro.
2. **Vidrio como material, no como efecto.** Pocos materiales con nombre, cada uno con su función (ver abajo), igual que en macOS. Nada de brillos, halos ni degradés decorativos.
3. **Un componente por concepto.** Un botón, un campo, un panel. Las variantes son modificadores del mismo componente, no copias.
4. **Tokens o nada.** Ningún valor visual fuera de `ui/tokens`. Un control automático lo hace cumplir.
5. **Identidad del instalador.** Petróleo, verde agua, filete dorado, DM Sans, el isotipo. El dorado es acento escaso (foco, estado activo, filetes), no relleno.

## Arquitectura

```
LibroStudio/v3/app/ui/
  tokens/
    primitives.css     Rampas de color (petróleo, verde agua, dorado, neutros), escalas crudas.
    semantic.css       Lo que usan los componentes: --surface-*, --text-*, --action-*, --focus,
                       --danger, --material-*, --elevation-*, --radius-*, --space-*, --type-*, --motion-*.
  base.css             Reset, tipografía de interfaz, foco visible, barras de desplazamiento.
  atoms/               button, icon-button, input, select, checkbox, switch, slider,
                       segmented, badge, kbd, divider, icon, spinner.
  molecules/           field (etiqueta + control + ayuda), tool-item (ícono + nombre + atajo),
                       tab, menu-item, toast, tooltip, section-header, number-stepper.
  organisms/           toolbar, tool-rail, inspector, page-strip, modal/sheet, popover,
                       status-bar, notice, welcome.
  templates/           workspace (grilla de la ventana), sheet (diálogos).
  book/                Lo que dibuja el libro: página y objetos, selección, miniaturas, mesa, impresión.
  index.css            Orden de capas: @layer book, tokens, base, atoms, molecules, organisms, templates.
  components.js        Funciones que arman el HTML de cada componente (ui.button({...})),
                       para dejar de concatenar clases y estilos a mano en cada módulo.
```

- **Capas de cascada (`@layer`).** El CSS viejo entró entero en una capa `legacy`, la de menor prioridad, y se migró pantalla por pantalla. Desde el 8-nov `legacy` no existe: en su lugar está `book`, con lo que dibuja el libro, y la interfaz le gana siempre sin `!important`.
- **Mismos nombres al pasar a React.** Los componentes React de la etapa 2/3 van a usar estos mismos tokens y clases: lo que se hace ahora no se tira.
- **Control automático.** `npm test` incluye un chequeo que falla si aparece un color, sombra, radio o tamaño de letra literal fuera de `ui/tokens`. También falla si aparece una hoja `.css` fuera de `ui/`.

## Materiales (el vidrio)

| Material | Dónde | Comportamiento |
|---|---|---|
| `--material-window` | Fondo de la ventana | En macOS, translucidez real del sistema (`vibrancy`); en Windows 11, Mica (`backgroundMaterial`). Sin soporte, color petróleo sólido. |
| `--material-sidebar` | Herramientas, páginas, inspector | Casi opaco (94 %), sin desenfoque: detrás no hay nada propio. Canto de luz arriba. |
| `--material-bar` | Barra superior y de estado | El único vidrio: deja ver el material del sistema (la barra superior con desenfoque). Canto de luz de 1 px. |
| `--material-popover` | Menús, tooltips, selectores | Opaco, con canto de luz y elevación (`--shadow-popover`). |
| `--material-sheet` | Diálogos | Opaco con velo detrás, canto de luz y elevación (`--shadow-sheet`). |

"Glass" (D9): el material del sistema sólo en el fondo de la ventana y las barras; el vidrio se nota en el canto de luz (`--material-edge`) y en la elevación, no en tintes ni degradés. La acción principal se llama `--action` (`--accent` es el nombre de shadcn para el fondo sutil al pasar, en el contrato con Motiova). El lienzo (la mesa de trabajo alrededor de la página) es sólido y neutro, para que el color del libro se juzgue bien. El vidrio nunca queda detrás de la página.

## Diálogos: tres tipos (D4)

Se elige el tipo con la función, nunca con una clase de tamaño. Todos usan `#modal` (salvo la confirmación simple, que es `#confirmDialog`); el tipo queda en `data-kind` y el ancho de la hoja en `data-size` mientras dure la apertura. Los tamaños son tokens `--dialog-*` de `ui/tokens/semantic.css`.

| Tipo | Función | Forma |
|---|---|---|
| Confirmación | `confirmAction` / `askChoice` (`src/components/dialog/dialogs.tsx`, React + Radix AlertDialog), o `modal.confirm(título, cuerpo, aplicar, 'Verbo')` si lleva contenido propio | 420 px, sin cruz, el verbo en el botón. |
| Hoja | `modal.sheet(título, cuerpo, aplicar, 'Verbo', { size: 'sm' \| 'md' \| 'lg' })`; `modal.info(título, cuerpo, 'Listo')` si sólo informa | 560 / 820 / 1040 px. Cancelar + verbo, o un solo botón. `modal(...)` sin más es una Hoja mediana. |
| Ventana de trabajo | `modal.workspace(título, cuerpo, { action: { label, run } })` | Casi pantalla completa (tope 1600 px), sin pie: título, acciones y cruz en una barra arriba. |

`variant` (en las opciones) pone una clase para el contenido de esa pantalla, no para su tamaño; `cancelLabel` cambia el texto de Cancelar ("Ahora no"). Nada de diálogo sobre diálogo: una Hoja o una Ventana reemplaza a la que esté abierta, y el explorador de fuentes abierto desde una Hoja ocupa su lugar. Sólo una Confirmación puede quedar encima de una Hoja (por ejemplo, "Cerrar sesión" desde Configuración).

## Orden de trabajo

1. **Base**: tokens, capas, `base.css`, control automático. Botón, campo e ícono como primeros átomos. Translucidez real de la ventana en Electron.
2. **Marco de trabajo**: barra superior, barra de herramientas, tira de páginas, inspector y barra de estado. Es lo que se ve el 100 % del tiempo.
3. **Diálogos y avisos**: modal/sheet único, avisos, tostadas, menús.
4. **Paneles específicos**: fuentes, salida/PDF, cubierta, legibilidad, asistente, tutorial, bienvenida.
5. **Limpieza** (hecha el 8-nov): `legacy` vaciada; `glass.css`, `crystal.css` y las otras 19 hojas ya no existen.

En cada etapa: autoprueba completa, capturas en notebook (1366×768), monitor grande (2560×1440) y Retina, y revisión de impeccable.

## Avance

- **Hecho**: tokens y capas, base, átomos (botón, campo, ícono), control automático (`npm run lint:design`), ventana con Mica/vibrancy y barra de título integrada, barra superior, paneles laterales pegados al borde, inspector (secciones de arriba hacia abajo, sin tarjetas anidadas), Configuración (cuenta, idioma, tamaño de la interfaz, carpetas de fuentes, acerca de), avisos de sistema.
- **Pendiente**: tira de páginas y herramientas, barra de estado y plantillas, diálogo/modal único (hoy usa legacy, con etiqueta superior vacía y cruz como carácter), menús y tostadas, paneles específicos (fuentes, salida, cubierta, legibilidad, asistente, tutorial, bienvenida), vaciar legacy.
- **Transitorio a resolver en la etapa 2**: el idioma cambia por la cadena de `onchange` de `#language` (oculto); Configuración pasa por `setLanguage()` para que el reemplazo se haga en un solo lugar.

## Decisiones abiertas

- ~~Translucidez real del sistema~~ → decidido: Mica en Windows 11 y vibrancy en macOS; color sólido donde no existe.
- Tema claro: hoy la app es sólo oscura. El sistema queda preparado para un tema claro, pero no está pedido.
