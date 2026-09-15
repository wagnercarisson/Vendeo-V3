param(
  [switch]$Bootstrap
)

$status = & npx supabase status -o env 2>$null
$envMap = @{}
foreach ($line in $status) {
  if ($line -match '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY|DB_URL)="([^"]+)"$') { $envMap[$Matches[1]] = $Matches[2] }
}
if ($envMap.API_URL -notmatch '^https?://(localhost|127\.0\.0\.1)(:\d+)?$') { throw "Refusing non-local API_URL: $($envMap.API_URL)" }
if ($envMap.DB_URL -notmatch '^postgresql://.*@(localhost|127\.0\.0\.1)(:\d+)?/') { throw "Refusing non-local DB_URL: $($envMap.DB_URL)" }

$env:NEXT_PUBLIC_SUPABASE_URL = $envMap.API_URL
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = $envMap.ANON_KEY
$env:SUPABASE_SERVICE_ROLE_KEY = $envMap.SERVICE_ROLE_KEY
$env:NEXT_PUBLIC_TURNSTILE_SITE_KEY = ""

Write-Host "Starting Vendeo against LOCAL Supabase only: $($envMap.API_URL)"
Write-Host "Turnstile disabled for local UAT; use scripts/uat/47-local-bootstrap.mjs to create an admin."
if ($Bootstrap) { node scripts/uat/47-local-bootstrap.mjs }
npm run dev
