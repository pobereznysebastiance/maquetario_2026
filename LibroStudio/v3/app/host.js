// Capa de host: la única parte de la interfaz que sabe en qué programa corre.
// - Electron: el preload expone window.maquetarioNative.
// - WebView2 (Maquetario.exe en C#, versión anterior): window.chrome.webview.
// - Navegador común: sin funciones de escritorio.
// El resto del código usa sólo window.MaquetarioHost.
(function () {
  'use strict';
  const electron = window.maquetarioNative;
  const webview = window.chrome && window.chrome.webview;
  const kind = electron ? 'electron' : webview ? 'webview2' : 'browser';
  const host = {
    kind,
    available: kind !== 'browser',
    platform: electron ? electron.platform : webview ? 'win32' : 'browser',
    postMessage(message) {
      if (electron) electron.postMessage(message);
      else if (webview) webview.postMessage(message);
      else throw new Error('Esta función requiere la app de escritorio de Maquetario.');
    },
    onMessage(callback) {
      if (electron) electron.onMessage(callback);
      else if (webview) webview.addEventListener('message', (event) => callback(event.data));
    },
    fontUrl(id) {
      const file = encodeURIComponent(id) + '.ttf';
      return electron ? '/__fonts/' + file : 'https://fonts.maquetario.local/' + file;
    },
  };
  window.MaquetarioHost = Object.freeze(host);

  // El sistema de diseño se acomoda a la ventana: material translúcido y lugar de los botones.
  const root = document.documentElement;
  root.dataset.host = kind;
  root.dataset.platform = host.platform;
  root.dataset.material = electron ? electron.material : 'none';
  if (electron) root.dataset.windowControls = electron.windowControls;
})();
