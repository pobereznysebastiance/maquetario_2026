# Próximos pasos (rama version-juan)

Hoja de ruta para retomar. Estado al cierre: todo subido, `npm test` y `npm run self-test` en verde.

## Antes de cada commit

```bash
npm test            # licencias, lector de fuentes, control de diseño (y deuda)
npm run typecheck
npm run self-test   # 25+ pasos sobre la app real; capturas en %APPDATA%\Maquetario-autoprueba\self-test
```

Commits en castellano, sin líneas de autoría de IA.

## 1. Inspector como registro (hecho) → seguir con las otras funciones

Las 17 extensiones de `inspector` pasan por el registro (`inspector-registry.js`): `decorateInspector`, `registerInspectorPanel` (Estructura, Objeto, Capas) y `pauseInspectorWhile` (ajuste en vivo de maestras). El scroll y los `<details>` abiertos se conservan una sola vez, por fuera de toda la cadena (`extend.around`). Ningún módulo llama `extend('inspector', …)` directamente.

Siguiente, con el mismo enfoque: `render` (6), `paper` (5), `prepareOutput` (4), `coverEditor` (4) y `autoElement` (4); después las 14 de `runIntegrationTests` a un registro de pruebas. Ver qué módulo extiende cada función con `MaquetarioExtensions.list()`. Autoprueba después de cada función convertida.

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
