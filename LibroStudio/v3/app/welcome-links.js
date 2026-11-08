// Bienvenida · "Para empezar": cada acción secundaria muestra ícono, nombre y qué hace.
// Antes eran enlaces subrayados con flecha de enlace externo (↗) sin explicación.
// Los botones los arman welcome.js y otros módulos (glosario, recuperación); acá se presentan con UI.actionItem.
(function () {
  'use strict';

  const ACTIONS = {
    welcomeTutorial: {
      icon: 'info',
      text: [
        'Aprendé a maquetar un libro paso a paso, dentro de la app.',
        'Learn to lay out a book step by step, inside the app.',
        'Aprenda a diagramar um livro passo a passo, dentro do app.',
      ],
    },
    welcomeDemo: {
      icon: 'pages',
      text: [
        'Abrí una novela ya maquetada para ver cómo está hecha.',
        'Open a finished novel to see how it is built.',
        'Abra um romance já diagramado para ver como foi feito.',
      ],
    },
    welcomeResume: {
      icon: 'select',
      text: [
        'Volvé al libro que tenías abierto.',
        'Go back to the book you had open.',
        'Volte ao livro que estava aberto.',
      ],
    },
    welcomeRecover: {
      icon: 'undo',
      text: [
        'Restaurá la copia automática de tu último trabajo.',
        'Restore the automatic copy of your last work.',
        'Restaure a cópia automática do seu último trabalho.',
      ],
    },
    welcomeGlossary: {
      icon: 'text',
      text: [
        'Los términos del oficio, explicados con ejemplos.',
        'Trade terms, explained with examples.',
        'Os termos do ofício, explicados com exemplos.',
      ],
    },
  };
  const heading = () => bw('Para empezar', 'Getting started', 'Para começar');

  function decorate() {
    const list = document.querySelector('#welcomeScreen .welcome-links');
    if (!list) return;
    if (!list.previousElementSibling?.classList.contains('welcome-links-title')) {
      const title = document.createElement('h2');
      title.className = 'welcome-links-title';
      title.textContent = heading();
      list.before(title);
    }
    for (const button of list.querySelectorAll('button:not(.action-item)')) {
      const spec = ACTIONS[button.id];
      if (!spec) continue;
      // El botón lo crea otro módulo con su acción; se reemplaza por la molécula y se conserva el clic.
      const holder = document.createElement('template');
      holder.innerHTML = UI.actionItem({
        id: button.id,
        icon: spec.icon,
        title: button.textContent.replace('↗', '').trim(),
        description: bw(...spec.text),
      });
      const item = holder.content.firstElementChild;
      item.onclick = button.onclick;
      button.replaceWith(item);
    }
  }

  const root = $('#welcomeScreen');
  if (root) new MutationObserver(decorate).observe(root, { childList: true, subtree: true });
  decorate();
})();
