'use strict';
const layoutWords = {
  es: {
    layers: 'Capas',
    snap: 'Imán',
    snapHint: 'Ajuste magnético a grilla, márgenes y guías. Alt lo suspende mientras arrastrás.',
    show: 'Mostrar / ocultar',
    lock: 'Bloquear / desbloquear',
    up: 'Subir',
    down: 'Bajar',
    rename: 'Nombre de la capa',
    hint: 'Las capas de arriba se dibujan delante. Arrastrá una fila para cambiar el orden. El ojo oculta y el candado bloquea.',
    empty: 'Esta página no tiene objetos.',
    width: 'Ancho',
    height: 'Alto',
  },
  en: {
    layers: 'Layers',
    snap: 'Snap',
    snapHint: 'Snap to grids, margins and guides. Hold Alt while dragging to bypass snapping.',
    show: 'Show / hide',
    lock: 'Lock / unlock',
    up: 'Move up',
    down: 'Move down',
    rename: 'Layer name',
    hint: 'Top layers are drawn in front. Drag a row to reorder. The eye hides and the lock prevents editing.',
    empty: 'This page has no objects.',
    width: 'Width',
    height: 'Height',
  },
  pt: {
    layers: 'Camadas',
    snap: 'Ímã',
    snapHint: 'Ajuste magnético à grade, margens e guias. Segure Alt ao arrastar para desativar.',
    show: 'Mostrar / ocultar',
    lock: 'Bloquear / desbloquear',
    up: 'Subir',
    down: 'Descer',
    rename: 'Nome da camada',
    hint: 'As camadas de cima ficam à frente. Arraste uma linha para reordenar. O olho oculta e o cadeado bloqueia.',
    empty: 'Esta página não tem objetos.',
    width: 'Largura',
    height: 'Altura',
  },
};
const lw = () => layoutWords[globalThis.LibroI18n?.language || 'es'];
function snapLines(b, index) {
  const m = M.margins(b, index),
    x = [0, b.width, m.left, b.width - m.right],
    y = [0, b.height, b.margins.top, b.height - b.margins.bottom];
  if (b.grid.enabled) {
    const r = M.gridRect(b, index),
      g = b.grid,
      w = (r.w - g.gapX * (g.cols - 1)) / g.cols,
      h = (r.h - g.gapY * (g.rows - 1)) / g.rows;
    for (let c = 0; c < g.cols; c++) x.push(r.x + c * (w + g.gapX), r.x + c * (w + g.gapX) + w);
    for (let a = 0; a < g.rows; a++) y.push(r.y + a * (h + g.gapY), r.y + a * (h + g.gapY) + h);
  }
  for (const guide of b.guides || []) (guide.axis === 'v' ? x : y).push(guide.position);
  return {
    x: [...new Set(x.map((v) => +v.toFixed(8)))],
    y: [...new Set(y.map((v) => +v.toFixed(8)))],
  };
}
function nearestSnap(value, lines, tolerance, valid = () => true) {
  let result = null;
  for (const line of lines) {
    let delta = line - value;
    if (
      Math.abs(delta) <= tolerance &&
      valid(line) &&
      (!result || Math.abs(delta) < Math.abs(result.delta))
    )
      result = { line, delta };
  }
  return result;
}
function snappedFrame(rect, direction, lines, tolerance, bounds) {
  const r = { ...rect },
    hits = [],
    min = 3;
  if (direction) {
    if (direction.includes('w')) {
      const fixed = r.x + r.w,
        s = nearestSnap(r.x, lines.x, tolerance, (line) => line >= 0 && fixed - line >= min);
      if (s) {
        r.x = s.line;
        r.w = fixed - s.line;
        hits.push({ axis: 'x', value: s.line });
      }
    }
    if (direction.includes('e')) {
      const s = nearestSnap(
        r.x + r.w,
        lines.x,
        tolerance,
        (line) => line - r.x >= min && line <= bounds.width,
      );
      if (s) {
        r.w = s.line - r.x;
        hits.push({ axis: 'x', value: s.line });
      }
    }
    if (direction.includes('n')) {
      const fixed = r.y + r.h,
        s = nearestSnap(r.y, lines.y, tolerance, (line) => line >= 0 && fixed - line >= min);
      if (s) {
        r.y = s.line;
        r.h = fixed - s.line;
        hits.push({ axis: 'y', value: s.line });
      }
    }
    if (direction.includes('s')) {
      const s = nearestSnap(
        r.y + r.h,
        lines.y,
        tolerance,
        (line) => line - r.y >= min && line <= bounds.height,
      );
      if (s) {
        r.h = s.line - r.y;
        hits.push({ axis: 'y', value: s.line });
      }
    }
  } else {
    for (const [axis, pos, size, limit] of [
      ['x', 'x', 'w', 'width'],
      ['y', 'y', 'h', 'height'],
    ]) {
      let a = nearestSnap(
          r[pos],
          lines[axis],
          tolerance,
          (line) => line >= 0 && line + r[size] <= bounds[limit],
        ),
        b = nearestSnap(
          r[pos] + r[size],
          lines[axis],
          tolerance,
          (line) => line - r[size] >= 0 && line <= bounds[limit],
        ),
        hit = !a ? b : !b ? a : Math.abs(a.delta) <= Math.abs(b.delta) ? a : b;
      if (hit) {
        r[pos] += hit.delta;
        hits.push({ axis, value: hit.line });
      }
    }
  }
  return { rect: r, hits };
}
function updateSnapButton() {
  const b = $('#snapButton');
  if (!b) return;
  b.classList.toggle('on', book.snap?.enabled !== false);
  b.title = lw().snapHint;
  b.innerHTML = '⌁ <span class="snap-label">' + lw().snap + '</span>';
  b.setAttribute('aria-pressed', book.snap?.enabled !== false);
}
const snapButton = document.createElement('button');
snapButton.id = 'snapButton';
snapButton.className = 'quiet';
snapButton.onclick = () => {
  finishEditing();
  commit(() => {
    book.snap = { enabled: book.snap?.enabled === false, tolerance: book.snap?.tolerance || 7 };
  }, false);
};
$('#documentSettings').before(snapButton);
updateSnapButton();
extend.after(
  'moveObject',
  function (e) {
    $$('.snap-indicator').forEach((n) => n.remove());
    if (!drag) return;
    const d = drag;
    if (book.snap?.enabled === false || e.altKey) return;
    const out = snappedFrame(
      d.o,
      d.resize,
      snapLines(book, active),
      (book.snap?.tolerance || 7) / scale,
      { width: book.width, height: book.height },
    );
    Object.assign(d.o, out.rect);
    Object.assign(d.el.style, {
      left: d.o.x * scale + 'px',
      top: d.o.y * scale + 'px',
      width: d.o.w * scale + 'px',
      height: d.o.h * scale + 'px',
    });
    const page = d.el.closest('.page');
    for (const hit of out.hits) {
      let line = document.createElement('div');
      line.className = 'snap-indicator ' + hit.axis;
      line.style[hit.axis === 'x' ? 'left' : 'top'] = hit.value * scale + 'px';
      page.append(line);
    }
    updateStatus();
  },
  'layout-tools',
);
extend.after(
  'upObject',
  function (e) {
    $$('.snap-indicator').forEach((n) => n.remove());
  },
  'layout-tools',
);
extend.instead(
  'objectDown',
  (e, o) => o.locked || o.hidden,
  () => {},
  'layout-tools',
);
extend.instead(
  'startEditing',
  () => selectObject()?.locked || selectObject()?.hidden,
  () => {},
  'layout-tools',
);
extend.instead(
  'command',
  (name) => ['deleteObject', 'front', 'back', 'editText'].includes(name) && selectObject()?.locked,
  () => {},
  'layout-tools',
);
extend.result(
  'paper',
  function (page, index, px, print = false) {
    for (const o of book.pages[index].objects) {
      const node = page.querySelector(`[data-id="${o.id}"]`);
      if (!node) continue;
      if (o.hidden) {
        node.remove();
        continue;
      }
      node.classList.toggle('locked', !!o.locked);
      if (o.locked) node.querySelectorAll('.frame-handle').forEach((n) => n.remove());
    }
    return page;
  },
  'layout-tools',
);
let layerDrag = null;
function layersPanel() {
  const w = lw(),
    host = $('#inspectorContent'),
    objects = book.pages[active].objects;
  host.innerHTML = section(
    w.layers + ' · ' + (active + 1),
    'pages',
    `<p class="help">${w.hint}</p><div id="layerList">${
      objects
        .slice()
        .reverse()
        .map(
          (o) =>
            `<div class="layer-row ${o.id === selected ? 'active' : ''} ${o.hidden ? 'is-hidden' : ''}" draggable="true" data-layer="${o.id}"><span class="layer-grip">⠿</span><span class="layer-type">${icon(o.type === 'text' ? 'text' : o.type === 'image' ? 'image' : 'frame')}</span><span class="layer-name user-content">${esc(o.name || o.text?.trim().split('\n')[0]?.slice(0, 36) || (o.type === 'frame' ? 'Marco' : 'Objeto'))}</span><button class="icon-btn" data-eye="${o.id}" title="${w.show}">${o.hidden ? '○' : '◉'}</button><button class="icon-btn" data-lock="${o.id}" title="${w.lock}">${o.locked ? '▣' : '□'}</button></div>`,
        )
        .join('') || `<p class="help">${w.empty}</p>`
    }</div>${selectObject() ? `<label class="field-label">${w.rename}</label><input id="layerName" class="field-full" maxlength="100" value="${esc(selectObject().name || '')}"><div class="page-action"><button id="layerUp" class="btn">↑ ${w.up}</button><button id="layerDown" class="btn">↓ ${w.down}</button></div><div class="pair"><div class="control"><label>${w.width} · mm</label><input id="layerWidth" type="number" min="3" max="${book.width}" step=".5" value="${selectObject().w.toFixed(1)}"></div><div class="control"><label>${w.height} · mm</label><input id="layerHeight" type="number" min="3" max="${book.height}" step=".5" value="${selectObject().h.toFixed(1)}"></div></div>` : ''}`,
  );
  host.querySelectorAll('[data-layer]').forEach((row) => {
    row.onclick = (e) => {
      if (e.target.closest('button')) return;
      finishEditing();
      tool = 'select';
      selected = row.dataset.layer;
      render(false);
    };
    row.ondragstart = (e) => {
      layerDrag = row.dataset.layer;
      e.dataTransfer.setData('text/plain', layerDrag);
    };
    row.ondragover = (e) => {
      e.preventDefault();
      row.classList.add('drop-target');
    };
    row.ondragleave = () => row.classList.remove('drop-target');
    row.ondrop = (e) => {
      e.preventDefault();
      const source = layerDrag,
        target = row.dataset.layer;
      if (source && source !== target) commit(() => reorderLayer(source, target), false);
      layerDrag = null;
    };
  });
  host.querySelectorAll('[data-eye]').forEach(
    (b) =>
      (b.onclick = () =>
        commit(() => {
          const o = objects.find((o) => o.id === b.dataset.eye);
          o.hidden = !o.hidden;
        }, false)),
  );
  host.querySelectorAll('[data-lock]').forEach(
    (b) =>
      (b.onclick = () =>
        commit(() => {
          const o = objects.find((o) => o.id === b.dataset.lock);
          o.locked = !o.locked;
        }, false)),
  );
  if ($('#layerName')) {
    $('#layerName').onchange = (e) => commit(() => (selectObject().name = e.target.value), false);
    $('#layerUp').onclick = () => moveLayer(1);
    $('#layerDown').onclick = () => moveLayer(-1);
    for (const [id, key, limit, pos] of [
      ['#layerWidth', 'w', 'width', 'x'],
      ['#layerHeight', 'h', 'height', 'y'],
    ])
      $(id).onchange = (e) => {
        const o = selectObject(),
          n = Number(e.target.value);
        if (o.locked || !Number.isFinite(n) || n < 3 || n > book[limit] - o[pos]) {
          inspector();
          return;
        }
        commit(() => (o[key] = n), false);
      };
  }
}
registerInspectorPanel('layers', layersPanel, 'layout-tools');
decorateInspector(() => updateSnapButton(), 'layout-tools');
function reorderLayer(source, target) {
  let list = book.pages[active].objects,
    from = list.findIndex((o) => o.id === source),
    to = list.findIndex((o) => o.id === target);
  if (from < 0 || to < 0 || list[from].locked) return;
  const item = list.splice(from, 1)[0];
  list.splice(to, 0, item);
  selected = source;
}
function moveLayer(direction) {
  const o = selectObject();
  if (!o || o.locked) return;
  const list = book.pages[active].objects,
    index = list.indexOf(o),
    next = index + direction;
  if (next < 0 || next >= list.length) return;
  commit(() => {
    [list[index], list[next]] = [list[next], list[index]];
  }, false);
}
const tabLayer = document.createElement('button');
tabLayer.className = 'tab';
tabLayer.dataset.tab = 'layers';
tabLayer.setAttribute('role', 'tab');
tabLayer.textContent = lw().layers;
tabLayer.onclick = () => showTab('layers');
$('.tabs').append(tabLayer);
const layerButton = document.createElement('button');
layerButton.id = 'layersTool';
layerButton.className = 'tool';
layerButton.innerHTML = icon('pages') + '<span>' + lw().layers + '</span>';
layerButton.onclick = () => {
  finishEditing();
  showTab('layers');
};
$('#tools').append(layerButton);
document.addEventListener('maquetario:language', () => {
  tabLayer.textContent = lw().layers;
  layerButton.querySelector('span').textContent = lw().layers;
  updateSnapButton();
});
updateSnapButton();
