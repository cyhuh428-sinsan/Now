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
DESKTOP_POLICY_CHECK = ROOT / "scripts" / "check_desktop_client_policies.mjs"
GRAPH_VIEW_CHECK = ROOT / "scripts" / "check_graph_view.mjs"
GRAPH_DESIGN = ROOT.parent / "docs" / "NOW_1_2_GRAPH_VIEW_DESIGN.md"
PROPERTIES_DESIGN = ROOT.parent / "docs" / "NOW_1_3_PROPERTIES_DESIGN.md"
CANVAS_DESIGN = ROOT.parent / "docs" / "NOW_1_4_CANVAS_DESIGN.md"
CAPTURE_DESIGN = ROOT.parent / "docs" / "NOW_1_5_QUICK_CAPTURE_MEDIA_DESIGN.md"
COMMAND_DESIGN = ROOT.parent / "docs" / "NOW_1_6_WRITING_COMMAND_DESIGN.md"
RECOVERY_IMPORT_DESIGN = ROOT.parent / "docs" / "NOW_1_7_RECOVERY_IMPORT_DESIGN.md"
PUBLISH_SLIDES_DESIGN = ROOT.parent / "docs" / "NOW_1_8_PUBLISH_SLIDES_DESIGN.md"
WORKSPACE_OPERATIONS_DESIGN = ROOT.parent / "docs" / "NOW_1_9_WORKSPACE_OPERATIONS_DESIGN.md"
GROUP_SHARED_VIEWS_DESIGN = ROOT.parent / "docs" / "NOW_2_1_WEB_GROUP_SHARED_VIEWS_DESIGN.md"
GROUP_MESSENGER_DESIGN = ROOT.parent / "docs" / "NOW_2_2_GROUP_MESSENGER_DESIGN.md"
LIGHTWEIGHT_RUNTIME_DESIGN = ROOT.parent / "docs" / "NOW_2_3_LIGHTWEIGHT_RUNTIME_REDESIGN.md"
GROUP_MESSENGER_ADVANCED_DESIGN = ROOT.parent / "docs" / "NOW_2_3_GROUP_MESSENGER_ATTACHMENTS_AND_ROOMS_DESIGN.md"
DESKTOP = ROOT.parent / "desktop"
DESKTOP_PACKAGE = DESKTOP / "package.json"
DESKTOP_MAIN = DESKTOP / "main.cjs"
DESKTOP_PRELOAD = DESKTOP / "preload.cjs"
DESKTOP_APP_INDEX = DESKTOP / "app" / "index.html"
DESKTOP_APP_SCRIPT = DESKTOP / "app" / "app.js"
DESKTOP_APP_STYLES = DESKTOP / "app" / "styles.css"
DESKTOP_APP_HELP = DESKTOP / "app" / "help.html"
DESKTOP_STORAGE_CHECK = DESKTOP / "scripts" / "check-desktop-storage.mjs"
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
        DESKTOP_POLICY_CHECK,
        GRAPH_VIEW_CHECK,
        GRAPH_DESIGN,
        PROPERTIES_DESIGN,
        CANVAS_DESIGN,
        CAPTURE_DESIGN,
        COMMAND_DESIGN,
        RECOVERY_IMPORT_DESIGN,
        PUBLISH_SLIDES_DESIGN,
        WORKSPACE_OPERATIONS_DESIGN,
        GROUP_SHARED_VIEWS_DESIGN,
        GROUP_MESSENGER_DESIGN,
        LIGHTWEIGHT_RUNTIME_DESIGN,
        GROUP_MESSENGER_ADVANCED_DESIGN,
        DESKTOP_PACKAGE,
        DESKTOP_MAIN,
        DESKTOP_PRELOAD,
        DESKTOP_APP_INDEX,
        DESKTOP_APP_SCRIPT,
        DESKTOP_APP_STYLES,
        DESKTOP_APP_HELP,
        DESKTOP_STORAGE_CHECK,
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
    desktop_policy_check = DESKTOP_POLICY_CHECK.read_text(encoding="utf-8")
    graph_view_check = GRAPH_VIEW_CHECK.read_text(encoding="utf-8")
    graph_design = GRAPH_DESIGN.read_text(encoding="utf-8")
    properties_design = PROPERTIES_DESIGN.read_text(encoding="utf-8")
    canvas_design = CANVAS_DESIGN.read_text(encoding="utf-8")
    capture_design = CAPTURE_DESIGN.read_text(encoding="utf-8")
    command_design = COMMAND_DESIGN.read_text(encoding="utf-8")
    recovery_import_design = RECOVERY_IMPORT_DESIGN.read_text(encoding="utf-8")
    publish_slides_design = PUBLISH_SLIDES_DESIGN.read_text(encoding="utf-8")
    desktop_package = DESKTOP_PACKAGE.read_text(encoding="utf-8")
    desktop_main = DESKTOP_MAIN.read_text(encoding="utf-8")
    desktop_preload = DESKTOP_PRELOAD.read_text(encoding="utf-8")
    desktop_app_index = DESKTOP_APP_INDEX.read_text(encoding="utf-8")
    desktop_app_script = DESKTOP_APP_SCRIPT.read_text(encoding="utf-8")
    desktop_app_styles = DESKTOP_APP_STYLES.read_text(encoding="utf-8")
    desktop_app_help = DESKTOP_APP_HELP.read_text(encoding="utf-8")
    desktop_storage_check = DESKTOP_STORAGE_CHECK.read_text(encoding="utf-8")
    desktop_readme = DESKTOP_README.read_text(encoding="utf-8")

    html_requirements = [
        ("<title>NowNote</title>", "app title without Web suffix"),
        ('rel="manifest"', "PWA manifest link"),
        ('rel="icon"', "PWA icon link"),
        ("navigator.serviceWorker.register", "service worker registration"),
        ("hosted-web-only hidden", "group shared view menu hosted Web visibility guard"),
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
        ("sharedMineNavBtn", "my shared notes view button"),
        ("sharedGroupTreeNavBtn", "group knowledge tree view button"),
        ("sharedMemberNavBtn", "member shared documents view button"),
        ("groupMessengerBtn", "group messenger button"),
        ("groupMessengerUnreadCount", "group messenger unread count"),
        ("groupMessengerView", "group messenger view"),
        ("groupMessengerRoomList", "group messenger room list"),
        ("groupMessengerNewRoomBtn", "group messenger room create button"),
        ("groupMessengerList", "group messenger list"),
        ("groupMessengerFileInput", "group messenger attachment input"),
        ("groupMessengerAttachBtn", "group messenger attachment button"),
        ("groupMessengerInput", "group messenger input"),
        ("groupMessengerSendBtn", "group messenger send button"),
        ("noteActionMenuBtn", "note action menu button"),
        ("noteActionMenu", "note action menu"),
        ("noteFindInput", "in-note search input"),
        ("openTabs", "open tabs list"),
        ("shortcutEditor", "shortcut editor"),
        ("tabIndentSelect", "Tab indent size setting"),
        ("serverModeSelect", "server mode selector"),
        ("serverGuideIssue", "server token issue guide"),
        ("serverUserTokenHint", "per-user token hint"),
        ("serverAutoSyncToggle", "desktop auto sync toggle"),
        ("serverConflictBox", "server conflict box"),
        ("serverConflictList", "server conflict list"),
        ("serverTestBtn", "server test button"),
        ("serverSyncBtn", "server sync button"),
        ("serverFullSyncBtn", "full server sync button"),
        ("serverAnalysisTypeSelect", "server analysis job type selector"),
        ("serverAnalysisCreateBtn", "server analysis create button"),
        ("languageSelect", "language selector"),
        ("confirmDialog", "internal confirm dialog"),
        ("webLoginView", "hosted Web login view"),
        ("webLoginForm", "hosted Web login form"),
        ("webLoginDesc", "hosted Web login description"),
        ("webLoginOwnerInput", "hosted Web owner ID input"),
        ("webLoginPasswordLabel", "hosted Web password label"),
        ("webLoginPasswordInput", "hosted Web password input"),
        ("webRegisterEmailInput", "hosted Web registration email input"),
        ("webLoginTwoFactorInput", "hosted Web two-factor input"),
        ("webRegisterSubmitBtn", "hosted Web self-registration button"),
        ("webResetRequestBtn", "hosted Web password reset request button"),
        ("webResetConfirmBtn", "hosted Web password reset confirm button"),
        ("webResetCodeInput", "hosted Web password reset code input"),
        ("webLogoutBtn", "hosted Web logout button"),
        ("hostedDeviceTokenBox", "hosted Web device token box"),
        ("deviceTokenIssueBtn", "hosted Web device token issue button"),
        ("deviceTokenText", "hosted Web device token output"),
        ("desktopStorageRow", "desktop local storage status row"),
        ("desktopStorageStatus", "desktop local storage status text"),
        ("desktopStoragePath", "desktop local storage path"),
        ("shareTreeBtn", "knowledge note share toggle"),
        ("graphModeSelect", "graph mode selector"),
        ("graphDepthSelect", "local graph depth selector"),
        ("graphFilterInput", "graph search filter"),
        ("graphTagSelect", "graph tag filter"),
        ("graphGroupSelect", "graph group selector"),
        ("graphBookmarkSaveBtn", "graph bookmark save button"),
        ("graphBookmarkSelect", "graph bookmark selector"),
        ("graphSummary", "graph summary"),
        ("graphCanvas", "graph canvas"),
        ("graphOutgoingList", "graph outgoing link list"),
        ("graphBacklinkList", "graph backlink list"),
        ("graphSuggestionsList", "graph unlinked mention list"),
        ("graphIsolatedList", "graph isolated note list"),
        ("graphHubList", "graph hub note list"),
        ("propertiesBtn", "properties view button"),
        ("notePropertiesPanel", "note properties editor panel"),
        ("propertyStatusSelect", "note property status selector"),
        ("propertyPrioritySelect", "note property priority selector"),
        ("propertyTypeInput", "note property type input"),
        ("propertyProjectInput", "note property project input"),
        ("propertySourceInput", "note property source input"),
        ("propertyAuthorInput", "note property author input"),
        ("propertyDueInput", "note property due date input"),
        ("propertiesView", "properties view"),
        ("propertiesSearchInput", "properties search filter"),
        ("propertiesStatusFilter", "properties status filter"),
        ("propertiesPriorityFilter", "properties priority filter"),
        ("propertiesGroupSelect", "properties group selector"),
        ("propertiesFilterSaveBtn", "properties saved filter button"),
        ("propertiesSavedFilterSelect", "properties saved filter selector"),
        ("propertiesList", "properties list"),
        ("propertiesMissingList", "missing properties list"),
        ("propertyTemplateSelect", "property template selector"),
        ("propertyTemplateCreateBtn", "property template create button"),
        ("canvasBtn", "Canvas view button"),
        ("canvasView", "Canvas view"),
        ("canvasTitleInput", "Canvas title input"),
        ("canvasAddNoteBtn", "Canvas note card button"),
        ("canvasAddTextBtn", "Canvas text card button"),
        ("canvasConnectBtn", "Canvas connect button"),
        ("canvasDraftFromGraphBtn", "Canvas graph draft button"),
        ("canvasZoomOutBtn", "Canvas zoom out button"),
        ("canvasZoomInBtn", "Canvas zoom in button"),
        ("canvasFitBtn", "Canvas fit button"),
        ("canvasSummary", "Canvas summary"),
        ("canvasBoard", "Canvas board"),
        ("canvasSelectionLabel", "Canvas selection label"),
        ("captureBtn", "quick capture button"),
        ("captureView", "quick capture view"),
        ("captureContentInput", "quick capture content input"),
        ("captureColorSelect", "quick capture color selector"),
        ("captureLabelInput", "quick capture label input"),
        ("captureReminderInput", "quick capture reminder input"),
        ("captureChecklistToggle", "quick capture checklist toggle"),
        ("capturePinToggle", "quick capture pin toggle"),
        ("captureAttachmentInput", "quick capture attachment input"),
        ("captureAttachmentLabel", "quick capture attachment label"),
        ("captureSketchCanvas", "quick capture sketch canvas"),
        ("captureSaveBtn", "quick capture save button"),
        ("captureFilterSelect", "quick capture filter selector"),
        ("captureSearchInput", "quick capture search input"),
        ("captureSummary", "quick capture summary"),
        ("captureList", "quick capture list"),
        ("commandPaletteBtn", "command palette button"),
        ("commandPaletteView", "command palette view"),
        ("commandPaletteInput", "command palette search input"),
        ("commandPaletteSummary", "command palette summary"),
        ("commandPaletteList", "command palette list"),
        ("commandPaletteCloseBtn", "command palette close button"),
        ("snapshotCreateBtn", "recovery snapshot create button"),
        ("snapshotSelect", "recovery snapshot selector"),
        ("snapshotRestoreBtn", "recovery snapshot restore button"),
        ("snapshotSummary", "recovery snapshot summary"),
        ("importReportList", "import report list"),
        ("publishBundleSelect", "publish bundle selector"),
        ("publishTitleInput", "publish title input"),
        ("publishDescriptionInput", "publish description input"),
        ("publishPermalinkInput", "publish permalink input"),
        ("publishSaveBtn", "publish save button"),
        ("publishHtmlExportBtn", "publish HTML export button"),
        ("publishSlidesExportBtn", "publish slides export button"),
        ("publishSensitiveList", "publish sensitive warning list"),
        ("publishNodeList", "publish node checklist"),
        ("publishPreview", "publish preview"),
        ("workspaceNameInput", "workspace name input"),
        ("workspaceSelect", "workspace selector"),
        ("workspaceSaveBtn", "workspace save button"),
        ("workspaceApplyBtn", "workspace apply button"),
        ("workspaceHealthSummary", "workspace health summary"),
        ("workspaceHealthList", "workspace health list"),
        ("workspaceExternalLinks", "workspace external links"),
    ]
    for element_id, label in required_ids:
        check(has_id(html, element_id), f"Web surface has {label}", element_id, failures)
    for option_value, label in [
        ("zh", "Chinese language option"),
        ("ja", "Japanese language option"),
        ("vi", "Vietnamese language option"),
        ("ar", "Arabic language option"),
    ]:
        check(f'value="{option_value}"' in html, f"Web surface has {label}", option_value, failures)

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
        ("await loadServerSharedNotes({ replace: true", "hosted Web replaces local view with server-shared notes"),
        ("elements.shareTreeBtn.disabled = isHostedWebClient()", "hosted Web share toggle disabled"),
        ('document.documentElement.dataset.client = isHostedWebClient() ? "hosted"', "hosted Web client mode marker"),
        ("async function createSelectedNoteAnalysisJob", "server analysis job function"),
        ("function buildKnowledgeAnalysisPayload", "2.0 knowledge analysis payload builder"),
        ("function approveAnalysisResult", "analysis approval function"),
        ("async function retryAnalysisJob", "analysis retry function"),
        ("async function cancelAnalysisJob", "analysis cancel function"),
        ("settings.server.analysis.job.knowledge_2_0_review", "2.0 knowledge analysis job translation"),
        ("settings.server.analysis.encryptedNote", "encrypted note analysis guard translation"),
        ("if (isEncryptedContent(selected.content))", "encrypted note analysis guard"),
        ('"app.title": "NowNote"', "app title translation without Web suffix"),
        ("const LANGUAGES", "language metadata registry"),
        ("zh-CN", "Chinese locale support"),
        ("ja-JP", "Japanese locale support"),
        ("vi-VN", "Vietnamese locale support"),
        ('dir: "rtl"', "Arabic RTL support"),
        ("LANGUAGE_PACKS", "extra language packs"),
        ("settings.server.guide.issue", "server token issue translation"),
        ("settings.tabIndent.title", "Tab indent setting translation"),
        ("/api/v1/auth/web-login", "hosted Web password login API"),
        ("/api/v1/auth/register", "hosted Web self-registration API"),
        ("/api/v1/auth/password-reset/request", "hosted Web password reset request API"),
        ("/api/v1/auth/password-reset/confirm", "hosted Web password reset confirm API"),
        ("/api/v1/auth/device-token", "hosted Web device token issue API"),
        ("/api/v1/auth/device-tokens", "hosted Web device token list API"),
        ("/api/v1/auth/web-session", "hosted Web session API"),
        ("/api/v1/auth/web-logout", "hosted Web logout API"),
        ("X-Now-Web-Session", "hosted Web session header"),
        ('webLoginDesc: $("#webLoginDesc")', "hosted Web login description element binding"),
        ('webLoginPasswordLabel: $("#webLoginPasswordLabel")', "hosted Web password label element binding"),
        ("async function handleWebRegisterSubmit", "hosted Web self-registration function"),
        ('elements.webRegisterSubmitBtn?.addEventListener("click", handleWebRegisterSubmit)', "hosted Web self-registration click binding"),
        ('elements.webRegisterSubmitBtn.type = "button"', "hosted Web self-registration button avoids submit routing"),
        ("authClickEventsBound", "hosted Web self-registration click binding guard"),
        ("async function issueDeviceToken", "hosted Web device token issue function"),
        ("async function refreshDeviceTokens", "hosted Web device token refresh function"),
        ("async function handlePasswordResetRequest", "hosted Web password reset request function"),
        ("async function handlePasswordResetConfirm", "hosted Web password reset confirm function"),
        ('setWebLoginMode("login");', "hosted Web password reset returns to login mode"),
        ('elements.webResetCodeInput.value = "";', "hosted Web password reset clears reset code after success"),
        ("function noteFindMatches", "in-note search function"),
        ("keepInputFocus", "in-note search keeps input focus"),
        ("focusNoteFindInput", "in-note search input focus helper"),
        ("focusSearchPopoverInput", "search popover input focus helper"),
        ('event.key === "Tab" && !event.ctrlKey && !event.altKey && !event.metaKey', "plain Tab indents selected editor lines"),
        ("indentTreeContentSelection(event.shiftKey ? -1 : 1)", "Shift+Tab outdents selected editor lines"),
        ("selectionEndForLine", "editor indent avoids trailing newline over-selection"),
        ("normalizeTabIndentSize", "editor Tab indent size normalization"),
        ("state.settings.tabIndentSize", "editor Tab indent uses settings"),
        ('id: "search", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.search", label: "검색", defaultShortcut: { ctrl: true, key: "f" }', "Ctrl+F opens global search directly"),
        ('id: "noteFind", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.noteFind", label: "본문 찾기", defaultShortcut: { ctrl: true, shift: true, key: "f" }', "Ctrl+Shift+F opens in-note search directly"),
        ('if (isPrimaryShortcut(event, "f") && !event.shiftKey && !event.altKey) {\n    if (!featureEnabled("search")) return;\n    event.preventDefault();\n    openSearchPopover();', "Ctrl+F hard route opens global search"),
        ('if (isPrimaryShortcut(event, "f") && event.shiftKey && !event.altKey) {\n    event.preventDefault();\n    openNoteFind();', "Ctrl+Shift+F hard route opens in-note search"),
        ('id: "commandPalette", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.commandPalette", label: "명령 팔레트", defaultShortcut: { ctrl: true, shift: true, key: "p" }', "Ctrl+Shift+P opens command palette"),
        ('id: "pinTab", groupKey: "shortcut.group.tabs", labelKey: "shortcut.action.pinTab", label: "현재 탭 고정", defaultShortcut: { ctrl: true, alt: true, key: "p" }', "Ctrl+Alt+P pins current tab"),
        ("function renderOpenTreeTabs", "tab rendering function"),
        ("function normalizeShortcutSettings", "shortcut normalization"),
        ("state.data.daily", "daily note state"),
        ("function renderTodayMemoState", "daily chip refresh function"),
        ("archivedDaily", "daily archive state"),
        ("selected.level >= 3", "tree depth guard"),
        ("function normalizeSharedView", "shared view mode normalization"),
        ("function renderMemberSharedTreeList", "member shared tree renderer"),
        ("function isOwnSharedTreeNode", "my shared notes filter"),
        ("async function refreshGroupMessages", "group messenger refresh"),
        ("async function refreshMessengerRooms", "group messenger room refresh"),
        ("async function uploadMessengerAttachment", "group messenger attachment upload"),
        ("startGroupMessengerAutoRefresh", "group messenger auto refresh timer"),
        ("refreshOpenGroupMessenger", "group messenger open-window auto refresh"),
        ("groupMessengerLastRefreshAt", "group messenger refresh throttle"),
        ("groupMessagesChanged", "group messenger unchanged render guard"),
        ("stopGroupMessengerAutoRefresh();", "group messenger stops when closed"),
        ("if (!isGroupMessengerOpen())", "group messenger refresh only while open"),
        ("if (isGroupMessengerOpen())", "group messenger marks read only while open"),
        ("server.webSessionToken", "group messenger polling requires hosted Web session"),
        ("async function sendGroupMessage", "group messenger send"),
        ("async function markGroupMessagesRead({ silent = false } = {})", "group messenger mark read"),
        ("/api/v1/messenger/rooms", "2.3 messenger rooms API path"),
        ("/api/v1/messenger/attachments", "2.3 messenger attachment API path"),
        ("function parseServerDate", "server UTC timestamp parser"),
        ("async function joinServerGroupByInvite", "hosted Web group invite join function"),
        ("async function loadServerGroupOptions", "hosted Web group list load function"),
        ("/api/v1/users/${encodeURIComponent(normalizeOwnerId(server.ownerId))}/group-join", "hosted Web group invite join API path"),
        ("/api/v1/users/${encodeURIComponent(normalizeOwnerId(server.ownerId))}/groups", "hosted Web group list API path"),
        ('serverGroupNameInput: $("#serverGroupNameInput")', "hosted Web group name input binding"),
        ('serverGroupInviteCodeInput: $("#serverGroupInviteCodeInput")', "hosted Web group invite code input binding"),
        ("function renderServerGroupOptions", "hosted Web group select renderer"),
        ("normalizeServerGroups", "hosted Web group list normalization"),
        ("function isEncryptedTreeNodeLocked", "tree editor encrypted lock helper"),
        ("elements.treeContent.readOnly = contentReadOnly", "tree editor read-only state reset"),
        ("!isDesktopClient() && node?.groupSharedReadOnly === true", "tree editor hosted-only read-only check"),
        ("node.groupSharedReadOnly = node.groupSharedReadOnly === true", "tree node strict read-only normalization"),
        ('elements.serverGroupJoinBtn?.addEventListener("click", joinServerGroupByInvite)', "hosted Web group join click binding"),
        ("serverUserTokenInput", "public server user token input"),
        ("settings.server.autoSync", "auto sync setting translation"),
        ("settings.server.conflict.keepLocal", "server conflict action translation"),
        ("function recordServerConflict", "server conflict recorder"),
        ("function applyServerConflictRemote", "server conflict server apply action"),
        ("function isTreeNodeSharedForServer", "knowledge share filter"),
        ("function shouldTreeNodeSyncWithServer", "knowledge server sync gate"),
        ("function shouldCountPendingTreeSync", "knowledge pending sync counter"),
        ("serverShared", "knowledge server share state"),
        ('syncState: "local"', "deleted/private notes stay local"),
        ("function archiveDeletedTreeNode", "deleted tree archive function"),
        ("function restoreDeletedTreeNode", "deleted tree restore function"),
        ("if (parent.shared === false) return false", "ancestor share guard before server sync"),
        ("function confirmAction", "internal confirm dialog function"),
        ("function isDesktopClient", "desktop client detection"),
        ("async function readStorage", "desktop-aware storage reader"),
        ("migrateLocalStorageToDesktopStore", "desktop localStorage migration"),
        ("function renderDesktopStorageStatus", "desktop storage status renderer"),
        ("settings.desktopStorage.error", "desktop storage error status"),
        ("error: true", "desktop storage write failure marker"),
        ("function graphModel", "1.2 graph model builder"),
        ("function renderGraphCanvas", "1.2 graph canvas renderer"),
        ("function localGraphNodeIds", "1.2 local graph depth traversal"),
        ("function unlinkedMentionSuggestions", "1.2 unlinked mention suggestions"),
        ("function applyLinkSuggestion", "1.2 suggested link apply action"),
        ("function saveGraphBookmark", "1.2 graph bookmark save action"),
        ("function applyGraphBookmark", "1.2 graph bookmark apply action"),
        ("normalizeGraphSettings", "1.2 graph setting normalization"),
        ("function normalizeNoteProperties", "1.3 note property normalization"),
        ("function renderNoteProperties", "1.3 note property editor renderer"),
        ("function renderPropertiesView", "1.3 properties list renderer"),
        ("function savePropertyFilter", "1.3 property saved filter action"),
        ("function createNoteFromPropertyTemplate", "1.3 property template note action"),
        ("normalizePropertyViewSettings", "1.3 property view setting normalization"),
        ("function normalizeCanvas", "1.4 Canvas normalization"),
        ("function renderCanvas", "1.4 Canvas renderer"),
        ("function addSelectedNoteCanvasCard", "1.4 Canvas note card action"),
        ("function addTextCanvasCard", "1.4 Canvas text card action"),
        ("function connectSelectedCanvasCards", "1.4 Canvas edge action"),
        ("function createCanvasDraftFromGraph", "1.4 Canvas graph draft action"),
        ("function normalizeCaptureCard", "1.5 quick capture normalization"),
        ("function saveQuickCapture", "1.5 quick capture save action"),
        ("function renderCaptures", "1.5 quick capture renderer"),
        ("function toggleCapturePin", "1.5 quick capture pin action"),
        ("function toggleCaptureArchive", "1.5 quick capture archive action"),
        ("function clearCaptureSketch", "1.5 quick capture sketch action"),
        ("function commandCatalog", "1.6 command catalog"),
        ("function openCommandPalette", "1.6 command palette open action"),
        ("function executeCommand", "1.6 command execution"),
        ("function executeSlashCommandFromEditor", "1.6 slash command execution"),
        ("function createWritingTemplateNote", "1.6 writing template note action"),
        ("function createUniqueNote", "1.6 unique note action"),
        ("function openRandomNote", "1.6 random note action"),
        ("function mergeSelectedNoteChildren", "1.6 note composer merge action"),
        ("function splitSelectedNoteByHeading", "1.6 note composer split action"),
        ("WRITING_TEMPLATES", "1.6 writing templates"),
        ("function createRecoverySnapshot", "1.7 recovery snapshot action"),
        ("function restoreSelectedSnapshot", "1.7 snapshot restore action"),
        ("function renderRecoveryPanel", "1.7 recovery panel renderer"),
        ("function recordImportReport", "1.7 import report recorder"),
        ("function markdownFileToImportNode", "1.7 markdown import converter"),
        ("function parseMarkdownFrontmatter", "1.7 frontmatter parser"),
        ("function convertObsidianMarkdown", "1.7 Obsidian markdown converter"),
        ("snapshots", "1.7 snapshot data shape"),
        ("importReports", "1.7 import report data shape"),
        ("function normalizePublishBundle", "1.8 publish bundle normalization"),
        ("function renderPublishPanel", "1.8 publish panel renderer"),
        ("function savePublishBundle", "1.8 publish bundle save action"),
        ("function publishExclusionReason", "1.8 publish exclusion policy"),
        ("function scanPublishSensitiveContent", "1.8 sensitive content scan"),
        ("function exportPublishHtml", "1.8 public HTML export action"),
        ("function exportPublishSlides", "1.8 slides export action"),
        ("function buildPublicHtmlDocument", "1.8 public HTML builder"),
        ("function buildSlidesHtmlDocument", "1.8 slides HTML builder"),
        ("publishBundles", "1.8 publish bundle data shape"),
        ("function saveCurrentWorkspace", "1.9 workspace save action"),
        ("function applySelectedWorkspace", "1.9 workspace apply action"),
        ("function knowledgeHealthReport", "1.9 knowledge health report"),
        ("function externalLinksForText", "1.9 external link list"),
        ("workspaces: defaultWorkspaceSettings()", "1.9 workspace setting data shape"),
        ("function isGroupSharedServerNote", "group shared note detector"),
        ("function serverTreeNodeLocalId", "group shared local ID mapper"),
        ("function isReadOnlyTreeNode", "group shared read-only guard"),
        ("groupSharedReadOnly", "group shared read-only data shape"),
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
        ("markdownFileToImportNode(file.name, content)", "Markdown import creates a topic from plain Markdown"),
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
        (".member-shared-section", "member shared section styling"),
        (".messenger-list", "group messenger list styling"),
        (".messenger-room-list", "group messenger room list styling"),
        (".messenger-attachment", "group messenger attachment styling"),
        (".messenger-form .primary-btn", "group messenger send button no-wrap styling"),
        (".server-group-join", "server group invite join styling"),
        (".note-find-bar", "in-note search styling"),
        ("min-height: 44px", "in-note search fixed height"),
        (".markdown-preview", "Markdown preview styling"),
        (".server-settings-form", "server settings styling"),
        (".shortcut-groups", "shortcut settings styling"),
        (".deleted-toolbar", "deleted bin toolbar styling"),
        (".graph-toolbar", "graph toolbar styling"),
        (".graph-canvas", "graph canvas styling"),
        (".graph-node", "graph node styling"),
        (".graph-insights", "graph insight panel styling"),
        (".note-properties-panel", "note properties styling"),
        (".properties-toolbar", "properties toolbar styling"),
        (".properties-row", "properties row styling"),
        (".properties-insights", "properties insight panel styling"),
        (".canvas-toolbar", "Canvas toolbar styling"),
        (".canvas-board", "Canvas board styling"),
        (".canvas-board-card", "Canvas card styling"),
        (".canvas-edges", "Canvas edge styling"),
        (".capture-composer", "quick capture composer styling"),
        (".capture-sketch-canvas", "quick capture sketch styling"),
        (".capture-list", "quick capture list styling"),
        (".capture-item", "quick capture card styling"),
        (".command-card", "command palette card styling"),
        (".command-list", "command palette list styling"),
        (".command-item", "command palette item styling"),
        (".note-action-menu", "note action dropdown styling"),
        (".note-action-menu-btn", "compact note action menu button styling"),
        (".recovery-panel", "recovery panel styling"),
        (".import-report-list", "import report list styling"),
        (".import-report-item", "import report item styling"),
        (".publish-panel", "publish panel styling"),
        (".publish-toolbar", "publish toolbar styling"),
        (".publish-node-list", "publish node list styling"),
        (".publish-sensitive-list", "publish sensitive list styling"),
        (".publish-preview", "publish preview styling"),
        (".workspace-panel", "workspace panel styling"),
        (".workspace-health-item", "workspace health item styling"),
        (".confirm-backdrop", "internal confirm dialog styling"),
        (".confirm-backdrop.hidden", "internal confirm dialog hidden state"),
        (".publish-preview h4 {\n  margin: 0 0 4px;\n  font-size: 12px;", "publish preview title is 12px"),
        (".publish-node-option {\n  display: flex;", "publish node option style block"),
        ("font-size: 11px;\n  line-height: 1.35;\n}\n\n.publish-node-option:last-child", "publish node list body is 11px"),
        (".publish-sensitive-list {\n  display: grid;", "publish sensitive list style block"),
        ("color: var(--muted);\n  font-size: 9px;\n  line-height: 1.35;\n}\n\n.publish-sensitive-item", "publish explanation text is 9px"),
        (".workspace-panel .graph-summary {\n  color: var(--muted);\n  font-size: 10px;", "workspace summary body is 10px"),
        (".workspace-health-item span {\n  color: var(--blue);\n  font-size: 11px;", "workspace item label is 11px"),
        (".workspace-health-item strong {\n  min-width: 0;", "workspace item title style block"),
        ("white-space: nowrap;\n  font-size: 11px;\n  font-weight: 800;\n}\n\n.workspace-health-item span,\n.workspace-health-item strong", "workspace item title is 11px"),
        (".workspace-health-item small {\n  grid-column: 2;\n  color: var(--muted);\n  font-size: 9px;", "workspace item description is 9px"),
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
        ("1.2 관계 탐색과 그래프뷰", "1.2 graph view documented"),
        ("1.3 속성 기반 지식 관리", "1.3 properties documented"),
        ("1.4 Canvas와 시각적 사고 정리", "1.4 Canvas documented"),
        ("1.5 첨부/미디어/빠른 기록", "1.5 quick capture documented"),
        ("1.6 작성 보조와 명령 체계", "1.6 command palette documented"),
        ("1.7 복구/가져오기/마이그레이션", "1.7 recovery import documented"),
        ("1.8 출판/발표/공개 지식 묶음", "1.8 publish slides documented"),
        ("1.9 작업공간과 운영형 지식 관리", "1.9 workspace operations documented"),
        ("2.1 Web 그룹 공유 조회", "2.1 group shared views documented"),
        ("2.2 Web 그룹 메신저", "2.2 group messenger documented"),
        ("2.3 Web 그룹 메신저 첨부와 채팅방 후보", "2.3 group messenger attachments and rooms documented"),
        ("node scripts/check_graph_view.mjs", "graph view browser check documented"),
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
        ("관계 탐색과 그래프뷰", "runtime checklist graph section"),
        ("속성 기반 지식 관리", "runtime checklist properties section"),
        ("Canvas와 시각적 사고 정리", "runtime checklist Canvas section"),
        ("첨부/미디어/빠른 기록", "runtime checklist quick capture section"),
        ("작성 보조와 명령 체계", "runtime checklist writing command section"),
        ("복구/가져오기/마이그레이션", "runtime checklist recovery import section"),
        ("출판/발표/공개 지식 묶음", "runtime checklist publish slides section"),
        ("node scripts/check_graph_view.mjs", "runtime checklist graph browser check"),
        ("PWA 보조 설치 점검", "runtime checklist PWA install section"),
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

    desktop_policy_requirements = [
        ("buildServerSyncNotes(server)", "server sync note policy execution"),
        ("localExcluded", "private local exclusion assertion"),
        ("unshareTombstone", "unshare tombstone assertion"),
        ("deletedExcluded", "deleted trash exclusion assertion"),
        ("conflictRecorded", "server conflict assertion"),
        ("encryptedAnalysisBlocked", "encrypted analysis guard assertion"),
    ]
    for needle, label in desktop_policy_requirements:
        check(needle in desktop_policy_check, f"Desktop client policy check has {label}", needle, failures)

    desktop_package_requirements = [
        ('"electron"', "Electron dependency"),
        ('"electron-builder"', "electron-builder dependency"),
        ('"dist:win"', "Windows installer build script"),
        ('"check:storage"', "desktop storage check script"),
        ('"target": "nsis"', "NSIS installer target"),
        ("NowNote-Setup", "installer artifact name"),
        ('"icon": "build/icon.ico"', "Windows installer icon"),
    ]
    for needle, label in desktop_package_requirements:
        check(needle in desktop_package, f"Desktop package has {label}", needle, failures)

    desktop_main_requirements = [
        ("BrowserWindow", "Electron BrowserWindow"),
        ("loadFile", "local desktop app loading"),
        ("index.html", "desktop entry file loading"),
        ("setWindowOpenHandler", "external link handler"),
        ("Menu.setApplicationMenu", "desktop menu"),
        ("sendAppCommand", "desktop menu shortcut dispatcher"),
        ('label: "검색",\n          accelerator: "Ctrl+F"', "desktop Ctrl+F app search shortcut"),
        ('label: "본문 찾기",\n          accelerator: "Ctrl+Shift+F"', "desktop Ctrl+Shift+F note find shortcut"),
        ("nownote:desktop-store-read", "desktop local store read IPC"),
        ("nownote:desktop-store-write", "desktop local store write IPC"),
        ("NOWNOTE_DESKTOP_USER_DATA_DIR", "desktop test userData override"),
        ("nownote-desktop-store.json", "desktop local store file"),
        ("updatedAt: store.updatedAt", "desktop local store metadata"),
    ]
    for needle, label in desktop_main_requirements:
        check(needle in desktop_main, f"Desktop main has {label}", needle, failures)

    desktop_preload_requirements = [
        ("contextBridge", "secure preload bridge"),
        ("ipcRenderer.invoke", "desktop IPC invoke"),
        ("nownoteDesktop", "desktop bridge namespace"),
        ("storage", "desktop storage bridge"),
    ]
    for needle, label in desktop_preload_requirements:
        check(needle in desktop_preload, f"Desktop preload has {label}", needle, failures)

    desktop_app_index_requirements = [
        ('id="addRootBtn"', "desktop root note button"),
        ('id="treeTitleInput"', "desktop title editor"),
        ('id="treeContent"', "desktop content editor"),
        ('id="treeList"', "desktop tree list"),
        ('id="openTabs"', "desktop open tabs"),
        ('id="graphCanvas"', "desktop graph view"),
        ('id="notePropertiesPanel"', "desktop properties panel"),
        ('id="canvasView"', "desktop Canvas view"),
        ('id="captureView"', "desktop quick capture view"),
        ('id="commandPaletteView"', "desktop command palette"),
        ('id="noteActionMenuBtn"', "desktop note action menu button"),
        ('id="noteActionMenu"', "desktop note action menu"),
        ('id="workspaceHealthSummary"', "desktop workspace operations"),
        ('class="nav-tabs hosted-web-only hidden"', "hosted Web-only views hidden by default"),
    ]
    for needle, label in desktop_app_index_requirements:
        check(needle in desktop_app_index, f"Desktop app shell has {label}", needle, failures)

    desktop_app_script_requirements = [
        ('const STORAGE_KEY = "nownote.web.v1"', "Web-compatible desktop storage key"),
        ("DESKTOP_STORAGE_KEYS", "desktop file storage key allowlist"),
        ("function addRootNote", "desktop note creation"),
        ("elements.treeTitleInput.addEventListener(\"input\"", "desktop title editing"),
        ("elements.treeContent.addEventListener(\"input\"", "desktop content editing"),
        ("function isDesktopClient", "desktop runtime detection"),
        ("function isHostedWebClient", "hosted Web-only runtime detection"),
        ('window.addEventListener("nownote:menu-command"', "desktop menu command receiver"),
        ("toggleNoteActionMenu", "desktop note action menu toggle"),
        ("focusNoteFindInput", "desktop note find input focus helper"),
        ("focusSearchPopoverInput", "desktop search input focus helper"),
        ("keepInputFocus", "note find input focus retention"),
        ("!isDesktopClient() && node?.groupSharedReadOnly === true", "desktop ignores hosted read-only marker"),
        ("document.querySelectorAll(\".hosted-web-only\")", "hosted Web-only UI visibility guard"),
        ("window.nownoteDesktop.storage", "desktop storage bridge usage"),
    ]
    for needle, label in desktop_app_script_requirements:
        check(needle in desktop_app_script, f"Desktop app script has {label}", needle, failures)

    desktop_app_style_requirements = [
        (".app-shell", "desktop app layout"),
        (".sidebar", "desktop sidebar"),
        (".open-tabs-bar", "desktop tabs"),
        (".memo-editor", "desktop editor"),
        (".graph-canvas", "desktop graph style"),
        (".canvas-board", "desktop Canvas style"),
        (".capture-composer", "desktop quick capture style"),
        (".command-card", "desktop command palette style"),
        (".note-action-menu", "desktop note action dropdown style"),
        (".note-action-menu-btn", "desktop compact note action menu button style"),
        ("flex: 0 0 auto", "desktop note find bar fixed height"),
    ]
    for needle, label in desktop_app_style_requirements:
        check(needle in desktop_app_styles, f"Desktop app style has {label}", needle, failures)

    desktop_app_help_requirements = [
        ("NowNote", "desktop help title"),
        ("서버 연결", "desktop server connection help"),
    ]
    for needle, label in desktop_app_help_requirements:
        check(needle in desktop_app_help, f"Desktop help has {label}", needle, failures)

    desktop_storage_check_requirements = [
        ("NOWNOTE_DESKTOP_USER_DATA_DIR", "isolated desktop userData"),
        ("--remote-debugging-port", "desktop CDP launch"),
        ("nownote-desktop-store.json", "desktop store file check"),
        ("#addRootBtn", "desktop note creation check"),
        ("desktop store reload", "desktop restart reload assertion"),
    ]
    for needle, label in desktop_storage_check_requirements:
        check(needle in desktop_storage_check, f"Desktop storage check has {label}", needle, failures)

    desktop_readme_requirements = [
        (".exe", "exe installer documentation"),
        ("npm run dist:win", "Windows build command documentation"),
        ("NowNote-Setup-0.1.0-x64.exe", "installer output documentation"),
        ("Web 전용", "hosted Web-only exclusion documentation"),
    ]
    for needle, label in desktop_readme_requirements:
        check(needle in desktop_readme, f"Desktop README has {label}", needle, failures)

    graph_view_check_requirements = [
        ("graphModel()", "graph model execution"),
        ("#graphCanvas .graph-node", "graph node render assertion"),
        ("unlinkedMentionSuggestions", "unlinked mention assertion"),
        ("applyLinkSuggestion", "suggested link assertion"),
        ("saveGraphBookmark", "bookmark assertion"),
        ("updateSelectedNoteProperties", "properties editor assertion"),
        ("savePropertyFilter", "properties saved filter assertion"),
        ("createNoteFromPropertyTemplate", "properties template assertion"),
        ("openCanvasView", "Canvas open assertion"),
        ("connectSelectedCanvasCards", "Canvas connection assertion"),
        ("createCanvasDraftFromGraph", "Canvas graph draft assertion"),
        ("saveQuickCapture", "quick capture save assertion"),
        ("toggleCaptureArchive", "quick capture archive assertion"),
        ("openCommandPalette", "command palette assertion"),
        ("executeSlashCommandFromEditor", "slash command assertion"),
        ("splitSelectedNoteByHeading", "note split assertion"),
        ("mergeSelectedNoteChildren", "note merge assertion"),
        ("createRecoverySnapshot", "recovery snapshot assertion"),
        ("markdownFileToImportNode", "frontmatter import assertion"),
        ("restoreOk", "snapshot restore assertion"),
        ("savePublishBundle", "publish bundle assertion"),
        ("exportPublishHtml", "publish HTML export assertion"),
        ("exportPublishSlides", "publish slides export assertion"),
        ("publishExcluded", "publish exclusion assertion"),
        ("sensitiveWarning", "publish sensitive warning assertion"),
        ("groupSharedReadOnly", "group shared read-only assertion"),
        ("groupSharedNotPushed", "group shared upload exclusion assertion"),
    ]
    for needle, label in graph_view_check_requirements:
        check(needle in graph_view_check, f"Graph view check has {label}", needle, failures)

    graph_design_requirements = [
        ("NowNote 1.2 관계 탐색과 그래프뷰 설계서", "1.2 graph design title"),
        ("전체 그래프뷰", "global graph scope"),
        ("선택 메모 중심 로컬 그래프", "local graph scope"),
        ("고립 메모 목록", "isolated notes scope"),
        ("허브 메모 목록", "hub notes scope"),
        ("연결 후보", "unlinked mention scope"),
        ("그래프 필터 북마크", "graph bookmark scope"),
    ]
    for needle, label in graph_design_requirements:
        check(needle in graph_design, f"1.2 design has {label}", needle, failures)

    properties_design_requirements = [
        ("NowNote 1.3 속성 기반 지식 관리 설계서", "1.3 properties design title"),
        ("지식 메모별 속성 편집 패널", "property editor scope"),
        ("속성 기반 목록 보기", "property list scope"),
        ("속성 필터 저장", "saved filter scope"),
        ("누락 속성 점검", "missing property scope"),
        ("속성이 포함된 템플릿 메모 생성", "property template scope"),
    ]
    for needle, label in properties_design_requirements:
        check(needle in properties_design, f"1.3 design has {label}", needle, failures)

    canvas_design_requirements = [
        ("NowNote 1.4 Canvas와 시각적 사고 정리 설계서", "1.4 Canvas design title"),
        ("메모 카드 추가", "Canvas note card scope"),
        ("텍스트 카드 추가", "Canvas text card scope"),
        ("카드 간 연결선 추가", "Canvas edge scope"),
        ("그래프 주변 메모를 Canvas 초안", "Canvas graph draft scope"),
        ("Canvas 저장 구조", "Canvas storage scope"),
    ]
    for needle, label in canvas_design_requirements:
        check(needle in canvas_design, f"1.4 design has {label}", needle, failures)

    capture_design_requirements = [
        ("NowNote 1.5 첨부/미디어/빠른 기록 설계서", "1.5 quick capture design title"),
        ("빠른 캡처 카드", "quick capture card scope"),
        ("핀 고정", "pin scope"),
        ("색상 표시", "color scope"),
        ("체크리스트 카드", "checklist scope"),
        ("시간 기반 리마인더", "reminder scope"),
        ("첨부 파일 메타데이터 기록", "attachment metadata scope"),
        ("간단한 그림 카드 저장", "sketch scope"),
    ]
    for needle, label in capture_design_requirements:
        check(needle in capture_design, f"1.5 design has {label}", needle, failures)

    command_design_requirements = [
        ("NowNote 1.6 작성 보조와 명령 체계 설계서", "1.6 command design title"),
        ("명령 팔레트", "command palette scope"),
        ("Slash command", "slash command scope"),
        ("기본 템플릿 메모 생성", "template note scope"),
        ("고유 ID/시각 기반 메모 생성", "unique note scope"),
        ("하위 메모 내용 병합", "merge scope"),
        ("제목 섹션 기준 메모 나누기", "split scope"),
        ("랜덤 메모 열기", "random note scope"),
    ]
    for needle, label in command_design_requirements:
        check(needle in command_design, f"1.6 design has {label}", needle, failures)

    recovery_import_design_requirements = [
        ("NowNote 1.7 복구, 가져오기, 마이그레이션 설계서", "1.7 recovery import design title"),
        ("화면 기반 로컬 스냅샷", "snapshot scope"),
        ("가져오기 전 자동 스냅샷", "pre-import snapshot scope"),
        ("선택 스냅샷 복구", "snapshot restore scope"),
        ("frontmatter와 NowNote 속성 매핑", "frontmatter mapping scope"),
        ("Obsidian wiki 링크와 첨부 표기 보정", "Obsidian conversion scope"),
        ("가져오기 후 문제/보정 목록 표시", "import report scope"),
    ]
    for needle, label in recovery_import_design_requirements:
        check(needle in recovery_import_design, f"1.7 design has {label}", needle, failures)

    publish_slides_design_requirements = [
        ("NowNote 1.8 출판, 발표, 공개 지식 묶음 설계서", "1.8 publish slides design title"),
        ("공개 묶음 제목, 설명, permalink", "publish bundle metadata scope"),
        ("공개 묶음에 포함할 지식 메모", "publish include notes scope"),
        ("공유 안 함, 암호화 메모, 공개 제외 속성", "publish exclusion scope"),
        ("민감정보 후보", "sensitive scan scope"),
        ("HTML 문서", "public HTML export scope"),
        ("슬라이드형 HTML 문서", "slides HTML export scope"),
    ]
    for needle, label in publish_slides_design_requirements:
        check(needle in publish_slides_design, f"1.8 design has {label}", needle, failures)

    workspace_operations_design = WORKSPACE_OPERATIONS_DESIGN.read_text(encoding="utf-8")
    workspace_operations_design_requirements = [
        ("NowNote 1.9 작업공간과 운영형 지식 관리 설계서", "1.9 workspace design title"),
        ("작업공간 저장", "workspace save scope"),
        ("작업공간 적용", "workspace apply scope"),
        ("지식 건강 점검", "knowledge health scope"),
        ("외부 링크", "external link scope"),
    ]
    for needle, label in workspace_operations_design_requirements:
        check(needle in workspace_operations_design, f"1.9 design has {label}", needle, failures)

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
