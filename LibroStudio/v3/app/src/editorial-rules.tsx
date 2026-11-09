// Pauta de uso tipográfico (pedido de la cátedra de Tipografía I): la tabla donde se deciden las
// pautas del libro. Una fila por rol (src/roles.ts), en el orden de la planilla, con las columnas de
// la planilla de la cátedra: tipografía y cuerpo; variable (escritura, peso, rendimiento,
// inclinación); alineación; ancho de caja; interlineado (amplio, normal o ajustado, con el valor);
// operación tipográfica; y zonas activas de la grilla en tres dobles páginas representativas. Folio
// y cornisa van en Otros. Lleva la leyenda de la cátedra en la vista y en lo que se descarga.
//
// - Se edita: tipografía, cuerpo, alineación, ancho de caja, interlineado y operación cambian el rol,
//   o sea el libro entero, al aplicar (Hoja de React con campos no controlados, como antes).
// - Marca las excepciones: los textos del rol que se apartan de él (ajustes locales o una caja de
//   otro ancho), con las páginas para ir.
// - Se descarga: HTML para imprimir y CSV para la planilla.
// Los textos sin rol aparecen abajo, agrupados por formato (collectEditorialRules, como antes).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { renderToStaticMarkup } from 'react-dom/server';
import type { BookObject, RoleId } from './model.ts';
import { bw } from './i18n/language.ts';
import { editor, M } from './core-api.ts';
import {
  paragraphBase,
  paragraphFormat,
  paragraphKeys,
  pw,
  type ParagraphStyle,
} from './paragraph-format.ts';
import { chooseDefaultFace, selectedFace, variations } from './font-catalog.ts';
import { modal } from './components/dialog/modal.ts';
import { boxColumns, boxRoleStyle, fitBox, ROLE_IDS, roleName } from './roles.ts';
import { goToBookPage } from './book-navigation.ts';

/** Leyenda obligatoria de la cátedra, en la vista y en lo que se descarga. */
export const GUIDE_LEGEND =
  'Pautas tipográficas Material adaptado y desarrollado por la Cátedra de Tipografía I de la UNNE (Universidad Nacional del Nordeste) para fines académicos y editoriales.';

/**
 * Dónde cortan Ajustado, Normal y Amplio: interlineado ÷ cuerpo. PROVISORIO: es la propuesta que
 * le hicimos a la cátedra (docs/proximos-pasos.md, sección 5); cambiar acá cuando contesten.
 */
export const LEADING_LIMITS = { tight: 1.2, normal: 1.4 };
type LeadingClass = 'tight' | 'normal' | 'wide';
export const leadingClass = (size: number, leading: number): LeadingClass => {
  const ratio = leading / size;
  return ratio < LEADING_LIMITS.tight
    ? 'tight'
    : ratio <= LEADING_LIMITS.normal
      ? 'normal'
      : 'wide';
};
const leadingNames = (): Record<LeadingClass, string> => ({
  wide: bw('Amplio', 'Open', 'Amplo'),
  normal: bw('Normal', 'Normal', 'Normal'),
  tight: bw('Ajustado', 'Tight', 'Justo'),
});
type Writing = 'upper' | 'lower' | 'mixed';
const writingNames = (): Record<Writing, string> => ({
  upper: bw('Mayúsculas', 'Uppercase', 'Maiúsculas'),
  lower: bw('Minúsculas', 'Lowercase', 'Minúsculas'),
  mixed: bw('Alta y baja', 'Mixed case', 'Alta e baixa'),
});
const alignName = (align: string): string =>
  ({ left: pw().l, right: pw().r, center: pw().c, justify: pw().j })[align] || '—';
// Puntos para mostrar: el interlineado sale de multiplicar (14 × 1,4 = 19,599999…).
const points = (value: unknown) => Number((Number(value) || 0).toFixed(2));
const pageName = (page: number) => M.folio(editor.book, page) || String(page + 1);
const writingOf = (text: string): Writing | null =>
  text.toUpperCase() === text.toLowerCase()
    ? null
    : text === text.toUpperCase()
      ? 'upper'
      : text === text.toLowerCase()
        ? 'lower'
        : 'mixed';

