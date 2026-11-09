// Centro de Ayuda · Bibliografía (pedido de la cátedra de Tipografía I: bibliografía y tutoriales
// siempre a la vista, con "Aprender" en la barra superior). Libros de referencia de diseño editorial
// y tipografía en castellano; la cátedra puede mandar su propia lista para sumarla.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { useLanguage } from '../../react/mount.tsx';
import { bw } from '../../i18n/language.ts';
import { registerHelpSection } from './help-center.tsx';

/** Autoría, título, editorial y para qué sirve (en los tres idiomas). */
const BOOKS: [string, string, string, [string, string, string]][] = [
  [
    'Ellen Lupton',
    'Pensar con tipos',
    'Gustavo Gili',
    [
      'Letra, texto y retícula: la base para leer la planilla de pautas.',
      'Letter, text and grid: the basis for reading the type guidelines.',
      'Letra, texto e grid: a base para ler a planilha de pautas.',
    ],
  ],
  [
    'Robert Bringhurst',
    'Los elementos del estilo tipográfico',
    'Fondo de Cultura Económica',
    [
      'Ritmo, proporción, interlineado y medida de la línea.',
      'Rhythm, proportion, leading and line length.',
      'Ritmo, proporção, entrelinha e medida da linha.',
    ],
  ],
  [
    'Jost Hochuli y Robin Kinross',
    'El diseño de libros: práctica y teoría',
    'Campgràfic',
    [
      'Cómo se piensa un libro entero, de la portada al colofón.',
      'How to think a whole book, from title page to colophon.',
      'Como pensar um livro inteiro, da folha de rosto ao colofão.',
    ],
  ],
  [
    'Jan Tschichold',
    'La forma del libro',
    'Campgràfic',
    [
      'Proporciones de página y de márgenes en el libro clásico.',
      'Page and margin proportions in the classic book.',
      'Proporções de página e de margens no livro clássico.',
    ],
  ],
  [
    'Josef Müller-Brockmann',
    'Sistemas de retículas',
    'Gustavo Gili',
    [
      'Columnas, módulos y medianiles: la grilla como sistema.',
      'Columns, modules and gutters: the grid as a system.',
      'Colunas, módulos e medianizes: o grid como sistema.',
    ],
  ],
  [
    'Andrew Haslam',
    'Creación, diseño y producción de libros',
    'Blume',
    [
      'Partes del libro, encuadernación y producción.',
      'Book parts, binding and production.',
      'Partes do livro, encadernação e produção.',
    ],
  ],
  [
    'Jorge de Buen Unna',
    'Manual de diseño editorial',
    'Trea',
    [
      'Composición en castellano: cortes, viudas, huérfanas y notas.',
      'Typesetting in Spanish: breaks, widows, orphans and notes.',
      'Composição em espanhol: quebras, viúvas, órfãs e notas.',
    ],
  ],
];

const BibliographySection = () => {
  useLanguage();
  return (
    <>
      <h2 className="help-heading">{bw('Bibliografía', 'Bibliography', 'Bibliografia')}</h2>
      <p className="help-lead">
        {bw(
          'Libros para estudiar tipografía y diseño editorial mientras maquetás. Las ediciones en castellano son las de referencia.',
          'Books to study typography and editorial design while you lay out. The Spanish editions are listed.',
          'Livros para estudar tipografia e design editorial enquanto diagrama. Listadas as edições em espanhol.',
        )}
      </p>
      <ul className="help-bibliography">
        {BOOKS.map(([author, title, publisher, use]) => (
          <li key={title}>
            <span className="help-bibliography-title">{title}</span>
            <span className="help-bibliography-source">{`${author} · ${publisher}`}</span>
            <span className="help-bibliography-use">{bw(...use)}</span>
          </li>
        ))}
      </ul>
    </>
  );
};

registerHelpSection({
  id: 'bibliography',
  label: 'Bibliografía',
  order: 2.5,
  render: () => <BibliographySection />,
});
