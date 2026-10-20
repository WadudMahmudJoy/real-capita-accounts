param(
  [Parameter(Mandatory=$true)][string]$Configuration,
  [switch]$ProvisionCredential,
  [switch]$AttestOnly
)
$ErrorActionPreference='Stop'
try {
  $cfg=Get-Content -LiteralPath $Configuration -Raw | ConvertFrom-Json
  $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $identities=@($cfg.apiSid,$cfg.provisioningSid,$cfg.confirmationSid)
  if (($identities | Select-Object -Unique).Count -ne 3 -or ($identities | Where-Object {$_ -notmatch '^S-1-5-'})) { throw 'Distinct explicit Windows identities required' }
  if ($cfg.purpose -notin @('provisioning','confirmation')) { throw 'Invalid private purpose' }
  $expected=if($cfg.purpose -eq 'confirmation'){$cfg.confirmationSid}else{$cfg.provisioningSid}
  if ($sid -ne $expected) { throw 'Effective worker Windows identity mismatch' }
  $root=[IO.Path]::GetFullPath($cfg.repository)
  $secret=[IO.Path]::GetFullPath($cfg.credentialFile)
  if ($secret.StartsWith($root.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Private credentials must be outside Git' }
  if ($cfg.database -ne 'real_capita_accounts_salary_dev' -or $cfg.hostName -ne 'localhost' -or $cfg.port -ne 55532) { throw 'Explicit salary-dev target required' }
  if ($cfg.databaseRole -notmatch '^[a-z_][a-z0-9_]{2,62}$') { throw 'Explicit scoped database role required' }
  # Administrators/SYSTEM remain an explicit OS administrative trust boundary.
  $allowed=@($expected,'S-1-5-18','S-1-5-32-544')
  foreach($aclPath in @($Configuration,(Split-Path -Parent $secret),$(if(Test-Path -LiteralPath $secret){$secret}else{Split-Path -Parent $secret}))) {
    $acl=Get-Acl -LiteralPath $aclPath
    if ($acl.Owner -match '^S-1-') {$ownerSid=$acl.Owner} else {$ownerSid=([Security.Principal.NTAccount]$acl.Owner).Translate([Security.Principal.SecurityIdentifier]).Value}
    if ($ownerSid -notin $allowed) { throw 'Private credential/configuration has an unrelated owner' }
    foreach($ace in $acl.Access) {
      $aceSid=$ace.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
      if ($ace.AccessControlType -eq 'Allow' -and $aceSid -notin $allowed) { throw 'Private credential/configuration ACL permits an unrelated identity' }
    }
    $ancestor=Get-Item -LiteralPath $aclPath
    while($ancestor) {
      if($ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Reparse paths are not accepted for private credentials/configuration'}
      $ancestor=if($ancestor -is [IO.DirectoryInfo]){$ancestor.Parent}else{$ancestor.Directory}
    }
  }
  if ($ProvisionCredential) {
    if (Test-Path -LiteralPath $secret) { throw 'Never overwrite an existing credential' }
    # Run interactively AS the designated worker. DPAPI binds ciphertext to that SID.
    $value=Read-Host 'Private scoped PostgreSQL connection URL' -AsSecureString
    $value | Export-Clixml -LiteralPath $secret
    Write-Output 'PASS private worker DPAPI credential stored; value suppressed'
    exit 0
  }
  # A polluted worker environment is rejected, not silently used or repaired.
  foreach($name in @('PRIVATE_WORKER_DATABASE_URL','DB_CONFIRMATION_SECRET','DB_FINANCE_SECRET','DB_MIGRATION_SECRET','DATABASE_URL','DATABASE_ADMIN_URL','MIGRATION_DATABASE_URL','MIGRATION_SHADOW_DATABASE_URL','RUNTIME_DATABASE_URL','FINANCE_PROVISIONING_DATABASE_URL','CONFIRMATION_DATABASE_URL')) {
    if ([Environment]::GetEnvironmentVariable($name,'Process')) { throw 'Unexpected connection credentials in private worker environment' }
  }
  $secure=Import-Clixml -LiteralPath $secret
  if ($secure -isnot [Security.SecureString]) { throw 'Expected DPAPI SecureString credential' }
  $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $env:PRIVATE_WORKER_DATABASE_URL=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  $env:PRIVATE_WORKER_EXPECTED_SID=$expected
  $env:PRIVATE_WORKER_API_SID=$cfg.apiSid
  $env:PRIVATE_WORKER_ROLE=$cfg.databaseRole
  $env:PRIVATE_WORKER_PURPOSE=$cfg.purpose
  Push-Location -LiteralPath $root
  try {
    & pnpm.cmd exec tsx --tsconfig apps/api/tsconfig.json scripts/db/private-worker-attestation.ts
    if ($LASTEXITCODE -ne 0) { throw 'Private database attestation failed' }
  } finally { Pop-Location }
  if (-not $AttestOnly) { throw '503: no approved external evidence adapter or enabled private worker host; activation refused' }
} catch {
  # Never emit exception details: they can contain connection strings/passwords.
  Write-Error 'Private worker refused: identity, ACL, configuration, database privileges or evidence authority gate failed (details suppressed).'
  exit 1
} finally {
  Remove-Item Env:PRIVATE_WORKER_DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:PRIVATE_WORKER_EXPECTED_SID -ErrorAction SilentlyContinue
  Remove-Item Env:PRIVATE_WORKER_API_SID -ErrorAction SilentlyContinue
  Remove-Item Env:PRIVATE_WORKER_ROLE -ErrorAction SilentlyContinue
  Remove-Item Env:PRIVATE_WORKER_PURPOSE -ErrorAction SilentlyContinue
}
