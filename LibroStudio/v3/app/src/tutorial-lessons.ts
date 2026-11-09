// Tutorial guiado: las lecciones, el paso que muestra la tarjeta y la tarjeta misma. No tiene
// efectos al cargar: se importa. Las lecciones, la tarjeta (la crea tutorial.ts) y el recorrido
// están en tutorial.ts; review-tutorial.ts suma lecciones.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

/** Una lección del tutorial (title, body y task: castellano, inglés y portugués). */
export interface GuideLesson {
  id: string;
  tab: string;
  target: string;
  title: string[];
  body: string[];
  task: string[];
  action: string;
}

/** Lecciones en orden de recorrido. */
export const guideLessons: GuideLesson[] = [];
/** Suma una lección al final del recorrido. */
export function lesson(
  id: string,
  tab: string,
  target: string,
  title: string[],
  body: string[],
  task: string[],
  action = '',
): void {
  guideLessons.push({ id, tab, target, title, body, task, action });
}

/** Índice de la lección que muestra la tarjeta. */
export let tutorialIndex = 0;
export function setTutorialIndex(index: number): void {
  tutorialIndex = index;
}
/** Tarjeta flotante del tutorial (la crea tutorial.ts al cargar). */
export let tutorialCard: HTMLElement;
export function setTutorialCard(card: HTMLElement): void {
  tutorialCard = card;
}
