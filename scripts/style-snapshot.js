// Foto de estilos calculados de la interfaz, para comparar antes y después de mover CSS.
//
// Uso (en la consola de la interfaz servida con scripts/serve-ui.cjs):
//   await styleSnapshot('antes')   → guarda en localStorage una foto por estado
//   (cambiar el CSS, recargar, volver a cargar este archivo)
//   await styleSnapshot('despues'); styleDiff('antes', 'despues')  → lista de [estado, elemento, propiedad, antes, después]
//
// Los estados recorren la bienvenida, el editor con sus pestañas, la selección, el tutorial, diálogos y
// paneles plegados. Lo que dibuja el libro (#spread, #printRoot, miniaturas) queda afuera: no lo toca la interfaz.
(() => {
  const PROPS = [
    'display',
    'position',
    'top',
    'right',
    'bottom',
    'left',
    'width',
    'height',
    'min-height',
    'max-width',
    'margin-top',
    'margin-right',
    'margin-bottom',
    'margin-left',
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',
    'gap',
    'flex-grow',
    'flex-shrink',
    'flex-basis',
    'flex-direction',
    'flex-wrap',
    'align-items',
    'justify-content',
    'grid-template-columns',
    'font-size',
    'font-weight',
    'line-height',
    'letter-spacing',
    'white-space',
    'text-align',
    'color',
    'background-color',
    'background-image',
    'border-top-width',
    'border-top-color',
    'border-bottom-width',
    'border-bottom-color',
    'border-left-width',
    'border-left-color',
    'border-top-left-radius',
    'box-shadow',
    'opacity',
    'visibility',
    'overflow-x',
    'overflow-y',
    'z-index',
    'cursor',
    'outline-color',
    'outline-style',
  ];
  const SKIP =
    '#spread, #spread *, #printRoot, #printRoot *, .thumb-pages, .thumb-pages *, script, style, svg *';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const close = () => {
    try {
      $('#modal')?.open && $('#modal').close();
    } catch {}
    try {
      $('#fontBrowser')?.open && $('#fontBrowser').close();
    } catch {}
    try {
      closeTutorial();
    } catch {}
    if (document.body.classList.contains('focused')) $('#fullscreen')?.click();
    if (document.body.classList.contains('ui-large'))
      try {
        setReadability('standard');
      } catch {}
  };
  const sel = (type) => {
    const o = book.pages.flatMap((p) => p.objects).find((o) => o.type === type);
    active = book.pages.findIndex((p) => p.objects.includes(o));
    selected = o.id;
    render(true);
  };
  const STATES = [
    [
      'bienvenida',
      () => {
        close();
        showWelcome();
      },
    ],
    [
      'editor',
      async () => {
        close();
        try {
          installNovel(LibroModel.create());
        } catch {}
        hideWelcome();
        hasDocument = true;
        selected = null;
        render(true);
      },
    ],
    ['estructura', () => showTab('structure')],
    ['diseño', () => showTab('design')],
    [
      'texto',
      () => {
        sel('text');
        showTab('text');
      },
    ],
    ['objeto', () => showTab('object')],
    ['capas', () => showTab('layers')],
    ['páginas', () => showTab('pages')],
    [
      'plegado',
      () => {
        document.body.classList.add('templates-collapsed');
      },
    ],
    [
      'desplegado',
      () => {
        document.body.classList.remove('templates-collapsed');
      },
    ],
    // Abiertos con sus propios botones (la app los arranca plegados: sin estos estados no se ve su CSS).
    [
      'plantillas abiertas',
      () => {
        for (let i = 0; i < 2 && document.body.classList.contains('templates-collapsed'); i++)
          $('#toggleGridStrip')?.click();
      },
    ],
    [
      'configuración',
      () => {
        close();
        settingsNew(false);
      },
    ],
    [
      'salida',
      () => {
        close();
        outputDialog('pdf');
      },
    ],
    [
      'cubierta',
      () => {
        close();
        coverEditor();
      },
    ],
    [
      'tutorial',
      () => {
        close();
        startTutorial(0);
      },
    ],
    // Diálogos y modos que se dibujan aparte (sin ellos, lo migrado de sus hojas no se compara).
    [
      'glosario',
      async () => {
        close();
        showGlossary();
        await wait(400);
      },
    ],
    [
      'ayuda: recorrido del libro',
      () => {
        close();
        openHelp('route');
      },
    ],
    [
      'cerrar sin guardar',
      () => {
        close();
        prepareCloseNoticePreview();
      },
    ],
    [
      'foco',
      () => {
        close();
        $('#fullscreen')?.click();
      },
    ],
    [
      'interfaz grande',
      () => {
        close();
        setReadability('large');
      },
    ],
    [
      'asistente',
      () => {
        close();
        openEditorialAssistant();
      },
    ],
    [
      'buscador de fuentes',
      async () => {
        close();
        sel('text');
        showTab('text');
        await wait(200);
        const s = $(
          '#inspectorContent select[data-object="font"], #inspectorContent select.font-native-hidden',
        );
        if (s) openFontBrowser(s);
        await wait(500);
      },
    ],
    [
      'glifos',
      async () => {
        close();
        sel('text');
        showFontGlyphs();
        await wait(500);
      },
    ],
    [
      'reglas internas',
      () => {
        close();
        editorialRulesDialog();
      },
    ],
    [
      'galería de grillas',
      () => {
        close();
        gridGallery();
      },
    ],
    [
      'atajos',
      () => {
        close();
        [...document.querySelectorAll('button')]
          .find((b) => /Atajos de navegación/.test(b.title))
          ?.click();
      },
    ],
    // Se abre desde la cubierta: necesita una (el libro de ejemplo no trae).
    [
      'ficha de medidas',
      () => {
        close();
        book.cover = book.cover || defaultCover();
        coverSheetDialog('pdf');
      },
    ],
    // Recientes con proyectos (la lista real depende del equipo): se dibuja con la misma plantilla.
    [
      'recientes',
      () => {
        close();
        showWelcome();
        const list = $('#recentProjects');
        if (list)
          list.innerHTML = ['El atlas de las casas vacías', 'Borrador sin título']
            .map(
              (name, i) =>
                `<button class="recent-project ${i ? 'missing' : ''}"><span class="recent-cover">${icon('pages')}</span><span class="recent-details user-content"><strong>${name}</strong><small>C:\\Libros\\${i ? 'borrador' : 'atlas'}.mqt</small></span><span class="recent-date">${i ? 'No encontrado' : '8/11/2026'}</span><span class="recent-arrow">↗</span></button>`,
            )
            .join('');
      },
    ],
    // Último: reemplaza el libro por uno en blanco.
    [
      'sin documento',
      () => {
        close();
        hideWelcome();
        activateBlankDocument();
      },
    ],
  ];
  // Ruta estable de un elemento: id o etiqueta.clases con su posición entre hermanos.
  const key = (el) => {
    const parts = [];
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      if (e.id) {
        parts.unshift('#' + e.id);
        break;
      }
      const i = [...(e.parentElement?.children || [])].indexOf(e);
      parts.unshift(
        e.tagName.toLowerCase() +
          (e.classList.length ? '.' + [...e.classList].sort().join('.') : '') +
          ':' +
          i,
      );
    }
    return parts.join('>');
  };
  window.styleSnapshot = async (name) => {
    const shot = {};
    for (const [label, fn] of STATES) {
      await fn();
      await wait(250);
      const rows = {};
      for (const el of document.body.querySelectorAll('*')) {
        if (el.matches(SKIP)) continue;
        const cs = getComputedStyle(el);
        rows[key(el)] = PROPS.map((p) => cs.getPropertyValue(p)).join('|');
      }
      shot[label] = rows;
    }
    close();
    localStorage.setItem('styleSnapshot:' + name, JSON.stringify(shot));
    return Object.fromEntries(Object.entries(shot).map(([k, v]) => [k, Object.keys(v).length]));
  };
  window.styleDiff = (a, b, limit = 400) => {
    const A = JSON.parse(localStorage.getItem('styleSnapshot:' + a)),
      B = JSON.parse(localStorage.getItem('styleSnapshot:' + b)),
      out = [];
    for (const state of Object.keys(A))
      for (const [el, va] of Object.entries(A[state])) {
        const vb = B[state]?.[el];
        if (vb === undefined || vb === va) continue;
        const pa = va.split('|'),
          pb = vb.split('|');
        PROPS.forEach((p, i) => {
          if (pa[i] !== pb[i]) out.push([state, el, p, pa[i], pb[i]]);
        });
      }
    return out.slice(0, limit);
  };
  return 'styleSnapshot listo';
})();
