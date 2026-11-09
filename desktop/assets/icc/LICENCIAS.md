# Perfiles ICC

Los usa la salida PDF/X-4 (`desktop/src/main/pdfx.ts`). `scripts/build.mjs` los copia a `dist/icc`, que va en el instalador. Los dos se pueden redistribuir con el programa.

Origen: paquete `colorprofiles` de CTAN (versión 20181105), https://ctan.org/pkg/colorprofiles

| Archivo | Uso | SHA-256 |
|---|---|---|
| `FOGRA39L_coated.icc` | Perfil de salida (OutputIntent FOGRA39): offset, papel estucado, ISO 12647-2:2004/Amd 1 | `b35713ef7eff09349d4c3249e5f377736d06d8a2671c54712971a3546bf17c57` |
| `sRGB.icc` | DefaultRGB: etiqueta el RGB de Chromium como sRGB (IEC 61966-2.1) | `049e05b4b9f85e2b65d43e1bed89e301d157f14ba8dadefe3a92e12814d763da` |

Las sumas se verifican con `sha256sum desktop/assets/icc/*.icc` (la prueba `desktop/test/pdfx.test.ts` también las controla). Si se cambia un perfil, hay que actualizar esta tabla.

## FOGRA39L_coated.icc

Generado por Peter Selinger con `cd-create-profile` (colord) a partir de los datos de caracterización FOGRA39L. Lleva adentro la leyenda "This profile is free of known copyright restrictions". Selinger renunció a sus derechos sobre los archivos (https://tug.org/pipermail/tex-live/2018-September/042340.html).

Copyright de los datos de origen: Kai-Uwe Behrmann, Marti Maria, Photogamut, Graeme Gill, ColorSolutions (basICColor). Licencia zlib/libpng:

```
This software is provided 'as-is', without any express or implied
warranty. In no event will the authors be held liable for any damages
arising from the use of this software.

Permission is granted to anyone to use this software for any purpose,
including commercial applications, and to alter it and redistribute it
freely, subject to the following restrictions:

  1. The origin of this software must not be misrepresented; you must not
  claim that you wrote the original software. If you use this software
  in a product, an acknowledgment in the product documentation would be
  appreciated but is not required.

  2. Altered source versions must be plainly marked as such, and must not be
  misrepresented as being the original software.

  3. This notice may not be removed or altered from any source
  distribution.
```

## sRGB.icc

De ArgyllCMS (`icc/sRGB.icm`). Leyenda del perfil: "Created by Graeme W. Gill. Released into the public domain. No Warranty, Use at your own risk."

```
Copyright (c) 1997-2015 Graeme W. Gill

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.
```

## Por qué no PSO Coated v3 (FOGRA51) ni ISO Coated v2 de la ECI

El perfil de la ECI dice: "may be used, embedded and exchanged without restriction. It may not be distributed, sold or altered without written permission of ECI European Color Initiative." Incrustarlo en un PDF está permitido, pero ponerlo en el instalador requiere permiso escrito de la ECI. Los perfiles de Adobe (Coated FOGRA39) piden un acuerdo de redistribución aparte, el Color Profile Bundling Agreement.
