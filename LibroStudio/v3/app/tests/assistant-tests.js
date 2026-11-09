'use strict';
window.runAssistantTests = async function () {
  const checks = [],
    check = (ok, label) => {
      if (!ok) throw Error(label);
      checks.push(label);
    },
    prior = M.clone(maquetarioEditor.book),
    prevDirty = maquetarioEditor.dirty;
  try {
    check(
      !!$('#editorialAssistant') && $('#editorialAssistant').textContent.includes('Asistente'),
      'Acceso destacado al asistente',
    );
    maquetarioEditor.book = M.create();
    maquetarioEditor.book.pages = maquetarioEditor.book.pages.slice(0, 2);
    const target = M.text('Un  texto de prueba. '.repeat(20), 20, 30, 35, 5, 12);
    maquetarioEditor.book.pages[0].objects = [target];
    maquetarioEditor.active = maquetarioEditor.spread = 0;
    maquetarioEditor.selected = null;
    const before = JSON.stringify(maquetarioEditor.book),
      issues = await automaticEditorialReview();
    check(
      issues.some((i) => i.kind === 'overflow'),
      'Revisión automática detecta texto sobrante',
    );
    check(
      issues.some((i) => i.kind === 'spaces'),
      'Revisión automática detecta espacios repetidos',
    );
    check(
      JSON.stringify(maquetarioEditor.book) === before,
      'Revisión automática no cambia el libro',
    );
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
    const stamp = JSON.stringify(maquetarioEditor.book);
    $('#assistantFindings [data-finding-fix]').click();
    check(target.text === 'Un texto', 'Corrección de espacios es individual y explícita');
    undo();
    check(
      JSON.stringify(maquetarioEditor.book) === stamp,
      'Corrección del asistente permite deshacer',
    );
    closeSheet();
    return { ok: true, checks };
  } finally {
    maquetarioEditor.book = prior;
    maquetarioEditor.active = maquetarioEditor.spread = 0;
    maquetarioEditor.selected = null;
    maquetarioEditor.dirty = prevDirty;
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
  const target = maquetarioEditor.book.pages[8].objects.find(
    (o) => o.paragraphMap?.[0]?.styleId === 'body',
  );
  if (target) {
    target.text += '\nEste  párrafo tiene un espacio repetido para la revisión.';
    target.h = 25;
  }
  await openEditorialAssistant();
  await runAutomaticReview();
};
