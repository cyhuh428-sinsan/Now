param([switch]$MutationExperiment)

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
$exe = Join-Path $outDir $(if ($MutationExperiment) { 'vault-helper-experiment.exe' } else { 'vault-helper.exe' })
$define = if ($MutationExperiment) { '/DNOW_VAULT_MUTATION_EXPERIMENT' } else { '' }
$command = 'call "{0}" >nul && cl.exe /nologo /std:c++17 /EHsc /W4 /WX /DUNICODE /D_UNICODE {1} /Fe:"{2}" "{3}" "{4}" "{5}" ntdll.lib bcrypt.lib' -f `
  $vcvars, $define, $exe, (Join-Path $nativeDir 'main.cpp'), (Join-Path $nativeDir 'vault-path.cpp'), (Join-Path $nativeDir 'vault-ops.cpp')
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
if ($MutationExperiment) {
  $journalExe = Join-Path $outDir 'vault-journal-experiment.exe'
  $journalCommand = 'call "{0}" >nul && cl.exe /nologo /std:c++17 /EHsc /W4 /WX /DUNICODE /D_UNICODE /Fe:"{1}" "{2}" "{3}" ntdll.lib bcrypt.lib' -f `
    $vcvars, $journalExe, (Join-Path $nativeDir 'journal-session.cpp'), (Join-Path $nativeDir 'vault-path.cpp')
  Push-Location $outDir
  try {
    & cmd.exe /d /c $journalCommand
    $result = $LASTEXITCODE
  } finally {
    Pop-Location
  }
  if ($result -ne 0) { throw "Journal session build failed with exit code $result" }
  Remove-Item -LiteralPath (Join-Path $outDir 'journal-session.obj'), (Join-Path $outDir 'vault-path.obj') -ErrorAction Stop
  Write-Output "Built $journalExe"
  $reparseExe = Join-Path $outDir 'vault-reparse-attempt.exe'
  $reparseSource = Join-Path $nativeDir 'tests\reparse-attempt.cpp'
  $reparseCommand = 'call "{0}" >nul && cl.exe /nologo /std:c++17 /EHsc /W4 /WX /DUNICODE /D_UNICODE /Fe:"{1}" "{2}"' -f `
    $vcvars, $reparseExe, $reparseSource
  Push-Location $outDir
  try {
    & cmd.exe /d /c $reparseCommand
    $result = $LASTEXITCODE
  } finally {
    Pop-Location
  }
  if ($result -ne 0) { throw "Reparse test tool build failed with exit code $result" }
  Remove-Item -LiteralPath (Join-Path $outDir 'reparse-attempt.obj') -ErrorAction Stop
  Write-Output "Built $reparseExe"
}
