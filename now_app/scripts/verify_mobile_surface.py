from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / "lib"
ANDROID = ROOT / "android"
README = ROOT / "README.md"

FILES = {
    "app router": LIB / "core" / "router" / "app_router.dart",
    "home page": LIB / "features" / "home" / "home_page.dart",
    "memo list": LIB / "features" / "meeting" / "meetings_page.dart",
    "daily memo start": LIB / "features" / "meeting" / "memo_start_page.dart",
    "tree memo": LIB / "features" / "meeting" / "memo_tree_page.dart",
    "meeting progress": LIB / "features" / "meeting" / "meeting_progress_page.dart",
    "server settings": LIB / "features" / "settings" / "server_settings_page.dart",
    "help page": LIB / "features" / "settings" / "help_page.dart",
    "server sync service": LIB / "services" / "server_sync_service.dart",
    "backup service": LIB / "services" / "backup_service.dart",
    "android build": ANDROID / "app" / "build.gradle.kts",
    "android gradle properties": ANDROID / "gradle.properties",
    "android manifest": ANDROID / "app" / "src" / "main" / "AndroidManifest.xml",
    "android backup rules": ANDROID / "app" / "src" / "main" / "res" / "xml" / "backup_rules.xml",
    "android data extraction": ANDROID / "app" / "src" / "main" / "res" / "xml" / "data_extraction_rules.xml",
    "mobile README": README,
    "mobile runtime checklist": ROOT / "docs" / "mobile_runtime_checklist_ko.md",
}

CHECK_TOTAL = 0
CHECK_PASSED = 0


def check(condition: bool, name: str, detail: str, failures: list[str]) -> None:
    global CHECK_TOTAL, CHECK_PASSED
    CHECK_TOTAL += 1
    prefix = "[OK]" if condition else "[FAIL]"
    print(f"{prefix} {name} - {detail}")
    if condition:
        CHECK_PASSED += 1
    else:
        failures.append(f"{name}: {detail}")


def require_text(text: str, requirements: list[tuple[str, str]], source: str, failures: list[str]) -> None:
    for needle, label in requirements:
        check(needle in text, f"Mobile has {label}", f"{source}: {needle}", failures)


