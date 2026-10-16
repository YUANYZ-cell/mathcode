$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$projectFile = Join-Path $projectRoot 'desktop\MathCode.Desktop\MathCode.Desktop.csproj'
$publishPath = Join-Path $projectRoot 'dist\MathCode-current'
dotnet publish $projectFile -c Release -r win-x64 --self-contained false -o $publishPath
if ($LASTEXITCODE -ne 0) { throw 'Desktop publish failed.' }
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut((Join-Path $projectRoot '数学 × 编程.lnk'))
$shortcut.TargetPath = Join-Path $publishPath 'MathCode.exe'
$shortcut.WorkingDirectory = $projectRoot
$shortcut.IconLocation = Join-Path $projectRoot 'app\assets\app.ico'
$shortcut.Description = 'Math and C++ personal study library'
$shortcut.Save()
Get-FileHash -LiteralPath (Join-Path $publishPath 'MathCode.exe') -Algorithm SHA256
