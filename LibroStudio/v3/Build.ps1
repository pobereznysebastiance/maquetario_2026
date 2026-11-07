$ErrorActionPreference='Stop'
$studioRoot=$PSScriptRoot
$sdkVersion='1.0.2903.40'
$vendorRoot=Join-Path $studioRoot 'vendor'
$sdkRoot=Join-Path $vendorRoot 'webview2'
$libraryRoot=Join-Path $sdkRoot 'lib\net462'
if (!(Test-Path (Join-Path $libraryRoot 'Microsoft.Web.WebView2.Core.dll'))) {
    New-Item -ItemType Directory -Path $vendorRoot -Force | Out-Null
    $archive=Join-Path $vendorRoot 'webview2.zip'
    $url="https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/$sdkVersion/microsoft.web.webview2.$sdkVersion.nupkg"
    Invoke-WebRequest -Uri $url -OutFile $archive
    $expected='EF128016DD1E51C59178C827ED5B8AA3322C57AFA8675D930F8109505542AD74'
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expected) {
        throw 'La suma de verificación del SDK WebView2 no coincide.'
    }
    Expand-Archive -LiteralPath $archive -DestinationPath $sdkRoot -Force
}
$assetRoot=Join-Path $studioRoot 'bundle'
New-Item -ItemType Directory -Path $assetRoot -Force | Out-Null
Copy-Item -Path (Join-Path $studioRoot 'app\*') -Destination $assetRoot -Recurse -Force
Copy-Item (Join-Path $libraryRoot 'Microsoft.Web.WebView2.Core.dll'),(Join-Path $libraryRoot 'Microsoft.Web.WebView2.WinForms.dll') -Destination $assetRoot -Force
Copy-Item (Join-Path $studioRoot 'vendor\webview2\runtimes\win-x64\native\WebView2Loader.dll') -Destination $assetRoot -Force
Compress-Archive -Path (Join-Path $assetRoot '*') -DestinationPath (Join-Path $studioRoot 'bundle.zip') -Force
$output=Join-Path $studioRoot '..\..\Maquetario\Maquetario-3.24.exe'
$compiler='C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /target:winexe /platform:x64 "/out:$output" "/win32icon:$assetRoot\maquetario.ico" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Security.dll /reference:System.Web.Extensions.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll "/reference:$libraryRoot\Microsoft.Web.WebView2.Core.dll" "/reference:$libraryRoot\Microsoft.Web.WebView2.WinForms.dll" "/resource:$studioRoot\bundle.zip,bundle.zip" (Join-Path $studioRoot 'Host.cs') (Join-Path $studioRoot 'HostPrinting.cs') (Join-Path $studioRoot 'HostFonts.cs') (Join-Path $studioRoot 'HostWelcome.cs') (Join-Path $studioRoot 'HostGlyphs.cs') (Join-Path $studioRoot 'HostAssistant.cs') (Join-Path $studioRoot 'HostNotices.cs') (Join-Path $studioRoot 'HostPackage.cs')
if($LASTEXITCODE -ne 0){throw 'No se pudo compilar LibroStudio.'}
Get-Item -LiteralPath $output | Select-Object FullName,Length
