// Contenido de la Hoja "Nueva entrada del índice" (editorial.ts, panel Índice: la abre con
// modal.sheet y lee #entryLabel y #entryPage al aplicar). La página de referencia arranca en la
// página activa.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { Control, Field, Select } from '../form/Form.tsx';
import { editor, M } from '../../core-api.ts';

const TocEntryForm = () => (
  <div className="modal-grid">
    <Field id="entryLabel" label="Texto de la entrada" type="text" defaultValue="" full />
    <Control label="Página de referencia" htmlFor="entryPage" full>
      <Select
        id="entryPage"
        defaultValue={editor.book.pages[editor.active]?.id}
        options={editor.book.pages.map((page, i) => ({
          value: page.id,
          label: `${i + 1} · ${M.sectionAt(editor.book, i)}`,
        }))}
      />
    </Control>
  </div>
);

/** Elemento de la Hoja (lo llama editorial.ts, que no es .tsx). */
export const tocEntryForm = () => <TocEntryForm />;
