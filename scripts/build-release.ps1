param(
  [ValidateSet("generic","crazygames","poki","yandex","vkplay","rustore","newgrounds","itchio")]
  [string]$Platform = "generic",
  [switch]$All
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$env:VITE_USE_PLATFORM_MOCK = "0"

$platforms = @("generic","crazygames","poki","yandex","vkplay","rustore","newgrounds","itchio")
$targets = if ($All) { $platforms } else { @($Platform) }

foreach ($target in $targets) {
  Write-Host "Building platform: $target"
  npm run "build:$target"

  $dist = Join-Path $root "dist\$target"
  $zip = Join-Path $root "dist\lumelines-$target.zip"
  if (Test-Path $zip) { Remove-Item $zip }
  Compress-Archive -Path (Join-Path $dist "*") -DestinationPath $zip -Force
}

Remove-Item Env:VITE_USE_PLATFORM_MOCK -ErrorAction SilentlyContinue
Write-Host "All release builds completed successfully."
