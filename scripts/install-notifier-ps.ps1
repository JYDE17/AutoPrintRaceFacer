# Installe l'agent notifier PowerShell (SANS Node) comme tache planifiee.
# A lancer sur un POS CLIENT. Demarre a l'ouverture de session, en arriere-plan,
# se relance seul.
#
# Usage :
#   powershell -ExecutionPolicy Bypass -File install-notifier-ps.ps1 -Server http://10.56.10.226:8787
#   (options : -Duration long|court|persistant  -AppName "Goplex - Resultats")
param(
  [string]$Server = "http://10.56.10.226:8787",
  [string]$Duration = "long",
  [string]$AppName = "Goplex - Resultats",
  [string]$Method = "balloon"   # balloon (bas-droite) | msgbox
)

$ErrorActionPreference = "Stop"
$TaskName = "AutoPrintRaceFacerNotifier"
$ps1 = Join-Path $PSScriptRoot "notifier.ps1"
if (-not (Test-Path $ps1)) { throw "Introuvable : $ps1" }

$argline = "-ExecutionPolicy Bypass -WindowStyle Hidden -NoProfile -File `"$ps1`" " +
  "-Server `"$Server`" -Duration `"$Duration`" -AppName `"$AppName`" -Method `"$Method`""

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argline
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -RestartCount 9999 `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
  -Settings $settings -Principal $principal `
  -Description "Recoit et affiche les notifications RaceFacer depuis POS4 (sans Node)." `
  -Force | Out-Null

Start-ScheduledTask -TaskName $TaskName

Write-Host ""
Write-Host "OK - Notifier PowerShell installe et demarre sur ce POS." -ForegroundColor Green
Write-Host "Serveur POS4 : $Server  |  Duree toast : $Duration"
Write-Host "Pour desinstaller : Unregister-ScheduledTask -TaskName $TaskName -Confirm:`$false"
