// Átomo: ícono del set de la app, el mismo que dibuja icon() de src/core/icons.ts (trazos en paths).
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

export const Icon = ({ name }: { name: string }) => (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d={paths[name] || paths.file} />
  </svg>
);
