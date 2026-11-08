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
      'Todavía no hay una cuenta conectada. Cuando abras Maquetario desde Motiova vas a ver acá tu cuenta y tu licencia.',
      'No account connected yet. When you open Maquetario from Motiova, your account and license will appear here.',
      'Ainda não há conta conectada. Ao abrir o Maquetario pelo Motiova, sua conta e licença aparecerão aqui.',
    ],
    edition: ['Edición', 'Edition', 'Edição'],
    expires: ['Licencia válida hasta', 'License valid until', 'Licença válida até'],
    invalid: ['La licencia no es válida en este equipo.', 'The license is not valid on this computer.', 'A licença não é válida neste computador.'],
    interfaceSection: ['Interfaz', 'Interface', 'Interface'],
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
    desktopOnly: ['Disponible en la app de escritorio.', 'Available in the desktop app.', 'Disponível no app para desktop.'],
    about: ['Acerca de', 'About', 'Sobre'],
    createdBy: ['Creado por', 'Created by', 'Criado por'],
  };
  const t = (key) => bw(...text[key]);

  /** Cambia el idioma por la API de i18n (LibroI18n.set), la misma que usa la bienvenida. */
  function setLanguage(value) {
    if (LibroI18n.language !== value) LibroI18n.set(value);
  }

  const row = (label, control, help) => UI.settingRow({ label, control, help });

  function section(title, body) {
    return `<section class="settings-section"><h3 class="settings-section-title">${title}</h3>${body}</section>`;
  }

  function accountBody(info) {
    const license = info && info.license;
    if (!license || !license.valid) {
      return `<p class="settings-note">${license && !license.valid ? t('invalid') : t('noAccount')}</p>`;
    }
    const expires = license.expires ? new Date(license.expires).toLocaleDateString(document.documentElement.lang || 'es') : '';
    return (
      row(license.email || '', `<span class="settings-value">${esc(license.edition || '')}</span>`, t('edition')) +
      (expires ? row(t('expires'), `<span class="settings-value">${esc(expires)}</span>`) : '')
    );
  }

  function foldersBody() {
    if (!MaquetarioHost.available) return `<p class="settings-note">${t('desktopOnly')}</p>`;
    const folders = Array.isArray(window.fontFolders) ? window.fontFolders : typeof fontFolders !== 'undefined' ? fontFolders : [];
    const list = folders.length
      ? `<ul class="settings-list">${folders.map((f) => `<li class="settings-list-item user-content" title="${esc(f)}">${esc(f)}</li>`).join('')}</ul>`
      : `<p class="settings-note">${t('noFolders')}</p>`;
    return `${list}<button type="button" class="btn" id="settingsAddFolder"><span data-icon="folder"></span>${t('addFolder')}</button>`;
  }

  async function openSettings() {
    // Volver a armar el panel (al cambiar idioma o carpetas) requiere cerrarlo antes: showModal falla si ya está abierto.
    if ($('#modal').open) $('#modal').close();
    let info = null;
    if (MaquetarioHost.available) {
      try {
        info = await nativeCall('appInfo');
      } catch {
        info = null;
      }
    }
    const language = LibroI18n.language;
    const large = document.body.classList.contains('ui-large');
    const body =
      `<div class="settings">` +
      section(t('account'), accountBody(info)) +
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
          ),
      ) +
      section(t('fonts'), `<p class="settings-help">${t('fontsHelp')}</p>${foldersBody()}`) +
      section(
        t('about'),
        `<p class="settings-about">Maquetario ${esc((info && info.version) || '')}<br>${t('createdBy')} ${esc((info && info.creator) || 'Sebastián Poberezny')}</p>`,
      ) +
      `</div>`;

    modal(t('title'), body, () => true, t('done'), '');
    $('#modal').classList.add('settings-modal');
    $('#modal').addEventListener('close', () => $('#modal').classList.remove('settings-modal'), { once: true });
    icons();

    const languageSelect = $('#settingsLanguage');
    languageSelect.value = language;
    languageSelect.onchange = () => {
      setLanguage(languageSelect.value);
      // El panel se vuelve a armar en el idioma elegido.
      openSettings();
    };
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

  window.openSettings = openSettings;
  window.setLanguage = setLanguage;
})();
