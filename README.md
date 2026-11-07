# Maquetario

Aplicación de escritorio para diseño y maquetación editorial, creada por Sebastián Poberezny. Permite armar publicaciones, definir grillas y estilos tipográficos, diseñar cubiertas, revisar pliegos y exportar o imprimir PDF.

La versión del código en este repositorio es **3.24**. Está orientada a **Windows 10 y 11 de 64 bits**.

## Compilar

Desde PowerShell, en la raíz del repositorio:

```powershell
& ./LibroStudio/v3/Build.ps1
```

La compilación usa .NET Framework 4.x. En la primera ejecución descarga el SDK fijado de Microsoft WebView2 y verifica su suma SHA-256. El resultado queda en `Maquetario/Maquetario-3.24.exe`. Para abrirlo, la computadora necesita Microsoft Edge WebView2 Runtime.

Para armar el instalador con Inno Setup 6.7:

```powershell
& ./LibroStudio/v3/Build-Installer.ps1
```

Si Inno Setup está en otra ubicación, pasá la ruta de `ISCC.exe` con `-Compiler`. El resultado queda en `Maquetario/Instalador/`.

## Código y comprobaciones

- `LibroStudio/v3/app/` contiene el editor y sus recursos.
- `LibroStudio/v3/Host*.cs` contiene la integración con Windows, las fuentes, la impresión y el guardado.
- `LibroStudio/v3/Maquetario.iss` define el instalador.
- `Maquetario/Servicio-aula/` contiene el servicio opcional para conectar el asistente editorial. Consultá [su guía de configuración](Maquetario/Servicio-aula/LEEME.md).

En Windows, `Maquetario.exe --self-test` ejecuta las pruebas de la aplicación y deja los informes junto al ejecutable. Las comprobaciones del servicio de aula se pueden correr con `node --test Maquetario/Servicio-aula/service.test.mjs`.

Los avisos de DM Sans, pdf-lib y sus componentes están en `LibroStudio/v3/app/licenses/`. La biblioteca de separación silábica conserva su aviso en `LibroStudio/v3/app/hyphenation/LICENSE`.
