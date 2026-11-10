# Maquetario en macOS (10-nov)

Cómo se arma y se instala la versión de Mac. El código ya andaba en macOS (Electron); faltaba el instalador y que los atajos usen ⌘.

## Qué cambió en el programa

- **Atajos con ⌘.** En Mac los atajos usan Command: ⌘S, ⌘Z, ⇧⌘Z (rehacer), ⌘P, ⇧⌘S, ⌘+/⌘−/⌘0/⌘1, ⌘ + rueda (y el pellizco del trackpad), ⌘C/⌘X/⌘V/⌘D sobre objetos. La tecla "delete" borra el objeto elegido. Las ayudas y los títulos de los botones muestran ⌘ en lugar de Ctrl (`src/keys.ts`: `commandKey`, `shortcutLabel`).
- **Menú de la app.** En macOS hay barra de menú con Maquetario, Edición (cortar, copiar y pegar en los campos) y Ventana (`desktop/src/main/main.ts` → `applicationMenu`). En Windows y Linux sigue sin barra.
- **Fuentes.** El catálogo lee `/System/Library/Fonts`, `/Library/Fonts` y `~/Library/Fonts`.

## Armar el instalador

Desde Windows no se puede: electron-builder necesita macOS para el `.dmg`. Hay dos caminos.

### 1. GitHub Actions (sin Mac)

`.github/workflows/mac.yml`. En GitHub: **Actions → Instalador de macOS → Run workflow**, elegir la rama. Tarda unos 15 minutos y deja en **Artifacts** un zip con:

- `Maquetario-<versión>-mac-arm64.dmg` y `.zip`: Apple Silicon (M1 en adelante).
- `Maquetario-<versión>-mac-x64.dmg` y `.zip`: Mac con Intel.

El repo tiene que estar en GitHub con Actions habilitado (el plan gratuito alcanza: las Mac de Actions cuentan 10 veces los minutos).

### 2. En una Mac

```bash
npm ci
npm run dist:mac-unsigned   # sin certificado de Apple (firma ad-hoc)
npm run dist:mac            # con certificado Developer ID en el llavero (firma y notariza)
```

Sale en `desktop/release/`.

## Firma y notarización

| | Sin certificado (hoy) | Con Apple Developer |
|---|---|---|
| Costo | — | USD 99 por año (cuenta de Apple Developer) |
| Cómo se arma | `dist:mac-unsigned` (firma ad-hoc, `desktop/scripts/mac-unsigned.cjs`) | `dist:mac` con `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` |
| Al abrir por primera vez | macOS avisa que no puede comprobar el desarrollador | Abre sin avisos |

Sin firma ninguna, la app de Apple Silicon no abre ("está dañada"): por eso la firma ad-hoc. Con ad-hoc el "hardened runtime" va apagado (si no, rechaza las bibliotecas de Electron).

Para firmar en Actions, cargar en el repo (Settings → Secrets and variables → Actions) `MAC_CSC_LINK` (el certificado .p12 en base64), `MAC_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` y `APPLE_TEAM_ID`. El workflow los usa si están.

## Instalar (versión sin certificado)

1. Abrir el `.dmg` y arrastrar Maquetario a Aplicaciones.
2. Abrir Maquetario. macOS dice que no puede comprobar que no tenga software malicioso: **Listo** (no "Trasladar a la papelera").
3. **Ajustes del Sistema → Privacidad y seguridad**, abajo: "Se bloqueó Maquetario…" → **Abrir igual**, y confirmar con la contraseña.
4. Desde ahí abre normal.

Alternativa por Terminal (hace lo mismo):

```bash
xattr -dr com.apple.quarantine /Applications/Maquetario.app
```

## Pendiente

- Probar en una Mac real: atajos, menú contextual con sugerencias de ortografía (en Mac usa el corrector del sistema), impresión, exportar PDF y abrir un `.mqt` con doble clic.
- Confirmar la regla del cuerpo truncado del motor de composición en macOS (`docs/proximos-pasos.md`, etapa 4).
- El zip para el launcher de Motiova (`-mac-*.zip`) sale igual; falta que el launcher lo maneje.
