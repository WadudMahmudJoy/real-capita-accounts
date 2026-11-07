$ErrorActionPreference='Stop'
$source=Join-Path $PSScriptRoot 'db/authority-onboarding-worker.ps1'
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($source,[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Wrapper parse failure'}
$fn=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-PrivatePowerShellPath'},$true)
if(-not $fn){throw 'Missing trusted OS path validation function'}
. ([scriptblock]::Create($fn.Extent.Text))
$trusted='C:\Windows\System32'
if((Get-PrivatePowerShellPath $trusted 'C:\Windows') -ne 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'){throw 'Wrong pinned PowerShell path'}
foreach($bad in @('C:\Untrusted','relative','')){ $denied=$false;try{Get-PrivatePowerShellPath $trusted $bad | Out-Null}catch{$denied=$true};if(-not $denied){throw 'Untrusted SystemRoot accepted'} }
$guard=$ast.Find({param($node) $node -is [Management.Automation.Language.ForEachStatementAst] -and $node.Extent.Text.Contains("'NODE_OPTIONS'")},$true)
if(-not $guard -or -not $guard.Extent.Text.Contains("'ESBUILD_BINARY_PATH'")){throw 'Missing pre-decode executable override rejection'}
$decode=$ast.Find({param($node) $node -is [Management.Automation.Language.CommandAst] -and $node.GetCommandName() -eq 'Import-Clixml'},$true)
if($guard.Extent.StartOffset -ge $decode.Extent.StartOffset){throw 'Executable override check occurs after DPAPI decode'}
$prior=$env:ESBUILD_BINARY_PATH
try{$env:ESBUILD_BINARY_PATH='C:\synthetic-only\transformer.exe';$denied=$false;try{& ([scriptblock]::Create($guard.Extent.Text))}catch{$denied=$true};if(-not $denied){throw 'Transformer override accepted'}}finally{$env:ESBUILD_BINARY_PATH=$prior}
Write-Output 'PASS pure wrapper fixtures: trusted OS PowerShell path; substituted/missing SystemRoot rejected; ESBUILD override rejected before DPAPI decode; no enrollment or credentials.'
$ErrorActionPreference='Stop'
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($source,[ref]$tokens,[ref]$errors)
$fn=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-PrivateExecutableAllowedSids'},$true)
. ([scriptblock]::Create($fn.Extent.Text))
$private=@('synthetic-executor','synthetic-system','synthetic-admin')
$os='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
$osAllowed=@(Get-PrivateExecutableAllowedSids $os $os $private 'synthetic-ti')
if('synthetic-ti' -notin $osAllowed){throw 'Pinned OS owner rejected'}
foreach($path in @('C:\private\config.json','C:\release\node.exe','C:\release\tsx.cjs')){if('synthetic-ti' -in @(Get-PrivateExecutableAllowedSids $path $os $private 'synthetic-ti')){throw 'TI owner exception escaped pinned OS package'}}
if('synthetic-ti' -in $private){throw 'Private ACL policy broadened'}
$privateGuard=$ast.Find({param($node) $node -is [Management.Automation.Language.IfStatementAst] -and $node.Extent.Text.Contains("throw 'Private path owner denied'")},$true)
if(-not $privateGuard -or -not $privateGuard.Extent.Text.Contains('$ownerSid -notin $allowed')){throw 'Private owner policy changed'}
Write-Output 'PASS pure owner policy: TrustedInstaller allowed for pinned OS PowerShell ancestors only; node/tsx/private configuration policy unchanged.'
