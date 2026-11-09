// Conmutador Interior | Cubierta y solapas (pedido de la cátedra de Tipografía I): las dos piezas
// del libro, siempre a la vista. Va en la barra principal (Interior elegido: Cubierta abre la
// cubierta desplegada) y en la cabecera de la cubierta (Cubierta elegida: Interior la cierra, como la
// X; lo guardado queda guardado).
//
// La Cubierta conserva el id #coverTool (la usan el recorrido de la Ayuda, los espacios de trabajo y
// las pruebas).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { Icon } from '../Icon.tsx';
import { bookTitle } from '../../react/no-book.ts';
import { bw } from '../../i18n/language.ts';
import { editor } from '../../core-api.ts';
import { closeSheet } from '../dialog/dialogs.tsx';

export const PieceSwitch = ({ piece }: { piece: 'interior' | 'cover' }) => (
  <div
    className="piece-switch"
    role="group"
    aria-label={bw('Pieza del libro', 'Book piece', 'Peça do livro')}
  >
    <button
      type="button"
      id={piece === 'interior' ? 'interiorTool' : 'coverInteriorTool'}
      className={piece === 'interior' ? 'active' : undefined}
      aria-pressed={piece === 'interior'}
      title={bw('Las páginas del libro.', 'The book pages.', 'As páginas do livro.')}
      disabled={!editor.hasDocument}
      onClick={() => {
        if (piece === 'cover') closeSheet();
      }}
    >
      <Icon name="pages" />
      <span>{bw('Interior', 'Interior', 'Miolo')}</span>
    </button>
    <button
      type="button"
      id={piece === 'interior' ? 'coverTool' : 'coverPieceTool'}
      className={piece === 'cover' ? 'active' : undefined}
      aria-pressed={piece === 'cover'}
      title={bookTitle(
        bw(
          'Tapa, lomo, contratapa y solapas.',
          'Front, spine, back and flaps.',
          'Capa, lombada, contracapa e orelhas.',
        ),
      )}
      disabled={!editor.hasDocument}
      onClick={() => {
        if (piece === 'interior') coverEditor();
      }}
    >
      <Icon name="book" />
      <span>{bw('Cubierta y solapas', 'Cover and flaps', 'Capa e orelhas')}</span>
    </button>
  </div>
);
