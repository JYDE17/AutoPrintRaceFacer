# Desinstalle la tache planifiee de l'agent notifier.
$ErrorActionPreference = "SilentlyContinue"
$TaskName = "AutoPrintRaceFacerNotifier"
Stop-ScheduledTask -TaskName $TaskName
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "Tache '$TaskName' supprimee (si elle existait)." -ForegroundColor Yellow
