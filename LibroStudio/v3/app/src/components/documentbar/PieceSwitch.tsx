// Conmutador Interior | Cubierta y solapas (pedido de la cátedra de Tipografía I), en la cabecera de
// la cubierta: Cubierta está elegida e Interior la cierra (como la X; lo guardado queda guardado).
// Para abrir la cubierta está su ícono en el riel izquierdo (#coverTool, components/rail/Rail.tsx).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { Icon } from '../Icon.tsx';
import { bw } from '../../i18n/language.ts';
import { closeSheet } from '../dialog/dialogs.tsx';

export const PieceSwitch = () => (
  <div
    className="piece-switch"
    role="group"
    aria-label={bw('Pieza del libro', 'Book piece', 'Peça do livro')}
  >
    <button
      type="button"
      id="coverInteriorTool"
      aria-pressed={false}
      title={bw('Las páginas del libro.', 'The book pages.', 'As páginas do livro.')}
      onClick={() => closeSheet()}
    >
      <Icon name="pages" />
      <span>{bw('Interior', 'Interior', 'Miolo')}</span>
    </button>
    <button
      type="button"
      id="coverPieceTool"
      className="active"
      aria-pressed
      title={bw(
        'Tapa, lomo, contratapa y solapas.',
        'Front, spine, back and flaps.',
        'Capa, lombada, contracapa e orelhas.',
      )}
    >
      <Icon name="book" />
      <span>{bw('Cubierta y solapas', 'Cover and flaps', 'Capa e orelhas')}</span>
    </button>
  </div>
);
