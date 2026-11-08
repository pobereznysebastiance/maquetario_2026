// Aspecto de la ventana según el sistema: material translúcido (Mica / vibrancy)
// y barra de título integrada a la barra de Maquetario.
import { app, nativeTheme, type BrowserWindowConstructorOptions } from 'electron';
import { release } from 'node:os';

export type WindowMaterial = 'mica' | 'vibrancy' | 'none';
/** Dónde quedan los botones de la ventana: a la derecha (Windows/Linux) o a la izquierda (macOS). */
export type WindowControls = 'overlay-right' | 'inset-left';

/** Mica existe desde Windows 11 22H2 (compilación 22621). */
function supportsMica(): boolean {
  if (process.platform !== 'win32') return false;
  const build = Number(release().split('.')[2]);
  return Number.isFinite(build) && build >= 22621;
}

export function windowMaterial(): WindowMaterial {
  // Desarrollo: MAQUETARIO_WINDOW_MATERIAL=none fuerza la ventana sólida (diagnóstico).
  const forced = process.env.MAQUETARIO_WINDOW_MATERIAL;
  if (!app.isPackaged && (forced === 'none' || forced === 'mica' || forced === 'vibrancy')) return forced;
  if (process.platform === 'darwin') return 'vibrancy';
  return supportsMica() ? 'mica' : 'none';
}

/** Alto de la zona de los botones de la ventana; coincide con la barra superior (ui/templates/window.css). */
export const TITLE_BAR_HEIGHT = 48;
const SOLID_WINDOW = '#13242b';
const CONTROL_SYMBOLS = '#d6e0dc';

export function windowChromeOptions(): {
  options: BrowserWindowConstructorOptions;
  material: WindowMaterial;
  controls: WindowControls;
} {
  // Maquetario es oscura: el material del sistema tiene que tomar la variante oscura.
  nativeTheme.themeSource = 'dark';
  const material = windowMaterial();
  const options: BrowserWindowConstructorOptions = {
    backgroundColor: material === 'none' ? SOLID_WINDOW : '#00000000',
  };
  if (material === 'vibrancy') {
    options.vibrancy = 'under-window';
    options.visualEffectState = 'followWindow';
  } else if (material === 'mica') {
    options.backgroundMaterial = 'mica';
  }
  if (process.platform === 'darwin') {
    options.titleBarStyle = 'hiddenInset';
    options.trafficLightPosition = { x: 16, y: 14 };
    return { options, material, controls: 'inset-left' };
  }
  options.titleBarStyle = 'hidden';
  options.titleBarOverlay = { color: 'rgba(0,0,0,0)', symbolColor: CONTROL_SYMBOLS, height: TITLE_BAR_HEIGHT };
  return { options, material, controls: 'overlay-right' };
}
