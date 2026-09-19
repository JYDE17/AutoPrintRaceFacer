' Lance le service AutoPrint RaceFacer en arriere-plan, SANS aucune fenetre.
' Utilise par la tache planifiee. Bloque tant que node tourne pour que le
' planificateur puisse le relancer si le processus s'arrete.
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(scriptDir)

logDir = fso.BuildPath(projectDir, "logs")
If Not fso.FolderExists(logDir) Then fso.CreateFolder(logDir)
logFile = fso.BuildPath(logDir, "service.log")

Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = projectDir
' Fenetre cachee (0), on attend la fin (True) -> restart-on-failure possible.
' ">" (et non ">>") : le log est REMIS A ZERO a chaque demarrage -> le fichier
' ne grossit pas indefiniment sur le disque.
sh.Run "cmd /c node src\index.js > """ & logFile & """ 2>&1", 0, True
