param([string]$ProjectRoot = ".")
$ErrorActionPreference = "Stop"
$root = (Resolve-Path $ProjectRoot).Path
$package = Join-Path $root "node_modules\@whiskeysockets\baileys\package.json"
$target = Join-Path $root "node_modules\@whiskeysockets\baileys\lib\Socket\messages-send.js"
$patched = Join-Path $PSScriptRoot "messages-send.js"
if (!(Test-Path $package) -or !(Test-Path $target) -or !(Test-Path $patched)) { throw "No se encontraron archivos; comprueba la ruta de KennyBot y la extraccion." }
$version = (Get-Content $package -Raw | ConvertFrom-Json).version
if ($version -ne "7.0.0-rc13") { throw "Parche solo para Baileys 7.0.0-rc13. Actual: $version" }
$original = Get-Content $target -Raw
$old = "tag: 'plaintext'," + "`n" + "                    attrs: {},"
$already = "tag: 'plaintext'," + "`n" + "                    attrs: { ...extraAttrs },"
$normalized = $original -replace "`r`n", "`n"
if ($normalized.Contains($already)) { Write-Host "El cambio mediatype ya estaba aplicado. No se modifico nada."; exit 0 }
if (!$normalized.Contains($old)) { throw "El archivo ya fue modificado de otra forma. No se reemplazo por seguridad." }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $root "messages-send.backup-$stamp.js"
Copy-Item $target $backup
Copy-Item $patched $target -Force
Write-Host "Parche mediatype aplicado. Respaldo: $backup"
Write-Host "Reinicia KennyBot y prueba primero la imagen en el canal."
