// Secciones del centro de Ayuda que ya son React: Tutorial guiado, Atajos y Recorrido del libro.
// Las registra el módulo que las conoce (tutorial.ts, canvas-navigation.ts, book-workflow.ts);
// el glosario todavía dibuja HTML (editorial-learning.ts). Leen los globales del núcleo al
// dibujarse (el centro de Ayuda las vuelve a pedir al abrir, al cambiar de sección y de idioma).
// Los textos van con LibroI18n.tr() (castellano con su fila en i18n.ts) o bw().
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import type { HelpSection } from './help-center.tsx';

const tr = (text: string) => LibroI18n.tr(text);

// ── Tutorial guiado ──

const TutorialSection = () => {
  const lang = { es: 0, en: 1, pt: 2 }[LibroI18n.language] || 0,
    saved = Number(localStorage.getItem('maquetario-tutorial-step')) || 0;
  // startTutorial por globalThis: review-workspace.ts la extiende (pide un libro antes).
  return (
    <>
      <h2 className="help-heading">{tr('Tutorial guiado')}</h2>
      <p className="help-lead">
        {tr(
          'Un recorrido por todas las secciones de Maquetario, sobre tu libro actual. Abre los paneles y señala los controles; vos decidís qué cambiar.',
        )}
      </p>
      <div className="help-actions">
        <button
          type="button"
          id="helpTutorialStart"
          className="btn primary"
          onClick={() => globalThis.startTutorial(0)}
        >
          {tr('Empezar desde el principio')}
        </button>
        {saved > 0 ? (
          <button
            type="button"
            id="helpTutorialResume"
            className="btn"
            onClick={() => globalThis.startTutorial()}
          >
            {tr('Seguir donde quedé')}
          </button>
        ) : null}
      </div>
      <h3 className="help-subheading">{tr('Capítulos')}</h3>
      <ol className="help-chapters">
        {guideLessons.map((lesson, i) => (
          <li key={i}>
            <button
              type="button"
              data-tutorial-chapter={i}
              aria-current={saved > 0 && i === saved ? 'step' : undefined}
              onClick={() => globalThis.startTutorial(i)}
            >
              {lesson.title[lang]}
            </button>
          </li>
        ))}
      </ol>
    </>
  );
};

export const tutorialHelpSection: HelpSection = {
  id: 'tutorial',
  label: 'Tutorial guiado',
  order: 1,
  render: () => <TutorialSection />,
};

// ── Atajos ──

/** Atajo: la tecla en castellano, inglés y portugués, y qué hace. */
const shortcutRows = (): [[string, string, string], string][] => [
  [
    ['Espacio + arrastrar', 'Space + drag', 'Espaço + arrastar'],
    bw(
      'Mano temporal · soltá Espacio para volver a tu herramienta.',
      'Temporary hand · release Space to return to your tool.',
      'Mão temporária · solte Espaço para voltar à ferramenta.',
    ),
  ],
  [
    ['Botón central + arrastrar', 'Middle button + drag', 'Botão central + arrastar'],
    bw('Desplazar el lienzo.', 'Pan the canvas.', 'Deslocar a área de trabalho.'),
  ],
  [
    ['Ctrl + rueda', 'Ctrl + wheel', 'Ctrl + roda'],
    bw('Zoom alrededor del puntero.', 'Zoom around the pointer.', 'Zoom em torno do ponteiro.'),
  ],
  [
    ['Ctrl + / Ctrl −', 'Ctrl + / Ctrl −', 'Ctrl + / Ctrl −'],
    bw('Acercar / alejar.', 'Zoom in / out.', 'Aproximar / afastar.'),
  ],
  [
    ['Ctrl + 0', 'Ctrl + 0', 'Ctrl + 0'],
    bw(
      'Ajustar el pliego a la ventana.',
      'Fit the spread to the window.',
      'Ajustar as páginas à janela.',
    ),
  ],
  [['Ctrl + 1', 'Ctrl + 1', 'Ctrl + 1'], bw('Zoom al 100%.', 'Zoom to 100%.', 'Zoom em 100%.')],
  [['H / V', 'H / V', 'H / V'], bw('Mano / Seleccionar.', 'Hand / Select.', 'Mão / Selecionar.')],
  [
    ['Shift + rueda', 'Shift + wheel', 'Shift + roda'],
    bw('Desplazamiento horizontal.', 'Horizontal scrolling.', 'Deslocamento horizontal.'),
  ],
];

const ShortcutsSection = () => (
  <>
    <h2 className="help-heading">
      {bw('Moverse por la maqueta', 'Navigate the layout', 'Navegar pela diagramação')}
    </h2>
    <table className="canvas-shortcut-table">
      <tbody>
        {shortcutRows().map(([keys, action]) => (
          <tr key={keys[0]}>
            <th>{bw(...keys)}</th>
            <td>{action}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <p className="help">
      {bw(
        'Los atajos de navegación no se activan mientras escribís en un campo o editás texto. El 100% usa píxeles de pantalla y no calibra el tamaño físico de tu monitor.',
        'Navigation shortcuts do not activate while typing in fields or editing text. 100% uses screen pixels and does not calibrate physical monitor size.',
        'Atalhos de navegação não ativam ao digitar em campos ou editar texto. 100% usa pixels de tela e não calibra o tamanho físico do monitor.',
      )}
    </p>
  </>
);

export const shortcutsHelpSection: HelpSection = {
  id: 'shortcuts',
  label: 'Atajos',
  order: 3,
  render: () => <ShortcutsSection />,
};

// ── Recorrido del libro ──

/** Un paso del recorrido: id, nombre y qué hace (en castellano, con su fila en i18n.ts). */
export type RouteStepView = [id: string, label: string, description: string];

/** Lo que el recorrido necesita del módulo que lo conoce (book-workflow.ts). */
export interface RouteSource {
  steps: RouteStepView[];
  /** El paso de "estás acá". */
  current: () => string;
  /** Abre la herramienta del paso (cierra la Ayuda). */
  open: (id: string) => void;
}

const RouteSection = ({ source }: { source: RouteSource }) => {
  const here = source.current();
  return (
    <>
      <h2 className="help-heading">{tr('Recorrido del libro')}</h2>
      <p className="help-lead">
        {tr(
          'Los pasos para llevar un manuscrito a un PDF listo para imprimir. Cada paso abre su herramienta.',
        )}
      </p>
      <ol id="helpRoute" className="book-route">
        {source.steps.map(([id, label, description]) => (
          <li key={id} aria-current={id === here ? 'step' : undefined}>
            <button
              type="button"
              data-route-step={id}
              // Sin libro sólo se puede empezar (primer paso).
              disabled={!hasDocument && id !== 'build'}
              onClick={() => source.open(id)}
            >
              {tr(label)}
            </button>
            <p className="help">{tr(description)}</p>
            {id === here ? <span className="route-here">{tr('Estás acá')}</span> : null}
          </li>
        ))}
      </ol>
    </>
  );
};

export const routeHelpSection = (source: RouteSource): HelpSection => ({
  id: 'route',
  label: 'Recorrido del libro',
  order: 4,
  render: () => <RouteSection source={source} />,
});
