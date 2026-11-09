// Organismo: pantalla de bienvenida (#welcomeScreen). Bienvenida de herramienta, no de portada:
// dos acciones (Crear un libro, Abrir proyecto), el ejemplo como tercera, una sola entrada a la
// Ayuda, la copia de recuperación como fila destacada y los proyectos recientes.
//
// Es sólo presentación: recibe el estado y las acciones por props (las arma welcome-service.tsx).
// Los textos llegan ya traducidos (texts). El aspecto sale de ui/organisms/welcome.css y de los
// átomos de ui/ (btn, quiet, action-item, recent-project).
//
// Ganchos que usan otros módulos, por id o clase (no cambiarlos sin revisar quién los usa):
// - .welcome-actions: book-workflow agrega ahí "Armar desde un manuscrito" (#welcomeNovel).
// - #welcomeDemo, #welcomeResume, #welcomeRecover: review-workspace les suma su clic.
// - #recentProjects y .recent-project: scripts/style-snapshot.js dibuja ahí recientes de muestra.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import type { ChangeEvent, ReactNode } from 'react';
import { Icon } from '../Icon.tsx';
import type { Language } from '../../i18n.ts';

/** Proyecto reciente que informa el anfitrión (appInfo). */
export interface RecentProject {
  name: string;
  path: string;
  modified: string | number;
  missing?: boolean;
}

/** Copia de recuperación de la última sesión (lo que hace falta mostrar de ella). */
export interface RecoverySummary {
  title: string;
  pages: number;
}

export interface WelcomeScreenProps {
  /** Textos de la pantalla en el idioma actual (claves de WELCOME_TEXT). */
  texts: Record<string, string>;
  language: Language;
  version: string;
  recents: RecentProject[];
  recovery: RecoverySummary | null;
  /** Hay un libro abierto detrás: se ofrece volver a él. */
  canResume: boolean;
  onNew: () => void;
  onOpen: () => void;
  onDemo: () => void;
  onHelp: () => void;
  onResume: () => void;
  onRecover: () => void;
  onDiscardRecovery: () => void;
  onOpenRecent: (project: RecentProject) => void;
  onLanguage: (language: Language) => void;
}

/** Molécula: acción con explicación (la misma que UI.actionItem). */
const ActionItem = ({
  id,
  icon,
  title,
  description,
  onClick,
}: {
  id: string;
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
}) => (
  <button type="button" id={id} className="action-item" onClick={onClick}>
    <Icon name={icon} />
    <span className="action-item-text">
      <span className="action-item-title">{title}</span>
      <span className="action-item-description">{description}</span>
    </span>
  </button>
);

/** Botón .btn con ícono antes del texto (el mismo marcado que UI.button). */
const Button = ({
  id,
  icon,
  primary,
  title,
  onClick,
  children,
}: {
  id: string;
  icon?: string;
  primary?: boolean;
  title?: string;
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    id={id}
    className={primary ? 'btn primary' : 'btn'}
    title={title}
    onClick={onClick}
  >
    {icon && <Icon name={icon} />}
    {children}
  </button>
);

const dateLocale = (language: Language): string =>
  language === 'pt' ? 'pt-BR' : language === 'en' ? 'en-US' : 'es-AR';

export const WelcomeScreen = (p: WelcomeScreenProps) => {
  const t = p.texts;
  return (
    <>
      <header className="welcome-header">
        <div className="welcome-brand">
          <img src="maquetario.svg" alt="" />
          <strong>Maquetario</strong>
          <span>v{p.version}</span>
        </div>
        {p.canResume && (
          <button type="button" id="welcomeResume" className="quiet" onClick={p.onResume}>
            {t.resume}
          </button>
        )}
      </header>
      <div className="welcome-body">
        <section className="welcome-copy">
          <h1>{t.headline}</h1>
          <p className="welcome-intro">{t.intro}</p>
          <div className="welcome-actions">
            <Button id="welcomeNew" icon="plus" primary onClick={p.onNew}>
              {t.new}
            </Button>
            <Button id="welcomeOpen" icon="folder" onClick={p.onOpen}>
              {t.open}
            </Button>
          </div>
          <div className="welcome-start">
            <ActionItem
              id="welcomeDemo"
              icon="pages"
              title={t.demo}
              description={t.demoHelp}
              onClick={p.onDemo}
            />
            <ActionItem
              id="welcomeHelp"
              icon="help"
              title={t.help}
              description={t.helpHelp}
              onClick={p.onHelp}
            />
          </div>
          <section className="welcome-recents">
            <div className="welcome-section-title">
              <h2>{t.recent}</h2>
            </div>
            {p.recovery && (
              <div className="recent-recovery" role="group" aria-label={t.recovery}>
                <span className="recent-cover">
                  <Icon name="undo" />
                </span>
                <span className="recent-details">
                  <strong>{t.recovery}</strong>
                  <small>
                    <span className="user-content">{p.recovery.title}</span>
                    {' · '}
                    {bw(
                      `${p.recovery.pages} páginas, guardada en este equipo`,
                      `${p.recovery.pages} pages, kept on this computer`,
                      `${p.recovery.pages} páginas, guardada neste computador`,
                    )}
                  </small>
                </span>
                <Button
                  id="welcomeRecover"
                  primary
                  onClick={p.onRecover}
                  title={bw(
                    `Abre la copia de recuperación de «${p.recovery.title}» (${p.recovery.pages} páginas). Si no la recuperás, queda guardada en este equipo hasta que crees o edites otro libro.`,
                    `Opens the recovery copy of “${p.recovery.title}” (${p.recovery.pages} pages). If you don't recover it, it stays on this computer until you create or edit another book.`,
                    `Abre a cópia de recuperação de “${p.recovery.title}” (${p.recovery.pages} páginas). Se você não recuperar, ela fica neste computador até você criar ou editar outro livro.`,
                  )}
                >
                  {t.recover}
                </Button>
                <button
                  type="button"
                  id="welcomeDiscardRecovery"
                  className="quiet"
                  onClick={p.onDiscardRecovery}
                >
                  {t.discard}
                </button>
              </div>
            )}
            <div id="recentProjects">
              {p.recents.length ? (
                p.recents.map((r, i) => (
                  <button
                    type="button"
                    key={i}
                    className={r.missing ? 'recent-project missing' : 'recent-project'}
                    data-recent={i}
                    onClick={() => p.onOpenRecent(r)}
                  >
                    <span className="recent-cover">
                      <Icon name="pages" />
                    </span>
                    <span className="recent-details user-content">
                      <strong>{r.name}</strong>
                      <small>{r.path}</small>
                    </span>
                    <span className="recent-date">
                      {r.missing
                        ? t.missing
                        : new Date(r.modified).toLocaleDateString(dateLocale(p.language))}
                    </span>
                    <span className="recent-arrow">↗</span>
                  </button>
                ))
              ) : (
                <div className="recent-empty">
                  <Icon name="folder" />
                  <p>{t.empty}</p>
                </div>
              )}
            </div>
          </section>
        </section>
        <aside className="welcome-art">
          <img src="assets/welcome-editorial-glass.png" alt={t.art} />
        </aside>
      </div>
      <footer className="welcome-footer">
        <span>{t.created}</span>
        <span className="welcome-footer-end">
          <select
            id="welcomeLanguage"
            aria-label={t.language}
            value={p.language}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              p.onLanguage(e.target.value as Language)
            }
          >
            <option value="es">ES · Español</option>
            <option value="en">EN · English</option>
            <option value="pt">PT · Português</option>
          </select>
        </span>
      </footer>
    </>
  );
};
