param([string]$DestinationRoot = 'C:\vendeo-backups')
$ErrorActionPreference = 'Stop'
$projectRef = 'gvbzwihwgzujwsviufgy'
$stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$destination = Join-Path $DestinationRoot "vendeo-v3-$stamp"
New-Item -ItemType Directory -Path $destination -ErrorAction Stop | Out-Null
# Restrict sensitive database/auth backup to the current Windows account and SYSTEM.
$account = [Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $destination /inheritance:r /grant:r "${account}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Cannot restrict backup directory ACL' }
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class BackupCredential {
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct CREDENTIAL {
 public uint Flags; public uint Type; public string TargetName; public string Comment;
 public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
 public uint CredentialBlobSize; public IntPtr CredentialBlob; public uint Persist;
 public uint AttributeCount; public IntPtr Attributes; public string TargetAlias; public string UserName;
 }
 [DllImport("advapi32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CredRead(string target,uint type,uint flags,out IntPtr ptr);
 [DllImport("advapi32.dll")] static extern void CredFree(IntPtr ptr);
 public static string Read(string target) {
 IntPtr ptr; if(!CredRead(target,1,0,out ptr)) return null;
 try { var c=(CREDENTIAL)Marshal.PtrToStructure(ptr,typeof(CREDENTIAL)); byte[] b=new byte[c.CredentialBlobSize]; Marshal.Copy(c.CredentialBlob,b,0,b.Length); return System.Text.Encoding.UTF8.GetString(b); } finally {CredFree(ptr);}
 }
}
'@
$token = [BackupCredential]::Read('Supabase CLI:supabase')
if ($token -notmatch '^sbp_(oauth_)?[a-f0-9]{40}$') { $token = [BackupCredential]::Read('Supabase CLI:access-token') }
if ($token -notmatch '^sbp_(oauth_)?[a-f0-9]{40}$') { throw 'Existing Supabase CLI authentication unavailable' }
$managementHeaders = @{ Authorization = "Bearer $token" }
function Save-Json($Value, [string]$Name) {
 $Value | ConvertTo-Json -Depth 100 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $destination $Name)
}
function Read-Sql([string]$Query) {
 $body = @{query=$Query; read_only=$true} | ConvertTo-Json -Compress
 $rows=Invoke-RestMethod -Method Post -Uri "https://api.supabase.com/v1/projects/$projectRef/database/query" -Headers $managementHeaders -ContentType 'application/json' -Body $body -TimeoutSec 180
 foreach($row in $rows) { Write-Output $row }
}
function Get-StorageInventory {
 return @(Read-Sql 'select id,bucket_id,name,version,created_at,updated_at,metadata from storage.objects order by bucket_id,name')
}
function Get-InventoryDigest($Rows) {
 $json = ConvertTo-Json -InputObject @($Rows) -Depth 100 -Compress
 $sha = [Security.Cryptography.SHA256]::Create()
 try { return [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($json))).Replace('-','').ToLowerInvariant() } finally {$sha.Dispose()}
}
$report = [ordered]@{projectRef=$projectRef; startedAt=[DateTime]::UtcNow.ToString('o'); status='running'; directory=$destination; limitations=@('Logical backup, not physical/PITR','No restore rehearsal','Database and Storage do not share an atomic snapshot','Remote project configuration and external providers are not a database dump')}
Save-Json $report 'manifest.json'
try {
 Write-Output "Backup directory: $destination"
 $identity = Read-Sql 'select current_database() as database, current_setting(''server_version'') as server_version, current_user as reader'
 Save-Json $identity 'database-identity.json'
 $buckets = @(Read-Sql 'select * from storage.buckets order by id')
 $before = @(Get-StorageInventory)
 Save-Json $buckets 'storage-buckets.json'
 Save-Json $before 'storage-before.json'
 Write-Output "Storage inventory: $($buckets.Count) buckets, $($before.Count) objects"
 # Official CLI backup role; read-only profile cannot access auth. All libpq sessions
 # below explicitly default to READ ONLY; no grants/password resets/business writes.
 $login = Invoke-RestMethod -Method Post -Uri "https://api.supabase.com/v1/projects/$projectRef/cli/login-role" -Headers $managementHeaders -ContentType 'application/json' -Body '{"read_only":false}' -TimeoutSec 60
 if (!$login.role -or !$login.password) { throw 'Temporary read-only login not returned' }
 $pooler = [Uri](Get-Content -Raw -LiteralPath 'supabase/.temp/pooler-url').Trim()
 if ($pooler.Host -ne 'aws-1-sa-east-1.pooler.supabase.com' -or $pooler.Port -ne 5432) {throw 'Unexpected pooler target'}
 $oldEnv = @{}
 foreach($key in @('PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGSSLMODE','PGCONNECT_TIMEOUT','PGOPTIONS')) { $oldEnv[$key]=[Environment]::GetEnvironmentVariable($key,'Process') }
 try {
 $env:PGHOST=$pooler.Host; $env:PGPORT='5432'; $env:PGUSER="$($login.role).$projectRef"; $env:PGPASSWORD=$login.password
 $env:PGDATABASE='postgres'; $env:PGSSLMODE='require'; $env:PGCONNECT_TIMEOUT='30'; $env:PGOPTIONS='-c default_transaction_read_only=on'
 $pgBin = 'C:\Users\wagne\scoop\apps\postgresql\current\bin'
 # The session pooler caches temporary login credentials; allow bounded propagation.
 $connected=$false
 foreach($delay in @(2,5,10)) {
  Start-Sleep -Seconds $delay
  $ErrorActionPreference='Continue'
  $ping=& "$pgBin\psql.exe" --no-password -X -A -t -c 'select 1' 2> (Join-Path $destination 'connection-check.log')
  $pingExit=$LASTEXITCODE
  $ErrorActionPreference='Stop'
  if ($pingExit -eq 0 -and "$ping".Trim() -eq '1') {$connected=$true;break}
 }
 if (!$connected) {throw 'Temporary login did not become available after bounded pooler propagation checks'}
 Write-Output 'Downloading consistent logical database archive (pg_dump)...'
 $ErrorActionPreference='Continue'
 & "$pgBin\pg_dump.exe" --no-password --role postgres --format=custom --verbose --file (Join-Path $destination 'database.dump') 2> (Join-Path $destination 'pg-dump.log')
 $dumpExit = $LASTEXITCODE
 $ErrorActionPreference='Stop'
 if ($dumpExit -ne 0) { throw "pg_dump failed (exit $dumpExit); inspect private pg-dump.log" }
 $ErrorActionPreference='Continue'
 & "$pgBin\pg_restore.exe" --list (Join-Path $destination 'database.dump') 1> (Join-Path $destination 'archive-list.txt') 2> (Join-Path $destination 'pg-restore-list.log')
 $restoreExit=$LASTEXITCODE
 $ErrorActionPreference='Stop'
 if ($restoreExit -ne 0) {throw 'Archive list validation failed'}
 $ErrorActionPreference='Continue'
 & "$pgBin\pg_dumpall.exe" --no-password --role postgres --roles-only --no-role-passwords --file (Join-Path $destination 'roles.sql') 2> (Join-Path $destination 'roles.log')
 $report.rolesExit=$LASTEXITCODE
 $ErrorActionPreference='Stop'
 $report.database = @{file='database.dump'; bytes=(Get-Item -LiteralPath (Join-Path $destination 'database.dump')).Length; sha256=(Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $destination 'database.dump')).Hash; archiveListValidated=$true; rolesPasswordHashesExcluded=$true}
 } finally {
 foreach($key in $oldEnv.Keys) { [Environment]::SetEnvironmentVariable($key,$oldEnv[$key],'Process') }
 $login=$null
 }
 Write-Output "Database saved: $($report.database.bytes) bytes. Downloading Storage..."
 $remoteEnv=@{}
 foreach($line in Get-Content -LiteralPath '.env.local.remote.bak') {if($line -match '^\s*(SUPABASE_URL|NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)\s*=\s*(.*)$') {$remoteEnv[$matches[1]]=$matches[2].Trim().Trim('"').Trim("'")}}
 $apiUrl=$remoteEnv['SUPABASE_URL']
 if (!$apiUrl) {$apiUrl=$remoteEnv['NEXT_PUBLIC_SUPABASE_URL']}
 if ($apiUrl.TrimEnd('/') -ne "https://$projectRef.supabase.co") {throw 'Storage API target mismatch'}
 $serviceKey=$remoteEnv['SUPABASE_SERVICE_ROLE_KEY']
 if (!$serviceKey) {throw 'Existing Storage credentials unavailable'}
 $storageHeaders=@{Authorization="Bearer $serviceKey";apikey=$serviceKey}
 $objectsDir=Join-Path $destination 'storage-objects'
 New-Item -ItemType Directory -Path $objectsDir | Out-Null
 $manifest=[Collections.Generic.List[object]]::new()
 $index=0
 foreach($obj in $before) {
  if ($obj.id -notmatch '^[a-fA-F0-9-]{36}$') {throw 'Invalid Storage object ID'}
  $encodedBucket=[Uri]::EscapeDataString([string]$obj.bucket_id)
  $encodedName=(($obj.name -split '/') | ForEach-Object {[Uri]::EscapeDataString($_)}) -join '/'
  $localName="$($obj.id).bin"
  $file=Join-Path $objectsDir $localName
  Invoke-WebRequest -UseBasicParsing -Uri "$apiUrl/storage/v1/object/$encodedBucket/$encodedName" -Headers $storageHeaders -OutFile $file -TimeoutSec 180
  $size=(Get-Item -LiteralPath $file).Length
  if ($null -ne $obj.metadata.size -and $size -ne [long]$obj.metadata.size) {throw "Storage byte count mismatch: $($obj.id)"}
  $manifest.Add(@{id=$obj.id;bucket=$obj.bucket_id;name=$obj.name;localFile="storage-objects/$localName";bytes=$size;sha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $file).Hash;remoteMetadata=$obj.metadata;remoteVersion=$obj.version})
  $index++
  if ($index % 25 -eq 0) {Write-Output "Storage: $index / $($before.Count) objects"; Save-Json @($manifest.ToArray()) 'storage-files.json'}
 }
 Save-Json @($manifest.ToArray()) 'storage-files.json'
 $after=@(Get-StorageInventory)
 Save-Json $after 'storage-after.json'
 $beforeHash=Get-InventoryDigest $before
 $afterHash=Get-InventoryDigest $after
 $report.storage=@{buckets=$buckets.Count;objects=$manifest.Count;bytes=($manifest | ForEach-Object {[long]$_.bytes} | Measure-Object -Sum).Sum;inventoryBeforeSha256=$beforeHash;inventoryAfterSha256=$afterHash;inventoryStable=($beforeHash -eq $afterHash);filesHashed=$true}
 if ($beforeHash -ne $afterHash) {throw 'Storage changed during backup; files retained but snapshot not complete/stable'}
 if ($report.rolesExit -ne 0) { $report.status='complete_database_and_storage_roles_incomplete' } else {$report.status='complete_database_and_storage'}
 $report.finishedAt=[DateTime]::UtcNow.ToString('o')
 Save-Json $report 'manifest.json'
 Get-ChildItem -LiteralPath $destination -File | Where-Object {$_.Name -ne 'SHA256SUMS.txt'} | Get-FileHash -Algorithm SHA256 | ForEach-Object {"$($_.Hash)  $([IO.Path]::GetFileName($_.Path))"} | Set-Content -Encoding ASCII -LiteralPath (Join-Path $destination 'SHA256SUMS.txt')
 & (Join-Path $PSScriptRoot 'verify-supabase-backup.ps1') -Directory $destination
 Write-Output ($report | ConvertTo-Json -Depth 10)
} catch {
 $report.status='incomplete'; $report.finishedAt=[DateTime]::UtcNow.ToString('o'); $report.failure=$_.Exception.Message
 Save-Json $report 'manifest.json'
 Write-Output "Backup incomplete; private logs and manifest retained at $destination"
 throw
}
