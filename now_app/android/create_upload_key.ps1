$ErrorActionPreference = "Stop"

$androidDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$keystorePath = Join-Path $androidDir "upload-keystore.jks"
$keyPropertiesPath = Join-Path $androidDir "key.properties"
$alias = "nownote_upload"

function Resolve-Keytool {
    if (-not [string]::IsNullOrWhiteSpace($env:NOWNOTE_KEYTOOL)) {
        if (Test-Path $env:NOWNOTE_KEYTOOL) { return $env:NOWNOTE_KEYTOOL }
        throw "NOWNOTE_KEYTOOL 경로를 찾을 수 없습니다: $env:NOWNOTE_KEYTOOL"
    }

    if (-not [string]::IsNullOrWhiteSpace($env:JAVA_HOME)) {
        $fromJavaHome = Join-Path $env:JAVA_HOME "bin\keytool.exe"
        if (Test-Path $fromJavaHome) { return $fromJavaHome }
    }

    $fromPath = Get-Command "keytool.exe" -ErrorAction SilentlyContinue
    if ($fromPath -and (Test-Path $fromPath.Source)) { return $fromPath.Source }

    $androidStudioKeytool = "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"
    if (Test-Path $androidStudioKeytool) { return $androidStudioKeytool }

    throw "keytool을 찾을 수 없습니다. JAVA_HOME 또는 NOWNOTE_KEYTOOL을 설정하세요."
}

$keytool = Resolve-Keytool

if (Test-Path $keystorePath) {
    throw "이미 upload-keystore.jks가 있습니다. 기존 키를 덮어쓰지 않습니다: $keystorePath"
}

if (Test-Path $keyPropertiesPath) {
    throw "이미 key.properties가 있습니다. 기존 설정을 덮어쓰지 않습니다: $keyPropertiesPath"
}

if ([string]::IsNullOrWhiteSpace($env:NOWNOTE_KEYSTORE_PASSWORD)) {
    throw "환경변수 NOWNOTE_KEYSTORE_PASSWORD를 먼저 설정하세요."
}

if ([string]::IsNullOrWhiteSpace($env:NOWNOTE_KEY_PASSWORD)) {
    throw "환경변수 NOWNOTE_KEY_PASSWORD를 먼저 설정하세요."
}

& $keytool `
    -genkeypair `
    -v `
    -keystore $keystorePath `
    -storetype JKS `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -alias $alias `
    -storepass $env:NOWNOTE_KEYSTORE_PASSWORD `
    -keypass $env:NOWNOTE_KEY_PASSWORD `
    -dname "CN=NowNote, OU=NowNote, O=Sinsan, L=Seoul, ST=Seoul, C=KR"

@"
storePassword=$env:NOWNOTE_KEYSTORE_PASSWORD
keyPassword=$env:NOWNOTE_KEY_PASSWORD
keyAlias=$alias
storeFile=../upload-keystore.jks
"@ | ForEach-Object {
    [System.IO.File]::WriteAllText(
        $keyPropertiesPath,
        $_,
        [System.Text.UTF8Encoding]::new($false)
    )
}

Write-Host "업로드 키 생성 완료:"
Write-Host $keystorePath
Write-Host $keyPropertiesPath
