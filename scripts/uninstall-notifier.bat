@echo off
REM Desinstalle l'agent de notifications Goplex sur ce POS.
net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
echo Suppression de la tache de notifications...
schtasks /End /TN "AutoPrintRaceFacerNotifier" >nul 2>&1
schtasks /Delete /TN "AutoPrintRaceFacerNotifier" /F >nul 2>&1
echo Termine.
pause
