// Reglas horizontal y vertical: preferencia de vista (como en InDesign), no del libro.
// Ctrl+R (⌘R en macOS) o Configuración → Interfaz → Reglas. Se recuerda entre sesiones.
(function () {
  'use strict';
  const STORE = 'maquetario-rulers';

  const read = () => {
    try {
      return localStorage.getItem(STORE) !== 'hidden';
    } catch {
      return true;
    }
  };
  let visible = read();

  function apply() {
    document.body.dataset.rulers = visible ? 'visible' : 'hidden';
  }

  function setVisible(value) {
    visible = !!value;
    try {
      localStorage.setItem(STORE, visible ? 'visible' : 'hidden');
    } catch {
      // Sin almacenamiento: vale hasta cerrar la app.
    }
    apply();
    // La mesa de trabajo cambió de tamaño: que el lienzo se reacomode.
    window.dispatchEvent(new Event('resize'));
  }

  document.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey || event.key.toLowerCase() !== 'r') return;
    if (event.target.closest?.('input, textarea, select, [contenteditable="true"]') || document.querySelector('dialog[open]')) return;
    event.preventDefault();
    setVisible(!visible);
  });

  window.MaquetarioRulers = Object.freeze({ isVisible: () => visible, setVisible });
  apply();
})();
