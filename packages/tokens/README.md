# @maquetario/tokens · contrato de tokens con Motiova (D5)

Maquetario y Motiova usan **los mismos nombres de tokens semánticos con valores propios**: un componente pensado para uno (el login, la cuenta, un diálogo) se ve bien en el otro sin copiar su aspecto. Decisión D5 de `docs/INTERFAZ_08-nov_decisiones-etapa3.md`.

## Qué hay acá

- `tokens.json`: el contrato en formato DTCG (Design Tokens Community Group). Cada hoja es un token con `$value` (el valor de Maquetario), `$type`, `$description` y `$extensions.maquetario.var`: el token de `LibroStudio/v3/app/ui/tokens/semantic.css` al que corresponde.
- `scripts/build.mjs`: genera `LibroStudio/v3/app/ui/tokens/contract.css`. Sólo usa node, sin dependencias.

**Regla de nombres:** la clave de cada hoja es el nombre CSS sin los dos guiones (`background` → `--background`, `material-sidebar` → `--material-sidebar`). Los grupos de primer nivel (`color`, `font`, `radius`, `material`, `elevation`, `type`, `status`) sólo ordenan y no forman parte del nombre.

## En Maquetario

`contract.css` se carga en `ui/index.css`, en la capa `tokens`, después de `semantic.css`. Declara los nombres comunes como **alias** de los tokens propios (`--background: var(--surface-window)`, `--primary: var(--action)`, `--accent: var(--surface-control-hover)`…). Así no cambia nada visualmente y los valores siguen viviendo en `semantic.css`. Los nombres del contrato que ya existen en Maquetario (`--material-*`, `--elevation-*`, `--type-*`, `--status-*`, `--radius-sm/md/lg`) no se repiten.

```bash
npm run build --workspace @maquetario/tokens   # regenera contract.css desde tokens.json
npm run sync --workspace @maquetario/tokens    # después de cambiar semantic.css: copia los valores a tokens.json
npm test --workspace @maquetario/tokens        # verifica (también corre en npm test y en lint:design)
```

La verificación falla en dos casos:
- `contract.css` no coincide con lo que genera `tokens.json`;
- un `$value` no es el valor real de Maquetario, resuelto desde `primitives.css` y `semantic.css` con los `var()` y con la escala de interfaz en 1.

Si cambiaste un color en `semantic.css` a propósito, `npm run sync` actualiza el contrato.

Los componentes nuevos (React + Radix, D1) pueden usar los nombres del contrato (`var(--primary)`, `var(--border)`, `var(--popover)`) o los de Maquetario: son el mismo valor. Conviene usar el contrato en lo que se piense compartir con Motiova.

## Los nombres

| Grupo | Nombres | Origen |
|---|---|---|
| color | `background`, `foreground`, `card`, `card-foreground`, `popover`, `popover-foreground`, `primary`, `primary-foreground`, `secondary`, `secondary-foreground`, `muted`, `muted-foreground`, `accent`, `accent-foreground`, `destructive`, `border`, `input`, `ring`, `highlight`, `highlight-foreground` | shadcn / Motiova |
| color | `sidebar`, `sidebar-foreground`, `sidebar-primary`, `sidebar-primary-foreground`, `sidebar-accent`, `sidebar-accent-foreground`, `sidebar-border`, `sidebar-ring` | shadcn / Motiova |
| font | `font-sans`, `font-heading` | Motiova (`@theme`) |
| radius | `radius` (base), `radius-sm`, `radius-md`, `radius-lg` | Motiova (`--radius` y derivados) |
| material | `material-sidebar`, `material-bar`, `material-popover`, `material-sheet`, `material-scrim`, `material-blur-bar`, `material-edge` | Maquetario. "Glass" (D9): el material del sistema sólo en la ventana y las barras; paneles, menús y diálogos opacos |
| elevation | `elevation-1`, `elevation-2`, `elevation-3` | Maquetario |
| type | `type-caption2`, `type-footnote`, `type-callout`, `type-body`, `type-headline`, `type-title3`, `type-title2`, `type-title1`, `type-large-title` | Maquetario (roles de macOS) |
| status | `status-{error,warning,success,info}` y sus variantes `-surface` y `-line` | Maquetario |

