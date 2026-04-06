param(
  [string]$Path = "/raleighs-hottest-deals/new-construction-process/",
  [int]$Port = 4173,
  [string]$Device = "iPhone 15 Pro",
  [switch]$CompareCommonDevices,
  [switch]$IncludeChromium
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$url = "http://127.0.0.1:$Port$Path"

function Get-PlaywrightDeviceNames {
  try {
    $json = node -e "const { devices } = require('playwright'); console.log(JSON.stringify(Object.keys(devices)));"
    return @($json | ConvertFrom-Json)
  } catch {
    return @()
  }
}

# Always close stale Playwright preview windows before launching a fresh one.
function Get-DescendantProcessIds {
  param(
    [int[]]$RootIds,
    [object[]]$ProcessRows
  )

  $seen = @{}
  $queue = New-Object System.Collections.ArrayList

  foreach ($id in $RootIds) {
    $intId = [int]$id
    if ($intId -and -not $seen.ContainsKey($intId)) {
      $seen[$intId] = $true
      [void]$queue.Add($intId)
    }
  }

  while ($queue.Count -gt 0) {
    $current = [int]$queue[0]
    $queue.RemoveAt(0)
    $children = $ProcessRows | Where-Object { $_.ParentProcessId -eq $current }
    foreach ($child in $children) {
      $childId = [int]$child.ProcessId
      if (-not $seen.ContainsKey($childId)) {
        $seen[$childId] = $true
        [void]$queue.Add($childId)
      }
    }
  }

  return @($seen.Keys | ForEach-Object { [int]$_ })
}

$allProcs = @(Get-CimInstance Win32_Process)
$launcherRoots = @(
  $allProcs | Where-Object {
    $_.ProcessId -ne $PID -and
    $_.CommandLine -and
    $_.CommandLine -match '(?i)\bplaywright\b' -and
    $_.CommandLine -match '(?i)\bopen\b'
  }
)

$rootIds = @($launcherRoots | ForEach-Object { [int]$_.ProcessId })
$treeIds = @()
if ($rootIds.Count -gt 0) {
  $treeIds = Get-DescendantProcessIds -RootIds $rootIds -ProcessRows $allProcs
}

$orphanBrowserIds = @(
  $allProcs |
    Where-Object {
      $_.ProcessId -ne $PID -and
      $_.Name -match '^(Playwright\.exe|WebKitWebProcess\.exe|WebKitGPUProcess\.exe|WebKitNetworkProcess\.exe)$'
    } |
    ForEach-Object { [int]$_.ProcessId }
)

$idsToStop = @($treeIds + $orphanBrowserIds | Sort-Object -Unique)
if ($idsToStop.Count -gt 0) {
  foreach ($procId in $idsToStop) {
    try {
      Stop-Process -Id $procId -Force -ErrorAction Stop
    } catch {
      # Ignore races where a process exits between listing and stop.
    }
  }
  Start-Sleep -Milliseconds 250
}

# Start local static server if one is not already running on the target port.
$serverRunning = $false
try {
  $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 2
  if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
    $serverRunning = $true
  }
} catch {
  $serverRunning = $false
}

if (-not $serverRunning) {
  Start-Process -FilePath "python" -ArgumentList "-m http.server $Port" -WorkingDirectory $root | Out-Null
  Start-Sleep -Milliseconds 700
}

$availableDevices = @(Get-PlaywrightDeviceNames)
$effectiveDevice = $Device
$fallbacks = @("iPhone 15 Pro", "iPhone 14", "iPhone 13 Pro")

if ($availableDevices.Count -gt 0 -and -not ($availableDevices -contains $effectiveDevice)) {
  foreach ($fallback in $fallbacks) {
    if ($availableDevices -contains $fallback) {
      Write-Warning "Playwright device '$Device' was not found. Using '$fallback' instead."
      $effectiveDevice = $fallback
      break
    }
  }
}

# iOS-style preview using WebKit (closest runtime to Safari on iOS).
Start-Process -FilePath "npx.cmd" -ArgumentList "playwright open -b webkit --device `"$effectiveDevice`" `"$url`"" -WorkingDirectory $root | Out-Null

if ($CompareCommonDevices) {
  $compareDevices = @("iPhone SE (3rd gen)", "iPhone 14", "iPhone 15 Pro Max")
  foreach ($compareDevice in $compareDevices) {
    if ($compareDevice -eq $effectiveDevice) {
      continue
    }
    if ($availableDevices.Count -eq 0 -or ($availableDevices -contains $compareDevice)) {
      Start-Process -FilePath "npx.cmd" -ArgumentList "playwright open -b webkit --device `"$compareDevice`" `"$url`"" -WorkingDirectory $root | Out-Null
    }
  }
}

if ($IncludeChromium) {
  # Optional Chromium preview using desktop Chrome channel if available.
  try {
    Start-Process -FilePath "npx.cmd" -ArgumentList "playwright open -b chromium --channel=chrome --device `"$effectiveDevice`" `"$url`"" -WorkingDirectory $root | Out-Null
  } catch {
    # Ignore if Chrome channel is unavailable on this machine.
  }
}

Write-Host "Mobile previews launched at $url using device '$effectiveDevice'"
