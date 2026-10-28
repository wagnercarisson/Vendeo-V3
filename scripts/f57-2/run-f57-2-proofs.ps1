<#
.SYNOPSIS
  Orquestrador das provas F57.2 no homolog existente.

.DESCRIPTION
  Executa SOMENTE contra 127.0.0.1:57782/postgres. Não cria, inicia, baixa ou
  destrói ambientes; não usa comandos de criação, reset ou push de banco.
  -Action status: valida identidade/ledger em modo read-only.
  -Action prove:  roda as três suítes postgres, emite/compare a prova
                  comparativa e grava as evidências; cleanup no finally.

  A ação prove exige autorização explícita do checkpoint humano do plano 05.
#>
param(
  [ValidateSet("status", "prove")]
  [string]$Action = "status",
  [string]$EvidenceDir = ".planning/phases/57.2-f57-2-persist-ncia-de-prefer-ncias-multimercado/evidence",
  [int]$ExpectedLedgerCount = 149,
  [string]$ExpectedLedgerSha256 = "acc1ce62227e54b8cf0f2f9178e3b2e77f77b89d4582b904a7c1b11972c1e9a9"
)

$ErrorActionPreference = "Stop"
$TargetHost = "127.0.0.1"
$TargetPort = "57782"
$TargetDb = "postgres"

if ($env:SUPABASE_ACCESS_TOKEN -or $env:SUPABASE_DB_URL) {
  throw "Recusado: SUPABASE_ACCESS_TOKEN/SUPABASE_DB_URL não são permitidos neste procedimento."
}
if (-not $env:TEST_DATABASE_URL) {
  throw "TEST_DATABASE_URL é obrigatório."
}

$uri = $null
if (-not [Uri]::TryCreate($env:TEST_DATABASE_URL, [UriKind]::Absolute, [ref]$uri)) {
  throw "TEST_DATABASE_URL inválida."
}
if (($uri.Scheme -ne "postgresql" -and $uri.Scheme -ne "postgres") -or
    ($uri.Host -ne $TargetHost -and $uri.Host -ne "localhost") -or
    $uri.Port -ne [int]$TargetPort -or $uri.AbsolutePath -ne "/$TargetDb") {
  throw "Destino recusado: esperado $TargetHost`:$TargetPort/$TargetDb."
}
$MaskedTarget = "postgresql://***@$TargetHost`:$TargetPort/$TargetDb"

function Invoke-ProofStatus {
  $code = @'
const { Client } = require("pg");
const { createHash } = require("crypto");
(async () => {
  const c = new Client({ connectionString: process.env.TEST_DATABASE_URL, ssl: false });
  await c.connect();
  try {
    const db = await c.query("select current_database() as db, to_regclass('auth.users') is not null as auth");
    const roles = await c.query("select rolname from pg_roles where rolname in ('anon','authenticated','service_role') order by rolname");
    const ledger = await c.query("select version, name from supabase_migrations.schema_migrations order by version");
    const stable = ledger.rows.filter(r => !String(r.name ?? "").includes("f57_2_")).map(r => r.version + "|" + (r.name ?? "")).sort();
    console.log(JSON.stringify({
      database: db.rows[0].db,
      auth: db.rows[0].auth,
      roles: roles.rows.map(r => r.rolname),
      ledger_count: stable.length,
      ledger_sha256: createHash("sha256").update(stable.join("\n")).digest("hex"),
      f57_2: ledger.rows.filter(r => String(r.name ?? "").includes("f57_2_")).map(r => r.version + "|" + r.name)
    }));
  } finally { await c.end(); }
})().catch(e => { console.error(e.message); process.exit(1); });
'@
  $raw = & node -e $code
  if ($LASTEXITCODE -ne 0) { throw "Falha ao ler identidade/ledger do homolog." }
  $status = $raw | ConvertFrom-Json
  if ($status.database -ne $TargetDb -or -not $status.auth) {
    throw "Identidade divergente: banco/auth não correspondem ao homolog."
  }
  if (($status.roles -join ",") -ne "anon,authenticated,service_role") {
    throw "Roles esperadas ausentes no homolog."
  }
  if ([int]$status.ledger_count -ne $ExpectedLedgerCount -or $status.ledger_sha256 -ne $ExpectedLedgerSha256) {
    throw "Fingerprint do ledger divergiu (count=$($status.ledger_count), sha=$($status.ledger_sha256))."
  }
  return $status
}

