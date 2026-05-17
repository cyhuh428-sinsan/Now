$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$androidDir = $PSScriptRoot

function Resolve-JavaHome {
    if (-not [string]::IsNullOrWhiteSpace($env:NOWNOTE_JAVA_HOME)) {
        if (Test-Path $env:NOWNOTE_JAVA_HOME) { return $env:NOWNOTE_JAVA_HOME }
        throw "NOWNOTE_JAVA_HOME 경로를 찾을 수 없습니다: $env:NOWNOTE_JAVA_HOME"
    }

    if (-not [string]::IsNullOrWhiteSpace($env:JAVA_HOME)) {
        if (Test-Path $env:JAVA_HOME) { return $env:JAVA_HOME }
    }

    $androidStudioJbr = "C:\Program Files\Android\Android Studio\jbr"
    if (Test-Path $androidStudioJbr) { return $androidStudioJbr }

    throw "JDK를 찾을 수 없습니다. JAVA_HOME 또는 NOWNOTE_JAVA_HOME을 설정하세요."
}

function Resolve-Flutter {
    if (-not [string]::IsNullOrWhiteSpace($env:NOWNOTE_FLUTTER_BIN)) {
        if (Test-Path $env:NOWNOTE_FLUTTER_BIN) { return $env:NOWNOTE_FLUTTER_BIN }
        throw "NOWNOTE_FLUTTER_BIN 경로를 찾을 수 없습니다: $env:NOWNOTE_FLUTTER_BIN"
    }

    $fromPath = Get-Command "flutter.bat" -ErrorAction SilentlyContinue
    if ($fromPath -and (Test-Path $fromPath.Source)) { return $fromPath.Source }

    $fromPath = Get-Command "flutter" -ErrorAction SilentlyContinue
    if ($fromPath -and (Test-Path $fromPath.Source)) { return $fromPath.Source }

    $localFlutter = Join-Path $env:USERPROFILE "flutter\bin\flutter.bat"
    if (Test-Path $localFlutter) { return $localFlutter }

    throw "Flutter 실행 파일을 찾을 수 없습니다. PATH 또는 NOWNOTE_FLUTTER_BIN을 설정하세요."
}

if (-not (Test-Path (Join-Path $androidDir "upload-keystore.jks"))) {
    throw "android/upload-keystore.jks가 없습니다. 먼저 android/create_upload_key.ps1을 실행하세요."
}

if (-not (Test-Path (Join-Path $androidDir "key.properties"))) {
    throw "android/key.properties가 없습니다. 먼저 android/create_upload_key.ps1을 실행하세요."
}

$javaHome = Resolve-JavaHome
$flutter = Resolve-Flutter
$env:JAVA_HOME = $javaHome
$env:GRADLE_USER_HOME = "C:\tmp\nownote_gradle_user_home"

Push-Location $repoRoot
try {
    $buildArgs = @("build", "appbundle", "--release")
    if ($env:NOWNOTE_SKIP_PUB -eq "1") {
        $buildArgs += "--no-pub"
    }
    & $flutter @buildArgs
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
