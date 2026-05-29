from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
APP = ROOT / "app.js"
STYLES = ROOT / "styles.css"
README = ROOT / "README.md"
MANIFEST = ROOT / "manifest.webmanifest"
SERVICE_WORKER = ROOT / "sw.js"
ICON = ROOT / "icons" / "nownote-icon.svg"
RUNTIME_CHECKLIST = ROOT / "runtime_checklist_ko.md"
PACKAGE_SCRIPT = ROOT / "scripts" / "package_web.py"
IMPORT_EXPORT_CHECK = ROOT / "scripts" / "check_import_export.mjs"
DESKTOP = ROOT.parent / "desktop"
DESKTOP_PACKAGE = DESKTOP / "package.json"
DESKTOP_MAIN = DESKTOP / "main.cjs"
DESKTOP_PRELOAD = DESKTOP / "preload.cjs"
DESKTOP_SYNC_SCRIPT = DESKTOP / "scripts" / "sync-web-assets.mjs"
DESKTOP_README = DESKTOP / "README.md"
DESKTOP_ICON = DESKTOP / "build" / "icon.ico"

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


def has_id(html: str, element_id: str) -> bool:
    return re.search(rf'\bid="{re.escape(element_id)}"', html) is not None


def main() -> None:
    failures: list[str] = []

    for path in [
        INDEX,
        APP,
        STYLES,
        README,
        MANIFEST,
        SERVICE_WORKER,
        ICON,
        RUNTIME_CHECKLIST,
        PACKAGE_SCRIPT,
        IMPORT_EXPORT_CHECK,
        DESKTOP_PACKAGE,
        DESKTOP_MAIN,
        DESKTOP_PRELOAD,
        DESKTOP_SYNC_SCRIPT,
        DESKTOP_README,
        DESKTOP_ICON,
    ]:
        check(path.exists(), f"{path.name} exists", str(path), failures)

    if failures:
        raise SystemExit(1)

    html = INDEX.read_text(encoding="utf-8")
    app = APP.read_text(encoding="utf-8")
    styles = STYLES.read_text(encoding="utf-8")
    readme = README.read_text(encoding="utf-8")
    manifest = MANIFEST.read_text(encoding="utf-8")
    service_worker = SERVICE_WORKER.read_text(encoding="utf-8")
    icon = ICON.read_text(encoding="utf-8")
    runtime_checklist = RUNTIME_CHECKLIST.read_text(encoding="utf-8")
    package_script = PACKAGE_SCRIPT.read_text(encoding="utf-8")
    import_export_check = IMPORT_EXPORT_CHECK.read_text(encoding="utf-8")
    desktop_package = DESKTOP_PACKAGE.read_text(encoding="utf-8")
    desktop_main = DESKTOP_MAIN.read_text(encoding="utf-8")
    desktop_sync_script = DESKTOP_SYNC_SCRIPT.read_text(encoding="utf-8")
    desktop_readme = DESKTOP_README.read_text(encoding="utf-8")

    html_requirements = [
        ("<title>NowNote</title>", "app title without Web suffix"),
        ('rel="manifest"', "PWA manifest link"),
        ('rel="icon"', "PWA icon link"),
        ("navigator.serviceWorker.register", "service worker registration"),
    ]
    for needle, label in html_requirements:
        check(needle in html, f"Web shell has {label}", needle, failures)
    check('id="helpBtn" class="ghost-btn help-link" href="./help.html"' in html, "Help link opens in same window", "helpBtn same-window link", failures)
    check('id="settingsHelpBtn" class="secondary-btn help-link" href="./help.html"' in html, "Settings help link opens in same window", "settingsHelpBtn same-window link", failures)

    required_ids = [
        ("treeList", "knowledge tree list"),
        ("treeTitleInput", "tree note title editor"),
        ("treeContent", "tree note content editor"),
        ("addRootBtn", "root topic add button"),
        ("addChildBtn", "child note add button"),
        ("deleteTreeBtn", "tree note delete button"),
        ("deletedTreeBtn", "deleted note bin button"),
        ("deletedBulkDeleteBtn", "bulk delete button"),
        ("dailyView", "daily note popover"),
        ("calendarGrid", "daily calendar"),
        ("dailyContent", "daily note editor"),
        ("archivePanel", "daily archive panel"),
        ("importMarkdownInput", "Markdown import input"),
        ("exportMarkdownBtn", "Markdown export button"),
        ("importMarkdownBtn", "Markdown import button"),
        ("markdownPreview", "Markdown preview"),
        ("searchInput", "global search input"),
        ("resultsList", "search result list"),
        ("noteFindInput", "in-note search input"),
        ("openTabs", "open tabs list"),
        ("shortcutEditor", "shortcut editor"),
        ("serverModeSelect", "server mode selector"),
        ("serverGuideIssue", "server token issue guide"),
        ("serverUserTokenHint", "per-user token hint"),
        ("serverTestBtn", "server test button"),
        ("serverSyncBtn", "server sync button"),
        ("serverFullSyncBtn", "full server sync button"),
        ("serverAnalysisCreateBtn", "server analysis create button"),
        ("languageSelect", "language selector"),
        ("confirmDialog", "internal confirm dialog"),
        ("webLoginView", "hosted Web login view"),
        ("webLoginForm", "hosted Web login form"),
        ("webLoginOwnerInput", "hosted Web owner ID input"),
        ("webLoginPasswordInput", "hosted Web password input"),
        ("webLoginTwoFactorInput", "hosted Web two-factor input"),
        ("webLogoutBtn", "hosted Web logout button"),
        ("shareTreeBtn", "knowledge note share toggle"),
    ]
    for element_id, label in required_ids:
        check(has_id(html, element_id), f"Web surface has {label}", element_id, failures)

    app_requirements = [
        ("function exportMarkdown()", "Markdown export function"),
        ("async function importMarkdownData", "Markdown import function"),
        ("function exportData()", "JSON export function"),
        ("function importData", "JSON import function"),
        ("function markdownToHtml", "Markdown preview renderer"),
        ("async function syncWebNotesToServer", "server sync function"),
        ("async function testServerConnection", "server connection test function"),
        ("async function handleWebLoginSubmit", "hosted Web login function"),
        ("async function handleWebLogout", "hosted Web logout function"),
        ("async function loadServerSharedNotes", "hosted Web shared document loader"),
        ("async function createSelectedNoteAnalysisJob", "server analysis job function"),
        ('"app.title": "NowNote"', "app title translation without Web suffix"),
        ("settings.server.guide.issue", "server token issue translation"),
        ("/api/v1/auth/web-login", "hosted Web password login API"),
        ("/api/v1/auth/web-session", "hosted Web session API"),
        ("/api/v1/auth/web-logout", "hosted Web logout API"),
        ("X-Now-Web-Session", "hosted Web session header"),
        ("function noteFindMatches", "in-note search function"),
        ("function renderOpenTreeTabs", "tab rendering function"),
        ("function normalizeShortcutSettings", "shortcut normalization"),
        ("state.data.daily", "daily note state"),
        ("function renderTodayMemoState", "daily chip refresh function"),
        ("archivedDaily", "daily archive state"),
        ("selected.level >= 3", "tree depth guard"),
        ("serverUserTokenInput", "public server user token input"),
        ("function isTreeNodeSharedForServer", "knowledge share filter"),
        ("if (parent.shared === false) return false", "ancestor share guard before server sync"),
        ("function confirmAction", "internal confirm dialog function"),
    ]
    for needle, label in app_requirements:
        check(needle in app, f"Web app has {label}", needle, failures)
    native_confirm_call = "confirm" + "("
    check(native_confirm_call not in app, "Web app avoids native browser confirm", native_confirm_call, failures)

    markdown_flow_requirements = [
        ('downloadText(`nownote-${fileTimestamp(new Date())}.md`, markdown, "text/markdown")', "Markdown export downloads .md file"),
        ("treeToMarkdown(state.data.tree)", "Markdown export includes tree notes"),
        ("dailyToMarkdown()", "Markdown export includes daily notes"),
        ("archivedDailyToMarkdown()", "Markdown export includes archived daily notes"),
        ("parseNowNoteMarkdownTree(content)", "Markdown import parses NowNote tree export"),
        ("parseNowNoteMarkdownDaily(content)", "Markdown import parses NowNote daily export"),
        ("parseNowNoteMarkdownArchivedDaily(content)", "Markdown import parses archived daily export"),
        ("titleFromMarkdownFile(file.name, content)", "Markdown import creates a topic from plain Markdown"),
        ("state.data.tree.push(...nodes)", "Markdown import adds tree nodes"),
        ("mergeImportedDailyNote(note)", "Markdown import merges daily notes"),
        ("showMarkdownImportResult(nodes, dailyNotes)", "Markdown import opens the imported result"),
    ]
    for needle, label in markdown_flow_requirements:
        check(needle in app, f"Web app supports {label}", needle, failures)

    backup_flow_requirements = [
        ("downloadCurrentBackup();", "JSON export delegates to backup download"),
        ('downloadText(`${prefix}-${fileTimestamp(new Date())}.json`, JSON.stringify(backup, null, 2), "application/json")', "JSON export downloads readable backup"),
        ("parseBackupData(parsed)", "JSON import parses backup shape"),
        ("backupSummary(imported.data)", "JSON import summarizes replacement data"),
        ('downloadCurrentBackup("nownote-before-import")', "JSON import saves pre-import backup"),
        ("state.data = backupDataShape(imported.data)", "JSON import replaces local data with normalized backup"),
        ("state.settings = normalizeSettings(imported.settings)", "JSON import restores settings when present"),
        ("persist();", "JSON import persists restored data"),
        ("showNotice(t(\"note.importDone\"), \"success\")", "JSON import reports success"),
    ]
    for needle, label in backup_flow_requirements:
        check(needle in app, f"Web app supports {label}", needle, failures)

    style_requirements = [
        (".daily-popover", "daily popover styling"),
        (".open-tabs-bar", "open tabs styling"),
        (".note-find-bar", "in-note search styling"),
        (".markdown-preview", "Markdown preview styling"),
        (".server-settings-form", "server settings styling"),
        (".shortcut-groups", "shortcut settings styling"),
        (".deleted-toolbar", "deleted bin toolbar styling"),
        (".confirm-backdrop", "internal confirm dialog styling"),
        (".confirm-backdrop.hidden", "internal confirm dialog hidden state"),
    ]
    for needle, label in style_requirements:
        check(needle in styles, f"Web style has {label}", needle, failures)

    readme_requirements = [
        ("일자별 메모", "daily notes documented"),
        ("지식 메모", "tree notes documented"),
        ("Markdown 내보내기", "Markdown import/export documented"),
        ("JSON 파일 기반 백업", "JSON backup documented"),
        ("본문 찾기", "in-note search documented"),
        ("단축키", "shortcuts documented"),
        ("서버 연결", "server connection documented"),
        ("서버 공유 문서가 원본", "hosted Web server source documented"),
        ("사용자 ID와 비밀번호", "hosted Web password login documented"),
        ("중간 단계가 없는 손자 메모", "hierarchy guard documented"),
        ("설치형 프로그램", "desktop packaging direction documented"),
        ("PWA 설치", "PWA install direction documented"),
        ("Windows `.exe` 설치형 프로그램", "Windows exe install direction documented"),
        ("runtime_checklist_ko.md", "runtime checklist documented"),
    ]
    for needle, label in readme_requirements:
        check(needle in readme, f"Web README has {label}", needle, failures)

    runtime_checklist_requirements = [
        ("python -m http.server 8761 --bind 127.0.0.1", "runtime checklist local server command"),
        ("http://127.0.0.1:8761/index.html", "runtime checklist local browser URL"),
        ("주제를 추가", "runtime checklist tree topic flow"),
        ("3단계 메모 아래에는 더 이상 하위 메모", "runtime checklist tree depth guard"),
        ("같은 메모장에 이어서 저장", "runtime checklist daily append model"),
        ("Markdown 내보내기", "runtime checklist Markdown export"),
        ("Markdown 가져오기", "runtime checklist Markdown import"),
        ("JSON 내보내기", "runtime checklist JSON export"),
        ("JSON 가져오기는 현재 상태를 먼저 자동 백업", "runtime checklist JSON restore safeguard"),
        ("PWA 설치형 점검", "runtime checklist PWA install section"),
        ("독립 창으로 NowNote가 열린다", "runtime checklist standalone window"),
        ("서버 capability", "runtime checklist server capability display"),
        ("Failed to fetch", "runtime checklist fetch troubleshooting"),
    ]
    for needle, label in runtime_checklist_requirements:
        check(needle in runtime_checklist, f"Web runtime checklist has {label}", needle, failures)

    manifest_requirements = [
        ('"name": "NowNote"', "manifest app name"),
        ('"display": "standalone"', "manifest standalone display"),
        ('"start_url": "./index.html"', "manifest start URL"),
        ('"theme_color"', "manifest theme color"),
        ('"icons"', "manifest icon list"),
    ]
    for needle, label in manifest_requirements:
        check(needle in manifest, f"Web manifest has {label}", needle, failures)

    service_worker_requirements = [
        ("CACHE_NAME", "cache version"),
        ("APP_SHELL", "app shell list"),
        ("self.addEventListener(\"install\"", "install handler"),
        ("self.addEventListener(\"activate\"", "activate handler"),
        ("self.addEventListener(\"fetch\"", "fetch handler"),
        ("caches.match", "cache-first response"),
    ]
    for needle, label in service_worker_requirements:
        check(needle in service_worker, f"Web service worker has {label}", needle, failures)

    package_script_requirements = [
        ("nownote-web-pwa.zip", "PWA zip output"),
        ("index.html", "PWA index included"),
        ("manifest.webmanifest", "PWA manifest included"),
        ("sw.js", "PWA service worker included"),
        ("icons", "PWA icons included"),
    ]
    for needle, label in package_script_requirements:
        check(needle in package_script, f"Web package script has {label}", needle, failures)

    import_export_requirements = [
        ("DOM.setFileInputFiles", "file input upload through browser"),
        ("exportMarkdownBtn", "Markdown export click"),
        ("importMarkdownInput", "Markdown import input"),
        ("exportBtn", "JSON export click"),
        ("importInput", "JSON import input"),
        ("nownote-before-import", "pre-import JSON backup"),
        ("JSON 복원 주제", "JSON restore assertion"),
    ]
    for needle, label in import_export_requirements:
        check(needle in import_export_check, f"Web import/export check has {label}", needle, failures)

    desktop_package_requirements = [
        ('"electron"', "Electron dependency"),
        ('"electron-builder"', "electron-builder dependency"),
        ('"dist:win"', "Windows installer build script"),
        ('"target": "nsis"', "NSIS installer target"),
        ("NowNote-Setup", "installer artifact name"),
        ('"icon": "build/icon.ico"', "Windows installer icon"),
    ]
    for needle, label in desktop_package_requirements:
        check(needle in desktop_package, f"Desktop package has {label}", needle, failures)

    desktop_main_requirements = [
        ("BrowserWindow", "Electron BrowserWindow"),
        ("loadFile", "local Web app loading"),
        ("index.html", "Web entry file loading"),
        ("setWindowOpenHandler", "external link handler"),
        ("Menu.setApplicationMenu", "desktop menu"),
    ]
    for needle, label in desktop_main_requirements:
        check(needle in desktop_main, f"Desktop main has {label}", needle, failures)

    desktop_sync_requirements = [
        ("webRoot", "Web source root"),
        ("targetRoot", "desktop app target"),
        ("index.html", "index asset copy"),
        ("app.js", "app asset copy"),
        ("styles.css", "style asset copy"),
        ("help.html", "help asset copy"),
        ("icons", "icon directory copy"),
    ]
    for needle, label in desktop_sync_requirements:
        check(needle in desktop_sync_script, f"Desktop sync script has {label}", needle, failures)

    desktop_readme_requirements = [
        (".exe", "exe installer documentation"),
        ("npm run dist:win", "Windows build command documentation"),
        ("NowNote-Setup-0.1.0-x64.exe", "installer output documentation"),
        ("공용 서버", "public server connection documentation"),
    ]
    for needle, label in desktop_readme_requirements:
        check(needle in desktop_readme, f"Desktop README has {label}", needle, failures)

    icon_requirements = [
        ("<svg", "SVG icon root"),
        ("NowNote", "icon title"),
        ("<circle", "clock mark"),
        ("<path", "note mark"),
    ]
    for needle, label in icon_requirements:
        check(needle in icon, f"Web install icon has {label}", needle, failures)

    if failures:
        print(f"\nWeb surface verification failed ({CHECK_PASSED}/{CHECK_TOTAL} checks):")
        for failure in failures:
            print(f"- {failure}")
        raise SystemExit(1)

    print(f"NowNote web surface verification passed ({CHECK_PASSED}/{CHECK_TOTAL} checks)")


if __name__ == "__main__":
    main()