function Invoke-Cleanup {
  $code = @'
const { Client } = require("pg");
(async () => {
  const c = new Client({ connectionString: process.env.TEST_DATABASE_URL, ssl: false });
  await c.connect();
  const failures = [];
  let deletedStores = 0;
  let deletedUsers = 0;
  try {
    const stores = await c.query("select id from public.stores where name like '%f572test-%' or name like '%f572proof-%'");
    for (const row of stores.rows) {
      try {
        await c.query("delete from public.store_market_settings where store_id=$1", [row.id]);
        await c.query("delete from public.store_billing_info where store_id=$1", [row.id]);
        await c.query("delete from public.legal_acceptances where store_id=$1", [row.id]);
        await c.query("delete from public.stores where id=$1", [row.id]);
        deletedStores += 1;
      } catch (error) {
        failures.push({ table: "stores", id: row.id, error: error.message });
      }
    }
    const users = await c.query("select id from auth.users where email like '%f572test-%' or email like '%f572proof-%'");
    for (const row of users.rows) {
      try {
        await c.query("delete from public.user_preferences where user_id=$1", [row.id]);
        await c.query("delete from public.admin_audit_log where target_id=$1", [row.id]);
        await c.query("delete from auth.users where id=$1", [row.id]);
        deletedUsers += 1;
      } catch (error) {
        failures.push({ table: "auth.users", id: row.id, error: error.message });
      }
    }
    const result = await c.query(`select
      (select count(*)::int from public.stores where name like '%f572test-%' or name like '%f572proof-%') as stores,
      (select count(*)::int from auth.users where email like '%f572test-%' or email like '%f572proof-%') as users,
      (select count(*)::int from public.store_market_settings s join public.stores st on st.id=s.store_id where st.name like '%f572test-%' or st.name like '%f572proof-%') as settings,
      (select count(*)::int from public.user_preferences p join auth.users u on u.id=p.user_id where u.email like '%f572test-%' or u.email like '%f572proof-%') as preferences`);
    const payload = { ...result.rows[0], deleted_stores: deletedStores, deleted_users: deletedUsers, failures };
    console.log(JSON.stringify(payload));
    if (failures.length > 0) process.exit(2);
  } finally { await c.end(); }
})().catch(e => { console.error(e.message); process.exit(1); });
'@
  $raw = & node -e $code
  if ($LASTEXITCODE -ne 0) {
    $detail = if ($raw) { ($raw -join "`n") } else { "sem detalhe" }
    throw "Falha no cleanup de fixtures (IDs preservados): $detail"
  }
  return $raw | ConvertFrom-Json
}

if ($Action -eq "status") {
  $status = Invoke-ProofStatus
  Write-Output "HOMOLOG $MaskedTarget"
  Write-Output "LEDGER $($status.ledger_count) $($status.ledger_sha256)"
  Write-Output "F57_2 $($status.f57_2 -join ',')"
  exit 0
}

