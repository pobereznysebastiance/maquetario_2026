// Separación silábica mientras se escribe: el párrafo muestra el manuscrito original (sin
// guiones); al terminar de editar se vuelve a separar. El texto con guiones y la lectura de los
// controles están en hyphenation.ts (sin efectos al cargar, se importa).
//
// Fuente TypeScript: se compila a build/hyphenation-controls.js (desktop/scripts/build.mjs).

// Mientras se escribe, usar el manuscrito original para que los guiones discrecionales nunca entren en él.
import { setHyphenatedText } from './hyphenation.ts';
import { paragraphFormat } from './paragraph-format.ts';

extend.after(
  'startEditing',
  function (element: HTMLElement) {
    if (editing !== element) return;
    const object = selectObject();
    if (!object || object.type !== 'text' || object.id !== element.dataset.id) return;
    const lines = object.text.split('\n');
    element.querySelectorAll('.mqt-paragraph').forEach((paragraph, index) => {
      if (paragraphFormat(book, object, index).hyphenate)
        paragraph.textContent = lines[index] || ' ';
    });
  },
  'hyphenation-controls',
);

extend(
  'finishEditing',
  (finishBeforeHyphenation) =>
    function () {
      const element = editing,
        object = element && selectObject();
      finishBeforeHyphenation();
      if (!object || object.type !== 'text' || object.id !== element!.dataset.id) return;
      const lines = object.text.split('\n');
      element!.querySelectorAll('.mqt-paragraph').forEach((paragraph, index) => {
        const format = paragraphFormat(book, object, index);
        if (format.hyphenate)
          setHyphenatedText(paragraph as HTMLElement, lines[index] || '', format);
      });
    },
  'hyphenation-controls',
);
