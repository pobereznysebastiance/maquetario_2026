# Imprenta · CMYK y PDF/X (09-nov)

Investigación para la etapa 4 ("PDF de imprenta"). Todavía no se implementa la conversión. Ya está hecha la primera pieza: cajas exactas (MediaBox, TrimBox, BleedBox) en `desktop/src/main/print-boxes.ts`.

## Dónde estamos

El PDF sale de Chromium (`printToPDF`, motor Skia):

- **Color:** todo en RGB de dispositivo (`DeviceRGB`): textos, filetes, fondos e imágenes. No hay CMYK, ni perfiles ICC, ni OutputIntent.
- **Transparencia:** queda viva (grupos de transparencia y máscaras suaves) cuando hay opacidades, sombras o PNG con canal alfa.
- **Fuentes:** siempre incrustadas y en subconjunto. Las TrueType comunes van como CID TrueType. Las fuentes variables y las WOFF2 salen como Type 3, que también están incrustadas pero son de menor calidad en el RIP.
- **Cajas:** desde el 09-nov, MediaBox exacta y TrimBox/BleedBox según el libro o la cubierta.
- **Versión:** Chromium escribe `%PDF-1.4`.

Esto alcanza para impresión digital y para la mayoría de las imprentas que aceptan "PDF de alta" y convierten en su RIP. No alcanza para una imprenta offset que exige **PDF/X-1a** (sólo CMYK, sin transparencia).

## Qué es cada PDF/X

| | PDF/X-1a (2001/2003) | PDF/X-4 (2008/2010) |
|---|---|---|
| Color | Sólo CMYK y tintas planas. Nada de RGB. | CMYK, tintas planas y también RGB o Lab **con perfil ICC** (lo convierte el RIP). |
| Transparencia | Prohibida: hay que aplanar. | Permitida (viva). |
| Base | PDF 1.3 / 1.4 | PDF 1.6 |
| OutputIntent | Obligatorio (condición de impresión, p. ej. FOGRA39) | Obligatorio, con perfil ICC incrustado |
| Cajas | TrimBox o ArtBox obligatoria; BleedBox recomendada | Igual |
| Fuentes | Todas incrustadas | Todas incrustadas |
| Metadatos | `GTS_PDFXVersion` en el Info y en el XMP, `Trapped` | Igual, en XMP |

Para un archivo nuevo, la recomendación general es PDF/X-4. PDF/X-1a sigue siendo lo que piden los RIP viejos y los flujos conservadores.

## Qué pide una imprenta argentina típica

No hay una norma local: cada imprenta publica su guía y conviene pedírsela. No encontré guías publicadas de imprentas argentinas concretas; lo que sigue es lo habitual en las guías en castellano y las internacionales:

- **Offset (tiradas largas, libros de editorial):**
  - PDF/X-1a, a veces PDF/X-4.
  - CMYK con perfil de papel estucado (ISO Coated v2 / FOGRA39, o PSO Coated v3 / FOGRA51) o no estucado (PSO Uncoated v3 / FOGRA52) para interiores en papel obra.
  - Sangrado de 3 mm (algunas piden 5).
  - Imágenes a 300 ppp al tamaño final, fuentes incrustadas y negro de texto al 100 % K.
  - Interior y tapa en archivos separados; la tapa con el lomo calculado por la imprenta según papel y páginas.
- **Digital (tiradas cortas, impresión por demanda):** casi siempre aceptan PDF común o PDF/X-4 con RGB y convierten en su RIP. Piden sangrado y marcas igual.

Maquetario ya resuelve sangrado y marcas en la cubierta, archivos separados, cajas exactas y fuentes incrustadas. Falta el color (CMYK u OutputIntent), la transparencia (para X-1a) y los metadatos PDF/X.

## Opciones reales

