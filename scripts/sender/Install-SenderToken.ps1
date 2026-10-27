$ErrorActionPreference = 'Stop'
$token = [Console]::In.ReadToEnd().Trim()
if ($token.Length -lt 100) { throw 'Clipboard does not contain the Sender API token.' }
$folder = Join-Path $env:LOCALAPPDATA 'RaleighGuide'
New-Item -ItemType Directory -Force -Path $folder | Out-Null
$path = Join-Path $folder 'sender-token.clixml'
$secret = ConvertTo-SecureString $token -AsPlainText -Force
$credential = [pscredential]::new('sender-api-token', $secret)
$credential | Export-Clixml -LiteralPath $path
Write-Output 'Sender token saved for the current Windows account.'
