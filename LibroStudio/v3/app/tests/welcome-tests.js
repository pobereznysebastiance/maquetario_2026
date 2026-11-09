'use strict';

// Libro nuevo desde la Hoja de formato: el anfitrión empieza un proyecto sin archivo.
extend(
  'applyBookSettings',
  (newBookWelcome) =>
    function (isNew, values) {
      const previous = maquetarioEditor.book;
      const applied = newBookWelcome(isNew, values);
      if (isNew && maquetarioEditor.book !== previous && maquetarioEditor.native)
        void nativeCall('newProject');
      return applied;
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
  const original = JSON.stringify(maquetarioEditor.book),
    originalDirty = maquetarioEditor.dirty,
    start = localStorage.getItem('maquetario-tutorial-step');
  startTutorial(8);
  check(
    !$('#tutorialCard').hidden && $('#tutorialJump').value === '8',
    'Recorrido guiado abre capítulo Imán',
  );
  check(
    JSON.stringify(maquetarioEditor.book) === original && maquetarioEditor.dirty === originalDirty,
    'Tutorial no modifica el libro',
  );
  showTutorialStep(17);
  check(currentRailView() === 'layers', 'Recorrido abre la vista Capas del riel');
  closeTutorial();
  showRailView('pages');
  if (start === null) localStorage.removeItem('maquetario-tutorial-step');
  else localStorage.setItem('maquetario-tutorial-step', start);
  check(!!$('#layersTool') && !!$('#snapButton'), 'Capas e imán accesibles');
  check(ww().created.includes('Sebastián Poberezny'), 'Crédito del autor correcto');
  showTab('design');
  return result;
}, 'welcome-tests');
