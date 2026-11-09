// Configuración: preferencias de la app, no del libro. Una Hoja grande en React (openSheet) que
// sólo informa (un botón "Listo"): cuenta de Motiova, interfaz (idioma, tamaño, reglas), espacio
// de trabajo, carpetas de fuentes y versión.
//
// openSettings es global: la usan workspace.ts y la autoprueba
// (desktop/src/main/selftest.ts, que busca #settingsLanguage). maquetarioUpdateAvailable la llama
// el proceso principal (desktop/src/main/main.ts).
// Mismos ids que la versión en HTML: #settings-section-account, #settingsConnect,
// #settingsSignOut, #settingsDownloadUpdate, #settingsLanguage, #settingsInterfaceSize,
// #settingsRulers, #settings-section-workspace, #settingsWorkspace (y las casillas con
// data-item) y #settingsAddFolder. Cambiar de idioma, de espacio activo, de cuenta o de carpetas
// vuelve a abrir la Hoja con el estado nuevo, como antes.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { useLayoutEffect, useState, type ReactNode } from 'react';
import type { Language } from '../../i18n.ts';
import type { WorkspaceMode } from '../../workspace.ts';
import { useLanguage } from '../../react/mount.tsx';
import { Icon } from '../Icon.tsx';
import { CheckItem, Select, SettingRow } from '../form/Form.tsx';
import { bw, i18n } from '../../i18n/language.ts';
import { confirmAction, openSheet } from '../dialog/dialogs.tsx';
import { fontFolders, obtainFonts } from '../../font-catalog.ts';

/** Versión nueva del programa en Motiova (mismo formato que desktop/src/main/motiova/desktop.ts). */
interface UpdateInfo {
  version: string;
  notes: string;
}

/** Estado de la cuenta que devuelve nativeCall('motiovaStatus') (desktop/src/main/motiova/desktop.ts). */
interface AccountStatus {
  connected: boolean;
  email?: string;
  name?: string;
  edition?: string;
  devicesInUse?: number;
  maxDevices?: number;
  /** Hasta cuándo funciona sin conexión (ISO). */
  validUntil?: string;
  licenseValid: boolean;
  update: UpdateInfo | null;
}

/** Lo que devuelve nativeCall('appInfo') y usa la sección Acerca de. */
interface AppInfo {
  version?: string;
  creator?: string;
}

declare global {
  /** Abre Configuración; focusSection lleva a una sección ('account', 'workspace'…). */
  var openSettings: (focusSection?: string) => Promise<void>;
  /** Aviso de versión nueva; lo llama el proceso principal al abrir. */
  var maquetarioUpdateAvailable: (update: { version?: string } | null | undefined) => void;
}

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
    'Seguí en el navegador: entrá a tu cuenta de Motiova y hacé clic en Conectar.',
    'Continue in your browser: sign in to Motiova and click Connect.',
    'Continue no navegador: entre na sua conta Motiova e clique em Conectar.',
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
    'Marcá cualquier casilla para armar tu espacio Personalizado. El libro no cambia.',
    'Tick any box to build your Custom workspace. The book does not change.',
    'Marque qualquer caixa para montar seu espaço Personalizado. O livro não muda.',
  ],
  tools: ['Herramientas', 'Tools', 'Ferramentas'],
  tabs: ['Pestañas del inspector', 'Inspector tabs', 'Abas do inspetor'],
  zones: ['Zonas', 'Areas', 'Áreas'],
  createdBy: ['Creado por', 'Created by', 'Criado por'],
} satisfies Record<string, [string, string, string]>;
type TextKey = keyof typeof text;
const t = (key: TextKey): string => bw(...text[key]);

/** Cambia el idioma por la API de i18n (LibroI18n.set), la misma que usa la bienvenida. */
function setLanguage(value: Language): void {
  if (i18n.language !== value) LibroI18n.set(value);
}

/** Sección de la Hoja: título y filas. */
const Section = ({ title, id, children }: { title: string; id?: string; children: ReactNode }) => (
  <section className="settings-section" id={id ? `settings-section-${id}` : undefined}>
    <h3 className="settings-section-title">{title}</h3>
    {children}
  </section>
);

// Los valores vienen del proceso principal (sin validar): texto o número.
const fill = (key: TextKey, values: Record<string, any>): string =>
  Object.entries(values).reduce((s, [k, v]) => s.replace(`{${k}}`, v), t(key));
const editionName = (value: string | undefined): string =>
  value === 'estandar' ? bw('Estándar', 'Standard', 'Padrão') : value || '';
const Value = ({ children }: { children: string }) => (
  <span className="settings-value">{children}</span>
);

