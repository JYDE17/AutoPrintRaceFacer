' Lance l'agent notifier en arriere-plan, SANS fenetre (pour les POS clients).
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(scriptDir)

logDir = fso.BuildPath(projectDir, "logs")
If Not fso.FolderExists(logDir) Then fso.CreateFolder(logDir)
logFile = fso.BuildPath(logDir, "notifier.log")

Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = projectDir
' Fenetre cachee (0), on attend (True) -> restart-on-failure possible.
sh.Run "cmd /c node src\notifier.js > """ & logFile & """ 2>&1", 0, True
