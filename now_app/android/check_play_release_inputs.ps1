$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$projectRoot = Split-Path -Parent $repoRoot
$manifestPath = Join-Path $repoRoot "android\app\src\main\AndroidManifest.xml"
$backupRulesPath = Join-Path $repoRoot "android\app\src\main\res\xml\backup_rules.xml"
$dataExtractionRulesPath = Join-Path $repoRoot "android\app\src\main\res\xml\data_extraction_rules.xml"
$playAssetsDir = Join-Path $repoRoot "docs\play_assets"

function Add-Check {
    param(
        [System.Collections.Generic.List[object]] $Checks,
        [string] $Name,
        [bool] $Ok,
        [string] $Message
    )

    $Checks.Add([pscustomobject]@{
        Name = $Name
        Ok = $Ok
        Message = $Message
    })
}

function Test-GitIgnored {
    param([string] $Path)

    Push-Location $projectRoot
    try {
        & git check-ignore -q -- $Path
        return $LASTEXITCODE -eq 0
    }
    finally {
        Pop-Location
    }
}

$checks = [System.Collections.Generic.List[object]]::new()

$keystoreRelative = "now_app/android/upload-keystore.jks"
$keyPropertiesRelative = "now_app/android/key.properties"
$keystorePath = Join-Path $repoRoot "android\upload-keystore.jks"
$keyPropertiesPath = Join-Path $repoRoot "android\key.properties"

Add-Check $checks "Upload keystore exists" (Test-Path $keystorePath) "android/upload-keystore.jks"
Add-Check $checks "key.properties exists" (Test-Path $keyPropertiesPath) "android/key.properties"
Add-Check $checks "Upload keystore is git-ignored" (Test-GitIgnored $keystoreRelative) $keystoreRelative
Add-Check $checks "key.properties is git-ignored" (Test-GitIgnored $keyPropertiesRelative) $keyPropertiesRelative

$manifest = if (Test-Path $manifestPath) { Get-Content $manifestPath -Raw } else { "" }
Add-Check $checks "POST_NOTIFICATIONS declared" ($manifest -match "android\.permission\.POST_NOTIFICATIONS") "Android 13+ notification permission"
Add-Check $checks "CAPTURE_AUDIO_OUTPUT removed" ($manifest -match "android\.permission\.CAPTURE_AUDIO_OUTPUT" -and $manifest -match 'tools:node="remove"') "Source manifest removal rule"
Add-Check $checks "Backup rules linked" ($manifest -match "android:fullBackupContent" -and $manifest -match "android:dataExtractionRules") "Cloud backup rule resources"

$backupRules = if (Test-Path $backupRulesPath) { Get-Content $backupRulesPath -Raw } else { "" }
$dataExtractionRules = if (Test-Path $dataExtractionRulesPath) { Get-Content $dataExtractionRulesPath -Raw } else { "" }
Add-Check $checks "Full backup excludes private data" ($backupRules -match '<exclude') "backup_rules.xml"
Add-Check $checks "Cloud backup excludes private data" ($dataExtractionRules -match '<cloud-backup>' -and $dataExtractionRules -match '<exclude') "data_extraction_rules.xml"

@(
    "app_icon_512.png",
    "feature_graphic_1024x500.png",
    "screenshot_01_home.png",
    "screenshot_02_daily_notes.png",
    "screenshot_03_tree_notes.png",
    "screenshot_04_voice.png"
) | ForEach-Object {
    Add-Check $checks "Play asset exists: $_" (Test-Path (Join-Path $playAssetsDir $_)) $_
}

$failed = $checks | Where-Object { -not $_.Ok }

foreach ($check in $checks) {
    $prefix = if ($check.Ok) { "[OK]" } else { "[FAIL]" }
    Write-Host "$prefix $($check.Name) - $($check.Message)"
}

if ($failed.Count -gt 0) {
    throw "Play release preflight failed: $($failed.Count) check(s)"
}

Write-Host "Play release preflight passed"
