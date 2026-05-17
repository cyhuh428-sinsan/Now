Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"
$OutDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function New-Bitmap($Width, $Height) {
    $bmp = New-Object System.Drawing.Bitmap $Width, $Height
    $bmp.SetResolution(144, 144)
    return $bmp
}

function Color($Hex) {
    return [System.Drawing.ColorTranslator]::FromHtml($Hex)
}

function Font($Size, $Style = [System.Drawing.FontStyle]::Regular) {
    return [System.Drawing.Font]::new("Malgun Gothic", [single]$Size, $Style, [System.Drawing.GraphicsUnit]::Pixel)
}

function Fill-RoundRect($G, $Brush, $X, $Y, $W, $H, $R) {
    if ($R -le 0) {
        $G.FillRectangle($Brush, $X, $Y, $W, $H)
        return
    }
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $R * 2
    $path.AddArc($X, $Y, $d, $d, 180, 90)
    $path.AddArc($X + $W - $d, $Y, $d, $d, 270, 90)
    $path.AddArc($X + $W - $d, $Y + $H - $d, $d, $d, 0, 90)
    $path.AddArc($X, $Y + $H - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    $G.FillPath($Brush, $path)
    $path.Dispose()
}

function Stroke-RoundRect($G, $Pen, $X, $Y, $W, $H, $R) {
    if ($R -le 0) {
        $G.DrawRectangle($Pen, $X, $Y, $W, $H)
        return
    }
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $R * 2
    $path.AddArc($X, $Y, $d, $d, 180, 90)
    $path.AddArc($X + $W - $d, $Y, $d, $d, 270, 90)
    $path.AddArc($X + $W - $d, $Y + $H - $d, $d, $d, 0, 90)
    $path.AddArc($X, $Y + $H - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    $G.DrawPath($Pen, $path)
    $path.Dispose()
}

function Draw-Text($G, $Text, $Font, $Color, $X, $Y, $W, $H, $Align = "Near") {
    $brush = New-Object System.Drawing.SolidBrush (Color $Color)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::$Align
    $format.LineAlignment = [System.Drawing.StringAlignment]::Near
    $format.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
    $rect = New-Object System.Drawing.RectangleF $X, $Y, $W, $H
    $G.DrawString($Text, $Font, $brush, $rect, $format)
    $format.Dispose()
    $brush.Dispose()
}

function Setup-Graphics($Bmp) {
    $g = [System.Drawing.Graphics]::FromImage($Bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    $g.Clear((Color "#f7f8fb"))
    return $g
}

function Draw-PhoneFrame($G) {
    $dark = New-Object System.Drawing.SolidBrush (Color "#101828")
    $screen = New-Object System.Drawing.SolidBrush (Color "#ffffff")
    Fill-RoundRect $G $dark 96 48 888 1824 70
    Fill-RoundRect $G $screen 126 94 828 1732 48
    $bar = New-Object System.Drawing.SolidBrush (Color "#e5e7eb")
    Fill-RoundRect $G $bar 384 122 312 28 14
    $dark.Dispose()
    $screen.Dispose()
    $bar.Dispose()
}

function Draw-Header($G, $Title, $Subtitle) {
    Draw-Text $G "NowNote" (Font 32 ([System.Drawing.FontStyle]::Bold)) "#2563eb" 174 178 360 48
    Draw-Text $G $Title (Font 54 ([System.Drawing.FontStyle]::Bold)) "#101828" 174 246 720 82
    Draw-Text $G $Subtitle (Font 27) "#667085" 174 330 720 56
}

function Draw-Card($G, $X, $Y, $W, $H, $Title, $Body, $Accent = "#2563eb") {
    $white = New-Object System.Drawing.SolidBrush (Color "#ffffff")
    $line = New-Object System.Drawing.Pen (Color "#d9dee8"), 2
    Fill-RoundRect $G $white $X $Y $W $H 24
    Stroke-RoundRect $G $line $X $Y $W $H 24
    $dot = New-Object System.Drawing.SolidBrush (Color $Accent)
    Fill-RoundRect $G $dot ($X + 28) ($Y + 30) 12 56 6
    Draw-Text $G $Title (Font 31 ([System.Drawing.FontStyle]::Bold)) "#101828" ($X + 58) ($Y + 24) ($W - 86) 48
    Draw-Text $G $Body (Font 25) "#344054" ($X + 58) ($Y + 82) ($W - 86) ($H - 104)
    $white.Dispose()
    $line.Dispose()
    $dot.Dispose()
}

function Save-Png($Bmp, $Name) {
    $path = Join-Path $OutDir $Name
    $Bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    return $path
}

function New-HomeScreenshot {
    $bmp = New-Bitmap 1080 1920
    $g = Setup-Graphics $bmp
    Draw-PhoneFrame $g
    Draw-Header $g "오늘 기록을 한눈에" "메모, 일정, 할 일을 하루 흐름에 맞춰 정리합니다."
    Draw-Card $g 174 430 732 210 "오늘 메모" "회의 아이디어 정리`n장보기 목록 추가`n퇴근 후 루틴 확인" "#2563eb"
    Draw-Card $g 174 680 732 180 "오늘 일정" "10:00 주간 회의`n18:30 운동" "#0f766e"
    Draw-Card $g 174 900 732 210 "할 일" "자료 정리 완료`n음성 기록 확인`n내일 일정 점검" "#9333ea"
    Draw-Card $g 174 1150 732 250 "빠른 기록" "생각이 떠오르는 순간 텍스트, 음성, 이미지로 바로 남깁니다." "#ea580c"
    Draw-Text $g "기록은 기기 안에서 관리됩니다." (Font 23) "#667085" 174 1482 732 42 "Center"
    $g.Dispose()
    $path = Save-Png $bmp "screenshot_01_home.png"
    $bmp.Dispose()
    return $path
}

function New-DailyNoteScreenshot {
    $bmp = New-Bitmap 1080 1920
    $g = Setup-Graphics $bmp
    Draw-PhoneFrame $g
    Draw-Header $g "날짜별 메모" "하루 단위로 기록하고 필요한 내용을 다시 찾습니다."
    $chipBrush = New-Object System.Drawing.SolidBrush (Color "#eff6ff")
    $chipPen = New-Object System.Drawing.Pen (Color "#bfdbfe"), 2
    $days = @("월", "화", "수", "목", "금", "토", "일")
    for ($i = 0; $i -lt 7; $i++) {
        $x = 174 + ($i * 104)
        Fill-RoundRect $g $chipBrush $x 430 76 82 20
        Stroke-RoundRect $g $chipPen $x 430 76 82 20
        Draw-Text $g $days[$i] (Font 24 ([System.Drawing.FontStyle]::Bold)) "#2563eb" $x 448 76 36 "Center"
    }
    $chipBrush.Dispose()
    $chipPen.Dispose()
    Draw-Card $g 174 580 732 190 "오전 기록" "오늘 처리할 일 정리`n프로젝트 배포 체크리스트 확인" "#2563eb"
    Draw-Card $g 174 810 732 210 "아이디어" "스토어 등록 설명 문구 다듬기`n스크린샷 순서: 홈, 메모, 계층, 음성" "#0f766e"
    Draw-Card $g 174 1060 732 220 "저녁 정리" "완료한 일과 남은 일을 간단히 기록하고 내일 할 일을 연결합니다." "#9333ea"
    Draw-Text $g "+ 새 메모" (Font 28 ([System.Drawing.FontStyle]::Bold)) "#ffffff" 384 1440 312 58 "Center"
    $btn = New-Object System.Drawing.SolidBrush (Color "#2563eb")
    Fill-RoundRect $g $btn 372 1424 336 76 38
    Draw-Text $g "+ 새 메모" (Font 28 ([System.Drawing.FontStyle]::Bold)) "#ffffff" 372 1442 336 44 "Center"
    $btn.Dispose()
    $g.Dispose()
    $path = Save-Png $bmp "screenshot_02_daily_notes.png"
    $bmp.Dispose()
    return $path
}

function New-TreeScreenshot {
    $bmp = New-Bitmap 1080 1920
    $g = Setup-Graphics $bmp
    Draw-PhoneFrame $g
    Draw-Header $g "계층 메모" "생각과 자료를 부모, 자식, 손자 구조로 연결합니다."
    Draw-Card $g 174 430 732 160 "프로젝트 준비" "출시 전 확인해야 할 큰 항목" "#2563eb"
    Draw-Card $g 224 640 682 150 "등록 자료" "설명 문구, 개인정보처리방침, 이미지" "#0f766e"
    Draw-Card $g 274 840 632 150 "스크린샷" "홈, 메모, 계층, 음성 화면 준비" "#9333ea"
    Draw-Card $g 224 1040 682 150 "빌드 점검" "AAB, 서명, 권한, 설치 테스트" "#ea580c"
    $pen = New-Object System.Drawing.Pen (Color "#cbd5e1"), 4
    $g.DrawLine($pen, 218, 590, 218, 1110)
    $g.DrawLine($pen, 218, 715, 224, 715)
    $g.DrawLine($pen, 218, 915, 274, 915)
    $g.DrawLine($pen, 218, 1115, 224, 1115)
    $pen.Dispose()
    Draw-Text $g "복잡한 기록도 구조를 유지하며 정리할 수 있습니다." (Font 24) "#667085" 174 1340 732 80 "Center"
    $g.Dispose()
    $path = Save-Png $bmp "screenshot_03_tree_notes.png"
    $bmp.Dispose()
    return $path
}

function New-VoiceScreenshot {
    $bmp = New-Bitmap 1080 1920
    $g = Setup-Graphics $bmp
    Draw-PhoneFrame $g
    Draw-Header $g "음성 기록" "말로 남긴 내용을 개인 기록으로 빠르게 저장합니다."
    $circle = New-Object System.Drawing.SolidBrush (Color "#eff6ff")
    $accent = New-Object System.Drawing.SolidBrush (Color "#2563eb")
    $line = New-Object System.Drawing.Pen (Color "#bfdbfe"), 4
    $g.FillEllipse($circle, 294, 490, 492, 492)
    $g.DrawEllipse($line, 294, 490, 492, 492)
    $g.FillEllipse($accent, 438, 634, 204, 204)
    Draw-Text $g "음성" (Font 38 ([System.Drawing.FontStyle]::Bold)) "#ffffff" 438 702 204 60 "Center"
    Draw-Card $g 174 1060 732 180 "녹음 내용" "회의 중 나온 핵심 아이디어를 바로 기록합니다." "#2563eb"
    Draw-Card $g 174 1280 732 180 "저장 방식" "필요한 메모에 연결하고 나중에 다시 확인합니다." "#0f766e"
    Draw-Text $g "권한은 사용자가 허용한 경우에만 요청됩니다." (Font 23) "#667085" 174 1540 732 44 "Center"
    $circle.Dispose()
    $accent.Dispose()
    $line.Dispose()
    $g.Dispose()
    $path = Save-Png $bmp "screenshot_04_voice.png"
    $bmp.Dispose()
    return $path
}

function New-FeatureGraphic {
    $bmp = New-Bitmap 1024 500
    $g = Setup-Graphics $bmp
    $bg = New-Object System.Drawing.SolidBrush (Color "#eff6ff")
    $white = New-Object System.Drawing.SolidBrush (Color "#ffffff")
    $blue = New-Object System.Drawing.SolidBrush (Color "#2563eb")
    $green = New-Object System.Drawing.SolidBrush (Color "#0f766e")
    Fill-RoundRect $g $bg 0 0 1024 500 0
    Draw-Text $g "NowNote" (Font 56 ([System.Drawing.FontStyle]::Bold)) "#101828" 64 76 420 76
    Draw-Text $g "메모, 음성 기록, 일정과 할 일을`n한곳에 정리하는 개인 기록 앱" (Font 34 ([System.Drawing.FontStyle]::Bold)) "#1d2433" 64 166 520 120
    Draw-Text $g "기록은 가볍게, 정리는 분명하게" (Font 25) "#667085" 66 310 500 42
    Fill-RoundRect $g $white 604 58 320 384 36
    Fill-RoundRect $g $blue 640 100 248 56 16
    Draw-Text $g "오늘 기록" (Font 24 ([System.Drawing.FontStyle]::Bold)) "#ffffff" 640 112 248 34 "Center"
    Fill-RoundRect $g $green 640 190 248 70 18
    Fill-RoundRect $g $blue 640 286 248 70 18
    Fill-RoundRect $g (New-Object System.Drawing.SolidBrush (Color "#9333ea")) 640 382 248 38 18
    Draw-Text $g "메모" (Font 22 ([System.Drawing.FontStyle]::Bold)) "#ffffff" 664 204 200 32
    Draw-Text $g "일정" (Font 22 ([System.Drawing.FontStyle]::Bold)) "#ffffff" 664 300 200 32
    Draw-Text $g "음성 기록" (Font 19 ([System.Drawing.FontStyle]::Bold)) "#ffffff" 664 386 200 30
    $bg.Dispose()
    $white.Dispose()
    $blue.Dispose()
    $green.Dispose()
    $g.Dispose()
    $path = Save-Png $bmp "feature_graphic_1024x500.png"
    $bmp.Dispose()
    return $path
}

function New-PlayAppIcon {
    $source = Join-Path (Split-Path -Parent $OutDir) "..\assets\icon\app_icon.png"
    $source = [System.IO.Path]::GetFullPath($source)
    if (-not (Test-Path $source)) {
        throw "앱 아이콘 원본을 찾을 수 없습니다: $source"
    }

    $img = [System.Drawing.Image]::FromFile($source)
    try {
        $bmp = New-Bitmap 512 512
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        try {
            $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $g.DrawImage($img, 0, 0, 512, 512)
            $path = Save-Png $bmp "app_icon_512.png"
        }
        finally {
            $g.Dispose()
            $bmp.Dispose()
        }
    }
    finally {
        $img.Dispose()
    }
    return $path
}

$created = @()
$created += New-PlayAppIcon
$created += New-FeatureGraphic
$created += New-HomeScreenshot
$created += New-DailyNoteScreenshot
$created += New-TreeScreenshot
$created += New-VoiceScreenshot

$created | ForEach-Object { Write-Output $_ }
