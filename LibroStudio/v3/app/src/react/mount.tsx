// Base para montar React en la interfaz actual (etapa 3, decisión D1).
//
// La interfaz sigue siendo el HTML de index.html más los módulos de src/. Cada pieza que pasa a
// React se monta en un nodo que ya existe (por ejemplo, #toast) con mount(); el resto de la
// página no cambia. React y Radix viajan dentro de build/app.js (desktop/scripts/build.mjs), no
// como scripts aparte.
//
// Cómo pasar una pantalla a React (detalle y motivos: docs/arquitectura.md → "Pasar una pantalla
// a React"):
// - Carpeta en src/components/ con el componente (PascalCase.tsx) y, si hace falta, su servicio;
//   lo que sigue siendo global se publica desde ahí (con extend.replace si otros lo extienden).
// - Mismo marcado que el HTML de antes (clases, ids, data-*, aria-*). Estilos sólo con clases y
//   tokens de ui/; comportamiento con Radix sin estilos; íconos con <Icon name>.
// - Textos: el traductor del DOM no entra en data-react. bw() o LibroI18n.tr() (con su fila en
//   i18n.ts) y useLanguage(); lo que otro módulo agrega adentro llega ya traducido.
// - Campos no controlados. El onChange de React no recibe un new Event('change') (no sube):
//   Select / useNativeChange o useFieldEvents (Form.tsx). En casillas, onChange sí (va con click).
// - Diálogos: openSheet / openWorkWindow (o modal.sheet/info/workspace con un elemento), uno a la
//   vez salvo keepModal; closeSheet() cierra en el acto. Los efectos de los hijos corren antes de
//   que la ref abra el <dialog>: si no hay alto, medir en el cuadro siguiente. El foco va al
//   diálogo.
// - Estado: leer los globales del núcleo y redibujar con useEditorState(); quien cambia estado
//   avisa con notifyEditorState() (flushSync: nunca desde un render ni un efecto).
// - Registros en vez de nodos sueltos: registerTool, registerInspectorPanel + inspectorSlot /
//   mountInspectorSlot, registerHelpSection.
// - Con { sync: true } el primer dibujo es inmediato (barras que otros buscan al cargar); montar
//   después de book-workflow.ts (bw). Nada de React toca lo que dibuja el libro.
// - Un cambio del proceso principal (CSP, protocolo) pide reiniciar la app: Ctrl+R no alcanza.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { StrictMode, useEffect, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';

/**
 * Monta un árbol de React dentro de host (un nodo que ya existe en la página). Lo que hubiera
 * adentro lo reemplaza React. Con sync, el primer dibujo ocurre antes de volver.
 */
export function mount(host: Element, node: ReactNode, { sync = false } = {}): Root {
  host.setAttribute('data-react', '');
  const root = createRoot(host);
  const render = () => root.render(<StrictMode>{node}</StrictMode>);
  if (sync) flushSync(render);
  else render();
  return root;
}

/** Idioma actual de la interfaz; el componente se vuelve a dibujar cuando cambia. */
export function useLanguage(): string {
  const [language, setLanguage] = useState(() => LibroI18n.language);
  useEffect(() => {
    const update = () => setLanguage(LibroI18n.language);
    document.addEventListener('maquetario:language', update);
    return () => document.removeEventListener('maquetario:language', update);
  }, []);
  return language;
}
