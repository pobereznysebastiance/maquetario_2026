param([string]$Compiler)

$ErrorActionPreference='Stop'
if (!$Compiler) {
    $command=Get-Command ISCC.exe -ErrorAction SilentlyContinue
    if ($command) { $Compiler=$command.Source }
    else {
        $candidates=@(
            "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
            "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
            "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
        )
        $Compiler=$candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    }
}
if (!$Compiler -or !(Test-Path -LiteralPath $Compiler -PathType Leaf)) {
    throw 'Instalá Inno Setup 6.7 o indicá la ruta a ISCC.exe con -Compiler.'
}

$tools=Join-Path $PSScriptRoot 'installer-tools'
New-Item -ItemType Directory -Path $tools -Force | Out-Null
$bootstrapper=Join-Path $tools 'MicrosoftEdgeWebview2Setup.exe'
if (!(Test-Path -LiteralPath $bootstrapper)) {
    Invoke-WebRequest 'https://go.microsoft.com/fwlink/p/?LinkId=2124703' -OutFile $bootstrapper
}
$signature=Get-AuthenticodeSignature -LiteralPath $bootstrapper
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch '(?:^|,\s*)CN=Microsoft Corporation(?:,|$)') {
    throw 'No se pudo verificar la firma de Microsoft del instalador de WebView2.'
}

& (Join-Path $PSScriptRoot 'Build.ps1')
& $Compiler (Join-Path $PSScriptRoot 'Maquetario.iss')
if ($LASTEXITCODE -ne 0) { throw 'No se pudo generar el instalador de Maquetario.' }
