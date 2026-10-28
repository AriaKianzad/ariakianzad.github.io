# Independent .NET read of a zip archive; prints one JSON line.
# Used by make-hosting-bundle.mjs to cross-check the archive that
# scripts/make-zip.ps1 wrote with a second reader implementation.
param(
  [Parameter(Mandatory=$true)][string]$ZipPath
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
try {
  $files = @($zip.Entries | Where-Object { $_.FullName -notmatch '/$' })
  $dirs = @($zip.Entries | Where-Object { $_.FullName -match '/$' })
  $index = @($zip.Entries | Where-Object { $_.FullName -eq 'index.html' })
  $htaccess = @($zip.Entries | Where-Object { $_.FullName -eq '.htaccess' })
  [pscustomobject]@{
    total = $zip.Entries.Count
    files = $files.Count
    dirs = $dirs.Count
    uncompressed = [long]($files | Measure-Object -Property Length -Sum | Select-Object -ExpandProperty Sum)
    hasIndex = [bool]$index
    hasHtaccess = [bool]$htaccess
  } | ConvertTo-Json -Compress
} finally { $zip.Dispose() }
