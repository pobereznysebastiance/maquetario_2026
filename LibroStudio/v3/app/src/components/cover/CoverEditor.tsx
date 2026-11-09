// Cubierta desplegada como vista de trabajo (D4): Ventana de trabajo en React (openWorkWindow) con
// la vista previa, la imagen y el texto de cada zona a la izquierda, y medidas, solapas, forrado,
// lomo y su estimación a la derecha. La abren coverEditor() (paso 3 del recorrido, asistente,
// glosario, pruebas) y su acción principal guarda el borrador en el libro.
//
// Lo que dibuja la cubierta no cambia: updateCoverPreview (publications.ts) pinta #coverPreview con
// coverArtwork y escribe #coverDimensions, la zona (#coverRegion) y los campos de la zona; sus
// extensiones (print-proof, cover-measurements, panel-resize) marcan solapas y pestañas, llenan la
// tabla de medidas y el nombre de la zona de la imagen. Por eso esos elementos se dibujan vacíos
// acá (React no toca lo que no tiene hijos) y los campos no son controlados: el borrador
// (coverDraft) es la única fuente y updateCoverPreview la vuelca a la vista.
//
// Mismo marcado, ids y clases que la versión en HTML armada entre publications, cover-actions,
// panel-resize, cover-measurements, editorial-learning, binding-estimate y print-proof: lo usan
// el CSS (dialog-content.css, .cover-modal), las pruebas y document-units (pasa las medidas a cm).
// Los cambios se atienden con el "change"/"input" nativo en captura (useFieldEvents): llegan
// también los new Event('change') de las pruebas y de otros controles (solapas, estimación).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts; después de publications).

import { useLayoutEffect, useRef } from 'react';
import { useLanguage } from '../../react/mount.tsx';
import { Icon } from '../Icon.tsx';
import { LabeledInput, useFieldEvents } from '../form/Form.tsx';

declare global {
  /** Abre el editor de la cubierta desplegada. */
  var coverEditor: () => void;
}

/** Medidas de la pieza: clave en la cubierta, nombre, mínimo y máximo (mm). */
const SIZES: [string, [string, string, string], number, number][] = [
  ['spine', ['Lomo', 'Spine', 'Lombada'], 0, 100],
  ['leftFlap', ['Solapa trasera', 'Back flap', 'Orelha traseira'], 0, 150],
  ['rightFlap', ['Solapa delantera', 'Front flap', 'Orelha dianteira'], 0, 150],
  ['bleed', ['Sangrado', 'Bleed', 'Sangria'], 0, 10],
  ['safe', ['Seguridad', 'Safe area', 'Segurança'], 3, 20],
];
/** Campos de la zona elegida: id del campo → dato de la zona. */
const PART_FIELDS: Record<string, string> = {
  coverText: 'text',
  coverSize: 'size',
  coverTextColor: 'color',
  coverY: 'y',
  coverAlign: 'align',
};
/** Ancho de cada solapa antes de quitarla, para devolverlo al volver a marcarla. */
const previousFlap: Record<string, number> = {};

/** Guarda el borrador en el libro y sigue con la salida (exportar o imprimir la cubierta). */
function saveAndGo(next: () => void): void {
  try {
    validateCover(coverDraft!);
    commit(() => (book.cover = M.clone(coverDraft)), false);
    closeSheet();
    setTimeout(next, 30);
  } catch (e) {
    toast((e as Error).message, 'error');
  }
}

function chooseImage(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/webp';
  input.onchange = () => {
    const file = input.files![0];
    if (!file) return;
    if (file.size > 12000000) {
      toast(
        bw('La imagen supera 12 MB.', 'Image exceeds 12 MB.', 'A imagem supera 12 MB.'),
        'warning',
      );
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      coverDraft!.parts[coverPart].image = r.result as string;
      updateCoverPreview();
    };
    r.readAsDataURL(file);
  };
  input.click();
}

