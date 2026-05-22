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

    for path in [INDEX, APP, STYLES, README, MANIFEST, SERVICE_WORKER, ICON]:
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

    html_requirements = [
        ('rel="manifest"', "PWA manifest link"),
        ('rel="icon"', "PWA icon link"),
        ("navigator.serviceWorker.register", "service worker registration"),
    ]
    for needle, label in html_requirements:
        check(needle in html, f"Web shell has {label}", needle, failures)

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
        ("serverTestBtn", "server test button"),
        ("serverSyncBtn", "server sync button"),
        ("serverFullSyncBtn", "full server sync button"),
        ("serverAnalysisCreateBtn", "server analysis create button"),
        ("languageSelect", "language selector"),
        ("confirmDialog", "internal confirm dialog"),
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
        ("async function createSelectedNoteAnalysisJob", "server analysis job function"),
        ("function noteFindMatches", "in-note search function"),
        ("function renderOpenTreeTabs", "tab rendering function"),
        ("function normalizeShortcutSettings", "shortcut normalization"),
        ("state.data.daily", "daily note state"),
        ("function renderTodayMemoState", "daily chip refresh function"),
        ("archivedDaily", "daily archive state"),
        ("selected.level >= 3", "tree depth guard"),
        ("serverUserTokenInput", "public server user token input"),
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
        ("설치형 프로그램", "desktop packaging direction documented"),
        ("PWA 설치", "PWA install direction documented"),
    ]
    for needle, label in readme_requirements:
        check(needle in readme, f"Web README has {label}", needle, failures)

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
