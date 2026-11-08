// Configuración: preferencias de la app, no del libro.
// Reúne lo que antes estaba suelto en la barra superior (idioma, tamaño de la interfaz)
// y lo que pertenece a la cuenta: sesión de Motiova, licencia, carpetas de fuentes, versión.
(function () {
  'use strict';

  const text = {
    title: ['Configuración', 'Settings', 'Configurações'],
    done: ['Listo', 'Done', 'Pronto'],
    account: ['Cuenta', 'Account', 'Conta'],
    noAccount: [
      'Conectá Maquetario con tu cuenta de Motiova. Se abre el navegador para entrar; la licencia queda en esta computadora, funciona 7 días sin conexión y se renueva sola cada vez que abrís Maquetario con internet.',
      'Connect Maquetario to your Motiova account. Your browser opens to sign in; the license stays on this computer, works 7 days offline and renews itself whenever you open Maquetario online.',
      'Conecte o Maquetario à sua conta Motiova. O navegador abre para entrar; a licença fica neste computador, funciona 7 dias sem conexão e se renova sozinha sempre que você abre o Maquetario com internet.',
    ],
    connect: ['Conectar con Motiova', 'Connect with Motiova', 'Conectar com o Motiova'],
    connecting: [
      'Seguí en el navegador: entrá a tu cuenta de Motiova y tocá Conectar.',
      'Continue in your browser: sign in to Motiova and click Connect.',
      'Continue no navegador: entre na sua conta Motiova e toque em Conectar.',
    ],
    cancel: ['Cancelar', 'Cancel', 'Cancelar'],
    connected: [
      'Maquetario quedó conectado con tu cuenta.',
      'Maquetario is now connected to your account.',
      'O Maquetario foi conectado à sua conta.',
    ],
    edition: ['Edición', 'Edition', 'Edição'],
    computers: ['Computadoras', 'Computers', 'Computadores'],
    computersOf: ['{n} de {max}', '{n} of {max}', '{n} de {max}'],
    expires: ['Funciona sin conexión hasta', 'Works offline until', 'Funciona sem conexão até'],
    invalid: [
      'La licencia de esta computadora no está vigente. Volvé a conectar para renovarla.',
      'This computer’s license is not active. Connect again to renew it.',
      'A licença deste computador não está ativa. Conecte de novo para renová-la.',
    ],
    signOut: [
      'Cerrar sesión en esta computadora',
      'Sign out on this computer',
      'Sair neste computador',
    ],
    signOutShort: ['Cerrar sesión', 'Sign out', 'Sair'],
    thisComputer: ['Esta computadora', 'This computer', 'Este computador'],
    signOutHelp: [
      'Libera esta computadora para usar Maquetario en otra.',
      'Frees this computer to use Maquetario on another one.',
      'Libera este computador para usar o Maquetario em outro.',
    ],
    signOutConfirm: [
      'Vas a liberar esta computadora. Para volver a usar Maquetario acá vas a tener que conectar tu cuenta otra vez.',
      'This computer will be freed. To use Maquetario here again you will need to connect your account.',
      'Este computador será liberado. Para usar o Maquetario aqui de novo, será preciso conectar sua conta.',
    ],
    signedOut: [
      'Cerraste la sesión en esta computadora.',
      'You signed out on this computer.',
      'Você saiu neste computador.',
    ],
    update: [
      'Hay una versión nueva: {v}',
      'A new version is available: {v}',
      'Há uma versão nova: {v}',
    ],
    download: ['Descargar', 'Download', 'Baixar'],
    downloading: ['Descargando…', 'Downloading…', 'Baixando…'],
    downloaded: [
      'Listo: el instalador de la versión {v} está en tu carpeta Descargas.',
      'Done: the installer for version {v} is in your Downloads folder.',
      'Pronto: o instalador da versão {v} está na sua pasta Downloads.',
    ],
    interfaceSection: ['Interfaz', 'Interface', 'Interface'],
    rulers: ['Reglas', 'Rulers', 'Réguas'],
    rulersHelp: [
      'Mostrar las reglas horizontal y vertical (Ctrl+R).',
      'Show horizontal and vertical rulers (Ctrl+R).',
      'Mostrar as réguas horizontal e vertical (Ctrl+R).',
    ],
    language: ['Idioma', 'Language', 'Idioma'],
    interface: ['Tamaño de la interfaz', 'Interface size', 'Tamanho da interface'],
    interfaceHelp: [
      'Cambia sólo menús y controles. La tipografía y las medidas del libro no cambian.',
      'Changes menus and controls only. Book typography and dimensions stay the same.',
      'Altera apenas menus e controles. A tipografia e as medidas do livro não mudam.',
    ],
    comfortable: ['Cómodo', 'Comfortable', 'Confortável'],
    large: ['Grande', 'Large', 'Grande'],
    fonts: ['Carpetas de fuentes', 'Font folders', 'Pastas de fontes'],
    fontsHelp: [
      'Además de las fuentes instaladas en el sistema.',
      'In addition to the fonts installed on your system.',
      'Além das fontes instaladas no sistema.',
    ],
    noFolders: ['Ninguna carpeta agregada.', 'No folders added.', 'Nenhuma pasta adicionada.'],
    addFolder: ['Agregar carpeta…', 'Add folder…', 'Adicionar pasta…'],
    desktopOnly: [
      'Disponible en la app de escritorio.',
      'Available in the desktop app.',
      'Disponível no app para desktop.',
    ],
    about: ['Acerca de', 'About', 'Sobre'],
    workspace: ['Espacio de trabajo', 'Workspace', 'Espaço de trabalho'],
    workspaceMode: ['Espacio activo', 'Active workspace', 'Espaço ativo'],
    workspaceHelp: [
      'Tocá cualquier casilla para armar tu espacio Personalizado. El libro no cambia.',
      'Tick any box to build your Custom workspace. The book does not change.',
      'Marque qualquer caixa para montar seu espaço Personalizado. O livro não muda.',
    ],
    tools: ['Herramientas', 'Tools', 'Ferramentas'],
    tabs: ['Pestañas del inspector', 'Inspector tabs', 'Abas do inspetor'],
    zones: ['Zonas', 'Areas', 'Áreas'],
    createdBy: ['Creado por', 'Created by', 'Criado por'],
  };
  const t = (key) => bw(...text[key]);

  /** Cambia el idioma por la API de i18n (LibroI18n.set), la misma que usa la bienvenida. */
  function setLanguage(value) {
    if (LibroI18n.language !== value) LibroI18n.set(value);
  }

  const row = (label, control, help) => UI.settingRow({ label, control, help });

  function section(title, body, id) {
    return `<section class="settings-section"${id ? ` id="settings-section-${id}"` : ''}><h3 class="settings-section-title">${title}</h3>${body}</section>`;
  }

  const fill = (key, values) =>
    Object.entries(values).reduce((s, [k, v]) => s.replace(`{${k}}`, v), t(key));
  const editionName = (value) =>
    value === 'estandar' ? bw('Estándar', 'Standard', 'Padrão') : value || '';

  /** Cuenta de Motiova: conectar, estado de la licencia de este equipo y versión nueva. */
  function accountBody(status) {
    if (!MaquetarioHost.available) return `<p class="settings-note">${t('desktopOnly')}</p>`;
    if (!status) return `<p class="settings-note">${t('noAccount')}</p>`;
    if (!status.connected) {
      return `<p class="settings-note">${t('noAccount')}</p><button type="button" class="btn primary" id="settingsConnect">${t('connect')}</button>`;
    }
    const lang = document.documentElement.lang || 'es';
    const until = status.validUntil
      ? new Date(status.validUntil).toLocaleDateString(lang, { day: 'numeric', month: 'long' })
      : '';
    const value = (v) => `<span class="settings-value">${esc(v)}</span>`;
    return (
      row(status.email || status.name || '', value(editionName(status.edition)), t('edition')) +
      (status.maxDevices
        ? row(
            t('computers'),
            value(fill('computersOf', { n: status.devicesInUse ?? 1, max: status.maxDevices })),
          )
        : '') +
      (status.licenseValid
        ? until
          ? row(t('expires'), value(until))
          : ''
        : `<p class="settings-note">${t('invalid')}</p>`) +
      (status.update
        ? row(
            fill('update', { v: status.update.version }),
            `<button type="button" class="btn" id="settingsDownloadUpdate">${t('download')}</button>`,
            status.update.notes || '',
          )
        : '') +
      row(
        t('thisComputer'),
        `<button type="button" class="btn" id="settingsSignOut">${t('signOutShort')}</button>`,
        t('signOutHelp'),
      )
    );
  }

  /** Botones de la sección Cuenta. Cada acción vuelve a armar el panel con el estado nuevo. */
  function wireAccount() {
    const connect = $('#settingsConnect');
    if (connect) {
      connect.onclick = async () => {
        const body = $('#settings-section-account');
        const title = body.querySelector('.settings-section-title').outerHTML;
        body.innerHTML = `${title}<p class="settings-note">${t('connecting')}</p><button type="button" class="btn" id="settingsCancelConnect">${t('cancel')}</button>`;
        $('#settingsCancelConnect').onclick = () => nativeCall('motiovaCancel');
        try {
          await nativeCall('motiovaConnect');
          toast(t('connected'));
        } catch (error) {
          if (!/cancel/i.test(error.message)) toast(error.message, 'error');
        }
        openSettings('account');
      };
    }
    const signOut = $('#settingsSignOut');
    if (signOut) {
      signOut.onclick = async () => {
        const ok = await confirmAction({
          title: t('signOut'),
          message: t('signOutConfirm'),
          confirmLabel: t('signOut'),
          danger: true,
        });
        if (!ok) return;
        signOut.disabled = true;
        try {
          await nativeCall('motiovaRelease');
          toast(t('signedOut'));
        } catch (error) {
          toast(error.message, 'error');
        }
        openSettings('account');
      };
    }
    const download = $('#settingsDownloadUpdate');
    if (download) {
      download.onclick = async () => {
        download.disabled = true;
        download.textContent = t('downloading');
        try {
          const result = await nativeCall('motiovaDownloadUpdate');
          toast(fill('downloaded', { v: result.version }));
        } catch (error) {
          toast(error.message, 'error');
        }
        download.disabled = false;
        download.textContent = t('download');
      };
    }
  }

  function foldersBody() {
    if (!MaquetarioHost.available) return `<p class="settings-note">${t('desktopOnly')}</p>`;
    const folders = Array.isArray(fontFolders) ? fontFolders : [];
    const list = folders.length
      ? `<ul class="settings-list">${folders.map((f) => `<li class="settings-list-item user-content" title="${esc(f)}">${esc(f)}</li>`).join('')}</ul>`
      : `<p class="settings-note">${t('noFolders')}</p>`;
    return `${list}<button type="button" class="btn" id="settingsAddFolder"><span data-icon="folder"></span>${t('addFolder')}</button>`;
  }

  function workspaceBody() {
    const ws = window.MaquetarioWorkspace;
    if (!ws) return '';
    const names = {
      simple: bw('Inicial', 'Starter', 'Inicial'),
      default: bw('Predeterminado', 'Default', 'Padrão'),
      custom: bw('Personalizado', 'Custom', 'Personalizado'),
    };
    const select = `<select id="settingsWorkspace">${Object.entries(names)
      .map(([id, n]) => `<option value="${id}">${esc(n)}</option>`)
      .join('')}</select>`;
    const groups = [
      ['tools', t('tools')],
      ['tabs', t('tabs')],
      ['zones', t('zones')],
    ];
    const items = ws.items();
    const lists = groups
      .map(
        ([group, title]) =>
          `<div class="settings-checklist"><h4 class="settings-checklist-title">${esc(title)}</h4>${items
            .filter((i) => i.group === group)
            .map((i) =>
              UI.checkItem({
                item: i.id,
                label: i.label,
                checked: ws.isVisible(i.id),
                disabled: i.locked,
              }),
            )
            .join('')}</div>`,
      )
      .join('');
    return (
      row(t('workspaceMode'), select) +
      `<p class="settings-help">${t('workspaceHelp')}</p><div class="settings-checklists">${lists}</div>`
    );
  }

  async function openSettings(focusSection) {
    // Volver a armar el panel (al cambiar idioma o carpetas) requiere cerrarlo antes: showModal falla si ya está abierto.
    if ($('#modal').open) $('#modal').close();
    let info = null;
    let account = null;
    if (MaquetarioHost.available) {
      [info, account] = await Promise.all([
        nativeCall('appInfo').catch(() => null),
        nativeCall('motiovaStatus').catch(() => null),
      ]);
    }
    const language = LibroI18n.language;
    const large = document.body.classList.contains('ui-large');
    const body =
      `<div class="settings">` +
      section(t('account'), accountBody(account), 'account') +
      section(
        t('interfaceSection'),
        row(
          t('language'),
          `<select id="settingsLanguage"><option value="es">Español</option><option value="en">English</option><option value="pt">Português</option></select>`,
        ) +
          row(
            t('interface'),
            `<select id="settingsInterfaceSize"><option value="standard">${t('comfortable')}</option><option value="large">${t('large')}</option></select>`,
            t('interfaceHelp'),
          ) +
          row(
            t('rulers'),
            UI.checkItem({
              id: 'settingsRulers',
              label: '',
              checked: MaquetarioRulers.isVisible(),
            }),
            t('rulersHelp'),
          ),
      ) +
      `<div id="settings-section-workspace">${section(t('workspace'), workspaceBody())}</div>` +
      section(t('fonts'), `<p class="settings-help">${t('fontsHelp')}</p>${foldersBody()}`) +
      section(
        t('about'),
        `<p class="settings-about">Maquetario ${esc((info && info.version) || '')}<br>${t('createdBy')} ${esc((info && info.creator) || 'Sebastián Poberezny')}</p>`,
      ) +
      `</div>`;

    modal(t('title'), body, () => true, t('done'), '');
    dialogVariant('settings-modal');
    icons();
    wireAccount();

    const languageSelect = $('#settingsLanguage');
    const workspaceSelect = $('#settingsWorkspace');
    if (workspaceSelect) {
      workspaceSelect.value = MaquetarioWorkspace.mode();
      workspaceSelect.onchange = () => {
        MaquetarioWorkspace.setMode(workspaceSelect.value);
        openSettings('workspace');
      };
      $$('#modalBody .check-item input[data-item]').forEach((box) => {
        box.onchange = () => {
          MaquetarioWorkspace.setVisible(box.dataset.item, box.checked);
          workspaceSelect.value = MaquetarioWorkspace.mode();
        };
      });
    }
    if (focusSection) $(`#settings-section-${focusSection}`)?.scrollIntoView({ block: 'start' });

    languageSelect.value = language;
    languageSelect.onchange = () => {
      setLanguage(languageSelect.value);
      // El panel se vuelve a armar en el idioma elegido.
      openSettings();
    };
    const rulersBox = $('#settingsRulers');
    if (rulersBox) rulersBox.onchange = () => MaquetarioRulers.setVisible(rulersBox.checked);
    const sizeSelect = $('#settingsInterfaceSize');
    sizeSelect.value = large ? 'large' : 'standard';
    sizeSelect.onchange = () => setReadability(sizeSelect.value);
    const addFolder = $('#settingsAddFolder');
    if (addFolder) {
      addFolder.onclick = async () => {
        addFolder.disabled = true;
        try {
          await obtainFonts('chooseFontFolder');
        } finally {
          openSettings();
        }
      };
    }
  }

  /** Lo llama el proceso principal al abrir, si Motiova tiene una versión más nueva. */
  window.maquetarioUpdateAvailable = (update) => {
    if (!update || !update.version) return;
    toast(
      fill('update', { v: update.version }) +
        ' · ' +
        bw(
          'Descargala desde Configuración → Cuenta.',
          'Download it from Settings → Account.',
          'Baixe em Configurações → Conta.',
        ),
      'info',
    );
  };

  window.openSettings = openSettings;
  window.setLanguage = setLanguage;
})();