if (-not (Test-Path $EvidenceDir)) { New-Item -ItemType Directory -Path $EvidenceDir | Out-Null }
$status = Invoke-ProofStatus
$suiteCodes = [ordered]@{}
$evidencePaths = [ordered]@{
  db = Join-Path $EvidenceDir "57.2-05-db-evidence.json"
  rls = Join-Path $EvidenceDir "57.2-05-rls-grants.txt"
  comparative = Join-Path $EvidenceDir "57.2-05-comparative-proof.md"
  concurrency = Join-Path $EvidenceDir "57.2-05-concurrency.json"
  after = Join-Path $EvidenceDir "57.2-05-s1-s9-after.json"
}
$residues = $null
$proofError = $null
$cleanupError = $null
$finalSnapshotError = $null
try {
  $env:F57_2_EXPECTED_LEDGER_COUNT = "$ExpectedLedgerCount"
  $env:F57_2_EXPECTED_LEDGER_SHA256 = $ExpectedLedgerSha256

  $schemaOut = Join-Path $EvidenceDir "57.2-05-schema-output.txt"
  & npx vitest run src/lib/__tests__/market-preferences-schema.postgres.test.ts --reporter=verbose 2>&1 |
    Tee-Object -FilePath $schemaOut
  $suiteCodes.schema = $LASTEXITCODE
  if ($suiteCodes.schema -ne 0) { throw "Suíte de schema falhou." }

  & npx vitest run src/lib/__tests__/market-preferences-onboarding.postgres.test.ts --reporter=verbose 2>&1 |
    Tee-Object -FilePath (Join-Path $EvidenceDir "57.2-05-onboarding-output.txt")
  $suiteCodes.onboarding = $LASTEXITCODE
  if ($suiteCodes.onboarding -ne 0) { throw "Suíte de onboarding falhou." }

  & npx vitest run src/lib/__tests__/market-preferences-security.postgres.test.ts --reporter=verbose 2>&1 |
    Tee-Object -FilePath $evidencePaths.rls
  $suiteCodes.security = $LASTEXITCODE
  if ($suiteCodes.security -ne 0) { throw "Suíte de segurança/RLS falhou." }

  $baseline = Join-Path $EvidenceDir "57.2-04-baseline.json"
  $s0Before = Join-Path $EvidenceDir "57.2-01-s0-before.json"
  $s0After01 = Join-Path $EvidenceDir "57.2-01-s0-after-01.json"
  $s0After02 = Join-Path $EvidenceDir "57.2-01-s0-after-02.json"
  foreach ($required in @($baseline, $s0Before, $s0After01, $s0After02)) {
    if (-not (Test-Path $required)) { throw "Evidência obrigatória ausente: $required" }
  }

  & node scripts/f57-2/comparative-proof.mjs emit --url $env:TEST_DATABASE_URL --side new `
    --out $evidencePaths.after --concurrency-out $evidencePaths.concurrency 2>&1
  if ($LASTEXITCODE -ne 0) { throw "emissão da prova comparativa falhou." }

  & node scripts/f57-2/comparative-proof.mjs compare --base $baseline --new $evidencePaths.after `
    --s0-before $s0Before --s0-after-01 $s0After01 --s0-after-02 $s0After02 `
    --out-md $evidencePaths.comparative 2>&1
  if ($LASTEXITCODE -ne 0) { throw "comparação base × novo divergiu." }
} catch {
  $proofError = $_
} finally {
  try {
    $residues = Invoke-Cleanup
  } catch {
    $cleanupError = $_
  }
}

# S0 novo, DEPOIS do cleanup, para provar que esta execução não deixou drift.
$finalS0 = Join-Path $EvidenceDir "57.2-05-s0-final.json"
$finalS0Md = Join-Path $EvidenceDir "57.2-05-s0-final.md"
$evidencePaths.final_s0 = $finalS0
$evidencePaths.final_s0_md = $finalS0Md
try {
  & node scripts/f57-2/homolog-snapshot.mjs snapshot --url $env:TEST_DATABASE_URL `
    --out $finalS0 --label after-proofs-cleanup 2>&1
  if ($LASTEXITCODE -ne 0) { throw "snapshot S0 final falhou." }
  & node scripts/f57-2/homolog-snapshot.mjs compare `
    --before (Join-Path $EvidenceDir "57.2-01-s0-after-02.json") `
    --after $finalS0 --out-md $finalS0Md 2>&1
  if ($LASTEXITCODE -ne 0) { throw "S0 final divergiu do snapshot histórico." }
} catch {
  $finalSnapshotError = $_
}

$evidence = [ordered]@{
  generated_at = (Get-Date).ToUniversalTime().ToString("o")
  target = $MaskedTarget
  ledger = [ordered]@{ count = $status.ledger_count; sha256 = $status.ledger_sha256; f57_2 = $status.f57_2 }
  suites = $suiteCodes
  residues = $residues
  evidence = $evidencePaths
  proof_error = if ($proofError) { $proofError.ToString() } else { $null }
  cleanup_error = if ($cleanupError) { $cleanupError.ToString() } else { $null }
  final_s0_error = if ($finalSnapshotError) { $finalSnapshotError.ToString() } else { $null }
}
$evidence | ConvertTo-Json -Depth 6 | Set-Content -Path $evidencePaths.db -Encoding utf8

if ($cleanupError) { throw $cleanupError }
if ($proofError) { throw $proofError }
if ($finalSnapshotError) { throw $finalSnapshotError }

foreach ($path in $evidencePaths.Values) {
  if (-not (Test-Path $path)) { throw "Evidência não produzida: $path" }
  if ((Get-Item $path).Length -le 0) { throw "Evidência vazia: $path" }
}
if ($residues.stores -ne 0 -or $residues.users -ne 0 -or $residues.settings -ne 0 -or $residues.preferences -ne 0) {
  throw "Resíduos encontrados após cleanup: $($residues | ConvertTo-Json -Compress)"
}
Write-Output "PROVE OK $MaskedTarget"
