# Etapa 3 · decisiones tomadas (08-nov)

Sobre la revisión `docs/INTERFAZ_08-nov_revision.md` (§4). Decidido con Juan Cruz el 08-nov.

| # | Decisión | Qué implica |
|---|---|---|
| D1 | **Radix sin estilos + nuestro CSS** | `radix-ui` 1.6.7 y React 19.2.8 (las versiones de Motiova). El estilo sale de `ui/` (tokens, `@layer`, clases), no de Tailwind ni shadcn. El libro sigue en `@layer book`: React monta el marco y deja `#spread` y `#printRoot` como nodos del motor actual. Campo numérico con unidad, selector de color y lista ordenable se hacen propios. |
| D2 | **Mixta, en dos tiempos** | 1) Completar la API de `src/ui/components.ts` y reemplazar el HTML de componentes armado a mano (`btn`, `<button>`…) por esas funciones, sin cambio visual. 2) Cada función pasa a ser un componente React con la misma API, pantalla por pantalla: avisos → diálogos simples → bienvenida → diálogos grandes → barras → inspector → riel. Lo que toca el lienzo, al final. |
| D3 | **Inspector en 3 pestañas** | Libro (estructura, página y grilla, foliado, cornisas) · Página (excepciones) · Selección (párrafo/texto u objeto, según lo elegido). Capas e Índice pasan a vistas del riel izquierdo. Títulos de sección a `headline`, unidad dentro del campo. |
| D4 | **Tres tipos de diálogo** | Confirmación (AlertDialog, 420 px, verbo en el botón) · Hoja (formularios cortos, sin "Cancelar" cuando sólo informa) · Ventana de trabajo (salida, cubierta, asistente, fuentes, glosario). Nada de diálogo sobre diálogo; la cubierta pasa a vista de trabajo. |
| D5 | **Mismos nombres que Motiova, valores propios** | Contrato de tokens semánticos común (los nombres de Motiova más materiales, elevación y roles tipográficos), en JSON (DTCG) con un script que genera el CSS. Cada producto pone sus valores. |
| D6–D9 | Según la revisión | Se conserva el sistema de tokens, capas, materiales y roles; dorado = foco y "estás acá" (aplicado el 08-nov); una sola puerta de Ayuda; "glass" = material del sistema sólo en fondo y barras, paneles opacos, sin degradés. |

## Plan de trabajo (primera ola, en paralelo)

- **Etapa 1:** retirar la versión C# (`LibroStudio/v3/Host*.cs`, `Build*.ps1`, `Maquetario.iss`) y su rama WebView2 en la interfaz.
- **Etapa 2:** migraciones del `.mqt` (versión de formato y pasos de actualización, con pruebas).
- **D5:** contrato de tokens (`packages/tokens`).
- **D1/D2:** React y Radix en el armado, y el primer componente React (avisos).
- **D2 tiempo 1:** API completa de `components.ts` y reemplazo del HTML a mano, por grupos de módulos.

Cada cambio se integra de a uno con la autoprueba y los PDF idénticos, como en la etapa 2.
