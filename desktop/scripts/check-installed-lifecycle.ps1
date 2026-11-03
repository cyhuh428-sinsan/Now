param([switch]$Plan)
$ErrorActionPreference = 'Stop'
if ($Plan) {
  @{ runnerOnly = $true; installMode = 'currentuser'; realUserData = $false; stages = @('install', 'runtime', 'uninstall') } | ConvertTo-Json -Compress
  exit 0
}
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted' -or $env:RUNNER_OS -ne 'Windows' -or $env:NOWNOTE_INSTALLER_QA -ne '1' -or $env:GITHUB_REPOSITORY -ne 'cyhuh428-sinsan/Now') {
  throw 'This destructive QA is restricted to the approved GitHub-hosted Windows runner.'
}
if (-not $env:RUNNER_TEMP) { throw 'Runner temporary directory is required.' }
$temp = (Resolve-Path -LiteralPath $env:RUNNER_TEMP).Path
$root = Join-Path $temp ('nownote-install-qa-' + [guid]::NewGuid().ToString('N'))
$install = Join-Path $root 'installed'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$package = Get-Content -LiteralPath (Join-Path $repo 'desktop/package.json') -Raw | ConvertFrom-Json
$installer = Join-Path $repo ('desktop/dist/NowNote-Setup-' + $package.version + '-x64.exe')
$uninstaller = Join-Path $install 'Uninstall NowNote.exe'
$registryRoots = @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*')
function Registration {
  @(Get-ItemProperty -Path $registryRoots -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq 'NowNote' })
}
$desktop = [Environment]::GetFolderPath('DesktopDirectory')
$programs = [Environment]::GetFolderPath('Programs')
$shortcuts = @((Join-Path $desktop 'NowNote.lnk'), (Join-Path $desktop 'NowNote Wiki.lnk'), (Join-Path $programs 'NowNote.lnk'), (Join-Path $programs 'NowNote Wiki.lnk'))
if (@(Registration).Count -ne 0 -or @($shortcuts | Where-Object { Test-Path -LiteralPath $_ }).Count -ne 0) { throw 'Existing NowNote installation or shortcuts must not be replaced.' }
if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) { throw 'Exact candidate installer is missing.' }
New-Item -ItemType Directory -Path $root | Out-Null
$receipt = [ordered]@{ commit = $env:GITHUB_SHA; version = $package.version; installerSha256 = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash; installExit = $null; installed = $false; registered = $false; shortcuts = $false; runtime = $false; uninstallExit = $null; removed = $false; cleanup = $false }
try {
  $process = Start-Process -FilePath $installer -ArgumentList "/S /currentuser /D=$install" -WindowStyle Hidden -PassThru
  if (-not $process.WaitForExit(120000)) { throw 'Installer timed out; no automatic retry.' }
  $receipt.installExit = $process.ExitCode
  if ($process.ExitCode -ne 0) { throw 'Installer returned a failure exit code.' }
  foreach ($file in @('NowNote.exe', 'NowNoteWiki.exe', 'resources/app.asar', 'Uninstall NowNote.exe')) {
    if (-not (Test-Path -LiteralPath (Join-Path $install $file) -PathType Leaf)) { throw "Missing installed file: $file" }
  }
  foreach ($file in @('NowNote.exe', 'NowNoteWiki.exe', 'resources/app.asar')) {
    $expected = (Get-FileHash -LiteralPath (Join-Path $repo ('desktop/dist/win-unpacked/' + $file)) -Algorithm SHA256).Hash
    $actual = (Get-FileHash -LiteralPath (Join-Path $install $file) -Algorithm SHA256).Hash
    if ($expected -ne $actual) { throw "Installed candidate bytes differ: $file" }
  }
  $receipt.installed = $true
  $entries = @(Registration)
  if ($entries.Count -ne 1 -or $entries[0].DisplayVersion -ne $package.version) { throw 'Installed version/registration mismatch.' }
  if (-not ([string]$entries[0].UninstallString).Contains($install)) { throw 'Uninstall registration points outside the owned installation.' }
  $receipt.registered = $true
  $wsh = New-Object -ComObject WScript.Shell
  foreach ($file in $shortcuts) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing installed shortcut: $file" }
    $link = $wsh.CreateShortcut($file)
    $exe = if ($file.EndsWith('NowNote Wiki.lnk')) { 'NowNoteWiki.exe' } else { 'NowNote.exe' }
    if ($link.TargetPath -ne (Join-Path $install $exe)) { throw 'Shortcut points outside the owned installation.' }
  }
  $receipt.shortcuts = $true
  $env:NOWNOTE_DESKTOP_EXE_PATH = Join-Path $install 'NowNote.exe'
  $env:NOWNOTE_QA_RETAINED_ORIGINAL = '1'
  & node (Join-Path $PSScriptRoot 'check-document-runtime.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'Installed application runtime QA failed.' }
  $receipt.runtime = $true
} finally {
  if (Test-Path -LiteralPath $uninstaller -PathType Leaf) {
    $process = Start-Process -FilePath $uninstaller -ArgumentList '/S /currentuser' -WindowStyle Hidden -PassThru
    if (-not $process.WaitForExit(120000)) { throw 'Uninstaller timed out; no automatic retry.' }
    $receipt.uninstallExit = $process.ExitCode
    $deadline = [DateTime]::UtcNow.AddSeconds(40)
    do {
      $remaining = (Test-Path -LiteralPath $uninstaller) -or (Test-Path -LiteralPath (Join-Path $install 'NowNote.exe')) -or @(Registration).Count -gt 0 -or @($shortcuts | Where-Object { Test-Path -LiteralPath $_ }).Count -gt 0
      if ($remaining) { Start-Sleep -Milliseconds 200 }
    } while ($remaining -and [DateTime]::UtcNow -lt $deadline)
    $receipt.removed = -not $remaining -and $process.ExitCode -eq 0
  }
  $report = Join-Path $repo 'desktop/dist/installer-lifecycle.json'
  $receipt.cleanup = $receipt.removed
  $receipt | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $report -Encoding utf8
  if ($receipt.removed) {
    $resolved = (Resolve-Path -LiteralPath $root).Path
    if (-not $resolved.StartsWith($temp.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Cleanup boundary mismatch.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
    if (Test-Path -LiteralPath $resolved) { throw 'Owned installer QA root remains.' }
  }
}
if (-not $receipt.removed) { throw 'Uninstallation did not remove installed files, registration and shortcuts.' }
$receipt | ConvertTo-Json -Compress
