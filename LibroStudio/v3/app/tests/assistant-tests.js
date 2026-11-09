'use strict';
window.runAssistantTests = async function () {
  const checks = [],
    check = (ok, label) => {
      if (!ok) throw Error(label);
      checks.push(label);
    },
    prior = M.clone(book),
    prevDirty = dirty;
  try {
    check(
      !!$('#editorialAssistant') && $('#editorialAssistant').textContent.includes('Asistente'),
      'Acceso destacado al asistente',
    );
    book = M.create();
    book.pages = book.pages.slice(0, 2);
    const target = M.text('Un  texto de prueba. '.repeat(20), 20, 30, 35, 5, 12);
    book.pages[0].objects = [target];
    active = spread = 0;
    selected = null;
    const before = JSON.stringify(book),
      issues = await automaticEditorialReview();
    check(
      issues.some((i) => i.kind === 'overflow'),
      'Revisión automática detecta texto sobrante',
    );
    check(
      issues.some((i) => i.kind === 'spaces'),
      'Revisión automática detecta espacios repetidos',
    );
    check(JSON.stringify(book) === before, 'Revisión automática no cambia el libro');
    const payload = classroomPayload('page');
    check(
      !JSON.stringify(payload).includes('data:image'),
      'Consulta IA no incluye imágenes incorporadas',
    );
    const structure = classroomPayload('structure');
    check(
      structure.pages.every((p) => !p.objects.length),
      'Consulta de estructura excluye cuerpo del manuscrito',
    );
    target.text = 'x'.repeat(25000);
    const limited = classroomPayload('page');
    check(
      limited.pages[0].objects[0].text.length === 20000 && limited.truncated,
      'Consulta limita el texto enviado',
    );
    target.text = 'Un  texto';
    editorialReport = [finding(0, target, 'spaces', 'tip', 'Prueba', 'Prueba', 'Prueba', 'spaces')];
    editorialReportStamp = reviewStamp();
    await openEditorialAssistant();
    check(
      !!$('#assistantConsent') && !$('#assistantConsent').checked,
      'Envío IA requiere autorización sin preselección',
    );
    const stamp = JSON.stringify(book);
    $('#assistantFindings [data-finding-fix]').click();
    check(target.text === 'Un texto', 'Corrección de espacios es individual y explícita');
    undo();
    check(JSON.stringify(book) === stamp, 'Corrección del asistente permite deshacer');
    closeSheet();
    return { ok: true, checks };
  } finally {
    book = prior;
    active = spread = 0;
    selected = null;
    dirty = prevDirty;
    editorialReport = [];
    editorialReportStamp = '';
    editorialSummary = '';
    render(true);
  }
};
window.prepareAssistantPreview = async function () {
  hideWelcome();
  closeSheet();
  if (fontBrowser.open) fontBrowser.close();
  window.prepareNovelProof();
  const target = book.pages[8].objects.find((o) => o.paragraphMap?.[0]?.styleId === 'body');
  if (target) {
    target.text += '\nEste  párrafo tiene un espacio repetido para la revisión.';
    target.h = 25;
  }
  await openEditorialAssistant();
  await runAutomaticReview();
};
