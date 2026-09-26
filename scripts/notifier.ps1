# Agent notifier 100% PowerShell (aucun Node/npm requis).
# A lancer sur un POS CLIENT : se connecte au serveur de POS4 et affiche un
# toast Windows pour chaque alerte. Se reconnecte tout seul.
#
# Usage :
#   powershell -ExecutionPolicy Bypass -File notifier.ps1 -Server http://10.56.10.226:8787
#
param(
  [string]$Server = "http://10.56.10.226:8787",
  [string]$AppName = "Goplex - Resultats",
  [string]$Duration = "long"   # court | long | persistant
)

Add-Type -AssemblyName System.Net.Http | Out-Null

function Convert-Xml([string]$s) {
  if ($null -eq $s) { return "" }
  return ($s -replace '&', '&amp;' -replace '<', '&lt;' -replace '>', '&gt;')
}

function Show-Toast([string]$title, [string]$body) {
  try {
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType = WindowsRuntime] | Out-Null

    $attrs = ' duration="long"'
    $actions = ''
    if ($Duration -eq 'court' -or $Duration -eq 'short') { $attrs = '' }
    elseif ($Duration -eq 'persistant' -or $Duration -eq 'persistent') {
      $attrs = ' scenario="reminder"'
      $actions = '<actions><action content="Fermer" arguments="dismiss" activationType="system"/></actions>'
    }

    $xml = "<toast$attrs><visual><binding template=""ToastGeneric""><text>$(Convert-Xml $AppName)</text><text>$(Convert-Xml $title)</text><text>$(Convert-Xml $body)</text></binding></visual>$actions</toast>"
    $doc = [Windows.Data.Xml.Dom.XmlDocument]::new()
    $doc.LoadXml($xml)
    $toast = [Windows.UI.Notifications.ToastNotification]::new($doc)
    $appId = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe'
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show($toast)
  }
  catch { }
}

$seen = New-Object System.Collections.Generic.HashSet[string]

Write-Host "Agent notifier demarre. Serveur POS4 : $Server"
while ($true) {
  try {
    $client = [System.Net.Http.HttpClient]::new()
    $client.Timeout = [TimeSpan]::FromMilliseconds(-1)  # streaming : pas de timeout
    $stream = $client.GetStreamAsync("$Server/events").GetAwaiter().GetResult()
    $reader = [System.IO.StreamReader]::new($stream)
    Write-Host "Connecte a POS4. En attente des alertes..."
    while ($null -ne ($line = $reader.ReadLine())) {
      if ($line.StartsWith("data:")) {
        $json = $line.Substring(5).Trim()
        if ($json.Length -gt 0) {
          try {
            $a = $json | ConvertFrom-Json
            if ($a.id -and $seen.Contains([string]$a.id)) { continue }
            if ($a.id) { [void]$seen.Add([string]$a.id) }
            Show-Toast $a.title $a.body
          }
          catch { }
        }
      }
    }
  }
  catch {
    # POS4 injoignable / connexion tombee : on reessaie.
  }
  finally {
    if ($reader) { $reader.Dispose() }
    if ($client) { $client.Dispose() }
  }
  Start-Sleep -Seconds 5
}
