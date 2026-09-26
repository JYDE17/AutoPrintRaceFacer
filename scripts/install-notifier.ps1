# Installe l'agent notifier comme tache planifiee sur un POS CLIENT
# (chaque POS qui doit recevoir les notifications de POS4).
#   - demarre a l'ouverture de session, en arriere-plan, se relance seul.
# A lancer UNE fois sur chaque POS client (`npm run notifier:install`).
# Prerequis : POS4_URL renseigne dans .env (URL du serveur de POS4).

$ErrorActionPreference = "Stop"
$TaskName = "AutoPrintRaceFacerNotifier"
$projectDir = Split-Path -Parent $PSScriptRoot
$vbs = Join-Path $PSScriptRoot "notifier.vbs"

if (-not (Test-Path $vbs)) { throw "Introuvable : $vbs" }

$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbs`"" -WorkingDirectory $projectDir
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
  -Description "Recoit et affiche les notifications RaceFacer depuis POS4." `
  -Force | Out-Null

Write-Host ""
Write-Host "OK - Agent notifier installe sur ce POS." -ForegroundColor Green
Write-Host "Il se connectera a POS4 et affichera les toasts. Demarrer tout de suite :" -ForegroundColor Cyan
Write-Host "    Start-ScheduledTask -TaskName $TaskName"
Write-Host "Logs : $projectDir\logs\notifier.log"
