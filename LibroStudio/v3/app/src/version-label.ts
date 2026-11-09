// Cómo se muestra la versión del programa. La versión técnica (desktop/package.json) es semver
// para el instalador, la licencia y las comparaciones con Motiova; la que se lee es otra cosa:
// una beta ("0.1.0-beta", "0.2.0-beta.3") se muestra "BETA 0.1", y una versión final, "v3.24.0".
// El proceso principal tiene la misma regla en desktop/src/main/env.ts (appVersionLabel).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

/** Versión para mostrar: "BETA 0.1" para una beta, "v3.24.0" para una versión final. */
export const versionLabel = (version: string): string => {
  const beta = /^(\d+)\.(\d+)\.\d+-beta(?:\.\d+)?$/.exec(version);
  return beta ? `BETA ${beta[1]}.${beta[2]}` : 'v' + version;
};
