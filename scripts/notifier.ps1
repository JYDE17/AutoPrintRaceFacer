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
  [string]$Duration = "long",    # court | long | persistant
  [string]$Method = "balloon"    # balloon (bas-droite) | msgbox (boite modale)
)

Add-Type -AssemblyName System.Net.Http | Out-Null

$script:notifyIcon = $null

# Notification en bas a droite via NotifyIcon (fiable depuis un process cache,
# aucune app a enregistrer). Repli sur msg.exe si Method=msgbox.
function Show-Toast([string]$title, [string]$body) {
  if ($Method -eq 'msgbox') {
    try {
      $txt = if ($body) { "$title`n$body" } else { $title }
      Start-Process -FilePath "msg" -ArgumentList '*', '/TIME:60', $txt -WindowStyle Hidden
    }
    catch { }
    return
  }

  try {
    if ($null -eq $script:notifyIcon) {
      Add-Type -AssemblyName System.Windows.Forms | Out-Null
      Add-Type -AssemblyName System.Drawing | Out-Null
      $script:notifyIcon = New-Object System.Windows.Forms.NotifyIcon
      $script:notifyIcon.Icon = [System.Drawing.SystemIcons]::Information
      $script:notifyIcon.Visible = $true
    }
    $ms = 10000
    if ($Duration -eq 'court' -or $Duration -eq 'short') { $ms = 5000 }
    elseif ($Duration -eq 'persistant' -or $Duration -eq 'persistent') { $ms = 30000 }

    $script:notifyIcon.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
    $script:notifyIcon.BalloonTipTitle = if ($title) { $title } else { $AppName }
    $script:notifyIcon.BalloonTipText = if ($body) { $body } else { " " }
    $script:notifyIcon.ShowBalloonTip($ms)
    # Petite pompe de messages pour que la bulle s'affiche depuis un process sans UI.
    for ($i = 0; $i -lt 10; $i++) {
      [System.Windows.Forms.Application]::DoEvents()
      Start-Sleep -Milliseconds 40
    }
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
