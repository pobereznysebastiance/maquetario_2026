// Pauta de uso tipográfico ("Reglas internas"): agrupa los párrafos del libro por su formato real
// y arma la tabla editable de funciones y operaciones de cada estilo.
// Fuente TypeScript: se compila a build/editorial-rules.js (desktop/scripts/build.mjs).
import type { BookObject } from './model.ts';

interface ParagraphStyle {
  id: string;
  name: string;
  properties?: Record<string, unknown>;
}
interface RuleExample {
  page: number;
  object: BookObject;
}
/** Un grupo de párrafos con el mismo estilo y el mismo formato efectivo. */
export interface EditorialRule {
  style: ParagraphStyle | undefined;
  format: Record<string, any>;
  count: number;
  columns: Set<number>;
  writing: Set<'upper' | 'lower' | 'mixed'>;
  examples: RuleExample[];
}

function usedGridColumns(page: number, object: BookObject): number {
  const grid = M.gridRect(book, page),
    { cols, gapX } = book.grid;
  const width = (grid.w - gapX * (cols - 1)) / cols;
  let count = 0;
  for (let column = 0; column < cols; column++) {
    const start = grid.x + column * (width + gapX);
    if (Math.min(start + width, object.x + object.w) - Math.max(start, object.x) > 0.01) count++;
  }
  return count;
}
function ruleGridPreview({ page, object }: RuleExample): string {
  const grid = M.gridRect(book, page),
    { cols, rows, gapX, gapY } = book.grid;
  const w = (grid.w - gapX * (cols - 1)) / cols,
    h = (grid.h - gapY * (rows - 1)) / rows;
  let cells = '';
  for (let x = 0; x < cols; x++)
    for (let y = 0; y < rows; y++) {
      cells += `<rect x="${grid.x + x * (w + gapX)}" y="${grid.y + y * (h + gapY)}" width="${w}" height="${h}" vector-effect="non-scaling-stroke"/>`;
    }
  return `<svg class="rule-grid-preview" viewBox="0 0 ${book.width} ${book.height}" aria-hidden="true">
    <g fill="none" stroke="#6a8b8866" stroke-width=".45">${cells}</g>
    <rect x="${object.x}" y="${object.y}" width="${object.w}" height="${object.h}" fill="#3fb59ca0"/>
    </svg>`;
}

function collectEditorialRules(): EditorialRule[] {
  const groups = new Map<string, EditorialRule>();
  for (const [pageIndex, page] of book.pages.entries())
    for (const object of page.objects) {
      if (object.type !== 'text' || object.hidden || object.toc) continue;
      const lines = object.text.split('\n');
      const columns = usedGridColumns(pageIndex, object);
      for (let index = 0; index < lines.length; index++) {
        if (!lines[index].trim()) continue;
        const format = paragraphFormat(book, object, index);
        const style = book.paragraphStyles?.find(
          (item: ParagraphStyle) => item.id === object.paragraphMap?.[index]?.styleId,
        );
        const signature = JSON.stringify([
          style?.id || '',
          ...paragraphKeys.map((key) => format[key] ?? null),
        ]);
        if (!groups.has(signature))
          groups.set(signature, {
            style,
            format,
            count: 0,
            columns: new Set(),
            writing: new Set(),
            examples: [],
          });
        const row = groups.get(signature)!,
          text = lines[index];
        row.count++;
        row.columns.add(columns);
        if (text.toUpperCase() !== text.toLowerCase())
          row.writing.add(
            text === text.toUpperCase() ? 'upper' : text === text.toLowerCase() ? 'lower' : 'mixed',
          );
        if (row.examples.length < 3 && !row.examples.some((example) => example.page === pageIndex))
          row.examples.push({ page: pageIndex, object });
      }
    }
  return [...groups.values()];
}

