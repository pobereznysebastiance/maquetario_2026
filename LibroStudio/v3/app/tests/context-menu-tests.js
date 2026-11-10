// Pruebas de la BETA 0.2 (pedido del 10-nov): clic derecho y atajos de objetos (src/context-menu.tsx),
// flechitas de los campos numéricos (src/number-stepper.ts) y la Cubierta en el riel. Sólo se cargan
// en la autoprueba (test-loader.js).

registerNavigationTest(async function (result) {
  const check = (condition, message) => {
    if (!condition) throw Error(message);
    result.checks.push(message);
  };
  const ed = maquetarioEditor,
    previous = {
      book: ed.book,
      active: ed.active,
      spread: ed.spread,
      selected: ed.selected,
      undoStack: ed.undoStack,
    };
  const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
  const menuItems = () => [...document.querySelectorAll('.context-menu [role="menuitem"]')];
  const openMenu = async (target, x, y) => {
    target.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }),
    );
    for (let i = 0; i < 50 && !menuItems().length; i++) await tick(10);
    return menuItems().map((item) => item.textContent);
  };
  const choose = async (label) => {
    const item = menuItems().find((i) => i.textContent.startsWith(label));
    if (!item) throw Error('No está en el menú: ' + label);
    item.click();
    for (let i = 0; i < 50 && document.querySelector('.context-menu'); i++) await tick(10);
  };
  const clipboardEvent = (type, text) => {
    const data = new DataTransfer();
    if (text !== undefined) data.setData('text/plain', text);
    document.body.dispatchEvent(
      new ClipboardEvent(type, { clipboardData: data, bubbles: true, cancelable: true }),
    );
    return data.getData('text/plain');
  };
  try {
    hideWelcome();
    ed.book = M.create();
    ed.book.pages = Array.from({ length: 4 }, M.page);
    const box = M.text('Uno dos tres', 20, 30, 60, 30);
    ed.book.pages[0].objects.push(box);
    ed.active = ed.spread = 0;
    ed.selected = null;
    ed.multiSelection.clear();
    ed.undoStack = [];
    render(true);
    const objects = () => ed.book.pages[0].objects;

    // Cubierta y solapas, en el panel izquierdo.
    check(
      !!$('.leftpanel .rail-switch #coverTool') && !$('.topbar #coverTool'),
      'Cubierta y solapas es un ícono del panel izquierdo',
    );

    // Menú de un objeto (caja de texto).
    const el = $(`#spread [data-id="${box.id}"]`),
      rect = el.getBoundingClientRect();
    const labels = await openMenu(el, rect.left + 10, rect.top + 10);
    check(ed.selected === box.id, 'El clic derecho elige el objeto');
    check(
      [
        'Editar el texto',
        'Ajustar la caja al texto',
        'Rol',
        'Insertar nota al pie',
        'Marcar como cita',
      ].every((label) => labels.some((l) => l.startsWith(label))) &&
        [
          'Cortar',
          'Copiar',
          'Duplicar',
          'Eliminar',
          'Traer al frente',
          'Enviar al fondo',
          'Bloquear',
          'Ocultar',
          'Alinear',
        ].every((label) => labels.some((l) => l.startsWith(label))),
      'El menú de una caja de texto tiene las acciones de objeto y las de texto',
    );
    await choose('Duplicar');
    check(
      objects().length === 2 && objects()[1].x === box.x + 5 && objects()[1].id !== box.id,
      'Duplicar desde el menú agrega una copia corrida',
    );
    undo();
    check(objects().length === 1, 'Duplicar se deshace');

    // Atajos: copiar, pegar, duplicar y cortar.
    ed.selected = box.id;
    render(false);
    const mark = clipboardEvent('copy');
    check(mark.startsWith('maquetario-objetos:'), 'Copiar deja la marca en el portapapeles');
    clipboardEvent('paste', mark);
    check(objects().length === 2 && objects()[1].y === box.y + 5, 'Pegar agrega la copia corrida');
    clipboardEvent('paste', 'texto de otro programa');
    check(objects().length === 2, 'Pegar algo de afuera no pega los objetos copiados');
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'd',
        ctrlKey: !isMacForTests(),
        metaKey: isMacForTests(),
        bubbles: true,
        cancelable: true,
      }),
    );
    check(objects().length === 3, 'Ctrl+D duplica el objeto');
    clipboardEvent('cut');
    check(objects().length === 2, 'Cortar quita el objeto');
    undo();
    undo();
    undo();
    check(objects().length === 1, 'Pegar, duplicar y cortar se deshacen');

    // Menú de la página vacía.
    ed.selected = box.id;
    render(false);
    clipboardEvent('copy');
    // La página, después de redibujar (render cambia sus nodos).
    const page = $('#spread .page'),
      pageRect = page.getBoundingClientRect();
    const pageLabels = await openMenu(page, pageRect.right - 20, pageRect.bottom - 20);
    check(
      [
        'Pegar',
        'Pegar en el mismo lugar',
        'Agregar una página',
        'Duplicar la página',
        'Eliminar la página',
        'Agregar una guía',
        'Ocultar la grilla',
      ].every((label) => pageLabels.some((l) => l.startsWith(label))),
      'El menú de la página tiene pegar, páginas, guía y grilla',
    );
    await choose('Pegar en el mismo lugar');
    check(
      objects().length === 2 && objects()[1].x === box.x && objects()[1].y === box.y,
      'Pegar en el mismo lugar deja la copia donde estaba',
    );
    undo();

    // Menú de una miniatura: insertar antes y después.
    const ids = ed.book.pages.map((p) => p.id);
    await openMenu($('#thumbnails [data-individual-page="2"]'), 60, 300);
    await choose('Insertar una página antes');
    check(
      ed.book.pages.length === 5 && !ids.includes(ed.book.pages[2].id) && ed.active === 2,
      'Insertar una página antes de la 3 la deja en su lugar',
    );
    await openMenu($('#thumbnails [data-individual-page="0"]'), 60, 200);
    await choose('Insertar una página después');
    check(
      ed.book.pages.length === 6 && !ids.includes(ed.book.pages[1].id),
      'Insertar una página después de la 1',
    );

    // Flechitas: de a 0,1, con Mayúscula de a 1, y lo mantenido se deshace junto.
    showTab('design');
    render(false);
    const margin = () => $('[data-bind="margins.bottom"]'),
      start = ed.book.margins.bottom;
    margin().dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    const stepper = document.querySelector('.number-stepper');
    check(!!stepper?.matches(':popover-open'), 'Las flechitas aparecen al pasar por el campo');
    const depth = ed.undoStack.length;
    stepper.querySelector('[data-direction="1"]').dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        button: 0,
        pointerId: 1,
      }),
    );
    stepper.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
    check(
      Math.abs(ed.book.margins.bottom - (start + 0.1)) < 1e-9,
      'Un clic en la flechita sube 0,1',
    );
    margin().dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    for (let i = 0; i < 3; i++)
      margin().dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowUp',
          repeat: i > 0,
          bubbles: true,
          cancelable: true,
        }),
      );
    margin().dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp', bubbles: true }));
    check(
      Math.abs(ed.book.margins.bottom - (start + 1.4)) < 1e-9,
      'Con Mayúscula sube de a 1 y las flechas del teclado de a 0,1',
    );
    check(ed.undoStack.length === depth + 3, 'La flecha mantenida se deshace de una sola vez');
    undo();
    check(
      Math.abs(ed.book.margins.bottom - (start + 1.1)) < 1e-9,
      'Deshacer vuelve atrás lo que subió mientras estaba apretada',
    );
  } finally {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    Object.assign(ed, previous);
    ed.multiSelection.clear();
    render(true);
  }
  return result;
}, 'context-menu-tests');

/** La autoprueba corre en Windows, macOS o Linux: el atajo usa ⌘ en macOS. */
function isMacForTests() {
  return /^Mac/i.test(navigator.platform);
}
