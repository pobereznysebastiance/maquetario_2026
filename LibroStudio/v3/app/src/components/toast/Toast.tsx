// Avisos del sistema (molécula "toast"): el primer componente en React (etapa 3, D1/D2).
//
//   toast('Proyecto guardado.')            → éxito (por defecto)
//   toast('No se pudo guardar: …', 'error') → error: más tiempo y botón de cerrar
//   tipos: 'success' | 'info' | 'warning' | 'error' (otro valor se ve como éxito)
//
// Un aviso a la vez, arriba al centro: el nuevo reemplaza al que se ve y reinicia el tiempo.
// Radix (Toast) pone el comportamiento: anuncio a lectores de pantalla (el de error con
// prioridad), pausa del tiempo con el puntero o el foco encima y con la ventana sin foco, Escape y
// F8 para ir a los avisos. El aspecto sale de ui/molecules/status.css (.toast).
//
// toast() sigue siendo la función global de siempre: studio.ts la declara y junta en cola los
// avisos pedidos antes de que cargue build/app.js; este módulo la reemplaza (extend.replace) y
// muestra lo que quedó en la cola.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { useSyncExternalStore } from 'react';
import { Toast } from 'radix-ui';
import { Icon } from '../Icon.tsx';
import { mount, useLanguage } from '../../react/mount.tsx';
import { bw, i18n } from '../../i18n/language.ts';

interface ToastItem {
  id: number;
  message: string;
  type: string;
  open: boolean;
}

const ICONS: Record<string, string> = {
  success: 'check',
  info: 'info',
  warning: 'alert',
  error: 'error',
};
/** Cuánto se ve cada aviso (ms). El de error, más. */
const duration = (type: string): number => (type === 'error' ? 7000 : 4300);

// Servicio: el aviso actual y quién lo escucha.
let current: ToastItem | null = null;
let nextId = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Muestra un aviso (reemplaza al que se ve). El texto llega en castellano y sale traducido. */
export function showToast(message: string, type = 'success'): void {
  current = { id: ++nextId, message: i18n.tr(String(message)), type, open: true };
  emit();
}

export function hideToast(): void {
  if (!current?.open) return;
  current = { ...current, open: false };
  emit();
}

export const Toaster = () => {
  const item = useSyncExternalStore(subscribe, () => current);
  useLanguage();
  return (
    <Toast.Provider label={bw('Aviso', 'Notification', 'Aviso')}>
      {item && (
        <Toast.Root
          key={item.id}
          className="toast"
          data-type={item.type}
          type={item.type === 'error' ? 'foreground' : 'background'}
          duration={duration(item.type)}
          open={item.open}
          onOpenChange={(open) => {
            if (!open && current?.id === item.id) hideToast();
          }}
        >
          <Icon name={ICONS[item.type] || ICONS.success} />
          <Toast.Description className="toast-message">{item.message}</Toast.Description>
          {item.type === 'error' && (
            <Toast.Close
              className="icon-btn"
              aria-label={bw('Cerrar', 'Close', 'Fechar')}
              title={bw('Cerrar', 'Close', 'Fechar')}
            >
              <Icon name="close" />
            </Toast.Close>
          )}
        </Toast.Root>
      )}
      <Toast.Viewport
        className="toast-viewport"
        label={bw('Avisos ({hotkey})', 'Notifications ({hotkey})', 'Avisos ({hotkey})')}
      />
    </Toast.Provider>
  );
};

mount($('#toast'), <Toaster />);
extend.replace('toast', showToast, 'toast');
// Lo que se pidió antes de que cargara este módulo (sólo se ve el último, como siempre).
for (const [message, type] of pendingToasts.splice(0)) showToast(message, type);