// ── Textos sin rol: grupos por formato (los usan las pruebas) ──

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
  writing: Set<Writing>;
  examples: RuleExample[];
}

function usedGridColumns(page: number, object: BookObject): number {
  const grid = M.gridRect(editor.book, page),
    { cols, gapX } = editor.book.grid;
  const width = (grid.w - gapX * (cols - 1)) / cols;
  let count = 0;
  for (let column = 0; column < cols; column++) {
    const start = grid.x + column * (width + gapX);
    if (Math.min(start + width, object.x + object.w) - Math.max(start, object.x) > 0.01) count++;
  }
  return count;
}

function collectEditorialRules(): EditorialRule[] {
  const groups = new Map<string, EditorialRule>();
  for (const [pageIndex, page] of editor.book.pages.entries())
    for (const object of page.objects) {
      if (object.type !== 'text' || object.hidden || object.toc) continue;
      const lines = object.text.split('\n');
      const columns = usedGridColumns(pageIndex, object);
      for (let index = 0; index < lines.length; index++) {
        if (!lines[index].trim()) continue;
        const format = paragraphFormat(editor.book, object, index);
        const style = editor.book.paragraphStyles?.find(
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
          writing = writingOf(M.withoutNoteMarks(editor.book, lines[index]));
        row.count++;
        row.columns.add(columns);
        if (writing) row.writing.add(writing);
        if (row.examples.length < 3 && !row.examples.some((example) => example.page === pageIndex))
          row.examples.push({ page: pageIndex, object });
      }
    }
  return [...groups.values()];
}

// ── Filas por rol ──

/** Un rol del libro en la tabla: su formato, dónde está y qué se aparta de él. */
export interface RoleRow {
  style: ParagraphStyle & { role: RoleId };
  /** Formato del rol (el estilo sobre la caja donde aparece primero). */
  format: Record<string, any>;
  paragraphs: number;
  /** Páginas donde aparece, en orden. */
  pages: number[];
  writing: Set<Writing>;
  /** Textos o cajas que se apartan del rol, y sus páginas. */
  exceptions: number;
  exceptionPages: number[];
}

export function collectRoleRows(): RoleRow[] {
  const b = editor.book,
    rows = new Map<string, RoleRow>(),
    roleStyles = (b.paragraphStyles || []).filter(
      (s: ParagraphStyle) => s.role,
    ) as RoleRow['style'][];
  const mark = (row: RoleRow, page: number) => {
    row.exceptions++;
    if (!row.exceptionPages.includes(page)) row.exceptionPages.push(page);
  };
  b.pages.forEach((page, pageIndex) =>
    page.objects.forEach((o) => {
      if (o.type !== 'text' || o.toc) return;
      o.text.split('\n').forEach((line: string, i: number) => {
        const style = roleStyles.find((s) => s.id === o.paragraphMap?.[i]?.styleId);
        if (!style) return;
        const roleFormat = { ...paragraphBase(o), ...style.properties };
        let row = rows.get(style.id);
        if (!row)
          rows.set(
            style.id,
            (row = {
              style,
              format: roleFormat,
              paragraphs: 0,
              pages: [],
              writing: new Set(),
              exceptions: 0,
              exceptionPages: [],
            }),
          );
        row.paragraphs++;
        if (!row.pages.includes(pageIndex)) row.pages.push(pageIndex);
        const writing = writingOf(M.withoutNoteMarks(b, line));
        if (writing) row.writing.add(writing);
        const own = paragraphFormat(b, o, i);
        if (paragraphKeys.some((k) => JSON.stringify(own[k]) !== JSON.stringify(roleFormat[k])))
          mark(row, pageIndex);
      });
      // Una caja del rol con otro ancho que el del rol también es una excepción.
      const boxStyle = boxRoleStyle(o),
        row = boxStyle && rows.get(boxStyle.id);
      if (row && boxStyle.columns && boxColumns(o, pageIndex) !== boxStyle.columns)
        mark(row, pageIndex);
    }),
  );
  return [...rows.values()].sort(
    (x, y) => ROLE_IDS.indexOf(x.style.role) - ROLE_IDS.indexOf(y.style.role),
  );
}

/** Hasta tres dobles páginas donde está el rol: la primera, una del medio y la última. */
function representativeSpreads(pages: number[]): number[] {
  const starts = [...new Set(pages.map((p) => (editor.book.facing ? p - (p % 2) : p)))];
  if (starts.length <= 3) return starts;
  return [starts[0]!, starts[Math.floor(starts.length / 2)]!, starts[starts.length - 1]!];
}

/** Una doble página con la grilla y las cajas del rol marcadas (las demás, tenues). */
const SpreadZones = ({ start, styleId }: { start: number; styleId: string }) => {
  const b = editor.book,
    pages = (b.facing ? [start, start + 1] : [start]).filter((i) => i < b.pages.length),
    { cols, rows, gapX, gapY } = b.grid;
  return (
    <svg
      className="guide-spread"
      viewBox={`0 0 ${b.width * pages.length} ${b.height}`}
      role="img"
      aria-label={bw('Páginas ', 'Pages ', 'Páginas ') + pages.map(pageName).join('–')}
    >
      {pages.map((page, k) => {
        const area = M.gridRect(b, page),
          w = (area.w - gapX * (cols - 1)) / cols,
          h = (area.h - gapY * (rows - 1)) / rows,
          x0 = k * b.width;
        return (
          <g key={page} transform={`translate(${x0} 0)`}>
            <rect
              width={b.width}
              height={b.height}
              fill="#fafaf5"
              stroke="#9a9da5"
              strokeWidth=".6"
            />
            <g fill="none" stroke="#6a8b8866" strokeWidth=".45">
              {Array.from({ length: cols * rows }, (_, n) => (
                <rect
                  key={n}
                  x={area.x + (n % cols) * (w + gapX)}
                  y={area.y + Math.floor(n / cols) * (h + gapY)}
                  width={w}
                  height={h}
                />
              ))}
            </g>
            {b.pages[page]!.objects.filter((o) => o.type === 'text' && !o.toc).map((o) => (
              <rect
                key={o.id}
                x={o.x}
                y={o.y}
                width={o.w}
                height={o.h}
                fill={
                  o.paragraphMap?.some((m: { styleId?: string }) => m?.styleId === styleId)
                    ? '#3fb59ca0'
                    : '#9a9da533'
                }
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
};

/** Folio, cornisa y titulillo (en Otros): tipo de letra, cuerpo y alineación. */
const otherElements = (): string[] => {
  const b = editor.book,
    item = (name: string, c: { font: string; size: number; align: string }) =>
      `${name}: ${c.font} ${points(c.size)} pt · ${alignName(c.align)}`;
  return [
    b.folio.enabled ? item(bw('Folio', 'Folio', 'Fólio'), b.folio) : '',
    b.header.enabled ? item(bw('Cornisa', 'Running head', 'Cabeçalho'), b.header) : '',
    b.titulillo.enabled ? item(bw('Titulillo', 'Running title', 'Titulinho'), b.titulillo) : '',
  ].filter(Boolean);
};

const headers = () => [
  bw('Rol', 'Role', 'Função'),
  bw('Tipografía y cuerpo', 'Typeface and size', 'Fonte e corpo'),
  bw(
    'Variable · escritura, peso, rendimiento, inclinación',
    'Variable · case, weight, width, slope',
    'Variável · caixa, peso, largura, inclinação',
  ),
  bw('Alineación', 'Alignment', 'Alinhamento'),
  bw('Ancho de caja', 'Frame width', 'Largura da caixa'),
  bw('Interlineado', 'Leading', 'Entrelinha'),
  bw('Operación tipográfica', 'Typographic treatment', 'Operação tipográfica'),
  bw('Zonas activas de la grilla', 'Active grid areas', 'Áreas ativas do grid'),
  bw('Excepciones', 'Exceptions', 'Exceções'),
];

const notesOf = (): Record<string, { leading?: LeadingClass; operation?: string }> =>
  editor.book.editorialPautas || {};
const columnsName = (n: number | undefined) =>
  n
    ? n + ' ' + (n === 1 ? bw('columna', 'column', 'coluna') : bw('columnas', 'columns', 'colunas'))
    : bw('Libre', 'Free', 'Livre');

/** La tabla: editable en la Hoja, de sólo lectura en lo que se descarga. */
const GuideTable = ({ rows, editable }: { rows: RoleRow[]; editable: boolean }) => {
  const notes = notesOf(),
    cols = editor.book.grid.cols;
  return (
    <table>
      <thead>
        <tr>
          {headers().map((label) => (
            <th key={label} scope="col">
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ style, format, paragraphs, pages, writing, exceptions, exceptionPages }) => {
          const face = selectedFace(format),
            weight =
              format.fontAxes?.wght ??
              format.fontWeight ??
              (format.bold ? 700 : face?.weight || 400),
            slope =
              format.fontItalic || format.italic
                ? bw('Cursiva', 'Italic', 'Itálico')
                : bw('Recta', 'Upright', 'Reto'),
            note = notes[style.id],
            automatic = leadingClass(format.size, format.leading),
            shownClass = note?.leading || automatic;
          return (
            <tr key={style.id} data-pauta-style={style.id}>
              <th scope="row">
                {roleName(style.role)}
                <small>
                  {(style.name !== roleName(style.role) ? style.name + ' · ' : '') +
                    paragraphs +
                    ' ' +
                    bw('párr.', 'para.', 'parág.')}
                </small>
              </th>
              <td>
                {editable ? (
                  <>
                    <select
                      data-pauta="font"
                      aria-label={bw('Tipografía', 'Typeface', 'Fonte')}
                      defaultValue={format.font}
                    >
                      {[...new Set([format.font, ...editor.fontList])].map((family) => (
                        <option key={family} value={family}>
                          {family}
                        </option>
                      ))}
                    </select>
                    <span className="guide-unit">
                      <input
                        data-pauta="size"
                        type="number"
                        min={4}
                        max={150}
                        step={0.5}
                        aria-label={bw('Cuerpo', 'Size', 'Corpo')}
                        defaultValue={points(format.size)}
                      />
                      pt
                    </span>
                  </>
                ) : (
                  <>
                    <strong>{format.font}</strong>
                    <small>{points(format.size)} pt</small>
                  </>
                )}
              </td>
              <td>
                {[...writing].map((key) => writingNames()[key]).join(' / ') || '—'}
                <small>
                  {`${format.fontStyleName || face?.style || weight} · ${format.fontAxes?.wdth ?? '—'} · ${slope}`}
                </small>
              </td>
              <td>
                {editable ? (
                  <select
                    data-pauta="align"
                    aria-label={bw('Alineación', 'Alignment', 'Alinhamento')}
                    defaultValue={format.align}
                  >
                    {['left', 'center', 'right', 'justify'].map((a) => (
                      <option key={a} value={a}>
                        {alignName(a)}
                      </option>
                    ))}
                  </select>
                ) : (
                  alignName(format.align)
                )}
              </td>
              <td>
                {editable ? (
                  <select
                    data-pauta="columns"
                    aria-label={bw('Ancho de caja', 'Frame width', 'Largura da caixa')}
                    defaultValue={String(style.columns ?? '')}
                  >
                    <option value="">{columnsName(undefined)}</option>
                    {Array.from({ length: cols }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={String(n)}>
                        {columnsName(n)}
                      </option>
                    ))}
                  </select>
                ) : (
                  columnsName(style.columns)
                )}
              </td>
              <td>
                {editable ? (
                  <>
                    <span className="guide-unit">
                      <input
                        data-pauta="leading"
                        type="number"
                        min={4}
                        max={220}
                        step={0.5}
                        aria-label={bw('Interlineado', 'Leading', 'Entrelinha')}
                        defaultValue={points(format.leading)}
                      />
                      pt
                    </span>
                    <select
                      data-pauta="leadingClass"
                      aria-label={bw('Tipo de interlineado', 'Leading type', 'Tipo de entrelinha')}
                      defaultValue={note?.leading || ''}
                    >
                      <option value="">{leadingNames()[automatic] + ' · auto'}</option>
                      {(Object.entries(leadingNames()) as [LeadingClass, string][]).map(
                        ([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </>
                ) : (
                  <>
                    {leadingNames()[shownClass]}
                    <small>{points(format.leading)} pt</small>
                  </>
                )}
              </td>
              <td>
                {editable ? (
                  <input
                    data-pauta="operation"
                    type="text"
                    maxLength={250}
                    aria-label={bw(
                      'Operación tipográfica',
                      'Typographic treatment',
                      'Operação tipográfica',
                    )}
                    defaultValue={note?.operation || ''}
                  />
                ) : (
                  note?.operation || '—'
                )}
              </td>
              <td>
                <div className="guide-zones">
                  {representativeSpreads(pages).map((start) => (
                    <figure key={start}>
                      <SpreadZones start={start} styleId={style.id} />
                      <figcaption>
                        {pageName(start) +
                          (editor.book.facing && start + 1 < editor.book.pages.length
                            ? '–' + pageName(start + 1)
                            : '')}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </td>
              <td data-pauta-exceptions={exceptions}>
                {exceptions ? (
                  <>
                    {exceptions +
                      ' ' +
                      (exceptions === 1
                        ? bw('texto', 'text', 'texto')
                        : bw('textos', 'texts', 'textos'))}
                    <small>
                      {exceptionPages.slice(0, 6).map((page) =>
                        editable ? (
                          <button
                            key={page}
                            type="button"
                            className="link-button guide-page"
                            data-guide-page={page}
                            onClick={() => {
                              closeSheet();
                              goToBookPage(page);
                            }}
                          >
                            {'p. ' + pageName(page)}
                          </button>
                        ) : (
                          <span key={page}>{'p. ' + pageName(page) + ' '}</span>
                        ),
                      )}
                    </small>
                  </>
                ) : (
                  bw('Ninguna', 'None', 'Nenhuma')
                )}
              </td>
            </tr>
          );
        })}
        <tr data-pauta-other>
          <th scope="row">{roleName('other')}</th>
          <td colSpan={8}>
            {otherElements().map((line) => (
              <div key={line}>{line}</div>
            ))}
          </td>
        </tr>
      </tbody>
    </table>
  );
};

/** Lo que se lee de la Hoja al aplicar: una fila por rol. */
interface RowEdit {
  style: ParagraphStyle;
  font: string;
  size: number;
  leading: number;
  align: string;
  columns: number | null;
  leadingClass: LeadingClass | '';
  operation: string;
}
function readEdits(rows: RoleRow[]): RowEdit[] {
  return rows.map(({ style }) => {
    const tr = document.querySelector<HTMLElement>(`[data-pauta-style="${style.id}"]`)!,
      field = (name: string) => tr.querySelector<HTMLInputElement>(`[data-pauta="${name}"]`)!.value;
    const size = Number(field('size')),
      leading = Number(field('leading'));
    if (!(size >= 4 && size <= 150) || !(leading >= 4 && leading <= 220))
      throw Error(
        bw(
          `Revisá el cuerpo y el interlineado de ${roleName(style.role!)}.`,
          `Check the size and leading of ${roleName(style.role!)}.`,
          `Revise o corpo e a entrelinha de ${roleName(style.role!)}.`,
        ),
      );
    return {
      style,
      font: field('font'),
      size,
      leading,
      align: field('align'),
      columns: field('columns') ? Number(field('columns')) : null,
      leadingClass: field('leadingClass') as LeadingClass | '',
      operation: field('operation').trim(),
    };
  });
}

/** Aplica la tabla: cada rol cambia en todo el libro (también el ancho de sus cajas). */
async function applyEdits(edits: RowEdit[], rows: RoleRow[]): Promise<void> {
  const faces = new Map<string, NativeFontFace | undefined>();
  for (const edit of edits)
    if (edit.font !== rows.find((r) => r.style === edit.style)!.format.font) {
      const face = chooseDefaultFace(edit.font);
      if (face) await ensureFace(face);
      faces.set(edit.style.id, face);
    }
  commit(() => {
    const b = editor.book,
      notes: Record<string, { leading?: LeadingClass; operation?: string }> = {
        ...(b.editorialPautas || {}),
      };
    for (const edit of edits) {
      const p = edit.style.properties;
      if (faces.has(edit.style.id)) {
        for (const key of ['fontFaceId', 'fontStyleName', 'fontWeight', 'fontItalic', 'fontAxes'])
          delete p[key];
        p.font = edit.font;
        const face = faces.get(edit.style.id);
        if (face)
          Object.assign(p, {
            fontFaceId: face.id,
            fontStyleName: face.style,
            fontWeight: face.weight,
            fontItalic: face.italic,
            fontAxes: variations(face),
          });
      }
      Object.assign(p, { size: edit.size, leading: edit.leading, align: edit.align });
      if ((edit.style.columns ?? null) !== edit.columns) {
        if (edit.columns) edit.style.columns = edit.columns;
        else delete edit.style.columns;
        if (edit.columns)
          b.pages.forEach((page, index) =>
            page.objects.forEach((o) => {
              if (boxRoleStyle(o) === edit.style) fitBox(o, edit.columns!, index);
            }),
          );
      }
      const note = {
        ...(edit.leadingClass ? { leading: edit.leadingClass } : {}),
        ...(edit.operation ? { operation: edit.operation } : {}),
      };
      if (Object.keys(note).length) notes[edit.style.id] = note;
      else delete notes[edit.style.id];
    }
    b.editorialPautas = notes;
  }, true);
}

// ── Descargar ──

/** La pauta como documento HTML para imprimir (con la leyenda). */
function guideHtml(rows: RoleRow[]): string {
  const title = bw(
      'Pauta de uso tipográfico',
      'Typography usage guide',
      'Pauta de uso tipográfico',
    ),
    body = renderToStaticMarkup(
      <>
        <h1>{title}</h1>
        <p className="book">{editor.book.title}</p>
        <GuideTable rows={rows} editable={false} />
        <p className="legend">{GUIDE_LEGEND}</p>
      </>,
    );
  // Hoja para imprimir: tinta negra sobre papel, sin depender de la app.
  const css = `body{font:10pt/1.4 Georgia,serif;margin:12mm;color:#111}h1{font-size:16pt;margin:0}
.book{margin:0 0 6mm;color:#555}table{width:100%;border-collapse:collapse}
th,td{border:.2mm solid #999;padding:2mm;text-align:left;vertical-align:top}thead th{background:#eee}
small{display:block;color:#555}.guide-zones{display:flex;gap:2mm}figure{margin:0;text-align:center}
.guide-spread{width:28mm;height:auto;display:block}figcaption{font-size:7pt;color:#555}
.legend{margin-top:6mm;font-size:8pt;color:#333}@page{size:A4 landscape;margin:10mm}`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${title} · ${editor.book.title.replace(/[<&]/g, '')}</title><style>${css}</style></head><body>${body}</body></html>`;
}

/** La pauta como planilla CSV (una fila por rol, la leyenda al final). */
function guideCsv(rows: RoleRow[]): string {
  const cell = (value: unknown) => `"${String(value).replace(/"/g, '""')}"`,
    notes = notesOf(),
    lines = [
      headers()
        .slice(0, 7)
        .concat(bw('Excepciones', 'Exceptions', 'Exceções'))
        .map(cell)
        .join(';'),
      ...rows.map(({ style, format, writing, exceptions }) =>
        [
          roleName(style.role),
          `${format.font} ${points(format.size)} pt`,
          [...writing].map((key) => writingNames()[key]).join(' / ') || '—',
          alignName(format.align),
          columnsName(style.columns),
          `${leadingNames()[notes[style.id]?.leading || leadingClass(format.size, format.leading)]} · ${points(format.leading)} pt`,
          notes[style.id]?.operation || '',
          exceptions,
        ]
          .map(cell)
          .join(';'),
      ),
      [roleName('other'), otherElements().join(' · ')].map(cell).join(';'),
      '',
      cell(GUIDE_LEGEND),
    ];
  return '\uFEFF' + lines.join('\r\n');
}

// ── La Hoja ──

const GuideSheet = ({ rows, unassigned }: { rows: RoleRow[]; unassigned: EditorialRule[] }) => (
  <>
    <p className="builder-intro">
      {bw(
        'La pauta del libro, rol por rol. Lo que cambies acá cambia el rol en todo el libro al aplicar. Las excepciones son los textos que se apartan de su rol.',
        'The book guide, role by role. What you change here changes the role across the book when applied. Exceptions are texts that depart from their role.',
        'A pauta do livro, função por função. O que mudar aqui muda a função no livro todo ao aplicar. As exceções são os textos que se afastam da função.',
      )}
    </p>
    {rows.length ? (
      <div className="editorial-rules-table guide-table">
        <GuideTable rows={rows} editable />
      </div>
    ) : (
      <p className="help" data-guide-empty>
        {bw(
          'Todavía no hay textos con rol. Elegí una caja y dale un rol en Selección → Rol.',
          'No texts have a role yet. Select a frame and give it a role in Selection → Role.',
          'Ainda não há textos com função. Selecione uma caixa e dê uma função em Seleção → Função.',
        )}
      </p>
    )}
    {unassigned.length ? (
      <section className="guide-unassigned">
        <h3>{bw('Textos sin rol', 'Texts without a role', 'Textos sem função')}</h3>
        <ul>
          {unassigned.map(({ style, format, count }, i) => (
            <li key={i}>
              {`${style?.name || bw('Formato directo', 'Direct formatting', 'Formatação direta')} · ${format.font} ${points(format.size)}/${points(format.leading)} pt · ${count} ${bw('párr.', 'para.', 'parág.')}`}
            </li>
          ))}
        </ul>
      </section>
    ) : null}
    <p className="guide-legend">{GUIDE_LEGEND}</p>
    <div className="page-action">
      <button
        type="button"
        className="btn"
        id="guideDownloadHtml"
        title={bw(
          'Con los valores aplicados.',
          'With the applied values.',
          'Com os valores aplicados.',
        )}
        onClick={() =>
          download(
            new Blob([guideHtml(rows)], { type: 'text/html;charset=utf-8' }),
            editor.book.title + ' - pauta tipográfica.html',
          )
        }
      >
        {bw('Descargar para imprimir', 'Download to print', 'Baixar para imprimir')}
      </button>
      <button
        type="button"
        className="btn"
        id="guideDownloadCsv"
        title={bw(
          'Con los valores aplicados.',
          'With the applied values.',
          'Com os valores aplicados.',
        )}
        onClick={() =>
          download(
            new Blob([guideCsv(rows)], { type: 'text/csv;charset=utf-8' }),
            editor.book.title + ' - pauta tipográfica.csv',
          )
        }
      >
        {bw('Descargar planilla (CSV)', 'Download spreadsheet (CSV)', 'Baixar planilha (CSV)')}
      </button>
    </div>
  </>
);

function editorialRulesDialog(): void {
  if (!editor.hasDocument) return;
  finishEditing();
  const rows = collectRoleRows(),
    unassigned = collectEditorialRules().filter((rule) => !rule.style?.role);
  // Ventana de trabajo (no una Hoja): la tabla tiene nueve columnas y en una Hoja grande se
  // desplazaba de costado. "Aplicar" va en la barra del título; la cruz cierra sin aplicar.
  modal.workspace(
    bw('Pauta de uso tipográfico', 'Typography usage guide', 'Pauta de uso tipográfico'),
    <GuideSheet rows={rows} unassigned={unassigned} />,
    {
      variant: 'editorial-rules-dialog',
      action: {
        id: 'sheetApply',
        label: bw('Aplicar', 'Apply', 'Aplicar'),
        run: async () => {
          if (rows.length) await applyEdits(readEdits(rows), rows);
          return true;
        },
      },
    },
  );
}

// "Pauta tipográfica" (#editorialRules) es un botón de la vista Estructura
// (components/inspector/StructurePanel.tsx) y del panel Rol (RolePanel.tsx).

// Las usan las pruebas (tests/category-tests.js, tests/document-view-tests.js, tests/guide-tests.js).
declare global {
  var collectEditorialRules: () => EditorialRule[];
  var editorialRulesDialog: () => void;
}
globalThis.collectEditorialRules = collectEditorialRules;
globalThis.editorialRulesDialog = editorialRulesDialog;
