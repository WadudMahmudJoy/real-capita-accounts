param(
 [Parameter(Mandatory=$true)][string]$Configuration,
 [Parameter(Mandatory=$true)][string]$WorkerAccount,
 [Parameter(Mandatory=$true)][ValidatePattern('^RealCapita-Private-(Provisioning|Confirmation)$')][string]$TaskName,
 [switch]$Apply,
 [Management.Automation.PSCredential]$ServiceCredential
)
$ErrorActionPreference='Stop'
# Review-only by default. No account, ACL, service or database is changed.
$cfg=Get-Content -LiteralPath $Configuration -Raw | ConvertFrom-Json
$workerSid=([Security.Principal.NTAccount]$WorkerAccount).Translate([Security.Principal.SecurityIdentifier]).Value
$expected=if($cfg.purpose -eq 'confirmation'){$cfg.confirmationSid}else{$cfg.provisioningSid}
if($workerSid -ne $expected -or $workerSid -eq $cfg.apiSid -or $cfg.provisioningSid -eq $cfg.confirmationSid){throw 'Independent existing service identity required'}
$wrapper=Join-Path $cfg.repository 'scripts\db\private-worker.ps1'
foreach($path in @($wrapper,$Configuration)) {if($path.Contains('"') -or -not [IO.Path]::IsPathRooted($path)){throw 'Unsafe deployment path'}}
if(Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue){throw 'Existing task must be reviewed; never overwrite'}
if(-not $Apply){Write-Output 'Review-only: independently authorize service identity, ACLs, DPAPI enrollment and task registration. No changes.';exit 0}
if(-not $ServiceCredential -or $ServiceCredential.UserName -ne $WorkerAccount){throw 'Private service credential is required for the exact designated OS account'}
# Attestation-only startup. There is deliberately no confirmation worker action.
$action=New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Argument "-NoProfile -NonInteractive -File `"$wrapper`" -Configuration `"$Configuration`" -AttestOnly" -WorkingDirectory $cfg.repository
$trigger=New-ScheduledTaskTrigger -AtStartup
$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($ServiceCredential.Password)
try {
 $plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
 Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -User $WorkerAccount -Password $plain -RunLevel Limited | Out-Null
} catch { Write-Error 'Private task registration failed (credential-bearing details suppressed)'; exit 1 } finally {$plain=$null;[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
Write-Output 'Private attestation task registered; confirmation remains unavailable'
