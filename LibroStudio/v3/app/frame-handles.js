'use strict';
const frameDirections = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
function frameHandleLabel(direction) {
  const lang = globalThis.LibroI18n?.language || 'es';
  const names = {
    es: {
      nw: 'Esquina superior izquierda',
      n: 'Borde superior',
      ne: 'Esquina superior derecha',
      e: 'Borde derecho',
      se: 'Esquina inferior derecha',
      s: 'Borde inferior',
      sw: 'Esquina inferior izquierda',
      w: 'Borde izquierdo',
    },
    en: {
      nw: 'Top-left corner',
      n: 'Top edge',
      ne: 'Top-right corner',
      e: 'Right edge',
      se: 'Bottom-right corner',
      s: 'Bottom edge',
      sw: 'Bottom-left corner',
      w: 'Left edge',
    },
    pt: {
      nw: 'Canto superior esquerdo',
      n: 'Borda superior',
      ne: 'Canto superior direito',
      e: 'Borda direita',
      se: 'Canto inferior direito',
      s: 'Borda inferior',
      sw: 'Canto inferior esquerdo',
      w: 'Borda esquerda',
    },
  };
  return names[lang][direction];
}
function addFrameHandles(el, o, index) {
  el.querySelectorAll(':scope > .resize-handle').forEach((handle) => handle.remove());
  for (const direction of frameDirections) {
    const handle = document.createElement('span');
    handle.className = 'resize-handle frame-handle handle-' + direction;
    handle.dataset.handle = direction;
    handle.title = frameHandleLabel(direction);
    handle.setAttribute('aria-label', handle.title);
    handle.setAttribute('role', 'button');
    handle.addEventListener('pointerdown', (e) => objectDown(e, o, index, el, direction));
    el.append(handle);
  }
}
function frameGeometry(start, direction, dx, dy, bounds) {
  const min = Math.min(3, bounds.width, bounds.height);
  let left = start.x,
    right = start.x + start.w,
    top = start.y,
    bottom = start.y + start.h;
  if (direction.includes('w')) left = Math.max(0, Math.min(right - min, start.x + dx));
  if (direction.includes('e'))
    right = Math.min(bounds.width, Math.max(left + min, start.x + start.w + dx));
  if (direction.includes('n')) top = Math.max(0, Math.min(bottom - min, start.y + dy));
  if (direction.includes('s'))
    bottom = Math.min(bounds.height, Math.max(top + min, start.y + start.h + dy));
  return { x: left, y: top, w: right - left, h: bottom - top };
}
extend.result(
  'paper',
  function (page, index, px, print = false) {
    if (!print) {
      for (const o of book.pages[index].objects) {
        if (o.id !== selected) continue;
        const el = page.querySelector(`[data-id="${o.id}"]`);
        if (el) addFrameHandles(el, o, index);
      }
    }
    return page;
  },
  'frame-handles',
);
extend.replace(
  'objectDown',
  function (e, o, index, el, resize = false) {
    if (preview || busy || e.button !== 0) return;
    const direction = resize === true ? 'se' : resize;
    if (editing === el && !direction) return;
    e.stopPropagation();
    if (direction) e.preventDefault();
    finishEditing();
    active = index;
    selected = o.id;
    if (tool === 'image' && o.type === 'frame') {
      chooseImage({ frame: o, page: index });
      return;
    }
    tool = 'select';
    snapshot();
    drag = {
      o,
      el,
      startX: e.clientX,
      startY: e.clientY,
      x: o.x,
      y: o.y,
      w: o.w,
      h: o.h,
      resize: direction,
      moved: false,
    };
    el.setPointerCapture(e.pointerId);
    el.addEventListener('pointermove', moveObject);
    el.addEventListener('pointerup', upObject, { once: true });
    el.addEventListener('pointercancel', cancelFrameDrag, { once: true });
    $$('.paper-object.selected').forEach((n) => n.classList.remove('selected'));
    el.classList.add('selected');
    addFrameHandles(el, o, index);
    $$('.page').forEach((n) =>
      n.classList.toggle('active-page', Number(n.dataset.page) === active),
    );
    inspector();
    updateStatus();
    $$('.tool').forEach((n) => n.classList.toggle('active', n.dataset.tool === tool));
  },
  'frame-handles',
);
extend.replace(
  'moveObject',
  function (e) {
    if (!drag) return;
    const d = drag,
      o = d.o,
      dx = (e.clientX - d.startX) / scale,
      dy = (e.clientY - d.startY) / scale;
    d.moved = d.moved || Math.abs(dx) + Math.abs(dy) > 0.3;
    if (d.resize)
      Object.assign(
        o,
        frameGeometry(d, d.resize, dx, dy, { width: book.width, height: book.height }),
      );
    else {
      o.x = Math.max(0, Math.min(book.width - o.w, d.x + dx));
      o.y = Math.max(0, Math.min(book.height - o.h, d.y + dy));
    }
    Object.assign(d.el.style, {
      left: o.x * scale + 'px',
      top: o.y * scale + 'px',
      width: o.w * scale + 'px',
      height: o.h * scale + 'px',
    });
    updateStatus();
    checkOverflow();
  },
  'frame-handles',
);
function cancelFrameDrag(e) {
  if (!drag) return;
  const d = drag;
  Object.assign(d.o, { x: d.x, y: d.y, w: d.w, h: d.h });
  d.moved = false;
  upObject(e);
  render(false);
}
extend.before(
  'upObject',
  function () {
    if (drag) {
      drag.el.removeEventListener('pointercancel', cancelFrameDrag);
      drag.el.removeEventListener('pointerup', upObject);
    }
  },
  'frame-handles',
);
window.showHandlePreview = function () {
  active = spread = 0;
  selected = book.pages[0].objects.filter((o) => o.type === 'text').slice(-1)[0].id;
  showTab('text');
  render(true);
};
renderPages();