/** Estimación de grosor y lomo (antes binding-estimate.ts): escribe el resultado en su lugar. */
function refreshBindingEstimate(): void {
  const spine = document.querySelector<HTMLInputElement>('[data-cover-size="spine"]'),
    method = document.querySelector<HTMLSelectElement>('#bindingMethod'),
    caliper = document.querySelector<HTMLInputElement>('#paperCaliper'),
    result = document.querySelector<HTMLElement>('#bindingResult'),
    hint = document.querySelector<HTMLElement>('#bindingHint'),
    apply = document.querySelector<HTMLButtonElement>('#applyBindingSpine');
  if (!spine || !method || !caliper || !result || !hint || !apply) return;
  const format = (number: number) =>
    new Intl.NumberFormat(LibroI18n.language, {
      maximumFractionDigits: documentUnit() === 'cm' ? 3 : 2,
    }).format(number);
  const stapled = method.value === 'stapled',
    pageCount = book.pages.length;
  const sheets = Math.ceil(pageCount / 4),
    blanks = sheets * 4 - pageCount;
  const leaves = stapled ? sheets * 2 : Math.ceil(pageCount / 2);
  const valid = caliper.value !== '' && caliper.validity.valid;
  const thickness = (leaves * Number(caliper.value)) / 1000;
  result.textContent = stapled
    ? bw(
        `${sheets} pliegos · ${blanks} páginas en blanco para completar la imposición`,
        `${sheets} sheets · ${blanks} blank pages added for imposition`,
        `${sheets} folhas · ${blanks} páginas em branco para completar a imposição`,
      )
    : bw(`${leaves} hojas del interior`, `${leaves} interior leaves`, `${leaves} folhas do miolo`);
  if (valid)
    result.textContent += bw(
      ` · Grosor teórico del interior ≈ ${format(thickness / (documentUnit() === 'cm' ? 10 : 1))} ${documentUnit()}`,
      ` · Theoretical text block ≈ ${format(thickness / (documentUnit() === 'cm' ? 10 : 1))} ${documentUnit()}`,
      ` · Espessura teórica do miolo ≈ ${format(thickness / (documentUnit() === 'cm' ? 10 : 1))} ${documentUnit()}`,
    );
  hint.textContent = stapled
    ? bw(
        'Usá lomo de 0 mm para una cubierta abrochada al doblez. El grosor estimado excluye la cubierta y no predice cuánto sobresalen las hojas. Plegá una muestra con el papel final para medirlo.',
        'Use a 0 mm spine for a cover stapled through the fold. The estimate excludes the cover and does not predict creep. Fold a proof using the final paper to measure it.',
        'Use lombada de 0 mm para capa grampeada na dobra. A estimativa exclui a capa e não prevê o deslocamento. Dobre uma amostra com o papel final para medir.',
      )
    : bw(
        'Tomá esta medida como punto de partida. Confirmá el lomo final con la imprenta según el papel, el adhesivo y el acabado.',
        'Use this as a starting point. Confirm the final spine with your printer based on paper, adhesive and finishing.',
        'Use a medida como ponto de partida. Confirme a lombada final com a gráfica conforme o papel, a cola e o acabamento.',
      );
  apply.hidden = !stapled && (!valid || thickness > Number(spine.max));
  apply.textContent = stapled
    ? bw('Usar doblez', 'Use fold', 'Usar dobra') + ' · 0 ' + documentUnit()
    : bw('Usar medida estimada', 'Use estimated width', 'Usar largura estimada');
  apply.onclick = () => {
    spine.value = stapled ? '0' : thickness.toFixed(2);
    spine.dispatchEvent(new Event('change', { bubbles: true }));
  };
}

