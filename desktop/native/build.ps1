$ErrorActionPreference = 'Stop'

$nativeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$outDir = Join-Path $nativeDir 'out'
$vsRoot = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio'
$vcvars = Get-ChildItem $vsRoot -Directory |
  ForEach-Object { Join-Path $_.FullName 'BuildTools\VC\Auxiliary\Build\vcvars64.bat' } |
  Where-Object { Test-Path $_ } |
  Select-Object -First 1
if (-not $vcvars) { throw 'Visual Studio Build Tools x64 environment was not found' }

New-Item -ItemType Directory -Path $outDir -Force | Out-Null
$exe = Join-Path $outDir 'vault-helper.exe'
$command = 'call "{0}" >nul && cl.exe /nologo /std:c++17 /EHsc /W4 /WX /DUNICODE /D_UNICODE /Fe:"{1}" "{2}" "{3}" "{4}" ntdll.lib bcrypt.lib' -f `
  $vcvars, $exe, (Join-Path $nativeDir 'main.cpp'), (Join-Path $nativeDir 'vault-path.cpp'), (Join-Path $nativeDir 'vault-ops.cpp')
$result = 1
Push-Location $outDir
try {
  & cmd.exe /d /c $command
  $result = $LASTEXITCODE
} finally {
  Pop-Location
}
if ($result -ne 0) { throw "Native build failed with exit code $result" }
if (-not (Test-Path $exe)) { throw 'Native build produced no executable' }
Remove-Item -LiteralPath (Join-Path $outDir 'main.obj'), (Join-Path $outDir 'vault-path.obj'), (Join-Path $outDir 'vault-ops.obj') -ErrorAction Stop
Write-Output "Built $exe"
