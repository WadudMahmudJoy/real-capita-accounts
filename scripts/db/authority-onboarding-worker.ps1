param([Parameter(Mandatory=$true)][string]$Configuration,[switch]$ProvisionCredential)
$ErrorActionPreference='Stop'
try {
  $cfg=Get-Content -LiteralPath $Configuration -Raw | ConvertFrom-Json
  $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  if($cfg.apiSid -notmatch '^S-1-5-' -or $cfg.executorSid -notmatch '^S-1-5-' -or $cfg.apiSid -eq $cfg.executorSid -or $sid -ne $cfg.executorSid){throw 'Distinct private identity required'}
  $root=[IO.Path]::GetFullPath($cfg.repository)
  $secret=[IO.Path]::GetFullPath($cfg.credentialFile)
  $allowed=@($cfg.executorSid,'S-1-5-18','S-1-5-32-544')
  $privatePaths=@($Configuration,$secret,$cfg.serverKeyFile,$cfg.serverCertFile,$cfg.clientCaFile)
  if($cfg.collector){$privatePaths+=@($cfg.collector.keyFile,$cfg.collector.certFile,$cfg.collector.caFile)}
  foreach($candidate in $privatePaths){
    $path=[IO.Path]::GetFullPath($candidate)
    if($path.StartsWith($root.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Private configuration must stay outside Git'}
    if(-not (Test-Path -LiteralPath $path)){if($path -ne $secret -or -not $ProvisionCredential){throw 'Private path missing'};$path=Split-Path -Parent $secret}
    foreach($aclPath in @($path,(Split-Path -Parent $path))){
      $acl=Get-Acl -LiteralPath $aclPath
      $ownerSid=if($acl.Owner -match '^S-1-'){$acl.Owner}else{([Security.Principal.NTAccount]$acl.Owner).Translate([Security.Principal.SecurityIdentifier]).Value}
      if($ownerSid -notin $allowed){throw 'Private path owner denied'}
      foreach($ace in $acl.Access){$aceSid=$ace.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value;if($ace.AccessControlType -eq 'Allow' -and $aceSid -notin $allowed){throw 'Private path ACL denied'}}
      $ancestor=Get-Item -LiteralPath $aclPath
      while($ancestor){if($ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Reparse paths denied'};$ancestor=if($ancestor -is [IO.DirectoryInfo]){$ancestor.Parent}else{$ancestor.Directory}}
    }
  }
  if($cfg.databaseRole -notmatch '^[a-z_][a-z0-9_]{2,62}$'){throw 'Private role required'}
  # A separate SID is ineffective if the ordinary API can replace its executable
  # package. Deploy an independently owned immutable release, not a writable
  # development checkout; never resolve privileged executables through PATH.
  if(-not [IO.Path]::IsPathRooted($cfg.nodeExecutable) -or -not [IO.Path]::IsPathRooted($cfg.tsxCliFile)){throw 'Pinned absolute executables required'}
  $releaseItems=@((Get-Item -LiteralPath $root),(Get-Item -LiteralPath $cfg.nodeExecutable),(Get-Item -LiteralPath $cfg.tsxCliFile)) + @(Get-ChildItem -LiteralPath $root -Recurse -Force)
  $writeMask=[Security.AccessControl.FileSystemRights]::Write -bor [Security.AccessControl.FileSystemRights]::Delete -bor [Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles -bor [Security.AccessControl.FileSystemRights]::ChangePermissions -bor [Security.AccessControl.FileSystemRights]::TakeOwnership
  foreach($releaseItem in $releaseItems){
    $ancestor=$releaseItem
    while($ancestor){
      if($ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Executable reparse paths denied'}
      $acl=Get-Acl -LiteralPath $ancestor.FullName
      $ownerSid=if($acl.Owner -match '^S-1-'){$acl.Owner}else{([Security.Principal.NTAccount]$acl.Owner).Translate([Security.Principal.SecurityIdentifier]).Value}
      if($ownerSid -notin $allowed){throw 'Executable package owner denied'}
      foreach($ace in $acl.Access){$aceSid=$ace.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value;if($ace.AccessControlType -eq 'Allow' -and $aceSid -notin $allowed -and ($ace.FileSystemRights -band $writeMask)){throw 'Executable package mutable by unrelated identity'}}
      $ancestor=if($ancestor -is [IO.DirectoryInfo]){$ancestor.Parent}else{$ancestor.Directory}
    }
  }
  foreach($name in @('PRIVATE_ONBOARDING_SECRET','DATABASE_URL','DATABASE_ADMIN_URL','MIGRATION_DATABASE_URL','RUNTIME_DATABASE_URL','PRIVATE_WORKER_DATABASE_URL','DB_MIGRATION_SECRET','DB_FINANCE_SECRET','DB_CONFIRMATION_SECRET')){if([Environment]::GetEnvironmentVariable($name,'Process')){throw 'Unexpected credentials in worker environment'}}
  foreach($name in @('NODE_OPTIONS','NODE_PATH')){if([Environment]::GetEnvironmentVariable($name,'Process')){throw 'Node executable injection configuration denied'}}
  if($ProvisionCredential){if(Test-Path -LiteralPath $secret){throw 'Existing credential cannot be replaced'};$value=Read-Host 'Private JSON: databaseUrl and resendApiKey (input suppressed)' -AsSecureString;$value | Export-Clixml -LiteralPath $secret;Write-Output 'Private DPAPI configuration stored; values suppressed';exit 0}
  $secure=Import-Clixml -LiteralPath $secret
  if($secure -isnot [Security.SecureString]){throw 'Expected DPAPI credential'}
  $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try{$env:PRIVATE_ONBOARDING_SECRET=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
  $env:PRIVATE_ONBOARDING_CONFIGURATION=[IO.Path]::GetFullPath($Configuration)
  Push-Location -LiteralPath $root
  try{& $cfg.nodeExecutable $cfg.tsxCliFile --tsconfig apps/api/tsconfig.json apps/api/src/onboarding/private/host.ts;if($LASTEXITCODE -ne 0){throw 'Private broker refused'}}finally{Pop-Location}
} catch {Write-Error 'Private onboarding worker refused: identity, ACL, configuration or startup gate failed (details suppressed).';exit 1}
finally {Remove-Item Env:PRIVATE_ONBOARDING_SECRET -ErrorAction SilentlyContinue;Remove-Item Env:PRIVATE_ONBOARDING_CONFIGURATION -ErrorAction SilentlyContinue}