/** Un campo de la cubierta cambió (change/input nativo, en captura). */
function fieldChanged(target: HTMLElement, type: 'change' | 'input'): void {
  const field = target as HTMLInputElement;
  if (type === 'input') {
    if (field.id === 'coverBackground') {
      coverDraft!.background = field.value;
      updateCoverPreview();
    } else if (field.id === 'paperCaliper') refreshBindingEstimate();
    return;
  }
  const size = field.dataset.coverSize;
  if (size) {
    const n = Number(field.value);
    if (!Number.isFinite(n) || n < Number(field.min) || n > Number(field.max)) {
      field.value = coverDraft![size];
      return;
    }
    coverDraft![size] = n;
    updateCoverPreview();
    return;
  }
  const flap = field.dataset.flap;
  if (flap) {
    const width = document.querySelector<HTMLInputElement>(`[data-cover-size="${flap}"]`)!;
    if (!field.checked && coverDraft![flap] > 0) previousFlap[flap] = coverDraft![flap];
    width.value = String(field.checked ? previousFlap[flap] : 0);
    width.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  const key = PART_FIELDS[field.id];
  if (key) {
    // Campos de texto, número, color y selector: se leen como un <input>.
    const v = field.type === 'number' ? Number(field.value) : field.value;
    if (
      field.type === 'number' &&
      (!Number.isFinite(v) ||
        (v as number) < Number(field.min) ||
        (v as number) > Number(field.max))
    )
      return;
    coverDraft!.parts[coverPart][key] = v;
    updateCoverPreview();
    return;
  }
  switch (field.id) {
    case 'coverWrap':
      if (field.value === '' || !field.validity.valid) {
        field.value = String(coverDraft!.wrap || 0);
        return;
      }
      coverDraft!.wrap = Number(field.value);
      updateCoverPreview();
      return;
    case 'spineDirection':
      coverDraft!.parts.spine.direction = field.value;
      coverPart = 'spine';
      updateCoverPreview();
      return;
    case 'coverImageFit':
      coverDraft!.parts[coverPart].imageFit = field.value;
      updateCoverPreview();
      return;
    case 'bindingMethod':
      refreshBindingEstimate();
  }
}

const CoverEditor = () => {
  useLanguage();
  const body = useRef<HTMLElement | null>(null);
  useFieldEvents(body, fieldChanged);
  // Al dibujar (también al cambiar de idioma): la estimación del lomo en el idioma actual.
  useLayoutEffect(() => refreshBindingEstimate());
  const unit = documentUnit();
  const draft = coverDraft!;
  return (
    <>
      <p className="builder-intro">
        {bw(
          'Diseñá la pieza exterior en el mismo proyecto. El ancho de tapa y contratapa y el alto siguen al interior. El lomo se ingresa según la medida final de la imprenta. Poné 0 para quitar lomo o solapas.',
          'Design the exterior in the same project. Front/back width and height follow the interior. Enter the final printer-supplied spine width. Set 0 to remove spine or flaps.',
          'Crie o exterior no mesmo projeto. Largura e altura seguem o miolo. Informe a lombada final fornecida pela gráfica. Use 0 para remover lombada ou orelhas.',
        )}
      </p>
      <div
        className="cover-stage"
        ref={(stage) => {
          // Los cambios se escuchan en el cuerpo de la Ventana (las dos columnas).
          body.current = stage?.parentElement ?? null;
        }}
      >
        <p className="notice">
          {bw(
            'Dos archivos: Interior PDF (páginas del libro) y Cubierta PDF (una pieza desplegada). Guardar cubierta conserva el diseño dentro del proyecto; Exportar genera el PDF.',
            'Two files: Interior PDF (book pages) and Cover PDF (one spread). Save cover keeps the design inside the project; Export creates the PDF.',
            'Dois arquivos: Miolo PDF (páginas) e Capa PDF (uma peça aberta). Salvar capa mantém o desenho no projeto; Exportar gera o PDF.',
          )}
        </p>
        {/* La pinta updateCoverPreview (coverArtwork). */}
        <div id="coverPreview"></div>
        <div className="cover-image-actions">
          <strong id="coverImageTarget"></strong>
          <button type="button" className="btn" id="coverImage" onClick={chooseImage}>
            <Icon name="image" />
            {bw('Agregar / cambiar imagen', 'Add / replace image', 'Adicionar / trocar imagem')}
          </button>
          <button
            type="button"
            className="btn"
            id="coverRemoveImage"
            onClick={() => {
              delete coverDraft!.parts[coverPart].image;
              updateCoverPreview();
            }}
          >
            {bw('Quitar imagen', 'Remove image', 'Remover imagem')}
          </button>
          <p>
            {bw(
              'Seleccioná una zona del desplegado y cargá su imagen. Se adapta para cubrir esa zona.',
              'Select an area in the spread and load its image. It scales to cover that area.',
              'Selecione uma área e carregue a imagem. Ela se adapta para cobrir essa área.',
            )}
          </p>
          <LabeledInput
            className="cover-image-fit"
            label={bw('Ajuste de imagen', 'Image fit', 'Ajuste de imagem') + ' '}
          >
            <select id="coverImageFit" defaultValue="cover">
              <option value="cover">
                {bw(
                  'Cubrir zona · recorta excedente',
                  'Cover area · crop excess',
                  'Cobrir área · cortar excesso',
                )}
              </option>
              <option value="contain">
                {bw('Mostrar imagen completa', 'Show entire image', 'Mostrar imagem inteira')}
              </option>
            </select>
          </LabeledInput>
        </div>
        <label className="spine-direction">
          <strong>{bw('Lectura del lomo', 'Spine reading direction', 'Leitura da lombada')}</strong>
          <select id="spineDirection" defaultValue={draft.parts.spine.direction || 'down'}>
            <option value="down">
              ↓ {bw('De arriba hacia abajo', 'Top to bottom', 'De cima para baixo')}
            </option>
            <option value="up">
              ↑ {bw('De abajo hacia arriba', 'Bottom to top', 'De baixo para cima')}
            </option>
          </select>
        </label>
        <div className="cover-tabs">
          {Object.entries(coverNames()).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className="btn"
              data-cover-edit={key}
              onClick={() => {
                coverPart = key;
                updateCoverPreview();
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {/* Zona y campos de la zona: los escribe updateCoverPreview al cambiar de zona. */}
        <h3 id="coverRegion"></h3>
        <textarea
          id="coverText"
          aria-labelledby="coverRegion"
          className="builder-source"
          maxLength={3000}
        ></textarea>
        <div className="cover-fields">
          <LabeledInput label={bw('Tamaño · pt', 'Size · pt', 'Tamanho · pt')}>
            <input id="coverSize" type="number" min="4" max="100" />
          </LabeledInput>
          <LabeledInput label={bw('Texto', 'Text', 'Texto')}>
            <input id="coverTextColor" type="color" />
          </LabeledInput>
          <LabeledInput
            label={bw('Distancia superior', 'Top distance', 'Distância superior') + ' · mm'}
          >
            <input id="coverY" type="number" min="0" max={book.height} />
          </LabeledInput>
          <LabeledInput label={bw('Alineación', 'Alignment', 'Alinhamento')}>
            <select id="coverAlign">
              <option value="left">{bw('Izquierda', 'Left', 'Esquerda')}</option>
              <option value="center">{bw('Centro', 'Center', 'Centro')}</option>
              <option value="right">{bw('Derecha', 'Right', 'Direita')}</option>
            </select>
          </LabeledInput>
        </div>
        <div className="page-action">
          <button
            type="button"
            className="btn"
            id="coverExport"
            onClick={() => saveAndGo(coverOutputDialog)}
          >
            {bw('Guardar y exportar PDF', 'Save and export PDF', 'Salvar e exportar PDF')}
          </button>
        </div>
      </div>
      <div className="cover-controls">
        {/* Lo escribe updateCoverPreview (medidas, partes y demasía). */}
        <p id="coverDimensions" className="help"></p>
        <section className="cover-measures">
          <h3>{bw('Solapas y forrado', 'Flaps and wrap', 'Orelhas e revestimento')}</h3>
          <div className="page-action">
            <label className="check-line">
              <input type="checkbox" data-flap="leftFlap" defaultChecked={draft.leftFlap > 0} />
              {bw('Solapa trasera', 'Back flap', 'Orelha traseira')}
            </label>
            <label className="check-line">
              <input type="checkbox" data-flap="rightFlap" defaultChecked={draft.rightFlap > 0} />
              {bw('Solapa delantera', 'Front flap', 'Orelha dianteira')}
            </label>
          </div>
          <LabeledInput
            className="field-row"
            label={bw(
              'Demasía para doblar · mm por lado',
              'Wrap allowance · mm per edge',
              'Margem de dobra · mm por lado',
            )}
          >
            <input
              id="coverWrap"
              type="number"
              min="0"
              max="50"
              step=".5"
              defaultValue={draft.wrap || 0}
            />
          </LabeledInput>
          <p className="help">
            {bw(
              'La demasía se dobla hacia adentro del cartón. El sangrado va por fuera de esa demasía. Las marcas indican el corte del material, incluido lo que se dobla.',
              'The wrap folds over the board edges. Bleed extends beyond it. Crop marks indicate where to cut the material, including the wrap.',
              'A sobra dobra para dentro do cartão. A sangria fica além dela. As marcas indicam o corte do material, incluindo a sobra.',
            )}
          </p>
        </section>
        <section className="cover-measures">
          <h3>
            {bw(
              'Medidas para diseñar cada parte',
              'Dimensions for designing each part',
              'Medidas para criar cada parte',
            )}
          </h3>
          {/* La llenan cover-measurements (tabla y resumen) en cada updateCoverPreview. */}
          <table id="coverMeasureTable"></table>
          <p id="coverMeasureSummary"></p>
          <p className="help">
            {bw(
              'Ancho × alto. Prepará cada imagen con la proporción de su zona. El sangrado corresponde al contorno exterior del desplegado; los pliegues no llevan sangrado adicional. Píxeles de referencia a 300 ppp.',
              'Width × height. Prepare each image in the aspect ratio of its area. Bleed applies to the outer spread; folds need no extra bleed. Pixel reference at 300 ppi.',
              'Largura × altura. Prepare cada imagem na proporção da área. Sangria no contorno externo; dobras não precisam de sangria extra. Referência em pixels a 300 ppp.',
            )}
          </p>
          <button
            type="button"
            className="btn"
            id="downloadCoverSpecs"
            onClick={() =>
              download(
                new Blob(['﻿' + coverMeasurementText(coverDraft!)], {
                  type: 'text/plain;charset=utf-8',
                }),
                book.title + ' - medidas cubierta.txt',
              )
            }
          >
            {bw(
              'Descargar ficha de medidas',
              'Download dimension sheet',
              'Baixar ficha de medidas',
            )}
          </button>
        </section>
        <div className="cover-fields">
          {SIZES.map(([key, label, min, max]) => (
            <LabeledInput key={key} label={bw(...label) + ' · mm'}>
              <input
                data-cover-size={key}
                type="number"
                min={min}
                max={max}
                step="0.5"
                defaultValue={draft[key]}
              />
            </LabeledInput>
          ))}
          <LabeledInput label={bw('Fondo', 'Background', 'Fundo')}>
            <input id="coverBackground" type="color" defaultValue={draft.background} />
          </LabeledInput>
        </div>
        <details className="binding-estimate">
          <summary>
            {bw(
              'Estimar grosor y lomo',
              'Estimate thickness and spine',
              'Estimar espessura e lombada',
            )}
          </summary>
          <div className="modal-grid">
            <div className="control">
              <label htmlFor="bindingMethod">
                {bw('Encuadernación', 'Binding', 'Encadernação')}
              </label>
              <select id="bindingMethod" defaultValue="stapled">
                <option value="stapled">
                  {bw('Abrochado al medio', 'Saddle stitch', 'Grampo central')}
                </option>
                <option value="flat">
                  {bw('Lomo plano encolado', 'Perfect bound', 'Lombada quadrada colada')}
                </option>
              </select>
            </div>
            <div className="control">
              <label htmlFor="paperCaliper">
                {bw(
                  'Espesor de una hoja · µm',
                  'Paper caliper · µm',
                  'Espessura de uma folha · µm',
                )}
              </label>
              <input
                id="paperCaliper"
                type="number"
                min="20"
                max="2000"
                step="1"
                placeholder="80"
              />
            </div>
          </div>
          <p className="help">
            {bw(
              'Usá el espesor de la ficha técnica. Si medís 10 hojas juntas en milímetros, multiplicá el resultado por 100 para obtener los µm de una hoja.',
              'Use the manufacturer’s caliper. If you measure a stack of 10 sheets in millimeters, multiply by 100 for microns per sheet.',
              'Use a espessura da ficha técnica. Se medir 10 folhas juntas em milímetros, multiplique por 100 para obter os µm de uma folha.',
            )}
          </p>
          {/* Resultado, aclaración y botón: los escribe refreshBindingEstimate. */}
          <p id="bindingResult" aria-live="polite"></p>
          <p id="bindingHint" className="help"></p>
          <button type="button" id="applyBindingSpine" className="btn" hidden></button>
        </details>
        <p className="help">
          {bw(
            'Las guías no se exportan. El sangrado extiende el fondo; las imágenes deben cubrirlo si llegan al corte. La cubierta se exporta aparte del interior, en una sola pieza.',
            'Guides are not exported. Bleed extends the background; images must cover it if they reach the trim. Export the cover separately as one spread.',
            'Guias não são exportadas. A sangria estende o fundo; imagens devem cobri-la se chegam ao corte. A capa é exportada separada do miolo, em uma peça.',
          )}
        </p>
      </div>
    </>
  );
};

/** Exportar e imprimir, junto a "Guardar cubierta" en la barra del título (antes cover-actions). */
const CoverActions = () => {
  useLanguage();
  return (
    <div id="coverPersistentActions" className="cover-persistent-actions">
      <button
        type="button"
        className="btn"
        id="exportCoverVisible"
        onClick={() => saveAndGo(coverOutputDialog)}
      >
        {bw('Exportar cubierta PDF', 'Export cover PDF', 'Exportar capa PDF')}
      </button>
      <button
        type="button"
        className="btn"
        id="printCoverVisible"
        onClick={() => saveAndGo(() => coverSheetDialog('print'))}
      >
        {bw('Imprimir cubierta', 'Print cover', 'Imprimir capa')}
      </button>
    </div>
  );
};

globalThis.coverEditor = function (): void {
  if (!hasDocument) {
    settings(true);
    return;
  }
  finishEditing();
  coverDraft = M.clone(book.cover || defaultCover());
  coverPart = 'front';
  for (const key of ['leftFlap', 'rightFlap']) previousFlap[key] = coverDraft![key] || 70;
  void openWorkWindow(<CoverEditor />, {
    title: bw('Cubierta desplegada', 'Full cover spread', 'Capa aberta'),
    variant: 'cover-modal',
    extraActions: <CoverActions />,
    action: {
      label: bw('Guardar cubierta', 'Save cover', 'Salvar capa'),
      run: () => {
        validateCover(coverDraft!);
        commit(() => (book.cover = M.clone(coverDraft)), false);
      },
    },
  });
  // La Ventana ya está en la página: se pinta en el acto y otra vez con el tamaño definitivo.
  updateCoverPreview();
  requestAnimationFrame(updateCoverPreview);
};
