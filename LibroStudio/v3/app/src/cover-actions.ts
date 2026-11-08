// Acciones de la cubierta: en el editor de cubierta, botones fijos para exportar o imprimir la
// cubierta (guardan el borrador antes) y una nota que distingue Interior PDF de Cubierta PDF.
// Al imprimir la cubierta en un papel estándar (A3, A4, A5, Carta), la centra en la hoja y, si
// se permite, la reduce para una prueba.
//
// No publica globales: todo se engancha con extend.
//
// Fuente TypeScript: se compila a build/cover-actions.js (desktop/scripts/build.mjs).

/** Lo que devuelve prepareOutput (output.js). */
interface OutputInfo {
  width: number;
  height: number;
  faces: number;
  scale: number;
}

/** Lo que recibe prepareOutput: para la cubierta, kind = 'cover'. */
interface OutputRequest {
  kind?: string;
  paper: string;
  fit: boolean;
}

extend.after(
  'coverEditor',
  function () {
    if (!$('#coverPreview')) return;
    const footer = $('#modal .modal-actions'),
      actions = document.createElement('div');
    actions.id = 'coverPersistentActions';
    actions.className = 'cover-persistent-actions';
    for (const [id, label, destination] of [
      [
        'exportCoverVisible',
        bw('Exportar cubierta PDF', 'Export cover PDF', 'Exportar capa PDF'),
        'pdf',
      ],
      ['printCoverVisible', bw('Imprimir cubierta', 'Print cover', 'Imprimir capa'), 'print'],
    ]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.id = id;
      b.textContent = label;
      b.onclick = () => {
        try {
          // Con el editor de cubierta abierto, el borrador siempre existe.
          validateCover(coverDraft!);
          commit(() => (book.cover = M.clone(coverDraft)), false);
          $('#modal').close();
          setTimeout(
            () => (destination === 'print' ? coverPrintDialog() : coverOutputDialog()),
            30,
          );
        } catch (e) {
          toast((e as Error).message, 'error');
        }
      };
      actions.append(b);
    }
    footer.prepend(actions);
    onDialogClose(() => actions.remove());
    const note = document.createElement('p');
    note.className = 'notice';
    note.textContent = bw(
      'Dos archivos: Interior PDF (páginas del libro) y Cubierta PDF (una pieza desplegada). Guardar cubierta conserva el diseño dentro del proyecto; Exportar genera el PDF.',
      'Two files: Interior PDF (book pages) and Cover PDF (one spread). Save cover keeps the design inside the project; Export creates the PDF.',
      'Dois arquivos: Miolo PDF (páginas) e Capa PDF (uma peça aberta). Salvar capa mantém o desenho no projeto; Exportar gera o PDF.',
    );
    $('#coverPreview').before(note);
  },
  'cover-actions',
);
async function coverPrintDialog(): Promise<void> {
  return coverSheetDialog('print');
}
extend.result(
  'prepareOutput',
  function (info: OutputInfo, config: OutputRequest): OutputInfo {
    if (config.kind !== 'cover' || !['A3', 'A4', 'A5', 'Letter'].includes(config.paper))
      return info;
    const [width, height] = outputPaperDimensions(config.paper, info.width, info.height);
    const ratio = Math.min(width / info.width, height / info.height, 1);
    if (!config.fit && ratio < 0.999) {
      clearPrint();
      throw Error(
        bw(
          'La cubierta no cabe a tamaño real. Elegí un papel mayor o permití reducir para una prueba.',
          'The cover does not fit at actual size. Choose larger paper or allow reduction for a proof.',
          'A capa não cabe em tamanho real. Escolha papel maior ou permita redução para uma prova.',
        ),
      );
    }
    const root = $('#printRoot'),
      art = root.querySelector<HTMLElement>('.cover-artwork')!,
      sheet = document.createElement('div');
    sheet.className = 'print-page';
    Object.assign(sheet.style, {
      width: (width * 96) / 25.4 + 'px',
      height: (height * 96) / 25.4 + 'px',
      position: 'relative',
      overflow: 'hidden',
    });
    art.classList.remove('print-page');
    const scale = config.fit ? ratio : 1;
    Object.assign(art.style, {
      position: 'absolute',
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
      left: (((width - info.width * scale) / 2) * 96) / 25.4 + 'px',
      top: (((height - info.height * scale) / 2) * 96) / 25.4 + 'px',
    });
    sheet.append(art);
    root.querySelector('style')!.textContent = `@page{size:${width}mm ${height}mm;margin:0}`;
    root.append(sheet);
    return { width, height, faces: 1, scale };
  },
  'cover-actions',
);

export {};
