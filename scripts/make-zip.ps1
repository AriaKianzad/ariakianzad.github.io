# Writes a zip with the Windows-native .NET ZipArchive.
#
# Entry names are created explicitly with forward slashes, so the archive
# parses correctly in Windows Explorer, Linux unzip, cPanel File Manager,
# and bsdtar. Hidden files are enumerated with -Force (nothing staged is
# silently omitted). bsdtar's own zip writer is deliberately not used:
# archives produced by `tar.exe --format=zip` are valid but documented to
# render as EMPTY in Windows Explorer (libarchive/libarchive#2489), which
# caused a false "empty archive" report for this site's bundle.
param(
  [Parameter(Mandatory=$true)][string]$Staging,
  [Parameter(Mandatory=$true)][string]$ZipPath
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
$staging = $staging.TrimEnd('\')
if (-not (Test-Path -LiteralPath $staging)) { throw "staging not found: $staging" }
$stagingLen = $staging.Length
if (Test-Path -LiteralPath $ZipPath) { throw "Refusing to overwrite an existing archive: $ZipPath" }
$fs = [System.IO.File]::Create($ZipPath)
try {
  $zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    Get-ChildItem -LiteralPath $staging -Recurse -File -Force | ForEach-Object {
      $rel = $_.FullName.Substring($stagingLen + 1).Replace('\', '/')
      $entry = $zip.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
      $in = [System.IO.File]::OpenRead($_.FullName)
      try {
        $out = $entry.Open()
        try { $in.CopyTo($out) } finally { $out.Dispose() }
      } finally { $in.Dispose() }
    }
  } finally { $zip.Dispose() }
} finally { $fs.Dispose() }
if (-not (Test-Path -LiteralPath $ZipPath)) { throw "zip not written: $ZipPath" }
Write-Output ("ZIPCREATED " + (Get-Item -LiteralPath $ZipPath).Length)
