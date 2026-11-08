# Evaluación de uso: observaciones

Notas para la etapa de experiencia de usuario, que va **después** de terminar el sistema de componentes. Cada punto dice qué se ve, por qué molesta y una dirección posible. Nada de esto está decidido.

## Orientación y ayuda

1. **Demasiadas puertas para aprender.** Tutorial, Aprender y Recorrido en la barra del documento; "?" en la barra de zoom; Tutorial guiado y Glosario en la bienvenida; ayudas "?" en cada sección. No queda claro cuál usar ni en qué se diferencian. *Dirección:* un solo centro de ayuda (aprender, recorridos, glosario, atajos) con una entrada fija.
2. **Consejo permanente al pie del inspector** ("La grilla es una guía: no se imprime…"). Útil la primera vez; después ocupa lugar siempre. *Dirección:* consejo contextual que se puede descartar.

## Espacio de trabajo

3. **El lienzo tiene marcas de interfaz pintadas sobre el papel** (etiqueta naranja "Página activa 9" dentro de la página). Contradice "la página manda": tapa el contenido del libro. *Dirección:* indicar la página activa en el marco (borde, regla o la tira de páginas), nunca sobre el papel.
4. **Las plantillas de grilla ocupan una franja fija abajo** aunque no se estén usando. *Dirección:* plegarlas por defecto o llevarlas al inspector (Diseño → Grilla).
5. **La barra de zoom mezcla cosas**: zoom, modo continuo, ajustar, atajos y ampliar área. *Dirección:* zoom + ajustar juntos; continuo y ampliar área como modos de vista.
6. **Herramientas y paneles mezclados en la columna izquierda**: Seleccionar, Mano y Texto son herramientas; Índice, Capas y Cubierta abren paneles. *Dirección:* separar herramientas (acción sobre el lienzo) de vistas (paneles).
7. **Estado de guardado duplicado**: "Proyecto local" abajo a la izquierda y "Guardado en tu equipo" abajo a la derecha. *Dirección:* un solo indicador.

## Inspector

8. **Siete pestañas en un panel angosto** (Libro, Diseño, Texto, Objeto, Páginas, Índice, Capas): se cortan o se esconden detrás de una flecha. *Dirección:* agrupar (Libro · Página · Selección) o cambiar la pestaña según lo seleccionado, como hace InDesign con el panel de Propiedades.
9. **Etiquetas que se parten en dos líneas** a anchos chicos ("Grosor · mm", "Horizontal · columnas"). *Dirección:* la unidad va dentro del campo (ya existe en otros) y la etiqueta en una línea.

## Lenguaje visual

10. **El dorado significa demasiadas cosas**: página activa, interruptores, ayudas, un ítem de la columna (Índice), foco. *Dirección:* reservar el dorado para foco y estado activo; verde agua para acción y selección.
11. **Caracteres usados como íconos**: ×, ?, ↗, ← →. Se ven de otro peso y tamaño que el set de íconos. *Dirección:* todo ícono sale del set dibujado (`studio.js → paths`).
12. **Etiquetas chicas en mayúsculas sobre títulos** (MAQUETARIO · …, TU TALLER EDITORIAL) en varios lugares: es uno de los rasgos que hacen que la app parezca generada por IA. Ya se sacaron de los avisos, la bienvenida y los diálogos; quedan otras.

## Confirmaciones

13. **Acciones destructivas sin distinguir**: eliminar página usaba el botón verde de acción principal. Ya corregido (confirmación con botón de peligro y foco en Cancelar). *Pendiente:* revisar el resto de acciones irreversibles (recuperación de sesión, reemplazar el libro desde "Armar otro libro").