### 1. Ghostscript (`pdfwrite` con `-dPDFX`)
- **Qué hace:** convierte a CMYK con un perfil ICC, escribe el OutputIntent (con un archivo `PDFX_def.ps` que apunta al perfil) e incrusta todas las fuentes.
- **Versiones de PDF/X:** la documentación oficial dice a la vez que soporta "PDF/X-1 y PDF/X-3" y que el parámetro acepta 1, 3 o 4. Además `-dPDFX` fuerza `CompatibilityLevel=1.3`. **Hay que probarlo con un archivo real antes de prometer X-4.**
- **Transparencia:** con nivel 1.3, una página con transparencia viva **se rasteriza entera**, texto incluido. Para un libro con imágenes PNG o sombras es un problema de calidad.
- **Licencia: AGPL o comercial (Artifex).**
  - Distribuirlo dentro del instalador de una app que no es AGPL requiere licencia comercial (es la lectura de Artifex). El precio no es público: se negocia.
  - Alternativas sin licencia:
    - **Que la persona lo instale aparte** y Maquetario lo use si está (como hacen algunos programas libres). Fricción alta para estudiantes y docentes.
    - **Convertir en un servidor** (Motiova): usar Ghostscript sin modificar en un servidor propio no obliga a publicar código, pero cada PDF de libro (decenas o cientos de MB) viaja al servidor. Hay costo de transferencia y una pregunta de privacidad.
- **Costo de integración:** unos 3–5 días (comando, perfil, pruebas con PDF de Chromium).

### 2. MuPDF / mupdf.js (WASM)
- **Qué hace:** `mutool recolor -c cmyk` convierte colores, pero no escribe PDF/X: no hay OutputIntent ni metadatos, y no aplana transparencia para X-1a.
- **Licencia:** también AGPL o comercial (Artifex). No resuelve lo de licencia y hace menos que Ghostscript.

### 3. pdf-lib (ya está en el repo, MIT) + Little CMS en WASM (`lcms-wasm`, MIT)
- **Lo que se puede hacer:**
  - Escribir OutputIntent con el perfil incrustado, XMP con `GTS_PDFXVersion`, `Trapped` y cajas (ya están).
  - Agregar `DefaultRGB` (sRGB ICC) a los recursos de cada página. Eso convierte todo el `DeviceRGB` de Chromium en color con perfil, que es lo que PDF/X-4 admite.
  - Con Little CMS, convertir imágenes RGB a CMYK con un perfil (decodificar, transformar, recodificar).
- **Lo que no:** reescribir a CMYK los colores vectoriales de los flujos de contenido, los degradados (shadings) y las máscaras de transparencia, y aplanar la transparencia. Eso es un motor de preimpresión: semanas de trabajo y mucho riesgo.
- **Resultado práctico:** un **PDF/X-4 con RGB etiquetado** (sRGB + OutputIntent FOGRA39/FOGRA51), que el RIP de la imprenta convierte. Sin licencias.
- **Costo:** unos 1–2 semanas, incluida la validación con un preflight.

### 4. Herramientas comerciales de preimpresión
- **callas pdfToolbox Server/CLI/SDK:** unos **5.000 € de pago único** más mantenimiento para actualizaciones. Convierte a PDF/X-1a, X-4 y otros, con aplanado de transparencia de calidad. Para el escritorio, cada instalación necesitaría su licencia: sólo tiene sentido en un servidor.
- **Apryse (PDFTron), PDFlib e iText (este último AGPL o comercial):** licencias anuales del mismo orden o más altas, según volumen.

### 5. Perfiles ICC
- La ECI distribuye gratis **ISO Coated v2 (FOGRA39)** y **PSO Coated v3 (FOGRA51)**, y la familia PSO Uncoated.
- Las condiciones que figuran en el empaquetado de Debian dicen que no se pueden modificar ni vender sin permiso. Incrustarlos en el PDF de salida es el uso normal.
- **Para empaquetarlos con el instalador, conviene confirmar por escrito con la ECI.** Una alternativa es usar el identificador registrado (`FOGRA39`) en el OutputIntent, que en X-1a permite omitir el perfil.

