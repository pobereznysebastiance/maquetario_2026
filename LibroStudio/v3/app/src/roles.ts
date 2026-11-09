// Roles de texto (pedido de la cátedra de Tipografía I): cada texto del libro tiene un rol con los
// nombres de la planilla "Pauta de uso tipográfico" (Título, Texto principal, Frases destacadas…).
// No tiene efectos al cargar: se importa. El panel está en components/inspector/RolePanel.tsx.
//
// Un rol no es un sistema aparte: es un estilo de párrafo con style.role (uno por rol en cada
// libro). Elegir un rol vincula los párrafos a ese estilo; si todavía no existe, se crea con el
// formato del párrafo, o el estilo que ya comparten los párrafos pasa a ser el del rol (así un libro
// armado con "Cuerpo de novela" no cambia).
//
// "¿Sólo acá o en todo el rol?": un cambio de formato sobre un texto con rol queda como ajuste local
// (como con cualquier estilo) y el panel lo muestra con dos salidas: aplicarlo a todo el rol o volver
// al rol. El ancho de caja en columnas de la grilla también es del rol (style.columns).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import type { BookObject, RoleId } from './model.ts';
import { bw } from './i18n/language.ts';
import { M, editor } from './core-api.ts';
import {
  asParagraphOperation,
  currentParagraph,
  paragraphBase,
  paragraphFormat,
  paragraphIndices,
  paragraphKeys,
  paragraphMeta,
  type ParagraphStyle,
} from './paragraph-format.ts';

/** Nombres de la planilla (castellano, inglés, portugués). */
const ROLE_NAMES: Record<RoleId, [string, string, string]> = {
  title: ['Título', 'Title', 'Título'],
  subtitle: ['Subtítulo', 'Subtitle', 'Subtítulo'],
  'subtitle-variant-a': [
    'Subtítulo · variable 1',
    'Subtitle · variant 1',
    'Subtítulo · variável 1',
  ],
  'subtitle-variant-b': [
    'Subtítulo · variable 2',
    'Subtitle · variant 2',
    'Subtítulo · variável 2',
  ],
  body: ['Texto principal', 'Main text', 'Texto principal'],
  'secondary-a': ['Texto secundario A', 'Secondary text A', 'Texto secundário A'],
  'secondary-b': ['Texto secundario B', 'Secondary text B', 'Texto secundário B'],
  'highlight-a': ['Frases destacadas A', 'Highlighted phrases A', 'Frases destacadas A'],
  'highlight-b': ['Frases destacadas B', 'Highlighted phrases B', 'Frases destacadas B'],
  'highlight-c': ['Frases destacadas C', 'Highlighted phrases C', 'Frases destacadas C'],
  'list-a': ['Listados A', 'Lists A', 'Listas A'],
  'list-b': ['Listados B', 'Lists B', 'Listas B'],
  'list-c': ['Listados C', 'Lists C', 'Listas C'],
  other: ['Otros', 'Other', 'Outros'],
};

/** Los roles, en el orden de la planilla (los define model.ts: M.roleIds). */
export const ROLE_IDS: readonly RoleId[] = M.roleIds;
/** Nombre del rol en el idioma de la interfaz. */
export const roleName = (role: RoleId): string => bw(...ROLE_NAMES[role]);

const styles = (): ParagraphStyle[] => editor.book.paragraphStyles || [];
/** El estilo de un rol en el libro, si ya existe. */
export const roleStyle = (role: RoleId): ParagraphStyle | undefined =>
  styles().find((s) => s.role === role);
/** El estilo vinculado a un párrafo. */
const styleOf = (o: BookObject, index: number): ParagraphStyle | undefined => {
  const id = o.paragraphMap?.[index]?.styleId;
  return id ? styles().find((s) => s.id === id) : undefined;
};

/** Rol de los párrafos elegidos: uno, ninguno ('') o mezclados ('mixed'). */
export function selectedRole(o: BookObject): RoleId | '' | 'mixed' {
  const roles = paragraphIndices(o).map((i) => styleOf(o, i)?.role ?? '');
  return roles.every((r) => r === roles[0]) ? roles[0]! : 'mixed';
}

/** El estilo del rol de toda la caja, si todos sus párrafos tienen el mismo rol. */
export function boxRoleStyle(o: BookObject): ParagraphStyle | undefined {
  // Sólo las cajas de texto tienen rol (imágenes y marcos no tienen texto: recorrer el libro entero
  // pasa por ellos).
  if (o.type !== 'text' || o.toc || typeof o.text !== 'string') return undefined;
  const lines = o.text.split('\n').length,
    first = styleOf(o, 0);
  if (!first?.role) return undefined;
  for (let i = 1; i < lines; i++) if (styleOf(o, i) !== first) return undefined;
  return first;
}

