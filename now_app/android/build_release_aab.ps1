$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$androidDir = $PSScriptRoot
$javaHome = "C:\Program Files\Android\Android Studio\jbr"

if (-not (Test-Path (Join-Path $androidDir "upload-keystore.jks"))) {
    throw "android/upload-keystore.jks가 없습니다. 먼저 android/create_upload_key.ps1을 실행하세요."
}

if (-not (Test-Path (Join-Path $androidDir "key.properties"))) {
    throw "android/key.properties가 없습니다. 먼저 android/create_upload_key.ps1을 실행하세요."
}

if (-not (Test-Path $javaHome)) {
    throw "Android Studio JBR을 찾을 수 없습니다: $javaHome"
}

$env:JAVA_HOME = $javaHome
$env:GRADLE_USER_HOME = "C:\tmp\nownote_gradle_user_home"

Push-Location $repoRoot
try {
    & "C:\Users\cyhuh\flutter\bin\flutter.bat" build appbundle --release --no-pub
    if ($LASTEXITCODE -ne 0) {
        throw "flutter build appbundle --release 실패"
    }
}
finally {
    Pop-Location
}

$aab = Join-Path $repoRoot "build\app\outputs\bundle\release\app-release.aab"
if (-not (Test-Path $aab)) {
    throw "AAB 파일을 찾을 수 없습니다: $aab"
}

Write-Host "서명된 AAB 빌드 완료:"
Write-Host $aab