## Recomendación

1. **Ahora (1–2 semanas, sin licencias):**
   - Salida "PDF/X-4 para imprenta" con pdf-lib: OutputIntent (PSO Coated v3 / FOGRA51 o ISO Coated v2 / FOGRA39, a elegir en el diálogo según papel), `DefaultRGB` sRGB, XMP de PDF/X-4 y las cajas que ya están.
   - Un preflight propio que avise lo que rompe la norma: fuentes Type 3, imágenes por debajo de 300 ppp, falta de sangrado en la cubierta.
   - Validar con la prueba gratuita de callas pdfToolbox o con el preflight de Acrobat Pro, y con una imprenta real (digital y offset).
2. **Cuando una imprenta exija PDF/X-1a o CMYK puro:**
   - Conversión en un servidor de Motiova con Ghostscript sin modificar: sin licencia, con costo de transferencia y la pregunta de privacidad.
   - O, si el volumen lo justifica, pdfToolbox Server (unos 5.000 € más mantenimiento), que aplana bien la transparencia.
   - No conviene meter Ghostscript en el instalador sin licencia comercial de Artifex. Además, con transparencia rasteriza páginas enteras.
3. **Lo que no conviene:** escribir un convertidor CMYK propio de contenido vectorial y transparencia. Es un producto en sí mismo.

## Para decidir con Seba

- ¿Las imprentas con las que trabajan los usuarios (aulas, editoriales chicas) son digitales u offset?
- Con una o dos guías de imprentas reales se cierra qué perfil va por defecto y si X-4 alcanza.

## Fuentes

- Ghostscript, documentación de `pdfwrite` (PDF/X y PDF/A): https://ghostscript.readthedocs.io/en/latest/VectorDevices.html
- Ghostscript, licencias (AGPL y comercial): https://ghostscript.com/licensing
- Ghostscript, bug sobre OutputIntent y conversión ICC: https://bugs.ghostscript.com/show_bug.cgi?id=700931
- Stack Overflow (archivo), "can ghostscript currently convert a pdf to pdf/x": https://kaweah.freedombox.rocks/kiwix/content/stackoverflow.com_en_all_2023-11/questions/28632119/can-ghostscript-currently-convert-a-pdf-to-pdf-x
- MuPDF, `mutool recolor`: https://mupdf.readthedocs.io/en/1.27.0/tools/mutool-recolor.html
- `lcms-wasm` (Little CMS en WebAssembly, MIT): https://npmjs.com/package/lcms-wasm
- ECI, descargas de perfiles: https://eci.org/doku.php_id=en:downloads.html
- Debian, licencia de los perfiles ECI empaquetados: https://tracker.debian.org/media/packages/i/icc-profiles/copyright-2.5
- ICC, registro de condiciones (FOGRA39, PSO Coated v3): https://www.color.org/FOGRA39.xalter · https://registry.color.org/profile-registry/PSOcoated_v3
- Skia, fuentes en PDF (Type 3 para variables y WOFF2): https://groups.google.com/a/chromium.org/g/chromium-dev/c/O-a4sW3nLNo · https://skia.googlesource.com/skia/+/chrome/m124/src/pdf/SkPDFFont.cpp
- PDF/X-1a:2003 (ISO 15930-4): https://www.iso.org/es/contents/data/standard/02/90/29061.html?browse=tc
- Guía PDF/X (X-1a frente a X-4, FOGRA39 como OutputIntent): https://kaijuconverter.com.servidor3000.lucusvirtual.es/guides/pdf-x-print-standard-complete-guide
- callas pdfToolbox 16, precios: https://pdfa.org/callas-software-releases-pdftoolbox-16/ · https://www.techbloat.com/software/callas-pdftoolbox-sdk/
