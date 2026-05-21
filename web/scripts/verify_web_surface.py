from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
APP = ROOT / "app.js"
STYLES = ROOT / "styles.css"
README = ROOT / "README.md"

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

    for path in [INDEX, APP, STYLES, README]:
        check(path.exists(), f"{path.name} exists", str(path), failures)

    if failures:
        raise SystemExit(1)

    html = INDEX.read_text(encoding="utf-8")
    app = APP.read_text(encoding="utf-8")
    styles = STYLES.read_text(encoding="utf-8")
    readme = README.read_text(encoding="utf-8")

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
        ("archivedDaily", "daily archive state"),
        ("selected.level >= 3", "tree depth guard"),
        ("serverUserTokenInput", "public server user token input"),
    ]
    for needle, label in app_requirements:
        check(needle in app, f"Web app has {label}", needle, failures)

    style_requirements = [
        (".daily-popover", "daily popover styling"),
        (".open-tabs-bar", "open tabs styling"),
        (".note-find-bar", "in-note search styling"),
        (".markdown-preview", "Markdown preview styling"),
        (".server-settings-form", "server settings styling"),
        (".shortcut-groups", "shortcut settings styling"),
        (".deleted-toolbar", "deleted bin toolbar styling"),
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
    ]
    for needle, label in readme_requirements:
        check(needle in readme, f"Web README has {label}", needle, failures)

    if failures:
        print(f"\nWeb surface verification failed ({CHECK_PASSED}/{CHECK_TOTAL} checks):")
        for failure in failures:
            print(f"- {failure}")
        raise SystemExit(1)

    print(f"NowNote web surface verification passed ({CHECK_PASSED}/{CHECK_TOTAL} checks)")


if __name__ == "__main__":
    main()
