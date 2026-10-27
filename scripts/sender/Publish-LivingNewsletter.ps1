param(
  [Parameter(Mandatory = $true)][string]$HtmlPath,
  [Parameter(Mandatory = $true)][string]$Subject,
  [Parameter(Mandatory = $true)][string]$ApprovalEmailId,
  [Parameter(Mandatory = $true)][string]$ApprovedSha256,
  [Parameter(Mandatory = $true)][string]$ScheduleEastern,
  [string]$Preheader = '',
  [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
$groupId = 'dJ2y5D'
$credentialPath = Join-Path $env:LOCALAPPDATA 'RaleighGuide\sender-token.clixml'
$statePath = Join-Path $env:LOCALAPPDATA 'RaleighGuide\sender-campaign-state.json'
$apiBase = 'https://api.sender.net/v2'

if (-not (Test-Path -LiteralPath $credentialPath)) { throw 'Sender token is not installed for this Windows account.' }
if (-not (Test-Path -LiteralPath $HtmlPath)) { throw 'Approved HTML file is missing.' }
$html = Get-Content -LiteralPath $HtmlPath -Raw -Encoding UTF8
$actualHash = (Get-FileHash -LiteralPath $HtmlPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualHash -ne $ApprovedSha256.ToLowerInvariant()) { throw 'HTML changed after approval; request approval of this version.' }
if ($html -notmatch '\{\$unsubscribe_link\}') { throw 'Sender unsubscribe link is missing from the approved HTML.' }
if ($html -match '(?i)investor_newsletter|investing in raleigh weekly newsletter') { throw 'Investor content or audience marker detected in Living campaign.' }
if ([string]::IsNullOrWhiteSpace($ApprovalEmailId)) { throw 'Issue-specific approval email ID is required.' }

$style = [Globalization.DateTimeStyles]::None
$culture = [Globalization.CultureInfo]::InvariantCulture
$scheduled = [datetime]::MinValue
if (-not [datetime]::TryParseExact($ScheduleEastern, 'yyyy-MM-dd HH:mm:ss', $culture, $style, [ref]$scheduled)) {
  throw 'ScheduleEastern must be yyyy-MM-dd HH:mm:ss.'
}
if ($scheduled.DayOfWeek -ne [DayOfWeek]::Thursday -or $scheduled.Hour -ne 10 -or $scheduled.Minute -ne 0 -or $scheduled.Second -ne 0) {
  throw 'Living newsletters must use Thursday at 10:00:00 Eastern.'
}
$eastern = [TimeZoneInfo]::FindSystemTimeZoneById('Eastern Standard Time')
if ($scheduled -le [TimeZoneInfo]::ConvertTimeFromUtc([datetime]::UtcNow, $eastern)) { throw 'The selected slot has passed.' }
if ($ValidateOnly) {
  [pscustomobject]@{ valid = $true; html_sha256 = $actualHash; schedule_eastern = $ScheduleEastern; group_id = $groupId }
  return
}

$credential = Import-Clixml -LiteralPath $credentialPath
$token = $credential.GetNetworkCredential().Password
if ([string]::IsNullOrWhiteSpace($token)) { throw 'Sender token is empty.' }
$headers = @{ Authorization = "Bearer $token"; Accept = 'application/json' }

function Invoke-Sender([string]$Method, [string]$Path, $Body = $null) {
  $options = @{ Method = $Method; Uri = "$apiBase$Path"; Headers = $headers; ErrorAction = 'Stop' }
  if ($null -ne $Body) {
    $options.ContentType = 'application/json'
    $options.Body = $Body | ConvertTo-Json -Depth 12 -Compress
  }
  Invoke-RestMethod @options
}

$state = @{}
if (Test-Path -LiteralPath $statePath) {
  $saved = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
  foreach ($property in $saved.PSObject.Properties) { $state[$property.Name] = $property.Value }
}
$issueKey = $scheduled.ToString('yyyy-MM-dd')
if ($state.ContainsKey($issueKey)) { throw "Campaign for $issueKey is already recorded. Inspect Sender before another attempt." }

# Sender's UI uses the account timezone. Check it before first scheduling and whenever changed.
$existing = Invoke-Sender 'GET' '/campaigns?limit=100&status=SCHEDULED'
$campaigns = @($existing.data)
foreach ($campaign in $campaigns) {
  if ($campaign.schedule_time -eq $ScheduleEastern -and @($campaign.campaign_groups) -contains $groupId) {
    throw "A Living campaign already occupies $ScheduleEastern."
  }
}

$payload = @{
  title = "Living in Raleigh | $issueKey | $Subject"
  subject = $Subject
  from = 'Living in Raleigh Team'
  reply_to = 'hello@raleighncguide.com'
  content_type = 'html'
  content = $html
  groups = @($groupId)
  preheader = $Preheader
}
$created = Invoke-Sender 'POST' '/campaigns' $payload
$campaign = if ($created.data) { $created.data } else { $created }
$campaignId = [string]$campaign.id
if ([string]::IsNullOrWhiteSpace($campaignId)) { throw 'Sender did not return a campaign ID; inspect the Sender account before retrying.' }
$assignedGroups = @($campaign.campaign_groups)
if ($assignedGroups.Count -gt 0 -and $assignedGroups -notcontains $groupId) {
  throw "Sender created campaign $campaignId without the intended Living group; do not schedule it."
}

# Record creation before scheduling so a failed schedule cannot create duplicate drafts on retry.
$state[$issueKey] = @{ campaign_id = $campaignId; status = 'draft_created'; approval_email_id = $ApprovalEmailId; html_sha256 = $actualHash; schedule_eastern = $ScheduleEastern }
$stateFolder = Split-Path -Parent $statePath
New-Item -ItemType Directory -Force -Path $stateFolder | Out-Null
$state | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $statePath -Encoding UTF8

Invoke-Sender 'POST' "/campaigns/$campaignId/schedule" @{ schedule_time = $ScheduleEastern } | Out-Null
$details = Invoke-Sender 'GET' "/campaigns/$campaignId"
$verified = if ($details.data) { $details.data } else { $details }
if ([string]$verified.status -ne 'SCHEDULED') { throw "Sender did not confirm scheduling for $campaignId; inspect the campaign." }
$state[$issueKey].status = 'scheduled'
$state | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $statePath -Encoding UTF8
[pscustomobject]@{ campaign_id = $campaignId; status = 'scheduled'; schedule_eastern = $ScheduleEastern; group_id = $groupId; approval_email_id = $ApprovalEmailId }
