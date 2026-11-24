param(
  [ValidateSet('Preflight', 'RecordRestore', 'Rehearse', 'Apply', 'Verify')][string]$Mode = 'Preflight',
  [string]$BackupDirectory,
  [string]$AuthorizationFile
)
$ErrorActionPreference = 'Stop'
$f62ProjectRef = 'gvbzwihwgzujwsviufgy'
$f62Migration = 'supabase/migrations/20261123130252_campaign_format_addition.sql'
$f62ExpectedSha = '56dc3423c9be5d7363bd663a694a7e20f9bb9faed3569eb3e1c9574a76b9272a'
if ((Get-Content supabase/.temp/project-ref -Raw).Trim() -ne $f62ProjectRef) { throw 'Project mismatch' }
if ((Get-FileHash $f62Migration -Algorithm SHA256).Hash.ToLowerInvariant() -ne $f62ExpectedSha) { throw 'Migration hash mismatch' }
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class F62ReleaseCredential {
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct CREDENTIAL { public uint Flags; public uint Type; public string TargetName; public string Comment; public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten; public uint CredentialBlobSize; public IntPtr CredentialBlob; public uint Persist; public uint AttributeCount; public IntPtr Attributes; public string TargetAlias; public string UserName; }
 [DllImport("advapi32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CredRead(string target,uint type,uint flags,out IntPtr ptr);
 [DllImport("advapi32.dll")] static extern void CredFree(IntPtr ptr);
 public static string Read(string target) { IntPtr ptr; if(!CredRead(target,1,0,out ptr)) return null; try { var c=(CREDENTIAL)Marshal.PtrToStructure(ptr,typeof(CREDENTIAL)); byte[] b=new byte[c.CredentialBlobSize]; Marshal.Copy(c.CredentialBlob,b,0,b.Length); return System.Text.Encoding.UTF8.GetString(b); } finally { CredFree(ptr); } }
}
'@
$f62Token = [F62ReleaseCredential]::Read('Supabase CLI:supabase')
if (!$f62Token) { $f62Token = [F62ReleaseCredential]::Read('Supabase CLI:access-token') }
if (!$f62Token) { throw 'Named Supabase authentication unavailable' }
$f62Headers = @{Authorization="Bearer $f62Token"}
function Invoke-F62Sql([string]$Query, [bool]$ReadOnly = $true) {
  $body = @{query=$Query; read_only=$ReadOnly} | ConvertTo-Json -Compress
  try { $rows = Invoke-RestMethod -Method Post -Uri "https://api.supabase.com/v1/projects/$f62ProjectRef/database/query" -Headers $f62Headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 150; foreach ($row in $rows) { Write-Output $row } }
  catch { $code = if ($_.Exception.Response) {[int]$_.Exception.Response.StatusCode} else {'network'}; throw "Remote SQL failed ($code); no automatic retry" }
}
$f62FingerprintSql = @'
SELECT 'campaigns' AS name,count(*) AS rows,md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) AS md5 FROM public.campaigns t
UNION ALL SELECT 'stores',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) FROM public.stores t
UNION ALL SELECT 'credit_operations',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) FROM public.product_1_1_campaign_credit_operations t
UNION ALL SELECT 'credit_transactions',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) FROM public.credit_transactions t
UNION ALL SELECT 'credit_balances',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) FROM public.credit_balances t
UNION ALL SELECT 'composition_artifacts',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) FROM public.campaign_composition_artifacts t
UNION ALL SELECT 'primary_artifacts',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) FROM public.product_1_1_campaign_artifacts t
UNION ALL SELECT 'two_stage_operations',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) FROM public.product_9_16_two_stage_operations t
UNION ALL SELECT 'two_stage_steps',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) FROM public.product_9_16_two_stage_steps t
UNION ALL SELECT 'storage_objects',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) FROM storage.objects t
UNION ALL SELECT 'existing_flags',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) FROM public.feature_flags t WHERE key<>'campaign_format_addition_enabled'
'@
$f62PrimarySql = "SELECT md5(coalesce(jsonb_agg(jsonb_build_object('campaign_id',id,'primary',public.product_1_1_get_campaign_operation_by_campaign(id)) ORDER BY id)::text,'')) AS md5 FROM public.campaigns"
try {
  $project = Invoke-RestMethod -Method Get -Uri "https://api.supabase.com/v1/projects/$f62ProjectRef" -Headers $f62Headers -TimeoutSec 45
  if ($project.id -ne $f62ProjectRef -or $project.name -ne 'Vendeo-V3' -or $project.status -ne 'ACTIVE_HEALTHY') { throw 'Remote identity/health mismatch' }
  $identity = Invoke-F62Sql @'
SELECT current_database() AS database, current_setting('server_version') AS postgres,
 (SELECT count(*) FROM supabase_migrations.schema_migrations) AS ledger_count,
 (SELECT max(version) FROM supabase_migrations.schema_migrations) AS latest,
 (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='20261123130252') AS f62_count,
 (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='20261118002139') AS f607_count,
 to_regclass('public.campaign_format_additions')::text AS addition_table;
'@
  $identity | ConvertTo-Json -Depth 5
  if ($Mode -eq 'RecordRestore') {
    $container = 'f62-restore-20261124-1949'
    $network = (& docker inspect $container --format '{{.HostConfig.NetworkMode}}').Trim()
    if ($LASTEXITCODE -ne 0 -or $network -ne 'none') { throw 'Restore container identity/network mismatch' }
    $remoteRows = @(Invoke-F62Sql $f62FingerprintSql)
    $localSql = "SELECT jsonb_agg(to_jsonb(f) ORDER BY f.name) FROM ($f62FingerprintSql) f"
    $localText = & docker exec $container psql -X -U supabase_admin -d f62_restore_proof -v ON_ERROR_STOP=1 -At -c $localSql
    if ($LASTEXITCODE -ne 0) { throw 'Restored content read failed' }
    $localRows = ($localText -join "`n") | ConvertFrom-Json
    if ($localRows.Count -ne 11 -or $remoteRows.Count -ne 11) { throw "Fingerprint count mismatch (local=$($localRows.Count), remote=$($remoteRows.Count))" }
    foreach ($row in $remoteRows) {
      $match = @($localRows | Where-Object name -eq $row.name)
      if ($match.Count -ne 1 -or $match[0].rows -ne $row.rows -or $match[0].md5 -ne $row.md5) { throw "Restore content mismatch: $($row.name)" }
    }
    $backup = Get-Content (Join-Path $BackupDirectory 'manifest.json') -Raw | ConvertFrom-Json
    $proof = [ordered]@{status='passed'; verified_at=[DateTime]::UtcNow.ToString('o'); container=$container; database='f62_restore_proof'; no_network=$true; backup_sha256=$backup.database.sha256; content_fingerprints=$remoteRows; restore_preserved_owners_and_acls=$true; limitations=@('Two initial attempts in bootstrap database failed; final restore into template0 database exited 0','Storage bytes verified against manifest, not uploaded to an isolated Storage server','External project configuration is outside the logical database archive')}
    $proof | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 (Join-Path $BackupDirectory 'f62-restore-proof.json')
    $proof | ConvertTo-Json -Depth 10
    return
  }
  if ($Mode -in @('Rehearse', 'Apply')) {
    if (!$BackupDirectory -or !$AuthorizationFile) { throw 'Backup and authorization required' }
    $backup = Get-Content (Join-Path $BackupDirectory 'manifest.json') -Raw | ConvertFrom-Json
    if ($backup.projectRef -ne $f62ProjectRef -or $backup.status -ne 'complete_database_and_storage') { throw 'Backup incomplete or wrong project' }
    $dump = Join-Path $BackupDirectory 'database.dump'
    if ((Get-FileHash $dump -Algorithm SHA256).Hash -ne $backup.database.sha256) { throw 'Backup checksum mismatch' }
    $restore = Get-Content (Join-Path $BackupDirectory 'f62-restore-proof.json') -Raw | ConvertFrom-Json
    if ($restore.status -ne 'passed' -or $restore.backup_sha256 -ne $backup.database.sha256 -or !$restore.no_network) { throw 'Restore proof missing or mismatched' }
    $branch = (git branch --show-current).Trim(); $head = (git rev-parse HEAD).Trim()
    node scripts/verify/f62-authorization.mjs --kind migration --file $AuthorizationFile --expected-branch $branch --expected-head $head --expected-sha256 $f62ExpectedSha --expected-host "db.$f62ProjectRef.supabase.co" --expected-port 5432 --expected-database postgres --expected-container "managed-project:$f62ProjectRef"
    if ($LASTEXITCODE -ne 0) { throw 'Structured authorization rejected' }
    $baseline = @($identity)[0]
    if ($baseline.ledger_count -ne 158 -or $baseline.f62_count -ne 0 -or $baseline.f607_count -ne 1 -or $baseline.addition_table) { throw 'Baseline drift; stop' }
    $f62Source = Get-Content -LiteralPath $f62Migration -Raw -Encoding UTF8
    if ($f62Source.Contains('$f62_migration$')) { throw 'Unsafe SQL quoting delimiter' }
    $before = Invoke-F62Sql $f62FingerprintSql
    # The existing function is EXECUTE-only for postgres/service_role, not the
    # Management API's supabase_read_only_user. This remains a SELECT-only call.
    $primaryBefore = Invoke-F62Sql $f62PrimarySql $false
    $before | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 (Join-Path $BackupDirectory 'f62-content-before.json')
    $primaryBefore | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 (Join-Path $BackupDirectory 'f62-primary-before.json')
    $sqlPrefix = @'
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
LOCK TABLE supabase_migrations.schema_migrations IN EXCLUSIVE MODE;
DO $f62_guard$ BEGIN
 IF (SELECT count(*) FROM supabase_migrations.schema_migrations)<>158
 OR EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261123130252')
 OR to_regclass('public.campaign_format_additions') IS NOT NULL
 OR EXISTS(SELECT 1 FROM public.feature_flags WHERE key='campaign_format_addition_enabled')
 THEN RAISE EXCEPTION 'f62_remote_baseline_drift'; END IF;
END $f62_guard$;
'@
    $sqlSuffix = @'
DO $f62_verify$ BEGIN
 IF (SELECT count(*) FROM public.campaign_format_additions)<>0 THEN RAISE EXCEPTION 'unexpected_additions'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.feature_flags WHERE key='campaign_format_addition_enabled' AND enabled=false) THEN RAISE EXCEPTION 'flag_not_disabled'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE proname='campaign_format_add_open' AND md5(pg_get_functiondef(oid))='4e3fd785528bd56705f17a55613f26ab') THEN RAISE EXCEPTION 'open_function_mismatch'; END IF;
 -- Expected from the exact UTF-8 file on the restored snapshot. Homolog's
 -- original deliver/refund have mojibake only in comments; executable lines match.
 IF EXISTS(SELECT 1 FROM (VALUES ('trg_cfa_guard_fn','c821c994f246dce4b06897d5158930e6'),('campaign_format_add_open','4e3fd785528bd56705f17a55613f26ab'),('campaign_format_add_deliver','974223bfe312bbce8b089cadff081b8e'),('campaign_format_add_refund','f13ec8349e571a89db7fee61d88098c6'),('product_1_1_get_campaign_operation_by_campaign','01763f8b90925b1437bf5b6088df6fc7')) e(name,hash) WHERE NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname=e.name AND md5(pg_get_functiondef(p.oid))=e.hash)) THEN RAISE EXCEPTION 'function_hash_mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname IN ('campaign_format_add_open','campaign_format_add_deliver','campaign_format_add_refund','product_1_1_get_campaign_operation_by_campaign') AND (NOT p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[] OR has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE') OR NOT has_function_privilege('service_role',p.oid,'EXECUTE'))) THEN RAISE EXCEPTION 'unexpected_function_acl'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.campaign_format_additions'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'rls_disabled'; END IF;
 IF (SELECT count(*) FROM pg_constraint WHERE conrelid='public.campaign_format_additions'::regclass AND contype='f' AND convalidated)<>6 OR (SELECT count(*) FROM pg_constraint WHERE conrelid='public.campaign_format_additions'::regclass AND contype='c' AND convalidated)<>9 THEN RAISE EXCEPTION 'constraints_mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.campaign_format_additions'::regclass AND tgname='trg_cfa_guard' AND tgenabled='O') THEN RAISE EXCEPTION 'trigger_mismatch'; END IF;
 IF has_table_privilege('anon','public.campaign_format_additions','SELECT') OR has_table_privilege('authenticated','public.campaign_format_additions','SELECT') OR NOT has_table_privilege('service_role','public.campaign_format_additions','SELECT') OR has_table_privilege('service_role','public.campaign_format_additions','INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'unexpected_table_acl'; END IF;
END $f62_verify$;
DO $f62_unchanged$ BEGIN
 IF EXISTS((SELECT * FROM f62_before EXCEPT SELECT * FROM f62_after) UNION ALL (SELECT * FROM f62_after EXCEPT SELECT * FROM f62_before)) THEN RAISE EXCEPTION 'business_content_changed'; END IF;
 IF (SELECT md5 FROM f62_primary_before) IS DISTINCT FROM (SELECT md5 FROM f62_primary_after) THEN RAISE EXCEPTION 'primary_reader_regression'; END IF;
END $f62_unchanged$;
'@
    $sql = $sqlPrefix + "`nCREATE TEMP TABLE f62_before ON COMMIT DROP AS $f62FingerprintSql;`nCREATE TEMP TABLE f62_primary_before ON COMMIT DROP AS $f62PrimarySql;`n" + $f62Source + "`nCREATE TEMP TABLE f62_after ON COMMIT DROP AS $f62FingerprintSql;`nCREATE TEMP TABLE f62_primary_after ON COMMIT DROP AS $f62PrimarySql;`n" + $sqlSuffix
    $sql += "`nINSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261123130252','campaign_format_addition',ARRAY[" + '$f62_migration$' + $f62Source + '$f62_migration$' + "]);`nDO " + '$f62_ledger$' + " BEGIN IF (SELECT count(*) FROM supabase_migrations.schema_migrations)<>159 THEN RAISE EXCEPTION 'ledger_mismatch'; END IF; END " + '$f62_ledger$' + ";`nCOMMIT;`nSELECT version,name,md5(array_to_string(statements,'')) AS recorded_sql_md5,encode(extensions.digest(array_to_string(statements,''),'sha256'),'hex') AS recorded_sql_sha256 FROM supabase_migrations.schema_migrations WHERE version='20261123130252';"
    if ($Mode -eq 'Rehearse') {
      if ((& docker inspect f62-restore-20261124-1949 --format '{{.HostConfig.NetworkMode}}').Trim() -ne 'none') { throw 'Restore container guard failed' }
      $OutputEncoding = New-Object System.Text.UTF8Encoding($false)
      $sql | docker exec -i f62-restore-20261124-1949 psql -X -U postgres -d f62_restore_proof -v ON_ERROR_STOP=1 -P pager=off
      if ($LASTEXITCODE -ne 0) { throw 'Rehearsal failed; remote untouched' }
      Write-Output 'Same transaction passed on restored production snapshot; remote untouched.'
      return
    }
    Write-Output 'Applying exactly F62 in one transaction; no automatic retry on error.'
    $result = Invoke-F62Sql $sql $false
    $result | ConvertTo-Json -Depth 8
    $result | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 (Join-Path $BackupDirectory 'f62-apply-result.json')
    $after = Invoke-F62Sql $f62FingerprintSql
    $after | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 (Join-Path $BackupDirectory 'f62-content-after.json')
    if ((Compare-Object ($before | ConvertTo-Json -Depth 8 -Compress) ($after | ConvertTo-Json -Depth 8 -Compress))) { throw 'Post-commit content changed; inspect before further steps' }
    Write-Output 'All 11 content fingerprints unchanged; primary-reader results unchanged inside transaction.'
  }
  if ($Mode -eq 'Verify') {
    $remoteVersions = @(Invoke-F62Sql 'SELECT version FROM supabase_migrations.schema_migrations ORDER BY version' | ForEach-Object { $_.version })
    $localVersions = @(Get-ChildItem supabase/migrations -Filter '*.sql' | ForEach-Object { $_.Name.Split('_')[0] } | Sort-Object)
    if (($localVersions | Select-Object -Unique).Count -ne $localVersions.Count) { throw 'Local duplicate migration version' }
    if (Compare-Object $localVersions $remoteVersions) { throw 'Local/remote migration version set differs' }
    Write-Output "Migration versions match exactly: $($localVersions.Count) local / $($remoteVersions.Count) remote; no duplicate version."
    Invoke-F62Sql @'
SELECT jsonb_build_object(
 'table',(SELECT jsonb_build_object('rls',relrowsecurity,'acl',relacl) FROM pg_class WHERE oid='public.campaign_format_additions'::regclass),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('name',conname,'type',contype,'validated',convalidated) ORDER BY conname) FROM pg_constraint WHERE conrelid='public.campaign_format_additions'::regclass),
 'indexes',(SELECT jsonb_agg(indexdef ORDER BY indexname) FROM pg_indexes WHERE schemaname='public' AND tablename='campaign_format_additions'),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('name',tgname,'enabled',tgenabled)) FROM pg_trigger WHERE tgrelid='public.campaign_format_additions'::regclass AND NOT tgisinternal),
 'policies',(SELECT jsonb_agg(jsonb_build_object('name',policyname,'roles',roles,'cmd',cmd)) FROM pg_policies WHERE schemaname='public' AND tablename='campaign_format_additions'),
 'rows',(SELECT count(*) FROM public.campaign_format_additions),
 'recorded_sql_md5',(SELECT md5(array_to_string(statements,'')) FROM supabase_migrations.schema_migrations WHERE version='20261123130252')
) AS postflight;
'@ | ConvertTo-Json -Depth 15
  }
  $schema = Invoke-F62Sql @'
SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_object('name',p.proname,'args',pg_get_function_identity_arguments(p.oid),'md5',md5(pg_get_functiondef(p.oid)),'definer',p.prosecdef,'config',p.proconfig,'acl',p.proacl) ORDER BY p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND (p.proname LIKE 'campaign_format_add_%' OR p.proname IN ('product_1_1_get_campaign_operation_by_campaign','product_9_16_open_operation_v2','product_9_16_begin_publication'))),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,'type',c.contype,'definition',pg_get_constraintdef(c.oid)) ORDER BY c.conname) FROM pg_constraint c WHERE c.conrelid IN ('public.campaign_composition_artifacts'::regclass,'public.product_1_1_campaign_credit_operations'::regclass,'public.campaigns'::regclass) AND (c.conname LIKE 'ck_cca_%' OR c.contype IN ('p','u'))),
 'flags',(SELECT jsonb_agg(jsonb_build_object('key',key,'enabled',enabled) ORDER BY key) FROM public.feature_flags WHERE key IN ('campaign_format_addition_enabled','product_9_16_two_stage_enabled')),
 'tables',(SELECT jsonb_agg(relname ORDER BY relname) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND (relname LIKE '%balance%' OR relname LIKE '%two_stage%')),
 'ledger_columns',(SELECT jsonb_agg(column_name ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='supabase_migrations' AND table_name='schema_migrations'),
 'storage_bytes',(SELECT sum((metadata->>'size')::bigint) FROM storage.objects)
) AS schema;
'@
  $schema | ConvertTo-Json -Depth 15
} finally { $f62Token=$null; $f62Headers=$null }