/** Cuenta de Motiova: conectar, estado de la licencia de este equipo y versión nueva. */
const Account = ({ status }: { status: AccountStatus | null }) => {
  const [connecting, setConnecting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [downloading, setDownloading] = useState(false);
  if (!MaquetarioHost.available) return <p className="settings-note">{t('desktopOnly')}</p>;
  if (!status) return <p className="settings-note">{t('noAccount')}</p>;
  if (connecting)
    return (
      <>
        <p className="settings-note">{t('connecting')}</p>
        <button
          type="button"
          className="btn"
          id="settingsCancelConnect"
          onClick={() => nativeCall('motiovaCancel')}
        >
          {t('cancel')}
        </button>
      </>
    );
  if (!status.connected) {
    const connect = async () => {
      setConnecting(true);
      try {
        await nativeCall('motiovaConnect');
        toast(t('connected'));
      } catch (error) {
        if (!/cancel/i.test((error as Error).message)) toast((error as Error).message, 'error');
      }
      openSettings('account');
    };
    return (
      <>
        <p className="settings-note">{t('noAccount')}</p>
        <button type="button" className="btn primary" id="settingsConnect" onClick={connect}>
          {t('connect')}
        </button>
      </>
    );
  }
  const lang = document.documentElement.lang || 'es';
  const until = status.validUntil
    ? new Date(status.validUntil).toLocaleDateString(lang, { day: 'numeric', month: 'long' })
    : '';
  const signOut = async () => {
    const ok = await confirmAction({
      title: t('signOut'),
      message: t('signOutConfirm'),
      confirmLabel: t('signOut'),
      danger: true,
    });
    if (!ok) return;
    setSigningOut(true);
    try {
      await nativeCall('motiovaRelease');
      toast(t('signedOut'));
    } catch (error) {
      toast((error as Error).message, 'error');
    }
    openSettings('account');
  };
  const download = async () => {
    setDownloading(true);
    try {
      const result: { path: string; version: string } = await nativeCall('motiovaDownloadUpdate');
      toast(fill('downloaded', { v: result.version }));
    } catch (error) {
      toast((error as Error).message, 'error');
    }
    setDownloading(false);
  };
  return (
    <>
      <SettingRow label={status.email || status.name || ''} help={t('edition')}>
        <Value>{editionName(status.edition)}</Value>
      </SettingRow>
      {status.maxDevices ? (
        <SettingRow label={t('computers')}>
          <Value>
            {fill('computersOf', { n: status.devicesInUse ?? 1, max: status.maxDevices })}
          </Value>
        </SettingRow>
      ) : null}
      {status.licenseValid ? (
        until ? (
          <SettingRow label={t('expires')}>
            <Value>{until}</Value>
          </SettingRow>
        ) : null
      ) : (
        <p className="settings-note">{t('invalid')}</p>
      )}
      {status.update ? (
        <SettingRow label={fill('update', { v: status.update.version })} help={status.update.notes}>
          <button
            type="button"
            className="btn"
            id="settingsDownloadUpdate"
            disabled={downloading}
            onClick={download}
          >
            {downloading ? t('downloading') : t('download')}
          </button>
        </SettingRow>
      ) : null}
      <SettingRow label={t('thisComputer')} help={t('signOutHelp')}>
        <button
          type="button"
          className="btn"
          id="settingsSignOut"
          disabled={signingOut}
          onClick={signOut}
        >
          {t('signOutShort')}
        </button>
      </SettingRow>
    </>
  );
};

const Folders = () => {
  const [adding, setAdding] = useState(false);
  if (!MaquetarioHost.available) return <p className="settings-note">{t('desktopOnly')}</p>;
  const folders = Array.isArray(fontFolders) ? fontFolders : [];
  const add = async () => {
    setAdding(true);
    try {
      await obtainFonts('chooseFontFolder');
    } finally {
      openSettings();
    }
  };
  return (
    <>
      {folders.length ? (
        <ul className="settings-list">
          {folders.map((folder) => (
            <li key={folder} className="settings-list-item user-content" title={folder}>
              {folder}
            </li>
          ))}
        </ul>
      ) : (
        <p className="settings-note">{t('noFolders')}</p>
      )}
      <button type="button" className="btn" id="settingsAddFolder" disabled={adding} onClick={add}>
        <Icon name="folder" />
        {t('addFolder')}
      </button>
    </>
  );
};

/** Espacio de trabajo (workspace.ts): el activo y qué muestra cada uno. */
const Workspace = () => {
  // Las casillas y el selector leen el espacio de trabajo en vivo; esto sólo vuelve a dibujar.
  const [, redraw] = useState(0);
  const ws = window.MaquetarioWorkspace;
  if (!ws) return null;
  const names: Record<WorkspaceMode, string> = {
    simple: bw('Inicial', 'Starter', 'Inicial'),
    default: bw('Predeterminado', 'Default', 'Padrão'),
    custom: bw('Personalizado', 'Custom', 'Personalizado'),
  };
  const groups: [string, string][] = [
    ['tools', t('tools')],
    ['tabs', t('tabs')],
    ['zones', t('zones')],
  ];
  const items = ws.items();
  return (
    <>
      <SettingRow label={t('workspaceMode')}>
        <Select
          id="settingsWorkspace"
          options={Object.entries(names).map(([value, label]) => ({ value, label }))}
          value={ws.mode()}
          onChange={(mode) => {
            ws.setMode(mode as WorkspaceMode);
            openSettings('workspace');
          }}
        />
      </SettingRow>
      <p className="settings-help">{t('workspaceHelp')}</p>
      <div className="settings-checklists">
        {groups.map(([group, title]) => (
          <div className="settings-checklist" key={group}>
            <h4 className="settings-checklist-title">{title}</h4>
            {items
              .filter((item) => item.group === group)
              .map((item) => (
                <CheckItem
                  key={item.id}
                  item={item.id}
                  label={item.label}
                  checked={ws.isVisible(item.id)}
                  disabled={item.locked}
                  onChange={(checked) => {
                    ws.setVisible(item.id, checked);
                    redraw((n) => n + 1);
                  }}
                />
              ))}
          </div>
        ))}
      </div>
    </>
  );
};

const SettingsPanel = ({
  info,
  account,
  focusSection,
}: {
  info: AppInfo | null;
  account: AccountStatus | null;
  focusSection?: string;
}) => {
  useLanguage();
  const [rulers, setRulers] = useState(() => MaquetarioRulers.isVisible());
  useLayoutEffect(() => {
    if (focusSection)
      document
        .getElementById(`settings-section-${focusSection}`)
        ?.scrollIntoView({ block: 'start' });
  }, [focusSection]);
  return (
    <div className="settings">
      <Section title={t('account')} id="account">
        <Account status={account} />
      </Section>
      <Section title={t('interfaceSection')}>
        <SettingRow label={t('language')}>
          <Select
            id="settingsLanguage"
            options={[
              { value: 'es', label: 'Español' },
              { value: 'en', label: 'English' },
              { value: 'pt', label: 'Português' },
            ]}
            defaultValue={i18n.language}
            onChange={(value) => {
              setLanguage(value as Language);
              // La Hoja se vuelve a armar en el idioma elegido.
              openSettings();
            }}
          />
        </SettingRow>
        <SettingRow label={t('interface')} help={t('interfaceHelp')}>
          <Select
            id="settingsInterfaceSize"
            options={[
              { value: 'standard', label: t('comfortable') },
              { value: 'large', label: t('large') },
            ]}
            defaultValue={document.body.classList.contains('ui-large') ? 'large' : 'standard'}
            onChange={(value) => setReadability(value)}
          />
        </SettingRow>
        <SettingRow label={t('rulers')} help={t('rulersHelp')}>
          <CheckItem
            id="settingsRulers"
            label=""
            checked={rulers}
            onChange={(checked) => {
              MaquetarioRulers.setVisible(checked);
              setRulers(checked);
            }}
          />
        </SettingRow>
      </Section>
      <div id="settings-section-workspace">
        <Section title={t('workspace')}>
          <Workspace />
        </Section>
      </div>
      <Section title={t('fonts')}>
        <p className="settings-help">{t('fontsHelp')}</p>
        <Folders />
      </Section>
      <Section title={t('about')}>
        <p className="settings-about">
          Maquetario {info && info.version ? 'v' + info.version : ''}
          <br />
          {t('createdBy')} {(info && info.creator) || 'Sebastián Poberezny'}
        </p>
      </Section>
    </div>
  );
};

async function openSettings(focusSection?: string): Promise<void> {
  let info: AppInfo | null = null;
  let account: AccountStatus | null = null;
  if (MaquetarioHost.available) {
    [info, account] = await Promise.all([
      nativeCall('appInfo').catch(() => null),
      nativeCall('motiovaStatus').catch(() => null),
    ]);
  }
  // Abrir una Hoja reemplaza la Hoja abierta (también esta misma, al rearmarla).
  void openSheet(<SettingsPanel info={info} account={account} focusSection={focusSection} />, {
    title: t('title'),
    single: true,
    action: { label: t('done'), run: () => true },
    size: 'lg',
    variant: 'settings-modal',
  });
}

/** Lo llama el proceso principal al abrir, si Motiova tiene una versión más nueva. */
globalThis.maquetarioUpdateAvailable = (update) => {
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

globalThis.openSettings = openSettings;