`accent` tiene el sentido de shadcn: el fondo sutil al pasar el mouse o resaltar (en Maquetario, `--surface-control-hover`). La acción principal de Maquetario se llama `--action` (en el contrato, `primary`). Hasta el 09-nov se llamaba `--accent` y chocaba con este nombre.

**Tiene Motiova, no el contrato:** `chart-1…5` (Maquetario no tiene gráficos), los colores crudos de marca (`brand-*`), los radios `radius-xl…4xl` y el modo Terminal.
**Tiene el contrato, no Motiova:** `material-*`, `elevation-*`, `type-*` y `status-*` (Motiova sólo tiene `destructive`).

## Cómo lo usaría Motiova

Motiova (Tailwind 4 + shadcn) ya usa casi todos los nombres de color. Para adoptar el contrato:

1. Tener su propio `tokens.json` con **las mismas claves** y sus valores, con un archivo por modo (claro, `.dark`, `.terminal`), o copiar este y cambiar los `$value`.
2. Generar su `:root` / `.dark` desde el JSON, o seguir escribiéndolo a mano y sumar en CI una verificación de que las claves coinciden con el contrato.
3. Mapear en `@theme inline` lo que hoy no tiene, con el mismo patrón que usa para los colores:

```css
@theme inline {
  --color-material-sheet: var(--material-sheet);
  --color-status-warning: var(--status-warning);
  --color-status-warning-surface: var(--status-warning-surface);
  --shadow-elevation-2: var(--elevation-2);
  --text-body: var(--type-body);
  --text-footnote: var(--type-footnote);
}
:root {
  /* Valores de ejemplo: los pone Motiova. */
  --material-sheet: #ffffff;
  --status-warning: #b07800;
  --elevation-2: 0 6px 16px -6px rgb(0 0 0 / 0.18);
  --type-body: 0.875rem;
}
```

Con eso, una clase como `bg-material-sheet`, `text-status-warning`, `shadow-elevation-2` o `text-body` funciona en Motiova. Y un componente que use `var(--popover)` o `var(--status-warning)` se ve bien en las dos apps.

## Qué hay que acordar con el equipo de Motiova

1. **`accent`: resuelto de nuestro lado.** Maquetario renombró su acción a `--action` (y `--action-hover`, `--action-pressed`) y emite `accent` con el sentido de shadcn. Falta que Motiova confirme que su `accent` es el mismo: el fondo sutil de menús y filas.
2. **Radios.** Motiova deriva `sm`/`md` del radio base con `calc()` (×0,6 y ×0,8). Maquetario los fija (4, 6 y 8 px: ×0,5 y ×0,75). Hay que acordar si el contrato fija los tres valores o sólo la base.
3. **Modos.** Maquetario es sólo oscuro; Motiova tiene claro, oscuro y Terminal. DTCG no tiene modos: hay que elegir entre un archivo por modo o `$extensions` por modo.
4. **Formato de los valores.** Acá van como texto CSS (`#13242b`, `rgb(… / 0.62)`, `0 6px 16px …`). Es la forma de los borradores de DTCG, y la entiende cualquier herramienta que acepte CSS. La versión estable de DTCG (2025) pide objetos para `color`, `dimension` y `shadow`. Si Motiova usa Style Dictionary, conviene acordar cuál de las dos.
5. **Qué quiere decir cada nombre** cuando los productos no coinciden:
   - `card` es la hoja o diálogo de Maquetario, que no tiene tarjetas;
   - `muted` es el fondo hundido de los campos;
   - `input` es el borde de los campos (en shadcn oscuro también es el relleno del interruptor);
   - `highlight` es el dorado "estás acá" de Maquetario y el amarillo de Motiova;
   - `ring` es el dorado de foco, contra el verde agua o el violeta de Motiova.
6. **Roles tipográficos y elevación.** Motiova hoy usa la escala y las sombras de Tailwind. Hay que ver si adopta `type-*` y `elevation-*`, o si quedan como extensión de Maquetario.
7. **`destructive-foreground`.** shadcn 4 lo sacó y Motiova no lo tiene. Maquetario tiene `--text-on-danger`, pero no lo usa todavía. Lo dejamos fuera del contrato.
8. **Dónde vive el contrato.** Puede ser una copia en cada repo con una verificación cruzada de claves, o un paquete único (`@motiova/tokens`) del que dependan los dos. Lo segundo evita que se separen, pero suma una dependencia publicada.
