# Imprenta · CMYK y PDF/X (09-nov)

Investigación para la etapa 4 ("PDF de imprenta"). Hecho hasta ahora:

- Cajas exactas (MediaBox, TrimBox, BleedBox) en `desktop/src/main/print-boxes.ts`.
- **PDF/X-4 con RGB etiquetado** en `desktop/src/main/pdfx.ts`, sólo en el proceso principal. Ver "PDF/X-4 en Maquetario" más abajo.

La conversión a CMYK todavía no está hecha.

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
- **Revisado el 09-nov, con el perfil en la mano:** la etiqueta de copyright de PSO Coated v3 dice "may be used, embedded and exchanged without restriction. It may not be distributed, sold or altered without written permission of ECI". Se puede incrustar en un PDF, pero **no ponerlo en el instalador** sin permiso escrito.
- **Adobe (Coated FOGRA39):** para redistribuirlo hace falta su Color Profile Bundling Agreement, con condiciones de licencia para el usuario final.
- **Lo que usa Maquetario:** `FOGRA39L_coated.icc` (zlib/libpng, "free of known copyright restrictions") y `sRGB.icc` de ArgyllCMS (dominio público y licencia tipo MIT), los dos del paquete `colorprofiles` de CTAN. Se pueden redistribuir. Licencias y sumas en `desktop/assets/icc/LICENCIAS.md`.
- En PDF/X-4 el perfil de salida va incrustado (DestOutputProfile). La variante PDF/X-4p, que lo referencia de afuera, no se usa.

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

## PDF/X-4 en Maquetario (hecho el 09-nov)

### Contrato con la ventana de salida

La acción `outputPdf` (`desktop/src/main/handlers/output.ts → outputDocument`) acepta, junto a `options`:

```ts
nativeCall('outputPdf', {
  options,            // lo de siempre (OutputConfig: mode, paper, crop…)
  pdfx: true,         // opcional: PDF/X-4 con RGB etiquetado
  title: 'Mi libro',  // opcional: título del documento; si falta, book.title
});
// → { base64, pdfx: true }   (si falla, error "No se pudo armar el PDF/X-4: …";
//                             con PDF/X pedido nunca devuelve un PDF común)
```

- Sólo vale para `outputPdf`. La impresión (`print`) y el paquete del proyecto no cambian.
- La condición de impresión es **FOGRA39** (offset, papel estucado). Hoy no se puede elegir otra: no hay un perfil libre de FOGRA51 ni de papel no estucado. Si se suma uno, el contrato pasa a `pdfx: { condition: 'fogra39' | … }`.
- Sugerencia para la ventana: una casilla "PDF para imprenta (PDF/X-4)" que sólo se active con marcas de corte o en la cubierta, y una nota que diga que el color lo convierte la imprenta.

### Qué cumple

| Requisito de PDF/X-4 (ISO 15930-7) | Estado |
|---|---|
| Encabezado `%PDF-1.6` o menor, sin `/Version` más nueva en el catálogo | Sí: se escribe `%PDF-1.6` y se quita `/Version` |
| OutputIntent `/S /GTS_PDFX` con `OutputConditionIdentifier` (FOGRA39), `RegistryName` (color.org) y perfil CMYK incrustado (`DestOutputProfile`, N 4) | Sí |
| Color dependiente del dispositivo compatible con el OutputIntent | RGB etiquetado: `DefaultRGB` sRGB en todos los recursos (páginas, Form, patrones, fuentes Type 3) y `/DeviceRGB` explícito en imágenes, sombreados, Indexed y grupos de transparencia pasado a `ICCBased` sRGB. El gris (DeviceGray) queda, que PDF/X admite. |
| XMP con `pdfxid:GTS_PDFXVersion` = PDF/X-4, `dc:title`, `xmp:CreateDate`/`ModifyDate`/`MetadataDate`, `xmp:CreatorTool`, `pdf:Producer`, `pdf:Trapped` = False, `xmpMM:DocumentID`/`InstanceID`/`VersionID`/`RenditionClass` | Sí, y con los mismos valores que el Info |
| Info: `Title`, `Creator`, `Producer`, `CreationDate`, `ModDate`, `Trapped` /False | Sí (Producer es el de Chromium, "Skia/PDF mNNN") |
| `/ID` en el trailer | Sí (Chromium no lo escribe) |
| TrimBox en cada página, dentro de BleedBox y MediaBox | Sí (print-boxes.ts) |
| Fuentes incrustadas | Sí: Chromium las incrusta siempre (TrueType o Type 3) |
| Transparencia | Permitida en X-4: queda viva |
| Sin anotaciones en la página | Se quitan los enlaces |
| Sin cifrado, JavaScript, acciones, contenido externo | Chromium no los genera |

### Qué no cumple o no está comprobado

- **No hay conversión a CMYK.** Es "PDF/X-4 con RGB etiquetado": válido en X-4, pero una imprenta que exige X-1a o CMYK puro lo va a rechazar.
- **Sin validador externo todavía.** El control propio (`pdfxProblems`, lo usan la autoprueba y las pruebas) cubre las reglas de arriba, no la norma entera. Puntos a mirar con un validador de verdad:
  - flujos de contenido con operadores de color de dispositivo dentro de patrones;
  - grupos de transparencia sin `/CS` (Chromium no lo pone; con OutputIntent no debería hacer falta);
  - la estructura etiquetada de Chromium.
- **El Producer queda "Skia/PDF".** Es correcto (es quien escribió el contenido), pero alguna imprenta podría preguntar.

### Cómo validarlo

- **Gratis y libre:** no hay validador libre de PDF/X. veraPDF valida PDF/A y PDF/UA; PDFBox Preflight sólo PDF/A-1b. Para la estructura del archivo sirve `qpdf --check archivo.pdf` (Apache 2.0).
- **Con prueba gratuita:** callas pdfToolbox Desktop (prueba de 14 días), perfil "PDF/X-4 compliance". El preflight de Acrobat Pro (prueba de 7 días), perfil "Verify compliance with PDF/X-4". Enfocus PitStop Pro también tiene prueba.
- **Recomendado:** sacar `El atlas de las casas vacias - PDFX4.pdf` de la autoprueba, pasarlo por el preflight de pdfToolbox o Acrobat, y mandarlo a una imprenta digital y a una offset.

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
