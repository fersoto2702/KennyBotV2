param([string]$ProjectRoot = (Get-Location).Path)
$ErrorActionPreference = 'Stop'
$moduleRoot = Join-Path $ProjectRoot 'node_modules\@whiskeysockets\baileys'
if (-not (Test-Path $moduleRoot)) { throw 'No se encontro Baileys dentro del proyecto.' }
$package = Get-Content (Join-Path $moduleRoot 'package.json') -Raw | ConvertFrom-Json
if ($package.version -ne '7.0.0-rc13') { throw "Version inesperada: $($package.version); se requiere 7.0.0-rc13." }
$expected = @{
    'lib/Defaults/index.js' = 'DB164B83E519911C2607EEF52A7F76552ED42CCAAE0A30ABECA36A2390186528'
    'lib/Utils/messages-media.js' = '22730BC93F1728E6B5866F8D50AF67CDCAFF6E23A1260450AC7B4BD082E187C0'
    'lib/Utils/messages.js' = '3DDE841C3CAA0698862507E6C4268600494288817139F33152F490F3A715861F'
}
$targets = @('lib/Defaults/index.js', 'lib/Utils/messages-media.js', 'lib/Utils/messages.js')
$prepared = @()
foreach ($rel in $targets) {
    $src = Join-Path $PSScriptRoot ($rel -replace '/', '\')
    $dest = Join-Path $moduleRoot ($rel -replace '/', '\')
    if (-not (Test-Path $src) -or -not (Test-Path $dest)) { throw "Archivo faltante: $rel" }
    $hash = (Get-FileHash -Algorithm SHA256 $dest).Hash
    if ($hash -ne $expected[$rel]) {
        throw "El archivo $rel difiere del original recibido. No se aplicaron cambios; evita sobrescribir modificaciones previas."
    }
    $prepared += [pscustomobject]@{ Src=$src; Dest=$dest; Rel=$rel }
}
$backup = Join-Path $ProjectRoot ('baileys-rc13-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
foreach ($item in $prepared) {
    $saved = Join-Path $backup ($item.Rel -replace '/', '\')
    New-Item -ItemType Directory -Path (Split-Path $saved) -Force | Out-Null
    Copy-Item -LiteralPath $item.Dest -Destination $saved -Force
}
try {
    foreach ($item in $prepared) { Copy-Item -LiteralPath $item.Src -Destination $item.Dest -Force }
} catch {
    foreach ($item in $prepared) {
        $saved = Join-Path $backup ($item.Rel -replace '/', '\')
        if (Test-Path $saved) { Copy-Item -LiteralPath $saved -Destination $item.Dest -Force }
    }
    throw
}
Write-Host 'Parche instalado en Baileys rc13.' -ForegroundColor Green
Write-Host "Respaldo en: $backup"
Write-Host 'Reinicia KennyBot. El parche requiere que prepareWAMessageMedia reciba options.jid para reconocer el canal.'
