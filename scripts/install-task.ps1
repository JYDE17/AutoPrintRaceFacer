# Installe AutoPrint RaceFacer comme tache planifiee Windows :
#   - demarre automatiquement a l'ouverture de session (au boot si session auto)
#   - tourne en arriere-plan, aucune fenetre
#   - se relance tout seul s'il s'arrete
# A lancer UNE fois (clic droit "Executer avec PowerShell", ou `npm run service:install`).

$ErrorActionPreference = "Stop"
$TaskName = "AutoPrintRaceFacer"
$projectDir = Split-Path -Parent $PSScriptRoot
$vbs = Join-Path $PSScriptRoot "start.vbs"

if (-not (Test-Path $vbs)) { throw "Introuvable : $vbs" }

# Action : lance le VBS (qui lance node cache) via wscript.
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbs`"" -WorkingDirectory $projectDir

# Declencheur : a l'ouverture de session de l'utilisateur courant.
$trigger = New-ScheduledTaskTrigger -AtLogOn

# Reglages : relance en cas d'echec, pas de limite de duree, demarre des que possible.
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -RestartCount 9999 `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -MultipleInstances IgnoreNew

# S'execute sous l'utilisateur courant, uniquement quand il est connecte
# (necessaire pour voir l'imprimante par defaut de la session).
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
  -Settings $settings -Principal $principal `
  -Description "Impression automatique des resultats RaceFacer (race_heat) a la fin de chaque heat." `
  -Force | Out-Null

Write-Host ""
Write-Host "OK - Tache '$TaskName' installee." -ForegroundColor Green
Write-Host "Le service demarrera automatiquement a chaque ouverture de session."
Write-Host "Pour le lancer tout de suite sans redemarrer :" -ForegroundColor Cyan
Write-Host "    Start-ScheduledTask -TaskName $TaskName"
Write-Host "Logs : $projectDir\logs\service.log"
