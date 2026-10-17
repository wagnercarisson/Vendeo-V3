# F56.2b2c (B2.3) — Runner da homologação permanente `vendeo-homolog` (Plano 04).
#
# NÃO aplica nada sem `-Apply -Authorized`. `-PreflightOnly` é ESTRITAMENTE read-only
# (nenhuma escrita no banco). Sem autorização humana, apenas o preflight roda.
#
# Guardas efetivas: prova REAL de destino (config.toml/container/porta), SHA-256 por
# arquivo, bloqueio de pendentes fora do conjunto autorizado, e aplicação SOMENTE via
# `infra` local (`migration up --local`) — NUNCA `db push`/`--linked`/reset.

param(
  [switch]$PreflightOnly,
  [switch]$Apply,
  [switch]$Authorized
)

$ErrorActionPreference = "Stop"

$Workdir   = "G:\Vendeo-Homolog"
$ConfigToml = Join-Path $Workdir "supabase\config.toml"
$ApiPort   = 57781
$DbPort    = 57782
$ProjectId = "vendeo-homolog"

# Conjunto AUTORIZADO (exato): duas migrations, com SHA-256 esperado.
$AllowedPending = @{
  "20261017000001_f56_2b2c_narrow_authorization.sql"      = "52859A5BFA7BD7EE4AC5F38156F1D07E6C2A23CF978024BDEFE298C07D928B41"
  "20261017000002_f56_2b2c_pilot_spend_control.sql"       = "6F31F1D81277C80A83B6193C2132A55A5406B896D1555BF7305A8D8590F7DC4B"
}

$script:Failures = @()
function Check([string]$Label, [bool]$Ok) {
  if ($Ok) { Write-Output "  ok   $Label" } else { $script:Failures += $Label; Write-Output "  FAIL $Label" }
}
function Test-LocalHost([string]$Url) {
  try { $h = ([System.Uri]$Url).Host } catch { return $false }
  return ($h -in @("127.0.0.1", "localhost", "::1"))
}
function Invoke-WithTimeout([scriptblock]$Block, [int]$Seconds) {
  $job = Start-Job -ScriptBlock $Block
  if (Wait-Job $job -Timeout $Seconds) { $out = Receive-Job $job; Remove-Job $job -Force; return $out }
  Stop-Job $job; Remove-Job $job -Force; return $null
}

Write-Output "== F56.2b2c runner - preflight (read-only) =="

# (1) Prova de destino — config.toml
$cfgOk = $false
if (Test-Path $ConfigToml) {
  $cfg = Get-Content $ConfigToml -Raw
  $cfgOk = ($cfg -match "project_id\s*=\s*`"$ProjectId`"")
}
Check "config.toml declara project_id = $ProjectId" $cfgOk

# (2) Container Up (best-effort, com timeout)
$containerUp = $false
try {
  $ps = Invoke-WithTimeout { docker ps --format "{{.Names}}" } 15
  if ($ps) { $containerUp = ($ps -split "`n" | ForEach-Object { $_.Trim() }) -contains "supabase_db_$ProjectId" }
} catch { $containerUp = $false }
Check "container supabase_db_$ProjectId Up" $containerUp

# (3) supabase status --workdir (API host local + porta 57781) — best-effort
$statusOk = $false
try {
  $envOut = Invoke-WithTimeout { npx --no-install supabase status --workdir "G:\Vendeo-Homolog" -o env } 30
  if ($envOut) {
    $apiLine = ($envOut -split "`n" | Where-Object { $_ -match "^API_URL=" })
    if ($apiLine) {
      $apiUrl = ($apiLine -replace "^API_URL=", "").Trim()
      $statusOk = (Test-LocalHost $apiUrl) -and ($apiUrl -match ":$ApiPort")
    }
  }
} catch { $statusOk = $false }
Check "API da homolog em host local :$ApiPort" $statusOk

# (4) Migrations presentes + SHA-256 EXATO (conjunto autorizado)
$repoMigs = Get-ChildItem "supabase/migrations" -Filter "*_f56_2b2c_*" -ErrorAction SilentlyContinue
foreach ($m in $AllowedPending.Keys) {
  $path = Join-Path "supabase\migrations" $m
  $exists = Test-Path $path
  Check "migration presente: $m" $exists
  if ($exists) {
    $hash = (Get-FileHash -Algorithm SHA256 $path).Hash
    Check "SHA-256 confere: $m" ($hash -ieq $AllowedPending[$m])
  }
}
# Qualquer OUTRA pendente b2.3 não autorizada ⇒ bloqueio
$others = $repoMigs | Where-Object { -not $AllowedPending.ContainsKey($_.Name) }
Check "nenhuma pendente B2.3 fora do conjunto autorizado" (@($others).Count -eq 0)

Write-Output ""
if ($script:Failures.Count -gt 0) {
  Write-Output "PREFLIGHT: FAIL ($($script:Failures.Count))"
  exit 1
}
Write-Output "PREFLIGHT: PASS"

if ($PreflightOnly) {
  Write-Output "PreflightOnly: encerrando SEM escrita no banco."
  exit 0
}

if (-not ($Apply -and $Authorized)) {
  Write-Output "Refuso: sem -Apply -Authorized (nenhuma escrita). Encerrando."
  exit 2
}

# --- APLICAÇÃO (somente com autorização humana explícita) ---
# (Execução real pertence ao checkpoint autorizado do Plano 04; aqui é a via.)
$dest = Join-Path $Workdir "supabase\migrations"
foreach ($m in $AllowedPending.Keys) {
  Copy-Item (Join-Path "supabase\migrations" $m) (Join-Path $dest $m) -Force
}
Write-Output "Copiadas 2 migrations com hash verificado para $dest"
npx --no-install supabase --workdir $Workdir migration up --local
if ($LASTEXITCODE -ne 0) { Write-Output "migration up --local EXIT=$LASTEXITCODE"; exit $LASTEXITCODE }
Write-Output "Aplicado (--local). Executar as provas em seguida no checkpoint autorizado."
exit 0
