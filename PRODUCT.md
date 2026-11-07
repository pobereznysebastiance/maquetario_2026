# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(Interfaz web empaquetada como programa de escritorio con Electron para Windows y macOS. El lenguaje de diseño es propio, no nativo de cada sistema.)

## Users

Una mezcla que empieza por estudiantes. Primero, alumnos de diseño editorial y sus docentes, dentro de los cursos de Motiova: aprenden a maquetar un libro maquetándolo. Después, esa misma gente y otros profesionales lo usan para trabajo real (libros por encargo, autoedición), así que la herramienta tiene que crecer con quien la usa: guía al principio, precisión y velocidad cuando ya sabe.

## Product Purpose

Maquetario es un editor de maquetación editorial para libros: armar publicaciones, definir grillas y estilos tipográficos, componer el texto, diseñar la cubierta con su lomo, revisar pliegos y exportar o imprimir PDF. Se distribuye y se cobra desde Motiova (launcher con sesión de Motiova y licencia). El éxito es que alguien que nunca maquetó termine un libro correcto para imprenta y entienda por qué está bien.

## Positioning

- Enseña mientras maquetás: reglas editoriales, legibilidad y avisos que explican el porqué, no sólo el qué.
- Más simple y accesible que InDesign o Affinity Publisher: menos curva de aprendizaje y precio pensado para Latinoamérica.
- En castellano primero (también inglés y portugués), con el vocabulario del oficio editorial de habla hispana.

## Operating Context

- Sesiones largas de trabajo sobre una página doble, en notebooks de 13–15" (1366×768 a 1920×1080), monitores grandes de estudio y Mac con pantalla Retina.
- Flujo: crear o abrir proyecto (.mqt) → manuscrito → páginas y grilla → texto y estilos → cubierta → revisión → PDF o impresora → paquete para imprenta (proyecto, fuentes, imágenes, PDF).
- Funciona sin conexión; el asistente editorial con IA es opcional y pide consentimiento por envío.
- En clase: el docente acompaña, los estudiantes siguen el tutorial y los recorridos guiados.

## Capabilities and Constraints

- Funciones existentes: formatos de página, grillas, folios y cornisas, cajas de texto, imágenes, figuras, capas, índice, cubierta con medidas y lomo, separación silábica (es, en, pt), catálogo de fuentes del sistema con ejes variables, revisión de legibilidad y reglas editoriales, tutorial, aprender, asistente editorial, salida PDF, impresión y paquete.
- Idiomas de la interfaz: español, inglés y portugués.
- El editor muestra la página tal como se imprime: el área de la página es contenido del usuario y no debe teñirse con el estilo de la interfaz.
- Pendiente de decidir: ediciones o planes de la licencia, precio, pago único o suscripción.

## Brand Commitments

- Nombre: Maquetario. Autor y creador: Sebastián Poberezny (se acredita en la app y en el instalador).
- Identidad existente del instalador (`LibroStudio/v3/installer-brand/`): fondo petróleo oscuro, verde agua, filete dorado, tipografía DM Sans, isotipo de libro abierto en dos hojas con degradé verde agua.
- Pedido explícito del creador: estilo "glass" inspirado en macOS. Pedido explícito del equipo: que se sienta una herramienta de trabajo seria, sin estética de panel genérico de IA.
- Voz: castellano rioplatense con voseo ("Elegí", "Guardá"), claro y directo.

## Evidence on Hand

- Ilustración y marca del instalador: `LibroStudio/v3/installer-brand/welcome.bmp`, `mark.bmp`; ícono `LibroStudio/v3/app/maquetario.ico`.
- Imágenes de bienvenida: `LibroStudio/v3/app/assets/welcome-editorial.png`, `welcome-editorial-glass.png`.
- Libro de ejemplo completo ("El atlas de las casas vacías", `novel-sample.js`) para demostraciones y pruebas.
- No hay testimonios, clientes ni métricas de uso: no inventarlos.

## Product Principles

1. La página manda: la interfaz se aparta para que el libro sea lo más visible y fiel de la pantalla.
2. Enseñar sin estorbar: la guía aparece cuando sirve y se puede apagar cuando ya se sabe.
3. Correcto para imprenta por defecto: lo que se ve es lo que sale en el PDF.
4. Un solo sistema: cada control, panel y aviso sale de los mismos componentes y tokens.
5. Serio y propio: precisión de herramienta profesional, identidad de Maquetario, sin adornos genéricos.

## Accessibility & Inclusion

- Uso por teclado completo (atajos ya existentes: herramientas con letra, Ctrl+rueda, Espacio para mano).
- Contraste legible sobre superficies translúcidas en notebooks con brillo bajo.
- Respetar "reducir movimiento" del sistema.
