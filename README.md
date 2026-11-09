# Maquetario

Aplicación de escritorio para diseño y maquetación editorial, creada por Sebastián Poberezny. Permite armar publicaciones, definir grillas y estilos tipográficos, diseñar cubiertas, revisar pliegos y exportar o imprimir PDF.

La versión está en `desktop/package.json`. Es un programa de escritorio en Electron para **Windows, macOS y Linux**.

## Compilar y probar

Con Node 22 o más nuevo, en la raíz del repositorio:

```bash
npm install          # una vez
npm run dev          # abre Maquetario en modo desarrollo
npm test             # pruebas, control de diseño y formato
npm run typecheck
npm run self-test    # autoprueba completa sobre la app real
npm run dist         # instalador y zip para el sistema actual (desktop/release/)
```

## Código

- `LibroStudio/v3/app/` contiene la interfaz: HTML, estilos en `ui/` y fuentes TypeScript en `src/` (se compilan a `build/`).
- `desktop/` contiene el programa de escritorio: ventana, guardado, fuentes, impresión y PDF, licencias.
- `packages/license/` contiene el formato y la verificación de licencias.
- `Maquetario/Servicio-aula/` contiene el servicio opcional para conectar el asistente editorial. Consultá [su guía de configuración](Maquetario/Servicio-aula/LEEME.md). Sus pruebas se corren con `node --test Maquetario/Servicio-aula/service.test.mjs`.

La arquitectura y las decisiones están en `docs/arquitectura.md`; la hoja de ruta, en `docs/proximos-pasos.md`.

Los avisos de DM Sans, pdf-lib y sus componentes están en `LibroStudio/v3/app/licenses/`. La biblioteca de separación silábica conserva su aviso en `LibroStudio/v3/app/hyphenation/LICENSE`.
