$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonPath = (Get-Command python.exe -ErrorAction Stop).Source
@{ python = $pythonPath; port = 8778 } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $projectRoot 'runtime.json') -Encoding utf8
Write-Output 'Configured local Python for MathCode.'
