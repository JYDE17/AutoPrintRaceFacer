# Desinstalle la tache planifiee AutoPrint RaceFacer.
$ErrorActionPreference = "SilentlyContinue"
$TaskName = "AutoPrintRaceFacer"
Stop-ScheduledTask -TaskName $TaskName
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "Tache '$TaskName' supprimee (si elle existait)." -ForegroundColor Yellow
