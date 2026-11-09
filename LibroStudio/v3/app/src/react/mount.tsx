// Base para montar React en la interfaz actual (etapa 3, decisión D1).
//
// La interfaz sigue siendo el HTML de index.html más los módulos de src/. Cada pieza que pasa a
// React se monta en un nodo que ya existe (por ejemplo, #toast) con mount(); el resto de la
// página no cambia. React y Radix viajan dentro de build/app.js (desktop/scripts/build.mjs), no
// como scripts aparte.
//
// Convención de componentes (src/components/):
// - Una carpeta por componente (src/components/toast/) con el componente (.tsx, nombre en
//   PascalCase: Toaster) y, si hace falta, su servicio: las funciones que llama el resto de la
//   app (showToast). Lo que tiene que seguir siendo global (toast()) se publica desde ahí.
// - Comportamiento y accesibilidad con Radix sin estilos (import { Toast } from 'radix-ui').
// - Estilos sólo con las clases y tokens de ui/ (className="toast", data-type…): nada de estilos
//   en línea, Tailwind ni CSS-in-JS. El CSS vive en ui/ (átomos, moléculas, organismos).
// - Los textos fijos van con bw(es, en, pt) y se vuelven a dibujar con useLanguage(); los textos
//   que llegan en castellano desde el resto de la app se traducen con LibroI18n.tr() antes de
//   dibujarlos (Radix anuncia el texto apenas se monta, antes de que pase el traductor del DOM).
// - Íconos con <Icon name="…" /> (src/components/Icon.tsx), el mismo set que icon() de studio.ts.
// - Estado del editor: el componente lee los globales del núcleo (book, active, dirty…) y se
//   redibuja con useEditorState() (src/react/editor-state.ts), que avisa el núcleo.
// - mount() marca el contenedor con data-react: el traductor del DOM (src/i18n.ts) no entra ahí,
//   porque React traduce sus textos (bw / LibroI18n.tr) y no hay que tocarle los nodos.
// - Con { sync: true } el primer dibujo es inmediato: para barras fijas de la pantalla, que otros
//   módulos o pruebas buscan apenas carga build/app.js. Montar después de book-workflow.ts (bw).
// - Nada de React toca lo que dibuja el libro (#spread, #printRoot, miniaturas).
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
