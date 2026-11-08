# Próximos pasos (rama version-juan)

Hoja de ruta para retomar. Estado al cierre: todo subido, `npm test` y `npm run self-test` en verde.

## Antes de cada commit

```bash
npm test            # licencias, lector de fuentes, control de diseño (y deuda)
npm run typecheck
npm run self-test   # 25+ pasos sobre la app real; capturas en %APPDATA%\Maquetario-autoprueba\self-test
```

Commits en castellano, sin líneas de autoría de IA.

## 1. Inspector como registro de paneles y decoradores

Diseño y relevamiento completo en `docs/arquitectura.md` → "Próximo paso de arquitectura". Las 17 extensiones de `inspector` ya pasan por `extend()` (`LibroStudio/v3/app/extend.js`). Pasos:

1. Hecho: `decorateInspector(fn)` y `registerInspectorPanel(tab, render)` en `inspector-registry.js`; 14 de las 17 extensiones convertidas (decoradores y la pestaña Estructura). **Faltan 3**: pestaña Objeto (`inspector-organization.js`), pestaña Capas (`layout-tools.js`) y la envoltura de `master-refinement.js` (pausa durante el ajuste en vivo + conservar scroll y `<details>`).
2. Convertir una extensión por vez, de las más simples a las más complejas: decoradores puros (editorial-learning, font-browser, font-glyphs, shapes, document-units) → decoradores por pestaña (paragraphs ×2, page-exceptions, review-workspace, fonts, folio-position, editorial-rules) → rutas (book-workflow: `structure`; inspector-organization: `object`) → envoltura (master-refinement).
3. Autoprueba después de cada grupo. Ver el orden con `MaquetarioExtensions.list().inspector`.

## 2. Vaciar la capa legacy

`npm run lint:design` informa la deuda: 965 colores, 137 anchos fijos, 63 `!important`, 111 estilos desde JS. Criterio: cuando una pieza ya está en su organismo de `ui/`, borrar sus reglas de las hojas viejas. Empezar por `glass.css` y `crystal.css` (capas de "vidrio" ya reemplazadas por los materiales de `ui/tokens/semantic.css`).

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