/** Un nombre de estilo libre (el del rol, o con "(rol)" si ya hay un estilo con ese nombre). */
function styleName(role: RoleId): string {
  const name = ROLE_NAMES[role][0],
    taken = (n: string) => styles().some((s) => s.name.toLocaleLowerCase() === n.toLowerCase());
  return taken(name) ? `${name} (rol)` : name;
}

/** Le da un rol a los párrafos elegidos de la caja ('': les saca el rol, conservando el formato). */
export function applyRole(role: RoleId | ''): void {
  const o = selectObject();
  if (!o || o.type !== 'text' || o.locked || o.toc) return;
  const indices = paragraphIndices(o);
  asParagraphOperation(() =>
    commit(() => {
      const b = editor.book;
      if (!role) {
        for (const i of indices)
          if (styleOf(o, i)?.role) {
            const meta = paragraphMeta(o, i);
            meta.overrides = paragraphFormat(b, o, i);
            meta.styleId = null;
          }
        return;
      }
      let style = roleStyle(role);
      if (!style) {
        const shared = styleOf(o, indices[0]!);
        if (shared && !shared.role && indices.every((i) => styleOf(o, i) === shared)) {
          // El estilo que ya comparten pasa a ser el del rol: el libro no cambia.
          shared.role = role;
          return;
        }
        style = {
          id: M.uid(),
          name: styleName(role),
          role,
          properties: M.clone(paragraphFormat(b, o, currentParagraph(o))),
        };
        if (!b.paragraphStyles) b.paragraphStyles = [];
        b.paragraphStyles.push(style);
      }
      for (const i of indices) {
        const meta = paragraphMeta(o, i);
        meta.styleId = style.id;
        meta.overrides = {};
      }
      if (style.columns && boxRoleStyle(o) === style) fitBox(o, style.columns);
    }, false),
  );
}

/** Lo que el texto elegido cambió respecto de su rol: el estilo y las propiedades. */
export function roleDeviation(o: BookObject): { style: ParagraphStyle; keys: string[] } | null {
  const indices = paragraphIndices(o),
    style = styleOf(o, indices[0]!);
  if (!style?.role || indices.some((i) => styleOf(o, i) !== style)) return null;
  const keys = new Set<string>(),
    roleFormat = { ...paragraphBase(o), ...style.properties };
  for (const i of indices) {
    const own = paragraphFormat(editor.book, o, i);
    for (const key of paragraphKeys)
      if (JSON.stringify(own[key]) !== JSON.stringify(roleFormat[key])) keys.add(key);
  }
  return keys.size ? { style, keys: [...keys] } : null;
}

/** Nombres de las propiedades que cambiaron, para mostrar (sin repetir). */
export function deviationLabels(keys: string[]): string[] {
  const label = (key: string): string => {
    if (key.startsWith('font')) return bw('tipografía', 'typeface', 'fonte');
    if (key === 'size') return bw('cuerpo', 'size', 'corpo');
    if (key === 'leading') return bw('interlineado', 'leading', 'entrelinha');
    if (key === 'align' || key === 'lastAlign') return bw('alineación', 'alignment', 'alinhamento');
    if (key.startsWith('hyphen')) return bw('separación silábica', 'hyphenation', 'hifenização');
    if (key === 'bold' || key === 'italic') return bw('estilo', 'style', 'estilo');
    if (key === 'color') return 'color';
    if (key === 'tracking') return 'tracking';
    if (key.startsWith('indent') || key === 'firstIndent')
      return bw('sangrías', 'indents', 'recuos');
    return bw('espacios', 'spacing', 'espaços');
  };
  return [...new Set(keys.map(label))];
}

/** "En todo el rol": lo que cambió el texto elegido pasa al rol y deja de ser un ajuste local. */
export function applyDeviationToRole(): void {
  const o = selectObject();
  if (!o || o.locked) return;
  const deviation = roleDeviation(o);
  if (!deviation) return;
  const own = paragraphFormat(editor.book, o, currentParagraph(o));
  asParagraphOperation(() =>
    commit(() => {
      for (const key of deviation.keys) {
        if (own[key] === undefined) delete deviation.style.properties[key];
        else deviation.style.properties[key] = M.clone(own[key]);
      }
      for (const i of paragraphIndices(o)) {
        const meta = paragraphMeta(o, i);
        for (const key of deviation.keys) delete meta.overrides[key];
      }
    }, false),
  );
}

/** "Sólo el rol": el texto elegido pierde sus ajustes locales y vuelve al formato del rol. */
export function backToRole(): void {
  const o = selectObject();
  if (!o || o.locked || !roleDeviation(o)) return;
  asParagraphOperation(() =>
    commit(() => {
      for (const i of paragraphIndices(o)) paragraphMeta(o, i).overrides = {};
    }, false),
  );
}

