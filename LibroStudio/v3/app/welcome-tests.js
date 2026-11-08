'use strict';

extend(
  'settingsNew',
  (newBookWelcome) =>
    function (isNew = true) {
      const previous = book;
      newBookWelcome(isNew);
      if (!isNew) return;
      const apply = $('#modalApply').onclick;
      $('#modalApply').onclick = async () => {
        await apply();
        if (book !== previous && native) await nativeCall('newProject');
      };
    },
  'welcome-tests',
);
extend.before(
  'runIntegrationTests',
  () => {
    hideWelcome();
  },
  'welcome-tests',
);
registerIntegrationTest(function (result) {
  const check = (ok, msg) => {
    if (!ok) throw Error(msg);
    result.checks.push(msg);
  };
  check(guideLessons.length === 32, 'Tutorial de 32 capítulos');
  for (const lesson of guideLessons) {
    check(
      lesson.title.length === 3 &&
        lesson.body.every((s) => s.length > 80) &&
        lesson.task.length === 3,
      'Tutorial completo: ' + lesson.id,
    );
  }
  const original = JSON.stringify(book),
    originalDirty = dirty,
    start = localStorage.getItem('maquetario-tutorial-step');
  startTutorial(8);
  check(
    !$('#tutorialCard').hidden && $('#tutorialJump').value === '8',
    'Recorrido guiado abre capítulo Imán',
  );
  check(
    JSON.stringify(book) === original && dirty === originalDirty,
    'Tutorial no modifica el libro',
  );
  showTutorialStep(17);
  check(tab === 'layers', 'Recorrido abre sección Capas');
  closeTutorial();
  if (start === null) localStorage.removeItem('maquetario-tutorial-step');
  else localStorage.setItem('maquetario-tutorial-step', start);
  check(!!$('#layersTool') && !!$('#snapButton'), 'Capas e imán accesibles');
  check(ww().created.includes('Sebastián Poberezny'), 'Crédito del autor correcto');
  showTab('design');
  return result;
}, 'welcome-tests');
