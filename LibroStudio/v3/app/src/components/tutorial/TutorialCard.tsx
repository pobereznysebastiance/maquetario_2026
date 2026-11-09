// Tarjeta del tutorial guiado, en React: paso actual (título, explicación y ejercicio), "Abrir esta
// sección", salto a otro capítulo, anterior / siguiente y pausa. Se monta en el <aside
// id="tutorialCard"> que crea tutorial.ts, que sigue mandando: muestra y esconde la tarjeta (hidden),
// elige el paso (tutorialIndex), abre su pestaña y señala el control. editor-controls.ts la ubica
// junto al control señalado (style.left) e ilumina el resto.
//
// Sin Radix: no es un diálogo ni un popover modal. La tarjeta es una ayuda al costado: no toma el
// foco al aparecer ni al cambiar de paso (el paso puede pedir escribir en el lienzo o en un campo).
// El foco sólo entra si se la usa (clic o Tab).
//
// renderTutorialCard() dibuja en el acto (flushSync): al volver de showTutorialStep la tarjeta ya
// está al día (las pruebas leen #tutorialJump y editor-controls mide la tarjeta enseguida).
// Los botones llaman a showTutorialStep y closeTutorial por su nombre global: editor-controls.ts
// las extiende y así siguen pasando por esas extensiones.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import type { Root } from 'react-dom/client';
import { mount, useLanguage } from '../../react/mount.tsx';
import { Icon } from '../Icon.tsx';
import type { GuideLesson } from '../../tutorial.ts';

const words = {
  es: {
    label: 'Guía de Maquetario',
    previous: 'Anterior',
    next: 'Siguiente',
    finish: 'Finalizar',
    close: 'Pausar tutorial',
    action: 'Abrir esta sección',
    note: 'Tus cambios se hacen en el libro actual. Podés deshacerlos con Ctrl+Z.',
    exercise: 'Probalo en tu libro',
    contents: 'Elegir capítulo',
    done: 'Recorrido completado. Podés volver a cualquier capítulo desde Ayuda.',
  },
  en: {
    label: 'Maquetario guide',
    previous: 'Back',
    next: 'Next',
    finish: 'Finish',
    close: 'Pause tutorial',
    action: 'Open this section',
    note: 'Edits apply to your current book. Undo with Ctrl+Z.',
    exercise: 'Try it in your book',
    contents: 'Choose a chapter',
    done: 'Tour complete. Revisit any chapter from Help.',
  },
  pt: {
    label: 'Guia do Maquetario',
    previous: 'Anterior',
    next: 'Próximo',
    finish: 'Concluir',
    close: 'Pausar tutorial',
    action: 'Abrir esta seção',
    note: 'As alterações afetam seu livro atual. Desfaça com Ctrl+Z.',
    exercise: 'Experimente no seu livro',
    contents: 'Escolher capítulo',
    done: 'Percurso concluído. Volte a qualquer capítulo pela Ajuda.',
  },
};

let version = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const TutorialCard = ({ onAction }: { onAction: (step: GuideLesson) => void }) => {
  useSyncExternalStore(subscribe, () => version);
  const language = useLanguage() as keyof typeof words;
  const w = words[language] || words.es,
    lang = { es: 0, en: 1, pt: 2 }[language] || 0,
    index = tutorialIndex,
    total = guideLessons.length,
    step = guideLessons[index],
    last = index === total - 1;
  // El salto de capítulo escucha el "change" nativo (un new Event('change') no sube hasta React).
  const jump = useRef<HTMLSelectElement | null>(null);
  useLayoutEffect(() => {
    const select = jump.current;
    if (!select) return;
    const listener = () => showTutorialStep(Number(select.value));
    select.addEventListener('change', listener);
    return () => select.removeEventListener('change', listener);
  }, []);
  if (!step) return null;
  return (
    <>
      <div className="tutorial-card-head">
        <span>
          {w.label} · {index + 1} / {total}
        </span>
        <button
          type="button"
          className="icon-btn"
          id="pauseTutorial"
          title={w.close}
          aria-label={w.close}
          onClick={() => closeTutorial()}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="tutorial-progress">
        <span style={{ width: `${((index + 1) / total) * 100}%` }}></span>
      </div>
      <div className="tutorial-body">
        <h2>{step.title[lang]}</h2>
        <p>{step.body[lang]}</p>
        <div className="tutorial-exercise">
          <strong>{w.exercise}</strong>
          <br />
          {step.task[lang]}
        </div>
        <button
          type="button"
          id="tutorialAction"
          className="tutorial-action"
          onClick={() => onAction(step)}
        >
          {w.action}
        </button>
      </div>
      <select
        id="tutorialJump"
        className="tutorial-jump"
        aria-label={w.contents}
        value={String(index)}
        ref={jump}
        // El cambio lo atiende el oyente nativo; esto sólo evita el aviso de React por value sin onChange.
        onChange={() => {}}
      >
        {guideLessons.map((s, i) => (
          <option key={i} value={i}>
            {/* Los títulos ya traen su número de capítulo ("4. Construir la grilla"). */}
            {s.title[lang]}
          </option>
        ))}
      </select>
      <div className="tutorial-nav">
        <button
          type="button"
          className="btn"
          id="tutorialPrev"
          disabled={index === 0}
          onClick={() => showTutorialStep(tutorialIndex - 1)}
        >
          ← {w.previous}
        </button>
        <button
          type="button"
          className="btn primary"
          id="tutorialNext"
          onClick={() => {
            if (tutorialIndex === guideLessons.length - 1) {
              closeTutorial();
              localStorage.setItem('maquetario-tutorial-step', '0');
              toast(w.done);
            } else showTutorialStep(tutorialIndex + 1);
          }}
        >
          {last ? w.finish : w.next} →
        </button>
      </div>
      <div className="tutorial-note">{w.note}</div>
    </>
  );
};

let root: Root | null = null;

/** Dibuja la tarjeta en el paso actual (tutorialIndex). La primera vez la monta en host. */
export function renderTutorialCard(host: HTMLElement, onAction: (step: GuideLesson) => void): void {
  version += 1;
  if (!root) root = mount(host, <TutorialCard onAction={onAction} />, { sync: true });
  else flushSync(() => listeners.forEach((listener) => listener()));
}
