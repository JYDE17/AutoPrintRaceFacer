@echo off
REM ============================================================
REM  Installe l'agent de notifications Goplex sur ce POS.
REM  Double-clique ce fichier. Il :
REM   1) demande les droits admin
REM   2) copie l'agent dans %LOCALAPPDATA%\GoplexNotifier
REM   3) installe la tache planifiee (bulle bas-droite, invisible, au boot)
REM  Place ce .bat dans le MEME dossier que :
REM   notifier.ps1 , notifier-ps.vbs , install-notifier-ps.ps1
REM ============================================================

REM --- A MODIFIER SI BESOIN ---
set "SERVER=http://10.56.10.226:8787"
set "METHOD=balloon"
set "APPNAME=Goplex - Resultats"
set "DURATION=long"
REM ----------------------------

REM --- Auto-elevation en admin ---
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Demande des droits administrateur...
  powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

setlocal
set "SRC=%~dp0"
set "DST=%LOCALAPPDATA%\GoplexNotifier"

echo.
echo Installation de l'agent de notifications Goplex
echo   Serveur : %SERVER%
echo   Dossier : %DST%
echo.

if not exist "%DST%" mkdir "%DST%"

REM --- Copie des fichiers necessaires ---
copy /Y "%SRC%notifier.ps1"            "%DST%\" >nul
copy /Y "%SRC%notifier-ps.vbs"         "%DST%\" >nul
copy /Y "%SRC%install-notifier-ps.ps1" "%DST%\" >nul

if not exist "%DST%\notifier.ps1" (
  echo ERREUR : notifier.ps1 introuvable a cote de ce .bat.
  echo Place ce fichier dans le dossier "scripts" du projet.
  pause
  exit /b 1
)

REM --- Installe la tache planifiee depuis le dossier stable ---
powershell -ExecutionPolicy Bypass -File "%DST%\install-notifier-ps.ps1" -Server "%SERVER%" -Method "%METHOD%" -Duration "%DURATION%" -AppName "%APPNAME%"

echo.
echo Termine. L'agent demarre maintenant et a chaque ouverture de session.
echo Teste depuis POS4 :  npm run alert -- "Test" "coucou"
echo.
pause