// ── Ancho de caja en columnas de la grilla ──

/** Columnas de la grilla en una página (la activa, si no se dice): inicio, ancho y medianil. */
function gridColumns(page = editor.active) {
  const area = M.gridRect(editor.book, page),
    { cols, gapX } = editor.book.grid;
  return { area, cols, gap: gapX, width: (area.w - gapX * (cols - 1)) / cols };
}

/** Cantidad de columnas de la grilla en la página. */
export const gridColumnCount = (): number => editor.book.grid.cols;

/** Cuántas columnas de la grilla ocupa la caja (redondeado). */
export function boxColumns(o: BookObject, page = editor.active): number {
  const c = gridColumns(page);
  return Math.max(1, Math.min(c.cols, Math.round((o.w + c.gap) / (c.width + c.gap))));
}

/** Lleva la caja a n columnas, desde la columna más cercana a donde empieza. */
export function fitBox(o: BookObject, n: number, page = editor.active): void {
  const c = gridColumns(page),
    span = Math.min(n, c.cols),
    step = c.width + c.gap,
    column = Math.max(0, Math.min(c.cols - span, Math.round((o.x - c.area.x) / step)));
  o.x = Math.round((c.area.x + column * step) * 100) / 100;
  o.w = Math.round((span * c.width + (span - 1) * c.gap) * 100) / 100;
}

/** Lleva todas las cajas del rol (las que son enteras de ese rol) a n columnas, en todo el libro. */
export function fitRoleBoxes(style: ParagraphStyle, n: number): void {
  editor.book.pages.forEach((page, index) =>
    page.objects.forEach((o) => {
      if (!o.locked && boxRoleStyle(o) === style) fitBox(o, n, index);
    }),
  );
}

/**
 * Ancho del rol en columnas (null: libre). Como el formato, es del rol: ajusta todas sus cajas en
 * todo el libro (pedido de la cátedra: "aplicar a todo el libro").
 */
export function setRoleColumns(columns: number | null): void {
  const o = selectObject(),
    style = o && boxRoleStyle(o);
  if (!o || !style || o.locked) return;
  commit(() => {
    if (columns) {
      style.columns = columns;
      fitRoleBoxes(style, columns);
    } else delete style.columns;
  }, false);
}

/** El ancho de esta caja pasa a ser el del rol, en todas sus cajas. */
export function useBoxWidthForRole(): void {
  const o = selectObject(),
    style = o && boxRoleStyle(o);
  if (!o || !style || o.locked) return;
  const columns = boxColumns(o);
  commit(() => {
    style.columns = columns;
    fitRoleBoxes(style, columns);
  }, false);
}

/** Ajusta la caja elegida al ancho de su rol. */
export function fitBoxToRole(): void {
  const o = selectObject(),
    style = o && boxRoleStyle(o);
  if (!o || !style?.columns || o.locked) return;
  commit(() => fitBox(o, style.columns!), false);
}

// ── Citas (pedido de la cátedra: "zonas de citas", en Otros de la pauta) ──

/**
 * El párrafo elegido (o toda la caja) pasa a ser una cita: el estilo "Cita", sangrado de los dos
 * lados y un punto más chico que el párrafo, que se crea la primera vez. Si el rol Otros está libre,
 * la Cita es su estilo (así entra en la fila Otros de la pauta).
 */
export function markAsQuote(): void {
  const o = selectObject();
  if (!o || o.type !== 'text' || o.locked || o.toc) return;
  finishEditing();
  asParagraphOperation(() =>
    commit(() => {
      const b = editor.book;
      if (!b.paragraphStyles) b.paragraphStyles = [];
      let style = styles().find((s) => s.id === 'quote');
      if (!style) {
        const base = paragraphFormat(b, o, currentParagraph(o)),
          round = (n: number) => Math.round(n * 10) / 10,
          taken = styles().some((s) => s.name.toLocaleLowerCase() === 'cita');
        style = {
          id: 'quote',
          name: bw('Cita', 'Quote', 'Citação') + (taken ? ' (Otros)' : ''),
          properties: {
            ...M.clone(base),
            size: round(Math.max(4, base.size - 1)),
            leading: round(Math.max(4, base.leading - 1)),
            indentLeft: 8,
            indentRight: 8,
            firstIndent: 0,
            spaceBefore: 2,
            spaceAfter: 2,
          },
        };
        if (!roleStyle('other')) style.role = 'other';
        b.paragraphStyles.push(style);
      }
      for (const i of paragraphIndices(o)) {
        const meta = paragraphMeta(o, i);
        meta.styleId = style.id;
        meta.overrides = {};
      }
    }, false),
  );
}
