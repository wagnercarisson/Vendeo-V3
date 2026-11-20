param([Parameter(Mandatory=$true)][string]$Directory, [switch]$FinalizeDownloaded)
$ErrorActionPreference='Stop'
$root=(Resolve-Path -LiteralPath $Directory).Path
$manifest=Get-Content -Raw -LiteralPath (Join-Path $root 'manifest.json') | ConvertFrom-Json
if ($manifest.status -notlike 'complete_database_and_storage*' -and !$FinalizeDownloaded) {throw 'Backup has not completed'}
$files=Get-Content -Raw -LiteralPath (Join-Path $root 'storage-files.json') | ConvertFrom-Json
$before=Get-Content -Raw -LiteralPath (Join-Path $root 'storage-before.json') | ConvertFrom-Json
if ($files.Count -ne $before.Count) {throw 'Storage manifest count mismatch'}
$seen=@{}
foreach($entry in $files) {
 if ($seen.ContainsKey($entry.id)) {throw 'Duplicate object in Storage manifest'}
 $seen[$entry.id]=$true
 if ($entry.localFile -notmatch '^storage-objects/[a-fA-F0-9-]{36}\.bin$') {throw 'Unsafe backup path'}
 $path=Join-Path $root $entry.localFile
 if ((Get-Item -LiteralPath $path).Length -ne $entry.bytes) {throw 'Storage size verification failed'}
 if ((Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash -ne $entry.sha256) {throw 'Storage checksum verification failed'}
}
foreach($entry in $before) {if (!$seen.ContainsKey($entry.id)) {throw 'Missing remote object in backup'}}
$after=Get-Content -Raw -LiteralPath (Join-Path $root 'storage-after.json') | ConvertFrom-Json
$beforeJson=ConvertTo-Json -InputObject $before -Depth 100 -Compress
$afterJson=ConvertTo-Json -InputObject $after -Depth 100 -Compress
if ($beforeJson -cne $afterJson) {throw 'Remote Storage inventories differ'}
$dbPath=Join-Path $root 'database.dump'
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $dbPath).Hash -ne $manifest.database.sha256) {throw 'Database checksum verification failed'}
& 'C:\Users\wagne\scoop\apps\postgresql\current\bin\pg_restore.exe' --file NUL $dbPath
if ($LASTEXITCODE -ne 0) {throw 'Full archive read verification failed'}
if ($FinalizeDownloaded) {
 $sha=[Security.Cryptography.SHA256]::Create()
 try {$digest=[BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($beforeJson))).Replace('-','').ToLowerInvariant()} finally {$sha.Dispose()}
 $buckets=Get-Content -Raw -LiteralPath (Join-Path $root 'storage-buckets.json') | ConvertFrom-Json
 $storage=@{buckets=$buckets.Count;objects=$files.Count;bytes=($files | ForEach-Object {[long]$_.bytes} | Measure-Object -Sum).Sum;inventoryBeforeSha256=$digest;inventoryAfterSha256=$digest;inventoryStable=$true;filesHashed=$true}
 $manifest | Add-Member -NotePropertyName storage -NotePropertyValue $storage -Force
 $manifest.status=if ($manifest.rolesExit -eq 0) {'complete_database_and_storage'} else {'complete_database_and_storage_roles_incomplete'}
 $manifest.finishedAt=[DateTime]::UtcNow.ToString('o')
 $manifest.PSObject.Properties.Remove('failure')
 $manifest | Add-Member -NotePropertyName localFinalizationNote -NotePropertyValue 'All downloads and remote after-inventory completed. Fixed local Hashtable byte-total calculation; independently verified every file and archive before finalizing. No remote scenario repeated.' -Force
 $manifest | ConvertTo-Json -Depth 100 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $root 'manifest.json')
}
$verification=[ordered]@{verifiedAt=[DateTime]::UtcNow.ToString('o');databaseHashMatches=$true;databaseArchiveFullyRead=$true;restoreExecuted=$false;storageFiles=$files.Count;storageAllHashesMatch=$true;storageAllSizesMatch=$true;remoteInventoryStable=$manifest.storage.inventoryStable;rolesExit=$manifest.rolesExit}
$verification | ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $root 'verification.json')
$checksumPath=Join-Path $root 'SHA256SUMS.txt'
Get-ChildItem -LiteralPath $root -File | Where-Object {$_.Name -ne 'SHA256SUMS.txt'} | Get-FileHash -Algorithm SHA256 | ForEach-Object {"$($_.Hash)  $([IO.Path]::GetFileName($_.Path))"} | Set-Content -Encoding ASCII -LiteralPath $checksumPath
$verification | ConvertTo-Json
