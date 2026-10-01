' Lanceur invisible de l'agent notifier PowerShell (aucune fenetre).
' Appele par la tache planifiee. Arguments : Server, Method, Duration, AppName.
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
ps1 = fso.BuildPath(scriptDir, "notifier.ps1")

server   = "http://10.56.10.226:8787"
method   = "balloon"
duration = "long"
appname  = "Goplex - Resultats"
If WScript.Arguments.Count >= 1 Then server   = WScript.Arguments(0)
If WScript.Arguments.Count >= 2 Then method   = WScript.Arguments(1)
If WScript.Arguments.Count >= 3 Then duration = WScript.Arguments(2)
If WScript.Arguments.Count >= 4 Then appname  = WScript.Arguments(3)

cmd = "powershell -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File """ & ps1 & _
      """ -Server """ & server & """ -Method """ & method & _
      """ -Duration """ & duration & """ -AppName """ & appname & """"

Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = scriptDir
' Fenetre cachee (0), on attend (True) pour permettre le restart-on-failure.
sh.Run cmd, 0, True
