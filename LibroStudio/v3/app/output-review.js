'use strict';
let outputReviewScale = 'fit';
extend.after(
  'outputPreview',
  function () {
    const box = $('#outputPreview'),
      sheet = box?.querySelector('.output-sheet');
    if (!sheet) return;
    const config = outputConfigFromDialog(),
      geometry = outputGeometry(config),
      px = 96 / 25.4,
      fit = Math.min(
        (box.clientWidth - 36) / (geometry.width * px),
        (box.clientHeight - 36) / (geometry.height * px),
      ),
      k = outputReviewScale === 'fit' ? fit : Number(outputReviewScale),
      w = geometry.width * px * k,
      h = geometry.height * px * k;
    const canvas = document.createElement('div');
    canvas.className = 'output-review-canvas';
    Object.assign(canvas.style, {
      position: 'relative',
      width: Math.max(box.clientWidth, w + 36) + 'px',
      height: Math.max(box.clientHeight, h + 36) + 'px',
    });
    Object.assign(sheet.style, {
      transform: `scale(${k})`,
      transformOrigin: 'top left',
      position: 'absolute',
      left: Math.max(18, (box.clientWidth - w) / 2) + 'px',
      top: Math.max(18, (box.clientHeight - h) / 2) + 'px',
    });
    canvas.append(sheet);
    box.replaceChildren(canvas);
    if ($('#outputReviewZoom')) $('#outputReviewZoom').value = outputReviewScale;
    if ($('#outputReviewFactor')) $('#outputReviewFactor').textContent = Math.round(k * 100) + '%';
  },
  'output-review',
);
extend(
  'outputDialog',
  (beforeLargeOutputDialog) =>
    function (destination) {
      outputReviewScale = 'fit';
      const result = beforeLargeOutputDialog(destination);
      if (!$('#outputPreview') || $('#modal .output-review-layout')) return result;
      const body = $('#modalBody'),
        layout = document.createElement('div'),
        options = document.createElement('aside'),
        previewPane = document.createElement('section');
      layout.className = 'output-review-layout';
      options.className = 'output-review-options';
      previewPane.className = 'output-review-pane';
      const tools = document.createElement('div');
      tools.className = 'output-review-toolbar';
      tools.innerHTML = `<label for="outputReviewZoom">Zoom <select id="outputReviewZoom"><option value="fit">${bw('Ajustar a ventana', 'Fit to window', 'Ajustar à janela')}</option><option value="1">100%</option><option value="1.5">150%</option><option value="2">200%</option><option value="3">300%</option></select></label><span id="outputReviewFactor"></span><button type="button" class="btn" id="outputReviewExpand">${bw('Ampliar revisión', 'Expand preview', 'Ampliar revisão')}</button>`;
      const previewNodes = [
        '.output-preview-title',
        '#reviewFaces',
        '#outputPreview',
        '#outputSummary',
      ]
        .map((s) => $(s))
        .filter(Boolean);
      for (const node of [...body.children]) if (!previewNodes.includes(node)) options.append(node);
      previewPane.append(tools, ...previewNodes);
      layout.append(options, previewPane);
      body.append(layout);
      $('#outputReviewZoom').onchange = (e) => {
        outputReviewScale = e.target.value;
        outputPreview();
      };
      $('#outputReviewExpand').onclick = () => {
        const expanded = $('#modal').classList.toggle('preview-expanded');
        $('#outputReviewExpand').textContent = expanded
          ? bw('Mostrar opciones', 'Show options', 'Mostrar opções')
          : bw('Ampliar revisión', 'Expand preview', 'Ampliar revisão');
        outputReviewScale = 'fit';
        outputPreview();
      };
      onDialogClose(() => $('#modal').classList.remove('preview-expanded'));
      outputPreview();
      requestAnimationFrame(outputPreview);
      return result;
    },
  'output-review',
);
window.addEventListener('resize', () => {
  if ($('#modal').open && $('#outputPreview')) outputPreview();
});
window.prepareLargeOutputPreview = function () {
  hideWelcome();
  if ($('#modal').open) $('#modal').close();
  window.prepareNovelProof();
  outputDialog('pdf');
  $('#outMode').value = 'booklet';
  $('#outPaper').value = 'A4';
  outputPreview();
};
