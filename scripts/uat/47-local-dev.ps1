# DEPRECATED: use `.\switch-env.ps1 local` (entrada oficial).
# Mantido apenas como wrapper sem logica concorrente.

param(
    [switch]$Bootstrap
)

Write-Warning "47-local-dev.ps1 esta obsoleto. Use '.\switch-env.ps1 local'."

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent (Split-Path -Parent $scriptDir)
& (Join-Path $root "switch-env.ps1") local

if ($Bootstrap) {
    node (Join-Path $scriptDir "47-local-bootstrap.mjs")
}
