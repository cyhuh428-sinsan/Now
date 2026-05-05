$ErrorActionPreference = "Stop"

$androidDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$keytool = "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"
$keystorePath = Join-Path $androidDir "upload-keystore.jks"
$keyPropertiesPath = Join-Path $androidDir "key.properties"
$alias = "nownote_upload"

if (-not (Test-Path $keytool)) {
    throw "keytool을 찾을 수 없습니다: $keytool"
}

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