def main() -> None:
    failures: list[str] = []

    for label, path in FILES.items():
        check(path.exists(), f"Mobile {label} file exists", str(path), failures)

    if failures:
        raise SystemExit(1)

    router = FILES["app router"].read_text(encoding="utf-8")
    home = FILES["home page"].read_text(encoding="utf-8")
    meetings = FILES["memo list"].read_text(encoding="utf-8")
    memo_start = FILES["daily memo start"].read_text(encoding="utf-8")
    memo_tree = FILES["tree memo"].read_text(encoding="utf-8")
    meeting_progress = FILES["meeting progress"].read_text(encoding="utf-8")
    server_settings = FILES["server settings"].read_text(encoding="utf-8")
    server_sync = FILES["server sync service"].read_text(encoding="utf-8")
    help_page = FILES["help page"].read_text(encoding="utf-8")
    backup_service = FILES["backup service"].read_text(encoding="utf-8")
    android_build = FILES["android build"].read_text(encoding="utf-8")
    android_gradle_properties = FILES["android gradle properties"].read_text(encoding="utf-8")
    manifest = FILES["android manifest"].read_text(encoding="utf-8")
    backup_rules = FILES["android backup rules"].read_text(encoding="utf-8")
    data_extraction = FILES["android data extraction"].read_text(encoding="utf-8")
    readme = README.read_text(encoding="utf-8")
    runtime_checklist = FILES["mobile runtime checklist"].read_text(encoding="utf-8")

    require_text(router, [("MemoStartPage", "daily memo route"), ("MemoTreePage", "tree memo route"), ("ServerSettingsPage", "server settings route"), ("voiceInputMode", "voice input mode routing")], "router", failures)
    require_text(home, [("오늘 메모", "home daily memo card"), ("context.push('/memo/start'", "home memo start entry")], "home", failures)
    require_text(meetings, [("일자별 메모", "daily memo overview"), ("계층 메모", "tree memo overview"), ("TableCalendar", "daily calendar overview")], "meetings", failures)
    require_text(memo_start, [("getDailyMemoByDate", "single daily memo append model"), ("recordType: 'memo'", "daily memo record type"), ("실시간 변환", "realtime voice option"), ("녹음 후 변환", "record-then-transcribe option"), ("voiceInputMode", "daily voice mode forwarding")], "memo_start", failures)
    require_text(memo_tree, [("MemoTreePage", "tree memo screen"), ("note_tree", "tree memo source"), ("node.level >= 3", "tree depth guard"), ("실시간 변환", "tree realtime voice option"), ("녹음 후 변환", "tree record-then-transcribe option"), ("uploadRecordingFile", "tree recording upload"), ("createAnalysisJob", "tree server analysis job"), ("삭제 보관함", "tree deleted bin")], "memo_tree", failures)
    require_text(meeting_progress, [("record_then_transcribe", "record-then-transcribe progress mode"), ("FlutterSoundRecorder", "recording support"), ("SpeechToText", "realtime speech support"), ("FilePicker.platform.pickFiles", "file import support")], "meeting_progress", failures)
    require_text(server_settings, [("_twoFactorCodeCtrl", "request-only two-factor code input"), ("twoFactorCode: _twoFactorCodeCtrl.text", "two-factor code request forwarding"), ("메모 동기화", "server memo sync button"), ("전체 다시 동기화", "server full sync button"), ("사용자 프로필", "server user profile section"), ("분석 작업", "server analysis section"), ("녹음 목록 새로고침", "server recording list refresh")], "server_settings", failures)
    require_text(server_sync, [("FlutterSecureStorage", "secure token storage"), ("testConnection", "server connection test"), ("_verifyUserToken", "per-user token verification"), ("syncNotes", "note sync"), ("_dailyMemoPayloads", "daily memo sync payload"), ("note_tree", "tree memo sync payload"), ("uploadRecordingFile", "recording upload"), ("createAnalysisJob", "analysis job API"), ("twoFactorCode.trim()", "request-only two-factor validation")], "server_sync", failures)
    require_text(help_page, [("일자별 메모는 하루 한 개의 메모장", "daily memo help"), ("Markdown 가져오기는 외부 .md/.txt 파일", "Markdown import help"), ("공용 서버 오픈 전", "public server help")], "help_page", failures)
    require_text(backup_service, [("NowNote 백업", "mobile backup subject"), ("FilePicker.platform.pickFiles", "mobile backup import")], "backup_service", failures)
    require_text(android_build, [('namespace = "com.sinsan.nownote"', "NowNote Android namespace"), ('applicationId = "com.sinsan.nownote"', "NowNote Android applicationId")], "android_build", failures)
    require_text(android_gradle_properties, [("-Xmx2G", "bounded Gradle JVM heap"), ("org.gradle.workers.max=2", "bounded Gradle workers")], "android_gradle_properties", failures)
    require_text(manifest, [('android:label="NowNote"', "NowNote Android label"), ("android.permission.RECORD_AUDIO", "microphone permission"), ("android.permission.CAMERA", "camera permission"), ("android.permission.POST_NOTIFICATIONS", "notification permission"), ("android:dataExtractionRules", "Android data extraction rules link"), ("android:fullBackupContent", "Android backup rules link")], "manifest", failures)
    require_text(backup_rules, [('domain="database"', "backup excludes database"), ('domain="sharedpref"', "backup excludes shared preferences"), ('domain="file"', "backup excludes files")], "backup_rules", failures)
    require_text(data_extraction, [("<cloud-backup>", "cloud backup policy"), ("<device-transfer>", "device transfer policy"), ('domain="database"', "cloud backup excludes database")], "data_extraction", failures)
    require_text(readme, [("NowNote 모바일 앱", "mobile README title"), ("음성 메모", "mobile README voice memo"), ("일자별 메모", "mobile README daily memo"), ("계층 메모", "mobile README tree memo"), ("서버 연결", "mobile README server connection"), ("2단계 인증 코드는 저장하지 않고", "mobile README request-only 2FA"), ("Markdown 가져오기는 외부 파일", "mobile README Markdown import"), ("mobile_runtime_checklist_ko.md", "mobile README runtime checklist link")], "README", failures)
    require_text(runtime_checklist, [("Android 에뮬레이터", "runtime checklist emulator scope"), ("실제 Android 기기", "runtime checklist physical device scope"), ("홈의 오늘 메모", "runtime checklist home daily memo"), ("같은 메모장에 이어서 저장", "runtime checklist daily append model"), ("3단계 메모 아래에는 더 이상 하위 메모", "runtime checklist tree depth guard"), ("실시간 변환", "runtime checklist realtime voice"), ("녹음 후 변환", "runtime checklist record-then-transcribe"), ("새 지식 메모로 추가", "runtime checklist Markdown import copy model"), ("10.0.2.2", "runtime checklist emulator server URL"), ("2단계 인증 코드는 저장되지 않고", "runtime checklist request-only 2FA")], "runtime checklist", failures)

    if failures:
        print(f"\nMobile surface verification failed ({CHECK_PASSED}/{CHECK_TOTAL} checks):")
        for failure in failures:
            print(f"- {failure}")
        raise SystemExit(1)

    print(f"NowNote mobile surface verification passed ({CHECK_PASSED}/{CHECK_TOTAL} checks)")


if __name__ == "__main__":
    main()