function editorialRulesDialog(): void {
  if (!hasDocument) return;
  finishEditing();
  const rules = collectEditorialRules();
  const styleRoles: Record<string, string> = book.editorialRoles || {};
  const styleNotes: Record<string, { leading?: string; operation?: string }> =
    book.editorialPautas || {};
  // Puntos para mostrar: el interlineado sale de multiplicar (14 × 1,4 = 19,599999…); dos decimales alcanzan.
  const points = (value: unknown) => Number((Number(value) || 0).toFixed(2));
  const leadingNames: Record<string, string> = {
    wide: bw('Amplio', 'Open', 'Amplo'),
    normal: bw('Normal', 'Normal', 'Normal'),
    tight: bw('Ajustado', 'Tight', 'Justo'),
  };
  const writingNames: Record<string, string> = {
    upper: bw('Mayúsculas', 'Uppercase', 'Maiúsculas'),
    lower: bw('Minúsculas', 'Lowercase', 'Minúsculas'),
    mixed: bw('Mixta', 'Mixed', 'Mista'),
  };
  const headers = [
    bw('Elemento / estilo', 'Element / style', 'Elemento / estilo'),
    bw('Familia y cuerpo', 'Family and size', 'Família e corpo'),
    bw('Escritura', 'Case', 'Caixa'),
    bw('Peso / rendimiento / inclinación', 'Weight / width / slope', 'Peso / largura / inclinação'),
    bw('Alineación', 'Alignment', 'Alinhamento'),
    bw('Ancho en columnas', 'Width in columns', 'Largura em colunas'),
    bw('Interlineado', 'Leading', 'Entrelinha'),
    bw('Operación tipográfica', 'Typographic treatment', 'Operação tipográfica'),
    bw('Zonas activas', 'Grid areas', 'Áreas ativas'),
  ];
  const align: Record<string, string> = {
    left: pw().l,
    right: pw().r,
    center: pw().c,
    justify: pw().j,
  };
  const rows = rules
    .map(({ style, format, count, columns, writing, examples }) => {
      const face = selectedFace(format);
      const variant =
        format.fontStyleName ||
        [format.bold ? 'Bold' : '', format.italic ? 'Italic' : ''].filter(Boolean).join(' ') ||
        selectedFace(format)?.style ||
        '—';
      const axes = Object.entries((format.fontAxes || {}) as Record<string, number>)
        .map(([name, value]) => name + ' ' + value)
        .join(' · ');
      const weight =
        format.fontAxes?.wght ?? format.fontWeight ?? (format.bold ? 700 : face?.weight || 400);
      const inclination =
        format.fontItalic || format.italic
          ? bw('Cursiva', 'Italic', 'Itálico')
          : bw('Recta', 'Upright', 'Reto');
      const note = style ? styleNotes[style.id] : undefined;
      const name = style?.name || bw('Formato directo', 'Direct formatting', 'Formatação direta');
      const operation = note?.operation || '—';
      return `<tr><th scope="row">${esc((style && styleRoles[style.id]) || name)}
      <small>${style && styleRoles[style.id] ? esc(name) + ' · ' : ''}${count} ${bw('párr.', 'para.', 'parág.')}</small></th>
      <td><strong>${esc(format.font)}</strong><small>${points(format.size)} pt · ${esc(variant)}</small></td>
      <td>${[...writing].map((key) => writingNames[key]).join(' / ') || '—'}</td>
      <td>${weight} · ${format.fontAxes?.wdth ?? '—'} · ${inclination}${axes ? `<small>${esc(axes)}</small>` : ''}</td>
      <td>${icon(format.align)} ${align[format.align] || '—'}</td>
      <td>${[...columns].sort((a, b) => a - b).join(' / ')}</td>
      <td>${points(format.leading)} pt <small>${leadingNames[note?.leading ?? ''] || '—'}</small></td>
      <td>${esc(operation)}<small>${bw('Sangrías', 'Indents', 'Recuos')} ${[format.indentLeft, format.indentRight, format.firstIndent].map((n: number) => displayMeasure(n || 0)).join(' / ')} ${documentUnit()}
      · ${bw('Espacio', 'Spacing', 'Espaço')} ${[format.spaceBefore, format.spaceAfter].map((n: number) => displayMeasure(n || 0)).join(' / ')} ${documentUnit()}</small></td>
      <td><div class="rule-grid-examples">${examples.map((example) => `<div>${ruleGridPreview(example)}<small>${M.folio(book, example.page)}</small></div>`).join('')}</div></td></tr>`;
    })
    .join('');
  const roleLabel = bw('Función editorial', 'Editorial role', 'Função editorial');
  modal(
    bw('Pauta de uso tipográfico', 'Typography usage guide', 'Pauta de uso tipográfico'),
    `
    <p class="builder-intro">${bw(
      'La tabla se actualiza con el formato que realmente usan los párrafos. Si un estilo tiene ajustes locales, sus variantes aparecen en filas separadas.',
      'The table follows the actual formatting used by paragraphs. Local variations of a style appear in separate rows.',
      'A tabela acompanha a formatação usada nos parágrafos. Variações locais de um estilo aparecem em linhas separadas.',
    )}</p>
    ${
      rows
        ? `<div class="editorial-rules-table"><table><thead><tr>${headers.map((label) => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`
        : `<p class="help">${bw('Agregá texto al documento para ver sus reglas.', 'Add text to see its rules.', 'Adicione texto para ver as regras.')}</p>`
    }
    ${
      (book.paragraphStyles || []).length
        ? `<h3>${bw('Asignar funciones a los estilos', 'Assign roles to styles', 'Atribuir funções aos estilos')}</h3>
    <div class="modal-grid">${book.paragraphStyles
      .map(
        (
          style: ParagraphStyle,
        ) => `<section class="rule-style-input"><label class="control">${esc(style.name)}
      <input type="text" data-editorial-role="${esc(style.id)}" aria-label="${roleLabel}: ${esc(style.name)}"
      maxlength="80" value="${esc(styleRoles[style.id] || '')}" placeholder="${bw('Ej. Cuerpo principal', 'E.g. Body text', 'Ex. Texto principal')}"></label>
      <label>${bw('Tipo de interlineado', 'Leading type', 'Tipo de entrelinha')} <select data-rule-leading>
      <option value="">—</option>${Object.entries(leadingNames)
        .map(
          ([key, label]) =>
            `<option value="${key}" ${key === styleNotes[style.id]?.leading ? 'selected' : ''}>${label}</option>`,
        )
        .join('')}</select></label>
      <label>${bw('Operación tipográfica', 'Typographic treatment', 'Operação tipográfica')}
      <input type="text" data-rule-operation maxlength="250" value="${esc(styleNotes[style.id]?.operation || '')}"></label>
      </section>`,
      )
      .join('')}</div>`
        : ''
    }`,
    () => {
      const roles = Object.fromEntries(
        $$('[data-editorial-role]')
          .map((input) => [input.dataset.editorialRole, input.value.trim()])
          .filter(([, role]) => role),
      );
      const notes = Object.fromEntries(
        $$('.rule-style-input')
          .map((section): [string | undefined, { leading: string; operation: string }] => [
            section.querySelector<HTMLElement>('[data-editorial-role]')!.dataset.editorialRole,
            {
              leading: section.querySelector<HTMLSelectElement>('[data-rule-leading]')!.value,
              operation: section
                .querySelector<HTMLInputElement>('[data-rule-operation]')!
                .value.trim(),
            },
          ])
          .filter(([, note]) => note.leading || note.operation),
      );
      if (
        JSON.stringify(roles) !== JSON.stringify(styleRoles) ||
        JSON.stringify(notes) !== JSON.stringify(styleNotes)
      ) {
        commit(() => {
          book.editorialRoles = roles;
          book.editorialPautas = notes;
        }, false);
      }
      return true;
    },
    bw('Listo', 'Done', 'Pronto'),
  );
  dialogVariant('editorial-rules-dialog');
}

decorateInspector(() => {
  if (tab !== 'structure' || !hasDocument) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'editorialRules';
  button.className = 'btn wide';
  button.textContent = bw('Reglas internas', 'Editorial rules', 'Regras internas');
  button.onclick = editorialRulesDialog;
  $('#inspectorContent').prepend(button);
}, 'editorial-rules');

// Las usan las pruebas (tests/category-tests.js, tests/document-view-tests.js).
declare global {
  var collectEditorialRules: () => EditorialRule[];
  var editorialRulesDialog: () => void;
}
globalThis.collectEditorialRules = collectEditorialRules;
globalThis.editorialRulesDialog = editorialRulesDialog;
