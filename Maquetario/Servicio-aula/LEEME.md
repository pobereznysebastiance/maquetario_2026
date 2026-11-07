# Maquetario · servicio del aula

Este servicio todavía **no está publicado**. El ejecutable funciona sin conexión para la revisión automática. Para la IA, un administrador debe alojar este servicio y configurar su dirección en Maquetario.

## Distribución sencilla para estudiantes

1. El docente publica **una sola instancia** del servicio detrás de HTTPS, con almacenamiento persistente.
2. Configura las variables de entorno `OPENAI_API_KEY`, `CLASS_CODE` (12 caracteres o más), `MAX_QUERIES_PER_DAY` (predeterminado 30), `MAX_QUERIES_PER_DEVICE` (predeterminado 3) y, opcionalmente, `OPENAI_MODEL` (predeterminado `gpt-5-mini`). La clave pertenece al docente y nunca se distribuye.
3. Ejecuta `node service.mjs`. Necesita Node.js 22 o posterior. Escucha en localhost:8787; el proxy HTTPS se configura en el alojamiento. `HOST` y `PORT` permiten cambiar ese enlace.
4. Entrega el ejecutable y un archivo `maquetario-aula.json` a su lado: `{"serviceUrl":"https://DIRECCION-REAL-DEL-AULA"}`. No es una dirección funcional de ejemplo.
5. El estudiante abre **Asistente editorial → Conectar aula**, ingresa el código una vez y autoriza cada envío de contenido.

La app protege el código almacenado usando la protección de datos de Windows para la cuenta actual. No guarda la clave de OpenAI, no la pide al estudiante y no la incorpora al proyecto.

## Alcance y límites

La revisión con IA envía texto y geometría de la página elegida (máximo 20.000 caracteres) o solo la estructura. No envía imágenes ni archivos. El modelo no recibe una captura visual y no puede certificar la composición ni la corrección de impresión. Las sugerencias no ejecutan cambios.

Los límites se reservan antes de consultar al proveedor y se guardan en `.runtime/daily-usage.json`. Incluso una llamada fallida consume una reserva; así no se reintenta indefinidamente con posibles costes. Los contadores cambian al día UTC. El límite total es por instalación del servicio, no una promesa de gasto exacto. Mantener una sola instancia o reemplazar los contadores por una base compartida antes de escalar a varias instancias.

El código de aula es compartido y puede reenviarse. Cambiarlo revoca el acceso anterior. La identidad de equipo es anónima y no es autenticación personal; la cuota global protege ante identidades cambiantes. Para una distribución pública masiva conviene usar cuentas o accesos individuales, además de un límite de gasto en la cuenta del proveedor.

No se guardan manuscritos ni respuestas en el servicio. La consulta se envía al proveedor usando `store:false`; eso no equivale a garantizar retención cero en todos los sistemas del proveedor. Revisar las condiciones aplicables antes de usar manuscritos sensibles o datos de estudiantes.

Referencias: [seguridad de claves](https://developers.openai.com/api/reference/overview), [Responses y salida estructurada](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

## Verificación

`node service.test.mjs` prueba autenticación, límites, limpieza del documento y respuesta usando un proveedor simulado. No envía solicitudes reales ni consume créditos. Una prueba real requiere el servicio publicado y la clave del docente.
