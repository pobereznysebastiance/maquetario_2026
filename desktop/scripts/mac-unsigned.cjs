// Configuración de electron-builder para macOS sin certificado de Apple (pruebas y beta).
//
// Toma la de package.json ("build") y cambia sólo la firma: ad-hoc ("-") en lugar de un
// Developer ID. Sin firma ninguna, la app de Apple Silicon no abre ("está dañada"); con ad-hoc abre,
// y la primera vez macOS pide permiso en Ajustes → Privacidad y seguridad → "Abrir igual".
// El "hardened runtime" va apagado: con firma ad-hoc rechaza las bibliotecas de Electron.
//
// Con certificado (CSC_LINK, APPLE_ID…) no se usa este archivo: `npm run dist:mac` firma y notariza
// con la configuración de package.json. Ver docs/MAC_10-nov_instalador.md.
const { build } = require('../package.json');

module.exports = {
  ...build,
  mac: { ...build.mac, identity: '-', hardenedRuntime: false },
};
