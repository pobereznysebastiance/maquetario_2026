# Maquetario · instrucciones para trabajar en este repo

Editor de maquetación editorial creado por Sebastián Poberezny. Rama de trabajo: `version-juan` (Juan Cruz Canteros, Tiny Studio). Se vende en Motiova: el programa se conecta con la cuenta y recibe una licencia firmada por equipo (`desktop/src/main/motiova/`; el launcher puede venir después).

## Antes de empezar

Leer `docs/proximos-pasos.md` (hoja de ruta), `docs/arquitectura.md` (estructura y decisiones), `docs/plan-interfaz.md` (sistema de diseño) y `PRODUCT.md` (usuarios y criterios).

## Reglas

- **Commits en castellano, sin líneas de autoría de IA** (nada de `Co-Authored-By` ni marcas similares). Título corto y cuerpo con viñetas de qué cambió y por qué.
- Antes de cada commit: `npm test`, `npm run typecheck` y `npm run self-test`. No commitear con fallas.
- Sistema de diseño: ningún color ni medida suelta en `LibroStudio/v3/app/ui/` (lo controla `npm run lint:design`). Componentes por capas (tokens → átomos → moléculas → organismos → plantillas); el marcado de componentes sale de `src/ui/components.ts`.
- Nada que parezca generado por IA: sin etiquetas chicas en mayúsculas sobre títulos, sin degradés decorativos, sin bordes laterales de color, sin tarjetas anidadas. Tipografía con los roles de macOS (tokens `--type-*`). Revisar con impeccable por grupos.
- TypeScript de la interfaz en `LibroStudio/v3/app/src/` (estricto): `src/entries/` son los puntos de entrada (core y app, importan los módulos en orden de carga), `src/global/studio.ts` es el núcleo como script global, `src/ui/` los componentes. Se compila a `app/build/` (no se commitea) con `npm run build`/`dev`. Un módulo nuevo se agrega con su `import` en el lugar que le toca de `src/entries/app.ts`.
- Pruebas de la interfaz en `LibroStudio/v3/app/tests/` (las carga `test-loader.js` sólo en la autoprueba; no van en el instalador). Nada de pruebas dentro de los módulos de la app.
- No reemplazar funciones globales a mano: usar `extend()`, `decorateInspector()` o `registerInspectorPanel()`.
- No tocar lo que dibuja el libro (página, impresión, miniaturas) al cambiar la interfaz: vive en `ui/book/` (capa `book`, la más baja) con sus colores en `ui/tokens/book.css`. Si se toca, los PDF de `npm run self-test` tienen que salir idénticos (`node scripts/compare-outputs.mjs <antes> <después>`).
- Ningún `.css` fuera de `ui/` (`lint:design` falla).

## Comandos

```bash
npm install          # una vez
npm run dev          # app en modo desarrollo (Ctrl+R recarga la interfaz, F12 herramientas)
npm test             # pruebas + control de diseño + deuda + formato
npm run format       # prettier sobre todo el código propio
npm run self-test    # autoprueba completa sobre la app real
npm run dist         # instalador y zip para el launcher (desktop/release)
```

Este archivo lo lee cualquier sesión que trabaje en esta carpeta; mantenerlo al día.
