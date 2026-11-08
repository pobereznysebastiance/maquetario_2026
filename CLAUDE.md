# Maquetario · instrucciones para trabajar en este repo

Editor de maquetación editorial creado por Sebastián Poberezny. Rama de trabajo: `version-juan` (Juan Cruz Canteros, Tiny Studio). Se vende en Motiova: el programa se conecta con la cuenta y recibe una licencia firmada por equipo (`desktop/src/main/motiova/`; el launcher puede venir después).

## Antes de empezar

Leer `docs/proximos-pasos.md` (hoja de ruta), `docs/arquitectura.md` (estructura y decisiones), `docs/plan-interfaz.md` (sistema de diseño) y `PRODUCT.md` (usuarios y criterios).

## Reglas

- **Commits en castellano, sin líneas de autoría de IA** (nada de `Co-Authored-By` ni marcas similares). Título corto y cuerpo con viñetas de qué cambió y por qué.
- Antes de cada commit: `npm test`, `npm run typecheck` y `npm run self-test`. No commitear con fallas.
- Sistema de diseño: ningún color ni medida suelta en `LibroStudio/v3/app/ui/` (lo controla `npm run lint:design`). Componentes por capas (tokens → átomos → moléculas → organismos → plantillas); el marcado de componentes sale de `ui/components.js`.
- Nada que parezca generado por IA: sin etiquetas chicas en mayúsculas sobre títulos, sin degradés decorativos, sin bordes laterales de color, sin tarjetas anidadas. Tipografía con los roles de macOS (tokens `--type-*`). Revisar con impeccable por grupos.
- No reemplazar funciones globales a mano: usar `extend()`, `decorateInspector()` o `registerInspectorPanel()`.
- No tocar lo que dibuja el libro (página, impresión, miniaturas) al cambiar la interfaz.

## Comandos

```bash
npm install          # una vez
npm run dev          # app en modo desarrollo (Ctrl+R recarga la interfaz, F12 herramientas)
npm test             # pruebas + control de diseño + deuda
npm run self-test    # autoprueba completa sobre la app real
npm run dist         # instalador y zip para el launcher (desktop/release)
```

Este archivo lo lee cualquier sesión que trabaje en esta carpeta; mantenerlo al día.
