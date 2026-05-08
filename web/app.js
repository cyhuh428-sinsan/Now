const STORAGE_KEY = "nownote.web.v1";
const SETTINGS_KEY = "nownote.web.settings.v1";

const ACCENTS = [
  { id: "blue", label: "파랑", value: "#2563eb" },
  { id: "purple", label: "보라", value: "#8b5cf6" },
  { id: "green", label: "초록", value: "#14b8a6" },
  { id: "orange", label: "주황", value: "#f97316" },
];

const state = {
  view: "tree",
  selectedDate: toDateKey(new Date()),
  visibleMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedTreeId: null,
  expandedTreeIds: new Set(),
  search: "",
  data: {
    daily: {},
    archivedDaily: [],
    deletedTree: [],
    tree: [],
  },
  settings: defaultSettings(),
};

let storageWarningShown = false;

function defaultSettings() {
  return {
    theme: "system",
    accent: "blue",
    wideEditor: true,
    treeListWidth: 280,
    sidebarCollapsed: false,
    fontSize: "medium",
    lineHeight: "normal",
    showBacklinks: true,
    enableShortcuts: true,
    showTags: true,
    showSidebarAssist: false,
    openTreeTabs: [],
    closedTreeTabs: [],
    pinnedTreeTabs: [],
  };
}

const $ = (selector) => document.querySelector(selector);

const elements = {
  searchInput: $("#searchInput"),
  navTabs: document.querySelectorAll(".nav-tab"),
  dailyToggleBtn: $("#dailyToggleBtn"),
  dailyCloseBtn: $("#dailyCloseBtn"),
  todayMemoState: $("#todayMemoState"),
  favoriteList: $("#favoriteList"),
  favoriteCount: $("#favoriteCount"),
  recentList: $("#recentList"),
  recentCount: $("#recentCount"),
  sideTagList: $("#sideTagList"),
  tagCount: $("#tagCount"),
  dailyView: $("#dailyView"),
  treeView: $("#treeView"),
  resultsView: $("#resultsView"),
  monthLabel: $("#monthLabel"),
  calendarGrid: $("#calendarGrid"),
  selectedDateLabel: $("#selectedDateLabel"),
  dailyContent: $("#dailyContent"),
  dailySavedLabel: $("#dailySavedLabel"),
  todayBtn: $("#todayBtn"),
  appendTimeBtn: $("#appendTimeBtn"),
  archiveSelectedBtn: $("#archiveSelectedBtn"),
  archiveToggleBtn: $("#archiveToggleBtn"),
  archivePanel: $("#archivePanel"),
  archiveList: $("#archiveList"),
  archiveCountLabel: $("#archiveCountLabel"),
  prevMonthBtn: $("#prevMonthBtn"),
  nextMonthBtn: $("#nextMonthBtn"),
  expandAllBtn: $("#expandAllBtn"),
  collapseAllBtn: $("#collapseAllBtn"),
  addRootBtn: $("#addRootBtn"),
  emptyAddRootBtn: $("#emptyAddRootBtn"),
  treeList: $("#treeList"),
  openTabsBar: $("#openTabsBar"),
  openTabs: $("#openTabs"),
  pinTabBtn: $("#pinTabBtn"),
  reopenClosedTabBtn: $("#reopenClosedTabBtn"),
  closeOtherTabsBtn: $("#closeOtherTabsBtn"),
  closeAllTabsBtn: $("#closeAllTabsBtn"),
  emptyTreeEditor: $("#emptyTreeEditor"),
  treeEditor: $("#treeEditor"),
  treeTitleInput: $("#treeTitleInput"),
  treeContent: $("#treeContent"),
  treePathLabel: $("#treePathLabel"),
  treeLevelLabel: $("#treeLevelLabel"),
  treeSavedLabel: $("#treeSavedLabel"),
  favoriteBtn: $("#favoriteBtn"),
  copyLinkBtn: $("#copyLinkBtn"),
  noteFindToggleBtn: $("#noteFindToggleBtn"),
  outlineToggleBtn: $("#outlineToggleBtn"),
  insertTimeBtn: $("#insertTimeBtn"),
  outlinePanel: $("#outlinePanel"),
  noteFindBar: $("#noteFindBar"),
  noteFindInput: $("#noteFindInput"),
  noteFindCount: $("#noteFindCount"),
  noteFindPrevBtn: $("#noteFindPrevBtn"),
  noteFindNextBtn: $("#noteFindNextBtn"),
  noteFindCloseBtn: $("#noteFindCloseBtn"),
  tagList: $("#tagList"),
  noteStats: $("#noteStats"),
  previewToggleBtn: $("#previewToggleBtn"),
  markdownPreview: $("#markdownPreview"),
  moveUpBtn: $("#moveUpBtn"),
  moveDownBtn: $("#moveDownBtn"),
  addChildBtn: $("#addChildBtn"),
  deleteTreeBtn: $("#deleteTreeBtn"),
  deletedTreeBtn: $("#deletedTreeBtn"),
  deletedTreeCount: $("#deletedTreeCount"),
  deletedTreeView: $("#deletedTreeView"),
  deletedTreeList: $("#deletedTreeList"),
  deletedTreeCloseBtn: $("#deletedTreeCloseBtn"),
  resultsList: $("#resultsList"),
  resultsCount: $("#resultsCount"),
  clearResultsBtn: $("#clearResultsBtn"),
  exportBtn: $("#exportBtn"),
  exportMarkdownBtn: $("#exportMarkdownBtn"),
  importInput: $("#importInput"),
  settingsBtn: $("#settingsBtn"),
  railSidebarBtn: $("#railSidebarBtn"),
  railDailyBtn: $("#railDailyBtn"),
  railSearchBtn: $("#railSearchBtn"),
  railQuickBtn: $("#railQuickBtn"),
  railGraphBtn: $("#railGraphBtn"),
  railSettingsBtn: $("#railSettingsBtn"),
  settingsCloseBtn: $("#settingsCloseBtn"),
  settingsView: $("#settingsView"),
  themeSelect: $("#themeSelect"),
  accentChoices: $("#accentChoices"),
  wideEditorToggle: $("#wideEditorToggle"),
  fontSizeSelect: $("#fontSizeSelect"),
  lineHeightSelect: $("#lineHeightSelect"),
  backlinksToggle: $("#backlinksToggle"),
  tagsToggle: $("#tagsToggle"),
  shortcutsToggle: $("#shortcutsToggle"),
  sidebarAssistToggle: $("#sidebarAssistToggle"),
  resetSettingsBtn: $("#resetSettingsBtn"),
  treeResizeHandle: $("#treeResizeHandle"),
  backlinksPanel: $("#backlinksPanel"),
  quickSwitchView: $("#quickSwitchView"),
  quickInput: $("#quickInput"),
  quickCount: $("#quickCount"),
  quickResults: $("#quickResults"),
  quickCloseBtn: $("#quickCloseBtn"),
  searchPopoverView: $("#searchPopoverView"),
  searchPopoverInput: $("#searchPopoverInput"),
  searchScopeSelect: $("#searchScopeSelect"),
  searchSortSelect: $("#searchSortSelect"),
  searchPopoverCount: $("#searchPopoverCount"),
  searchPopoverResults: $("#searchPopoverResults"),
  searchPopoverCloseBtn: $("#searchPopoverCloseBtn"),
  graphView: $("#graphView"),
  graphList: $("#graphList"),
  graphCloseBtn: $("#graphCloseBtn"),
};

load();
loadSettings();
bindEvents();
renderSettings();
applySettings();
render();

function bindEvents() {
  elements.navTabs.forEach((button) => {
    button.addEventListener("click", () => {
      setView(button.dataset.view);
    });
  });

  elements.searchInput.addEventListener("input", () => {
    state.search = elements.searchInput.value.trim();
    if (state.search) {
      setView("results");
    } else if (state.view === "results") {
      setView("tree");
    }
    render();
  });
  elements.searchInput.addEventListener("keydown", handleMainSearchInputKey);

  elements.clearResultsBtn.addEventListener("click", clearSearchResults);

  elements.dailyToggleBtn.addEventListener("click", () => {
    toggleDailyPopup();
  });

  elements.dailyCloseBtn.addEventListener("click", () => {
    closeDailyPopup();
  });

  elements.todayBtn.addEventListener("click", () => {
    const today = new Date();
    state.selectedDate = toDateKey(today);
    state.visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    renderDaily();
  });

  elements.prevMonthBtn.addEventListener("click", () => {
    state.visibleMonth = new Date(
      state.visibleMonth.getFullYear(),
      state.visibleMonth.getMonth() - 1,
      1,
    );
    renderDaily();
  });

  elements.nextMonthBtn.addEventListener("click", () => {
    state.visibleMonth = new Date(
      state.visibleMonth.getFullYear(),
      state.visibleMonth.getMonth() + 1,
      1,
    );
    renderDaily();
  });

  elements.appendTimeBtn.addEventListener("click", () => {
    const current = elements.dailyContent.value.trimEnd();
    const prefix = current ? `${current}\n\n` : "";
    elements.dailyContent.value = `${prefix}[${timeLabel(new Date())}] `;
    elements.dailyContent.focus();
    saveDailyFromEditor();
  });

  elements.archiveSelectedBtn.addEventListener("click", () => {
    archiveSelectedDailyNote();
  });

  elements.archiveToggleBtn.addEventListener("click", () => {
    elements.archivePanel.classList.toggle("hidden");
    renderArchiveList();
  });

  elements.dailyContent.addEventListener("input", () => {
    saveDailyFromEditor();
  });

  elements.railSidebarBtn.addEventListener("click", () => {
    state.settings.sidebarCollapsed = !state.settings.sidebarCollapsed;
    persistSettings();
    applySettings();
  });

  elements.railSearchBtn.addEventListener("click", () => {
    toggleSearchPopover();
  });

  elements.railQuickBtn.addEventListener("click", () => {
    toggleQuickSwitch();
  });

  elements.railGraphBtn.addEventListener("click", () => {
    toggleGraph();
  });

  elements.settingsBtn.addEventListener("click", () => {
    toggleSettings();
  });

  elements.railSettingsBtn.addEventListener("click", () => {
    toggleSettings();
  });

  elements.railDailyBtn.addEventListener("click", () => {
    toggleDailyPopup();
  });

  elements.settingsCloseBtn.addEventListener("click", () => {
    elements.settingsView.classList.add("hidden");
  });

  elements.themeSelect.addEventListener("change", () => {
    state.settings.theme = elements.themeSelect.value;
    persistSettings();
    applySettings();
  });

  elements.wideEditorToggle.addEventListener("change", () => {
    state.settings.wideEditor = elements.wideEditorToggle.checked;
    state.settings.treeListWidth = state.settings.wideEditor ? 280 : 360;
    persistSettings();
    applySettings();
  });

  elements.fontSizeSelect.addEventListener("change", () => {
    state.settings.fontSize = elements.fontSizeSelect.value;
    persistSettings();
    applySettings();
  });

  elements.lineHeightSelect.addEventListener("change", () => {
    state.settings.lineHeight = elements.lineHeightSelect.value;
    persistSettings();
    applySettings();
  });

  elements.backlinksToggle.addEventListener("change", () => {
    state.settings.showBacklinks = elements.backlinksToggle.checked;
    persistSettings();
    applySettings();
    renderLinkPanel();
  });

  elements.tagsToggle.addEventListener("change", () => {
    state.settings.showTags = elements.tagsToggle.checked;
    persistSettings();
    applySettings();
    renderTags();
  });

  elements.shortcutsToggle.addEventListener("change", () => {
    state.settings.enableShortcuts = elements.shortcutsToggle.checked;
    persistSettings();
  });

  elements.sidebarAssistToggle.addEventListener("change", () => {
    state.settings.showSidebarAssist = elements.sidebarAssistToggle.checked;
    persistSettings();
    applySettings();
  });

  elements.resetSettingsBtn.addEventListener("click", resetViewSettings);

  elements.addRootBtn.addEventListener("click", () => {
    addRootNote();
  });

  elements.expandAllBtn.addEventListener("click", () => {
    expandAllTreeNodes();
  });

  elements.collapseAllBtn.addEventListener("click", () => {
    state.expandedTreeIds.clear();
    renderTreeListOnly();
  });

  elements.emptyAddRootBtn.addEventListener("click", () => {
    addRootNote();
  });

  elements.treeTitleInput.addEventListener("input", () => {
    const selected = getSelectedTreeNode();
    if (!selected) return;
    selected.title = elements.treeTitleInput.value;
    markTreeNodeChanged(selected);
    persist();
    renderTreeListOnly();
    renderOpenTreeTabs();
    renderSidebarKnowledge();
    renderTreePath(selected);
    renderNoteStats(selected);
    renderLinkPanel();
    if (!elements.graphView.classList.contains("hidden")) renderGraph();
    showSaved(elements.treeSavedLabel);
  });

  elements.treeContent.addEventListener("input", () => {
    const selected = getSelectedTreeNode();
    if (!selected) return;
    syncTreeContentFromEditor();
  });
  elements.treeContent.addEventListener("keydown", handleTreeContentShortcut);

  elements.favoriteBtn.addEventListener("click", () => {
    const selected = getSelectedTreeNode();
    if (!selected) return;
    selected.favorite = !selected.favorite;
    markTreeNodeChanged(selected);
    persist();
    renderTree();
  });

  elements.copyLinkBtn.addEventListener("click", () => {
    const selected = getSelectedTreeNode();
    if (!selected) return;
    copyNoteLink(selected);
  });

  elements.noteFindToggleBtn.addEventListener("click", toggleNoteFind);
  elements.noteFindInput.addEventListener("input", () => selectNoteFindMatch(0));
  elements.noteFindInput.addEventListener("keydown", handleNoteFindInputKey);
  elements.noteFindPrevBtn.addEventListener("click", () => moveNoteFindMatch(-1));
  elements.noteFindNextBtn.addEventListener("click", () => moveNoteFindMatch(1));
  elements.noteFindCloseBtn.addEventListener("click", closeNoteFind);
  elements.outlineToggleBtn.addEventListener("click", toggleOutlinePanel);
  elements.insertTimeBtn.addEventListener("click", insertCurrentTimeIntoTreeNote);
  elements.pinTabBtn.addEventListener("click", toggleSelectedTreeTabPin);
  elements.reopenClosedTabBtn.addEventListener("click", reopenClosedTreeTab);
  elements.closeOtherTabsBtn.addEventListener("click", closeOtherTreeTabs);
  elements.closeAllTabsBtn.addEventListener("click", closeAllTreeTabs);
  elements.moveUpBtn.addEventListener("click", () => moveSelectedTreeNode(-1));
  elements.moveDownBtn.addEventListener("click", () => moveSelectedTreeNode(1));

  elements.previewToggleBtn.addEventListener("click", () => {
    const selected = getSelectedTreeNode();
    if (!selected) return;
    const isOpening = elements.markdownPreview.classList.contains("hidden");
    elements.markdownPreview.classList.toggle("hidden", !isOpening);
    elements.treeContent.classList.toggle("hidden", isOpening);
    elements.previewToggleBtn.textContent = isOpening ? "편집하기" : "Markdown 보기";
    if (isOpening) {
      renderMarkdownPreview(selected.content);
    } else {
      elements.treeContent.focus();
    }
  });

  elements.addChildBtn.addEventListener("click", addChildToSelectedTreeNode);

  elements.deleteTreeBtn.addEventListener("click", () => {
    const selected = getSelectedTreeNode();
    if (!selected) return;
    if (selected.children.length > 0) {
      alert("아래에 연결된 항목이 있으면 삭제할 수 없습니다.");
      return;
    }
    if (!confirm(`'${selected.title || "제목 없음"}' 메모를 삭제 보관함으로 이동할까요?`)) return;
    if (!archiveDeletedTreeNode(selected.id)) return;
    state.selectedTreeId = null;
    persist();
    renderTree();
    renderDeletedTreeButton();
  });

  elements.deletedTreeBtn.addEventListener("click", toggleDeletedTreeBox);
  elements.deletedTreeCloseBtn.addEventListener("click", closeDeletedTreeBox);
  elements.exportBtn.addEventListener("click", exportData);
  elements.exportMarkdownBtn.addEventListener("click", exportMarkdown);
  elements.importInput.addEventListener("change", importData);
  elements.searchPopoverInput.addEventListener("input", renderSearchPopoverResults);
  elements.searchPopoverInput.addEventListener("keydown", handleSearchPopoverInputKey);
  elements.searchScopeSelect.addEventListener("change", renderSearchPopoverResults);
  elements.searchSortSelect.addEventListener("change", renderSearchPopoverResults);
  elements.searchPopoverCloseBtn.addEventListener("click", closeSearchPopover);
  elements.quickInput.addEventListener("input", renderQuickResults);
  elements.quickInput.addEventListener("keydown", handleQuickInputKey);
  elements.quickCloseBtn.addEventListener("click", closeQuickSwitch);
  elements.graphCloseBtn.addEventListener("click", closeGraph);
  elements.markdownPreview.addEventListener("click", (event) => {
    const taskInput = event.target.closest(".task-list-item input");
    if (taskInput) {
      toggleMarkdownTask(Number(taskInput.closest(".task-list-item").dataset.taskIndex));
      return;
    }
    const link = event.target.closest("[data-wiki-link]");
    if (!link) return;
    openWikiLink(link.dataset.wikiLink);
  });
  window.addEventListener("keydown", handleShortcuts);
  bindTreeResize();

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (state.settings.theme === "system") applySettings();
  });
}

function toggleSettings() {
  if (elements.settingsView.classList.contains("hidden")) {
    elements.settingsView.classList.remove("hidden");
  } else {
    elements.settingsView.classList.add("hidden");
  }
}

function renderSettings() {
  elements.themeSelect.value = state.settings.theme;
  elements.wideEditorToggle.checked = state.settings.wideEditor;
  elements.fontSizeSelect.value = state.settings.fontSize;
  elements.lineHeightSelect.value = state.settings.lineHeight;
  elements.backlinksToggle.checked = state.settings.showBacklinks;
  elements.tagsToggle.checked = state.settings.showTags;
  elements.shortcutsToggle.checked = state.settings.enableShortcuts;
  elements.sidebarAssistToggle.checked = state.settings.showSidebarAssist;
  elements.accentChoices.replaceChildren(
    ...ACCENTS.map((accent) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "accent-btn";
      button.title = accent.label;
      button.style.setProperty("--accent-preview", accent.value);
      button.classList.toggle("active", accent.id === state.settings.accent);
      button.addEventListener("click", () => {
        state.settings.accent = accent.id;
        persistSettings();
        renderSettings();
        applySettings();
      });
      return button;
    }),
  );
}

function resetViewSettings() {
  if (!confirm("화면 설정을 기본값으로 되돌릴까요? 메모 내용은 유지됩니다.")) {
    return;
  }
  state.settings = defaultSettings();
  persistSettings();
  renderSettings();
  applySettings();
  renderTree();
  renderSidebarKnowledge();
}

function applySettings() {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolvedTheme = state.settings.theme === "system"
    ? (systemDark ? "dark" : "light")
    : state.settings.theme;
  const accent = ACCENTS.find((item) => item.id === state.settings.accent) || ACCENTS[0];
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.editor = state.settings.wideEditor ? "wide" : "normal";
  document.documentElement.dataset.sidebar = state.settings.sidebarCollapsed ? "collapsed" : "open";
  document.documentElement.dataset.fontSize = state.settings.fontSize;
  document.documentElement.dataset.lineHeight = state.settings.lineHeight;
  document.documentElement.dataset.backlinks = state.settings.showBacklinks ? "show" : "hide";
  document.documentElement.dataset.tags = state.settings.showTags ? "show" : "hide";
  document.documentElement.dataset.sidebarAssist = state.settings.showSidebarAssist ? "show" : "hide";
  document.documentElement.style.setProperty("--blue", accent.value);
  document.documentElement.style.setProperty("--tree-list-width", `${state.settings.treeListWidth}px`);
  elements.railSidebarBtn.title = state.settings.sidebarCollapsed ? "목록 펼치기" : "목록 접기";
}

function openQuickSwitch() {
  elements.quickSwitchView.classList.remove("hidden");
  elements.quickInput.value = "";
  renderQuickResults();
  elements.quickInput.focus();
}

function toggleQuickSwitch() {
  if (elements.quickSwitchView.classList.contains("hidden")) {
    openQuickSwitch();
  } else {
    closeQuickSwitch();
  }
}

function closeQuickSwitch() {
  elements.quickSwitchView.classList.add("hidden");
}

function toggleSearchPopover() {
  if (elements.searchPopoverView.classList.contains("hidden")) {
    openSearchPopover();
  } else {
    closeSearchPopover();
  }
}

function openSearchPopover() {
  elements.searchPopoverView.classList.remove("hidden");
  elements.searchPopoverInput.value = state.search;
  renderSearchPopoverResults();
  elements.searchPopoverInput.focus();
}

function closeSearchPopover() {
  elements.searchPopoverView.classList.add("hidden");
}

function renderSearchPopoverResults() {
  const query = elements.searchPopoverInput.value.trim();
  if (!query) {
    elements.searchPopoverCount.textContent = "검색어를 입력하세요.";
    elements.searchPopoverResults.innerHTML = '<div class="empty-compact">검색어를 입력하세요.</div>';
    return;
  }
  const results = searchResults(query, {
    scope: elements.searchScopeSelect.value,
    sort: elements.searchSortSelect.value,
  });
  elements.searchPopoverCount.textContent = `검색 결과 ${results.length}개`;
  renderSearchResultsInto(elements.searchPopoverResults, results, () => closeSearchPopover());
}

function renderQuickResults() {
  const query = elements.quickInput.value.trim().toLowerCase();
  const matches = flattenTree(state.data.tree)
    .filter((node) => !query || quickSwitchText(node).includes(query))
    .sort((a, b) => quickSwitchTime(b) - quickSwitchTime(a));
  const nodes = matches.slice(0, 30);
  elements.quickCount.textContent = query
    ? `전환 후보 ${matches.length}개${matches.length > nodes.length ? ` 중 ${nodes.length}개 표시` : ""}`
    : `최근 기준 ${nodes.length}개 표시${matches.length > nodes.length ? ` / 전체 ${matches.length}개` : ""}`;
  if (nodes.length === 0) {
    elements.quickResults.innerHTML = '<div class="empty-compact">이동할 메모가 없습니다.</div>';
    return;
  }
  elements.quickResults.replaceChildren(
    ...nodes.map((node) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quick-result";
      button.innerHTML = `<strong>${escapeHtml(node.title || "제목 없음")}</strong><span>${escapeHtml(treePath(node.id).join(" / "))}</span>`;
      button.addEventListener("click", () => {
        openQuickNode(node.id);
      });
      button.addEventListener("keydown", (event) => {
        handleQuickResultKey(event, button);
      });
      return button;
    }),
  );
}

function handleQuickInputKey(event) {
  if (event.key !== "Enter" && event.key !== "ArrowDown") return;
  const first = elements.quickResults.querySelector(".quick-result");
  if (!first) return;
  event.preventDefault();
  if (event.key === "Enter") {
    first.click();
  } else {
    first.focus();
  }
}

function handleQuickResultKey(event, button) {
  if (!["Enter", "ArrowDown", "ArrowUp", "Escape"].includes(event.key)) return;
  event.preventDefault();
  const results = Array.from(elements.quickResults.querySelectorAll(".quick-result"));
  const index = results.indexOf(button);
  if (event.key === "Enter") {
    button.click();
  } else if (event.key === "ArrowDown") {
    (results[index + 1] || results[0] || button).focus();
  } else if (event.key === "ArrowUp") {
    (results[index - 1] || results.at(-1) || button).focus();
  } else {
    elements.quickInput.focus();
  }
}

function openQuickNode(id) {
  selectTreeNode(id);
  closeQuickSwitch();
}

function quickSwitchTime(node) {
  return new Date(node.updatedAt || node.createdAt || 0).getTime() || 0;
}

function quickSwitchText(node) {
  return `${node.title} ${treePath(node.id).join(" ")}`.toLowerCase();
}

function openGraph() {
  renderGraph();
  elements.graphView.classList.remove("hidden");
}

function toggleGraph() {
  if (elements.graphView.classList.contains("hidden")) {
    openGraph();
  } else {
    closeGraph();
  }
}

function closeGraph() {
  elements.graphView.classList.add("hidden");
}

function openDeletedTreeBox() {
  renderDeletedTreeList();
  elements.deletedTreeView.classList.remove("hidden");
}

function toggleDeletedTreeBox() {
  if (elements.deletedTreeView.classList.contains("hidden")) {
    openDeletedTreeBox();
  } else {
    closeDeletedTreeBox();
  }
}

function closeDeletedTreeBox() {
  elements.deletedTreeView.classList.add("hidden");
}

function handleShortcuts(event) {
  if (!state.settings.enableShortcuts) return;
  if (event.key === "Escape") {
    if (!elements.noteFindBar.classList.contains("hidden")) {
      closeNoteFind();
      return;
    }
    closeQuickSwitch();
    closeSearchPopover();
    closeGraph();
    closeDeletedTreeBox();
    closeDailyPopup();
    elements.settingsView.classList.add("hidden");
    return;
  }
  if (!(event.ctrlKey || event.metaKey)) return;
  const key = event.key.toLowerCase();
  if (event.altKey && key === "arrowup") {
    event.preventDefault();
    moveSelectedTreeNode(-1);
  }
  if (event.altKey && key === "arrowdown") {
    event.preventDefault();
    moveSelectedTreeNode(1);
  }
  if (key === "k") {
    event.preventDefault();
    openQuickSwitch();
  }
  if (key === "o") {
    event.preventDefault();
    openQuickSwitch();
  }
  if (key === "f") {
    event.preventDefault();
    if (event.shiftKey) {
      openNoteFind();
    } else {
      toggleSearchPopover();
    }
  }
  if (key === "d") {
    event.preventDefault();
    toggleDailyPopup();
  }
  if (key === "g") {
    event.preventDefault();
    toggleGraph();
  }
  if (key === "s") {
    event.preventDefault();
    showCurrentSaveState();
  }
  if (key === ";") {
    event.preventDefault();
    insertCurrentTimeIntoTreeNote();
  }
  if (key === "w") {
    event.preventDefault();
    if (event.shiftKey) {
      closeOtherTreeTabs();
    } else {
      closeOpenTreeTab(state.selectedTreeId);
    }
  }
  if (key === "p" && event.shiftKey) {
    event.preventDefault();
    toggleSelectedTreeTabPin();
  }
  if (key === "t" && event.shiftKey) {
    event.preventDefault();
    reopenClosedTreeTab();
  }
  if (key === "pageup") {
    event.preventDefault();
    cycleOpenTreeTab(-1);
  }
  if (key === "pagedown") {
    event.preventDefault();
    cycleOpenTreeTab(1);
  }
  if (key === ",") {
    event.preventDefault();
    toggleSettings();
  }
  if (key === "n") {
    event.preventDefault();
    if (event.shiftKey) {
      addChildToSelectedTreeNode();
    } else {
      addRootNote();
    }
  }
}

function showCurrentSaveState() {
  if (state.view === "tree" && state.selectedTreeId) {
    showSaved(elements.treeSavedLabel);
    return;
  }
  if (!elements.dailyPopup.classList.contains("hidden")) {
    showSaved(elements.dailySavedLabel);
  }
}

function insertCurrentTimeIntoTreeNote() {
  const selected = getSelectedTreeNode();
  if (!selected || state.view !== "tree") return;
  if (!elements.markdownPreview.classList.contains("hidden")) {
    elements.markdownPreview.classList.add("hidden");
    elements.treeContent.classList.remove("hidden");
    elements.previewToggleBtn.textContent = "Markdown 보기";
  }
  const marker = `[${timeLabel(new Date())}] `;
  const start = elements.treeContent.selectionStart ?? elements.treeContent.value.length;
  const end = elements.treeContent.selectionEnd ?? start;
  const before = elements.treeContent.value.slice(0, start);
  const after = elements.treeContent.value.slice(end);
  elements.treeContent.value = `${before}${marker}${after}`;
  const nextCursor = start + marker.length;
  elements.treeContent.focus();
  elements.treeContent.setSelectionRange(nextCursor, nextCursor);
  syncTreeContentFromEditor();
}

function handleTreeContentShortcut(event) {
  if (event.key === "Enter" && !event.shiftKey && continueMarkdownLineOnEnter()) {
    consumeTreeContentShortcut(event);
    return;
  }
  if (event.key === "Tab") {
    consumeTreeContentShortcut(event);
    indentTreeContentSelection(event.shiftKey ? -1 : 1);
    return;
  }
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
  const key = event.key.toLowerCase();
  if (key === "b") {
    consumeTreeContentShortcut(event);
    wrapTreeContentSelection("**", "**");
  }
  if (key === "i") {
    consumeTreeContentShortcut(event);
    wrapTreeContentSelection("*", "*");
  }
  if (key === "c" && event.shiftKey) {
    consumeTreeContentShortcut(event);
    insertChecklistIntoTreeContent();
  }
  if (event.code === "Digit7" && event.shiftKey) {
    consumeTreeContentShortcut(event);
    insertOrderedListIntoTreeContent();
  }
  if (key === "q" && event.shiftKey) {
    consumeTreeContentShortcut(event);
    applyLinePrefixToTreeContent("> ", /^>\s*/);
  }
  if (key === "k" && event.shiftKey) {
    consumeTreeContentShortcut(event);
    wrapTreeContentAsCodeBlock();
  }
  if (key === "h" && event.shiftKey) {
    consumeTreeContentShortcut(event);
    insertHorizontalRuleIntoTreeContent();
  }
  if (key === "l" && event.shiftKey) {
    consumeTreeContentShortcut(event);
    wrapTreeContentAsMarkdownLink();
  }
  if (["1", "2", "3"].includes(key)) {
    consumeTreeContentShortcut(event);
    applyHeadingToTreeContent(Number(key));
  }
}

function consumeTreeContentShortcut(event) {
  event.preventDefault();
  event.stopPropagation();
}

function continueMarkdownLineOnEnter() {
  const selected = getSelectedTreeNode();
  if (!selected) return false;
  const cursor = elements.treeContent.selectionStart ?? 0;
  const value = elements.treeContent.value;
  const lineStart = value.lastIndexOf("\n", cursor - 1) + 1;
  const line = value.slice(lineStart, cursor);
  const quoteMatch = line.match(/^(\s*>\s?)(.*)$/);
  if (quoteMatch) {
    const [, marker, body] = quoteMatch;
    if (!body.trim()) {
      const before = value.slice(0, lineStart);
      const after = value.slice(cursor);
      elements.treeContent.value = `${before}${after}`;
      elements.treeContent.setSelectionRange(lineStart, lineStart);
    } else {
      elements.treeContent.value = `${value.slice(0, cursor)}\n${marker}${value.slice(cursor)}`;
      const nextCursor = cursor + 1 + marker.length;
      elements.treeContent.setSelectionRange(nextCursor, nextCursor);
    }
    syncTreeContentFromEditor();
    return true;
  }
  const orderedListMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
  if (orderedListMatch) {
    const [, indent, number, body] = orderedListMatch;
    if (!body.trim()) {
      const before = value.slice(0, lineStart);
      const after = value.slice(cursor);
      elements.treeContent.value = `${before}${after}`;
      elements.treeContent.setSelectionRange(lineStart, lineStart);
    } else {
      const nextMarker = `${indent}${Number(number) + 1}. `;
      elements.treeContent.value = `${value.slice(0, cursor)}\n${nextMarker}${value.slice(cursor)}`;
      const nextCursor = cursor + 1 + nextMarker.length;
      elements.treeContent.setSelectionRange(nextCursor, nextCursor);
    }
    syncTreeContentFromEditor();
    return true;
  }
  const listMatch = line.match(/^(\s*)([-*])\s+(.*)$/);
  if (!listMatch) return false;
  const [, indent, bullet, body] = listMatch;
  const taskMatch = body.match(/^\[([ xX])\]\s*(.*)$/);
  if (!body.trim() || (taskMatch && !taskMatch[2].trim())) {
    const before = value.slice(0, lineStart);
    const after = value.slice(cursor);
    elements.treeContent.value = `${before}${after}`;
    elements.treeContent.setSelectionRange(lineStart, lineStart);
  } else {
    const nextMarker = taskMatch ? `${indent}${bullet} [ ] ` : `${indent}${bullet} `;
    elements.treeContent.value = `${value.slice(0, cursor)}\n${nextMarker}${value.slice(cursor)}`;
    const nextCursor = cursor + 1 + nextMarker.length;
    elements.treeContent.setSelectionRange(nextCursor, nextCursor);
  }
  syncTreeContentFromEditor();
  return true;
}

function syncTreeContentFromEditor() {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  selected.content = elements.treeContent.value;
  selected.tags = extractTags(selected.content);
  markTreeNodeChanged(selected);
  persist();
  renderMarkdownPreview(selected.content);
  renderTags();
  renderNoteStats(selected);
  renderOutlinePanel(selected);
  renderLinkPanel();
  showSaved(elements.treeSavedLabel);
}

function indentTreeContentSelection(direction) {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  const value = elements.treeContent.value;
  const selectionStart = elements.treeContent.selectionStart ?? 0;
  const selectionEnd = elements.treeContent.selectionEnd ?? selectionStart;
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineEnd = value.indexOf("\n", selectionEnd);
  const end = lineEnd === -1 ? value.length : lineEnd;
  const block = value.slice(lineStart, end);
  const nextBlock = block
    .split("\n")
    .map((line) => {
      if (direction > 0) return `  ${line}`;
      return line.replace(/^ {1,2}/, "");
    })
    .join("\n");
  elements.treeContent.value = `${value.slice(0, lineStart)}${nextBlock}${value.slice(end)}`;
  const delta = nextBlock.length - block.length;
  const nextStart = Math.max(lineStart, selectionStart + (direction > 0 ? 2 : Math.min(0, delta)));
  const nextEnd = Math.max(nextStart, selectionEnd + delta);
  elements.treeContent.focus();
  elements.treeContent.setSelectionRange(nextStart, nextEnd);
  syncTreeContentFromEditor();
}

function wrapTreeContentSelection(prefix, suffix) {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  const start = elements.treeContent.selectionStart ?? 0;
  const end = elements.treeContent.selectionEnd ?? start;
  const value = elements.treeContent.value;
  const selectedText = value.slice(start, end);
  elements.treeContent.value = `${value.slice(0, start)}${prefix}${selectedText}${suffix}${value.slice(end)}`;
  const cursorStart = start + prefix.length;
  const cursorEnd = cursorStart + selectedText.length;
  elements.treeContent.focus();
  elements.treeContent.setSelectionRange(cursorStart, cursorEnd);
  syncTreeContentFromEditor();
}

function insertHorizontalRuleIntoTreeContent() {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  const start = elements.treeContent.selectionStart ?? 0;
  const end = elements.treeContent.selectionEnd ?? start;
  const value = elements.treeContent.value;
  const before = value.slice(0, start).trimEnd();
  const after = value.slice(end).trimStart();
  const rule = `${before ? `${before}\n\n` : ""}---${after ? `\n\n${after}` : ""}`;
  elements.treeContent.value = rule;
  const cursor = (before ? before.length + 2 : 0) + 3;
  elements.treeContent.focus();
  elements.treeContent.setSelectionRange(cursor, cursor);
  syncTreeContentFromEditor();
}

function wrapTreeContentAsMarkdownLink() {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  const start = elements.treeContent.selectionStart ?? 0;
  const end = elements.treeContent.selectionEnd ?? start;
  const value = elements.treeContent.value;
  const selectedText = value.slice(start, end) || "링크 제목";
  const linkText = `[${selectedText}](https://)`;
  elements.treeContent.value = `${value.slice(0, start)}${linkText}${value.slice(end)}`;
  const urlStart = start + selectedText.length + 3;
  const urlEnd = urlStart + "https://".length;
  elements.treeContent.focus();
  elements.treeContent.setSelectionRange(urlStart, urlEnd);
  syncTreeContentFromEditor();
}

function wrapTreeContentAsCodeBlock() {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  const start = elements.treeContent.selectionStart ?? 0;
  const end = elements.treeContent.selectionEnd ?? start;
  const value = elements.treeContent.value;
  const selectedText = value.slice(start, end);
  const codeBlock = `\`\`\`\n${selectedText}\n\`\`\``;
  elements.treeContent.value = `${value.slice(0, start)}${codeBlock}${value.slice(end)}`;
  const cursorStart = start + 4;
  const cursorEnd = cursorStart + selectedText.length;
  elements.treeContent.focus();
  elements.treeContent.setSelectionRange(cursorStart, cursorEnd);
  syncTreeContentFromEditor();
}

function applyLinePrefixToTreeContent(prefix, cleanupPattern) {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  const value = elements.treeContent.value;
  const selectionStart = elements.treeContent.selectionStart ?? 0;
  const selectionEnd = elements.treeContent.selectionEnd ?? selectionStart;
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineEnd = value.indexOf("\n", selectionEnd);
  const end = lineEnd === -1 ? value.length : lineEnd;
  const block = value.slice(lineStart, end);
  const nextBlock = block
    .split("\n")
    .map((line) => `${prefix}${line.replace(cleanupPattern, "")}`)
    .join("\n");
  elements.treeContent.value = `${value.slice(0, lineStart)}${nextBlock}${value.slice(end)}`;
  elements.treeContent.focus();
  elements.treeContent.setSelectionRange(lineStart, lineStart + nextBlock.length);
  syncTreeContentFromEditor();
}

function applyHeadingToTreeContent(level) {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  const marker = `${"#".repeat(level)} `;
  const value = elements.treeContent.value;
  const selectionStart = elements.treeContent.selectionStart ?? 0;
  const selectionEnd = elements.treeContent.selectionEnd ?? selectionStart;
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineEnd = value.indexOf("\n", selectionEnd);
  const end = lineEnd === -1 ? value.length : lineEnd;
  const block = value.slice(lineStart, end);
  const nextBlock = block
    .split("\n")
    .map((line) => `${marker}${line.replace(/^#{1,6}\s+/, "")}`)
    .join("\n");
  elements.treeContent.value = `${value.slice(0, lineStart)}${nextBlock}${value.slice(end)}`;
  const cursorStart = lineStart;
  const cursorEnd = lineStart + nextBlock.length;
  elements.treeContent.focus();
  elements.treeContent.setSelectionRange(cursorStart, cursorEnd);
  syncTreeContentFromEditor();
}

function insertChecklistIntoTreeContent() {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  const start = elements.treeContent.selectionStart ?? 0;
  const end = elements.treeContent.selectionEnd ?? start;
  const value = elements.treeContent.value;
  const selectedText = value.slice(start, end);
  const checklist = selectedText
    ? selectedText
      .split("\n")
      .map((line) => `- [ ] ${line.replace(/^[-*]\s+\[[ xX]\]\s*/, "").trimStart()}`)
      .join("\n")
    : "- [ ] ";
  elements.treeContent.value = `${value.slice(0, start)}${checklist}${value.slice(end)}`;
  const cursorStart = start + (selectedText ? 0 : checklist.length);
  const cursorEnd = start + checklist.length;
  elements.treeContent.focus();
  elements.treeContent.setSelectionRange(cursorStart, cursorEnd);
  syncTreeContentFromEditor();
}

function insertOrderedListIntoTreeContent() {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  const start = elements.treeContent.selectionStart ?? 0;
  const end = elements.treeContent.selectionEnd ?? start;
  const value = elements.treeContent.value;
  const selectedText = value.slice(start, end);
  const orderedList = selectedText
    ? selectedText
      .split("\n")
      .map((line, index) => `${index + 1}. ${line.replace(/^(\d+\.\s+|[-*]\s+)/, "").trimStart()}`)
      .join("\n")
    : "1. ";
  elements.treeContent.value = `${value.slice(0, start)}${orderedList}${value.slice(end)}`;
  const cursorStart = start + (selectedText ? 0 : orderedList.length);
  const cursorEnd = start + orderedList.length;
  elements.treeContent.focus();
  elements.treeContent.setSelectionRange(cursorStart, cursorEnd);
  syncTreeContentFromEditor();
}

function renderGraph() {
  const links = graphLinks();
  if (links.length === 0) {
    elements.graphList.innerHTML = '<div class="empty-compact">아직 연결된 메모가 없습니다. 본문에 [[메모 제목]]을 적으면 연결됩니다.</div>';
    return;
  }
  elements.graphList.replaceChildren(
    ...links.map((link) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "graph-link";
      row.innerHTML = `<strong>${escapeHtml(link.from.title || "제목 없음")}</strong><span>→</span><strong>${escapeHtml(link.to.title || "제목 없음")}</strong>`;
      row.addEventListener("click", () => {
        selectTreeNode(link.to.id);
        closeGraph();
      });
      return row;
    }),
  );
}

function renderDeletedTreeList() {
  const deleted = state.data.deletedTree || [];
  renderDeletedTreeButton();
  if (deleted.length === 0) {
    elements.deletedTreeList.innerHTML = '<div class="empty-compact">삭제 보관함이 비어 있습니다.</div>';
    return;
  }
  elements.deletedTreeList.replaceChildren(
    ...deleted.map((node) => {
      const item = document.createElement("article");
      item.className = "archive-item";
      item.innerHTML = `
        <div>
          <strong>${escapeHtml(node.title || "제목 없음")}</strong>
          <span>${escapeHtml(formatArchivedAt(node.deletedAt))} 삭제</span>
          <p>${escapeHtml(snippet(node.content || ""))}</p>
        </div>
        <div class="archive-actions">
          <button class="secondary-btn" type="button" data-action="restore">복원</button>
          <button class="danger-btn" type="button" data-action="remove">영구 삭제</button>
        </div>
      `;
      item.querySelector('[data-action="restore"]').addEventListener("click", () => {
        restoreDeletedTreeNode(node.id);
      });
      item.querySelector('[data-action="remove"]').addEventListener("click", () => {
        permanentlyDeleteTreeNode(node.id);
      });
      return item;
    }),
  );
}

function bindTreeResize() {
  let startX = 0;
  let startWidth = 0;

  const onMove = (event) => {
    const nextWidth = Math.min(460, Math.max(180, startWidth + event.clientX - startX));
    state.settings.treeListWidth = nextWidth;
    applySettings();
  };

  const onUp = () => {
    persistSettings();
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    document.body.classList.remove("resizing");
  };

  elements.treeResizeHandle.addEventListener("pointerdown", (event) => {
    startX = event.clientX;
    startWidth = state.settings.treeListWidth;
    document.body.classList.add("resizing");
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
}

function setView(view) {
  state.view = view;
  elements.navTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  elements.treeView.classList.toggle("active", view === "tree");
  elements.resultsView.classList.toggle("active", view === "results");
  render();
}

function selectTreeNode(id) {
  state.selectedTreeId = id;
  expandAncestors(id);
  closeDailyPopup();
  setView("tree");
}

function toggleDailyPopup() {
  if (elements.dailyView.classList.contains("hidden")) {
    openDailyPopup();
  } else {
    closeDailyPopup();
  }
}

function openDailyPopup() {
  elements.dailyView.classList.remove("hidden");
  elements.dailyContent.focus();
}

function closeDailyPopup() {
  elements.dailyView.classList.add("hidden");
}

function render() {
  renderDaily();
  renderTree();
  renderResults();
  renderSidebarKnowledge();
  renderDeletedTreeButton();
}

function renderDeletedTreeButton() {
  const count = state.data.deletedTree?.length || 0;
  elements.deletedTreeCount.textContent = String(count);
  elements.deletedTreeBtn.classList.toggle("has-items", count > 0);
}

function renderDaily() {
  elements.monthLabel.textContent = monthLabel(state.visibleMonth);
  elements.selectedDateLabel.textContent = longDateLabel(state.selectedDate);
  elements.dailyContent.value = state.data.daily[state.selectedDate]?.content || "";
  elements.todayMemoState.textContent = state.data.daily[toDateKey(new Date())]?.content?.trim()
    ? "기록 있음"
    : "비어 있음";
  renderCalendar();
  renderArchiveList();
}

function renderSidebarKnowledge() {
  renderFavoriteList();
  renderRecentList();
  renderSideTags();
}

function renderFavoriteList() {
  const favorites = flattenTree(state.data.tree).filter((node) => node.favorite);
  elements.favoriteCount.textContent = String(favorites.length);
  if (favorites.length === 0) {
    elements.favoriteList.innerHTML = '<div class="side-empty">없음</div>';
    return;
  }
  elements.favoriteList.replaceChildren(
    ...favorites.slice(0, 8).map((node) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "side-link";
      button.innerHTML = `<strong>${escapeHtml(node.title || "제목 없음")}</strong><span>${escapeHtml(levelName(node.level))}</span>`;
      button.addEventListener("click", () => {
        selectTreeNode(node.id);
      });
      return button;
    }),
  );
}

function renderRecentList() {
  const recent = flattenTree(state.data.tree)
    .filter((node) => node.updatedAt)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 8);
  elements.recentCount.textContent = String(recent.length);
  if (recent.length === 0) {
    elements.recentList.innerHTML = '<div class="side-empty">없음</div>';
    return;
  }
  elements.recentList.replaceChildren(
    ...recent.map((node) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "side-link";
      button.innerHTML = `<strong>${escapeHtml(node.title || "제목 없음")}</strong><span>${escapeHtml(relativeTime(node.updatedAt))}</span>`;
      button.addEventListener("click", () => {
        selectTreeNode(node.id);
      });
      return button;
    }),
  );
}

function renderSideTags() {
  const tags = tagSummary();
  elements.tagCount.textContent = String(tags.length);
  if (tags.length === 0) {
    elements.sideTagList.innerHTML = '<div class="side-empty">없음</div>';
    return;
  }
  elements.sideTagList.replaceChildren(
    ...tags.slice(0, 16).map((tag) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "side-tag";
      button.textContent = `#${tag.name} ${tag.count}`;
      button.addEventListener("click", () => {
        elements.searchInput.value = `tag:${tag.name}`;
        state.search = `tag:${tag.name}`;
        setView("results");
      });
      return button;
    }),
  );
}

function renderCalendar() {
  elements.calendarGrid.replaceChildren(...calendarButtons());
}

function calendarButtons() {
  const start = new Date(state.visibleMonth);
  start.setDate(1 - start.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = toDateKey(date);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "day-btn";
    button.textContent = String(date.getDate());
    button.classList.toggle("muted", date.getMonth() !== state.visibleMonth.getMonth());
    button.classList.toggle("selected", key === state.selectedDate);
    button.classList.toggle("has-note", Boolean(state.data.daily[key]?.content?.trim()));
    button.addEventListener("click", () => {
      state.selectedDate = key;
      state.visibleMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      renderDaily();
    });
    return button;
  });
}

function saveDailyFromEditor() {
  const content = elements.dailyContent.value;
  if (!content.trim()) {
    delete state.data.daily[state.selectedDate];
  } else {
    state.data.daily[state.selectedDate] = {
      date: state.selectedDate,
      content,
      status: "active",
      syncState: "pending",
      updatedAt: new Date().toISOString(),
    };
  }
  persist();
  renderCalendar();
  showSaved(elements.dailySavedLabel);
}

function archiveSelectedDailyNote() {
  const note = state.data.daily[state.selectedDate];
  if (!note?.content?.trim()) {
    alert("보관할 메모가 없습니다.");
    return;
  }
  if (!confirm(`${longDateLabel(state.selectedDate)} 메모를 보관함으로 이동할까요?`)) return;

  state.data.archivedDaily.unshift({
    id: crypto.randomUUID(),
    date: state.selectedDate,
    content: note.content,
    status: "archived",
    syncState: "pending",
    archivedAt: new Date().toISOString(),
    updatedAt: note.updatedAt || new Date().toISOString(),
  });
  delete state.data.daily[state.selectedDate];
  persist();
  renderDaily();
  elements.dailyContent.focus();
}

function renderArchiveList() {
  const archives = state.data.archivedDaily || [];
  elements.archiveCountLabel.textContent = `${archives.length}개`;
  if (archives.length === 0) {
    elements.archiveList.innerHTML = '<div class="empty-compact">보관된 일자별 메모가 없습니다.</div>';
    return;
  }

  elements.archiveList.replaceChildren(
    ...archives.map((note) => {
      const item = document.createElement("article");
      item.className = "archive-item";
      item.innerHTML = `
        <div>
          <strong>${escapeHtml(longDateLabel(note.date))}</strong>
          <span>${escapeHtml(formatArchivedAt(note.archivedAt))} 보관</span>
          <p>${escapeHtml(snippet(note.content))}</p>
        </div>
        <div class="archive-actions">
          <button class="secondary-btn" type="button" data-action="view">열람</button>
          <button class="secondary-btn" type="button" data-action="restore">복원</button>
        </div>
      `;
      item.querySelector('[data-action="view"]').addEventListener("click", () => {
        state.selectedDate = note.date;
        const [year, month] = note.date.split("-").map(Number);
        state.visibleMonth = new Date(year, month - 1, 1);
        elements.dailyContent.value = note.content;
        elements.selectedDateLabel.textContent = `${longDateLabel(note.date)} · 보관본 열람`;
        elements.dailyContent.focus();
      });
      item.querySelector('[data-action="restore"]').addEventListener("click", () => {
        restoreArchivedDailyNote(note.id);
      });
      return item;
    }),
  );
}

function restoreArchivedDailyNote(id) {
  const note = state.data.archivedDaily.find((item) => item.id === id);
  if (!note) return;
  const active = state.data.daily[note.date];
  if (active?.content?.trim()) {
    const ok = confirm("같은 날짜의 활성 메모가 있습니다. 보관본 내용을 아래에 추가할까요?");
    if (!ok) return;
    state.data.daily[note.date].content = `${active.content.trimEnd()}\n\n--- 보관본 복원 ---\n${note.content}`;
    state.data.daily[note.date].updatedAt = new Date().toISOString();
  } else {
    state.data.daily[note.date] = {
      date: note.date,
      content: note.content,
      status: "active",
      syncState: "pending",
      restoredFromArchiveId: note.id,
      updatedAt: new Date().toISOString(),
    };
  }
  state.selectedDate = note.date;
  const [year, month] = note.date.split("-").map(Number);
  state.visibleMonth = new Date(year, month - 1, 1);
  persist();
  renderDaily();
}

function renderTree() {
  renderTreeListOnly();
  renderTreeEditor();
  renderOpenTreeTabs();
}

function addRootNote() {
  const node = createNode("새 주제", "", null, 1);
  state.data.tree.push(node);
  state.selectedTreeId = node.id;
  state.expandedTreeIds.add(node.id);
  persist();
  renderTree();
}

function addChildToSelectedTreeNode() {
  const selected = getSelectedTreeNode();
  if (!selected) {
    addRootNote();
    return;
  }
  if (selected.level >= 3) {
    alert("지식 메모는 주제, 분류, 메모 3단계까지만 만들 수 있습니다.");
    return;
  }
  const node = createNode(defaultTitleForLevel(selected.level + 1), "", selected.id, selected.level + 1);
  selected.children.push(node);
  state.selectedTreeId = node.id;
  state.expandedTreeIds.add(selected.id);
  persist();
  renderTree();
}

function renderTreeListOnly() {
  if (state.data.tree.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = "<strong>주제가 없습니다</strong><span>먼저 주제를 추가하세요.</span>";
    elements.treeList.replaceChildren(empty);
    return;
  }
  elements.treeList.replaceChildren(...state.data.tree.map((node) => treeNodeElement(node)));
}

function treeNodeElement(node) {
  const wrapper = document.createElement("div");
  wrapper.className = "tree-node";
  const expanded = state.expandedTreeIds.has(node.id);
  const hasChildren = node.children.length > 0;
  wrapper.classList.toggle("expanded", expanded && hasChildren);
  wrapper.classList.toggle("has-children", hasChildren);

  const row = document.createElement("div");
  row.className = "tree-row";
  row.classList.toggle("active", node.id === state.selectedTreeId);

  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.className = "tree-toggle";
  toggleButton.textContent = hasChildren ? (expanded ? "⌄" : "›") : "";
  toggleButton.disabled = !hasChildren;
  toggleButton.title = expanded ? "접기" : "펼치기";
  toggleButton.addEventListener("click", () => {
    toggleTreeNode(node.id);
  });

  const labelButton = document.createElement("button");
  labelButton.type = "button";
  labelButton.className = "tree-label-btn";
  labelButton.addEventListener("click", () => {
    state.selectedTreeId = node.id;
    expandAncestors(node.id);
    renderTree();
  });

  const metaParts = [
    levelName(node.level),
    node.children.length > 0 ? `아래 ${node.children.length}개` : "",
    node.tags.length ? `#${node.tags.slice(0, 2).join(" #")}` : "",
  ].filter(Boolean);
  labelButton.innerHTML = `<div class="tree-title">${escapeHtml(node.favorite ? `★ ${node.title || "제목 없음"}` : node.title || "제목 없음")}</div><div class="tree-meta">${escapeHtml(metaParts.join(" · "))}</div>`;

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "small-btn";
  addButton.textContent = "+";
  addButton.title = "아래에 추가";
  addButton.disabled = node.level >= 3;
  addButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (node.level >= 3) return;
    const child = createNode(defaultTitleForLevel(node.level + 1), "", node.id, node.level + 1);
    node.children.push(child);
    state.selectedTreeId = child.id;
    state.expandedTreeIds.add(node.id);
    persist();
    renderTree();
  });

  row.append(toggleButton, labelButton, addButton);
  wrapper.append(row);

  if (hasChildren && expanded) {
    const children = document.createElement("div");
    children.className = "tree-children";
    children.append(...node.children.map((child) => treeNodeElement(child)));
    wrapper.append(children);
  }

  return wrapper;
}

function toggleTreeNode(id) {
  if (state.expandedTreeIds.has(id)) {
    state.expandedTreeIds.delete(id);
  } else {
    state.expandedTreeIds.add(id);
  }
  renderTreeListOnly();
}

function expandAllTreeNodes() {
  flattenTree(state.data.tree)
    .filter((node) => node.children.length > 0)
    .forEach((node) => state.expandedTreeIds.add(node.id));
  renderTreeListOnly();
}

function renderTreeEditor() {
  const selected = getSelectedTreeNode();
  elements.emptyTreeEditor.classList.toggle("hidden", Boolean(selected));
  elements.treeEditor.classList.toggle("hidden", !selected);
  if (!selected) {
    renderOpenTreeTabs();
    return;
  }
  addOpenTreeTab(selected.id);

  elements.treeLevelLabel.textContent = levelName(selected.level);
  elements.treeTitleInput.value = selected.title;
  elements.treeContent.value = selected.content;
  renderFavorite(selected);
  renderTags();
  renderNoteStats(selected);
  elements.markdownPreview.classList.add("hidden");
  elements.treeContent.classList.remove("hidden");
  elements.previewToggleBtn.textContent = "Markdown 보기";
  renderTreePath(selected);
  renderMarkdownPreview(selected.content);
  renderOutlinePanel(selected);
  renderLinkPanel();
  elements.addChildBtn.disabled = selected.level >= 3;
  renderTreeMoveButtons(selected);
}

function renderTreeMoveButtons(node) {
  const { siblings, index } = treeSiblingPosition(node);
  elements.moveUpBtn.disabled = index <= 0;
  elements.moveDownBtn.disabled = index < 0 || index >= siblings.length - 1;
}

function renderTreePath(node) {
  const nodes = treePathNodes(node.id);
  if (nodes.length === 0) {
    elements.treePathLabel.textContent = "";
    return;
  }
  elements.treePathLabel.replaceChildren(
    ...nodes.flatMap((pathNode, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "path-link";
      button.textContent = pathNode.title || "제목 없음";
      button.addEventListener("click", () => {
        selectTreeNode(pathNode.id);
      });
      if (index === nodes.length - 1) {
        button.setAttribute("aria-current", "page");
      }
      if (index === nodes.length - 1) return [button];
      const separator = document.createElement("span");
      separator.className = "path-separator";
      separator.textContent = "/";
      return [button, separator];
    }),
  );
}

function addOpenTreeTab(id) {
  if (!id) return;
  if (!state.settings.openTreeTabs.includes(id)) {
    state.settings.openTreeTabs = limitOpenTreeTabs([...state.settings.openTreeTabs, id]);
  }
  persistSettings();
}

function limitOpenTreeTabs(ids, limit = 10, pinnedTabIds = state.settings.pinnedTreeTabs) {
  const uniqueIds = Array.from(new Set(ids.filter((id) => typeof id === "string" && id.trim())));
  if (uniqueIds.length <= limit) return uniqueIds;
  const pinnedIds = new Set(pinnedTabIds);
  const pinnedToKeep = uniqueIds.filter((id) => pinnedIds.has(id)).slice(0, limit);
  const remainingSlots = Math.max(0, limit - pinnedToKeep.length);
  const normalIds = uniqueIds.filter((id) => !pinnedIds.has(id));
  const normalToKeep = remainingSlots > 0 ? normalIds.slice(-remainingSlots) : [];
  const keepIds = new Set([...pinnedToKeep, ...normalToKeep]);
  return uniqueIds.filter((id) => keepIds.has(id));
}

function visibleOpenTreeTabs() {
  const tabs = state.settings.openTreeTabs
    .map((id) => findTreeNode(state.data.tree, id))
    .filter(Boolean);
  const pinnedIds = new Set(state.settings.pinnedTreeTabs);
  return [
    ...tabs.filter((node) => pinnedIds.has(node.id)),
    ...tabs.filter((node) => !pinnedIds.has(node.id)),
  ];
}

function firstVisibleOpenTreeTabId() {
  return visibleOpenTreeTabs()[0]?.id || null;
}

function renderOpenTreeTabs() {
  pruneTreeTabSettings();
  const tabs = state.settings.openTreeTabs
    .map((id) => findTreeNode(state.data.tree, id))
    .filter(Boolean);
  const pinnedIds = new Set(state.settings.pinnedTreeTabs);
  const sortedTabs = visibleOpenTreeTabs();
  elements.openTabsBar.classList.toggle("hidden", sortedTabs.length === 0);
  if (tabs.length === 0) {
    elements.openTabs.replaceChildren();
    persistSettings();
    return;
  }
  elements.openTabs.replaceChildren(
    ...sortedTabs.map((node) => {
      const pinned = pinnedIds.has(node.id);
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "open-tab";
      tab.classList.toggle("active", node.id === state.selectedTreeId);
      tab.classList.toggle("pinned", pinned);
      tab.innerHTML = `<span>${pinned ? "고정 · " : ""}${escapeHtml(node.title || "제목 없음")}</span><strong aria-label="닫기">×</strong>`;
      tab.addEventListener("click", () => {
        selectTreeNode(node.id);
      });
      tab.querySelector("strong").addEventListener("click", (event) => {
        event.stopPropagation();
        closeOpenTreeTab(node.id);
      });
      return tab;
    }),
  );
  const selectedPinned = state.settings.pinnedTreeTabs.includes(state.selectedTreeId);
  elements.pinTabBtn.disabled = !state.selectedTreeId || !state.settings.openTreeTabs.includes(state.selectedTreeId);
  elements.pinTabBtn.textContent = selectedPinned ? "고정 해제" : "탭 고정";
  elements.reopenClosedTabBtn.disabled = !state.settings.closedTreeTabs.some((id) => findTreeNode(state.data.tree, id));
  persistSettings();
}

function pruneTreeTabSettings() {
  const exists = (id) => Boolean(findTreeNode(state.data.tree, id));
  const pinnedTabs = normalizeIdList(state.settings.pinnedTreeTabs, 10).filter(exists);
  const openTabs = normalizeIdList(state.settings.openTreeTabs, 100).filter(exists);
  state.settings.openTreeTabs = limitOpenTreeTabs(openTabs, 10, pinnedTabs);
  state.settings.closedTreeTabs = normalizeIdList(state.settings.closedTreeTabs, 10).filter(exists);
  state.settings.pinnedTreeTabs = pinnedTabs.filter((id) => state.settings.openTreeTabs.includes(id));
  if (state.selectedTreeId && !exists(state.selectedTreeId)) {
    state.selectedTreeId = null;
  }
}

function cycleOpenTreeTab(direction) {
  const tabs = visibleOpenTreeTabs();
  if (tabs.length < 2) return;
  const currentIndex = Math.max(0, tabs.findIndex((node) => node.id === state.selectedTreeId));
  const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
  selectTreeNode(tabs[nextIndex].id);
}

function rememberClosedTreeTabs(ids) {
  const validIds = ids.filter((id) => id && findTreeNode(state.data.tree, id));
  if (validIds.length === 0) return;
  state.settings.closedTreeTabs = [
    ...validIds.reverse(),
    ...state.settings.closedTreeTabs.filter((id) => !validIds.includes(id)),
  ].slice(0, 10);
}

function reopenClosedTreeTab() {
  const id = state.settings.closedTreeTabs.find((tabId) => findTreeNode(state.data.tree, tabId));
  if (!id) return;
  state.settings.closedTreeTabs = state.settings.closedTreeTabs.filter((tabId) => tabId !== id);
  addOpenTreeTab(id);
  selectTreeNode(id);
}

function toggleSelectedTreeTabPin() {
  const id = state.selectedTreeId;
  if (!id || !state.settings.openTreeTabs.includes(id)) return;
  if (state.settings.pinnedTreeTabs.includes(id)) {
    state.settings.pinnedTreeTabs = state.settings.pinnedTreeTabs.filter((tabId) => tabId !== id);
  } else {
    state.settings.pinnedTreeTabs = [...state.settings.pinnedTreeTabs, id];
  }
  persistSettings();
  renderOpenTreeTabs();
}

function closeOtherTreeTabs() {
  if (!state.selectedTreeId) return;
  const keepIds = new Set([state.selectedTreeId, ...state.settings.pinnedTreeTabs]);
  const closingIds = state.settings.openTreeTabs.filter((tabId) => !keepIds.has(tabId));
  rememberClosedTreeTabs(closingIds);
  state.settings.openTreeTabs = state.settings.openTreeTabs.filter((tabId) => keepIds.has(tabId));
  persistSettings();
  renderTree();
}

function closeAllTreeTabs() {
  const pinnedIds = new Set(state.settings.pinnedTreeTabs);
  const closingIds = state.settings.openTreeTabs.filter((tabId) => !pinnedIds.has(tabId));
  rememberClosedTreeTabs(closingIds);
  state.settings.openTreeTabs = state.settings.openTreeTabs.filter((tabId) => pinnedIds.has(tabId));
  if (!state.settings.openTreeTabs.includes(state.selectedTreeId)) {
    state.selectedTreeId = firstVisibleOpenTreeTabId();
  }
  persistSettings();
  renderTree();
}

function closeOpenTreeTab(id) {
  if (!id) return;
  const tabs = state.settings.openTreeTabs.filter((tabId) => tabId !== id);
  const wasSelected = state.selectedTreeId === id;
  rememberClosedTreeTabs([id]);
  state.settings.openTreeTabs = tabs;
  state.settings.pinnedTreeTabs = state.settings.pinnedTreeTabs.filter((tabId) => tabId !== id);
  if (wasSelected) {
    state.selectedTreeId = firstVisibleOpenTreeTabId();
  }
  persistSettings();
  renderTree();
}

function removeTreeTabReferences(id) {
  if (!id) return;
  state.settings.openTreeTabs = state.settings.openTreeTabs.filter((tabId) => tabId !== id);
  state.settings.closedTreeTabs = state.settings.closedTreeTabs.filter((tabId) => tabId !== id);
  state.settings.pinnedTreeTabs = state.settings.pinnedTreeTabs.filter((tabId) => tabId !== id);
  persistSettings();
}

function renderFavorite(node) {
  elements.favoriteBtn.classList.toggle("active", Boolean(node.favorite));
  elements.favoriteBtn.textContent = node.favorite ? "즐겨찾기 해제" : "즐겨찾기";
}

function renderTags() {
  const selected = getSelectedTreeNode();
  if (!selected || !state.settings.showTags) {
    elements.tagList.replaceChildren();
    return;
  }
  selected.tags = extractTags(selected.content);
  if (selected.tags.length === 0) {
    elements.tagList.innerHTML = '<span class="tag-empty">태그 없음</span>';
    return;
  }
  elements.tagList.replaceChildren(
    ...selected.tags.map((tag) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tag-chip";
      button.textContent = `#${tag}`;
      button.addEventListener("click", () => {
        elements.searchInput.value = `tag:${tag}`;
        state.search = `tag:${tag}`;
        setView("results");
      });
      return button;
    }),
  );
}

function renderNoteStats(node) {
  const text = node.content || "";
  const chars = text.replace(/\s/g, "").length;
  const lines = text ? text.split("\n").length : 0;
  const links = extractWikiLinks(text).length;
  const tags = extractTags(text).length;
  elements.noteStats.textContent = `글자 ${chars} · 줄 ${lines} · 링크 ${links} · 태그 ${tags} · 수정 ${relativeTime(node.updatedAt)}`;
}

function toggleOutlinePanel() {
  elements.outlinePanel.classList.toggle("hidden");
  const selected = getSelectedTreeNode();
  if (selected) renderOutlinePanel(selected);
}

function renderOutlinePanel(node) {
  if (elements.outlinePanel.classList.contains("hidden")) return;
  const headings = extractHeadings(node.content);
  if (headings.length === 0) {
    elements.outlinePanel.innerHTML = '<div class="empty-compact">개요로 표시할 제목이 없습니다.</div>';
    return;
  }
  elements.outlinePanel.replaceChildren(
    ...headings.map((heading) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "outline-item";
      button.style.setProperty("--outline-depth", String(Math.min(heading.level - 1, 4)));
      button.innerHTML = `<span>H${heading.level}</span><strong>${escapeHtml(heading.title)}</strong>`;
      button.addEventListener("click", () => {
        elements.markdownPreview.classList.add("hidden");
        elements.treeContent.classList.remove("hidden");
        elements.previewToggleBtn.textContent = "Markdown 보기";
        elements.treeContent.focus();
        elements.treeContent.setSelectionRange(heading.index, heading.index + heading.raw.length);
      });
      return button;
    }),
  );
}

function extractHeadings(content) {
  const headings = [];
  let offset = 0;
  String(content || "").split("\n").forEach((line) => {
    const match = /^(#{1,6})\s+(.+)$/.exec(line);
    if (match) {
      headings.push({
        level: match[1].length,
        title: match[2].trim(),
        raw: line,
        index: offset,
      });
    }
    offset += line.length + 1;
  });
  return headings;
}

function toggleNoteFind() {
  if (elements.noteFindBar.classList.contains("hidden")) {
    openNoteFind();
  } else {
    closeNoteFind();
  }
}

function openNoteFind() {
  elements.noteFindBar.classList.remove("hidden");
  elements.noteFindInput.focus();
  elements.noteFindInput.select();
  selectNoteFindMatch(0);
}

function closeNoteFind() {
  elements.noteFindBar.classList.add("hidden");
  elements.noteFindInput.value = "";
  elements.noteFindCount.textContent = "0개";
  elements.treeContent.focus();
}

function handleNoteFindInputKey(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    moveNoteFindMatch(event.shiftKey ? -1 : 1);
  }
  if (event.key === "Escape") {
    event.preventDefault();
    closeNoteFind();
  }
}

function noteFindMatches() {
  const query = elements.noteFindInput.value.trim().toLowerCase();
  if (!query) return [];
  const text = elements.treeContent.value.toLowerCase();
  const matches = [];
  let index = text.indexOf(query);
  while (index >= 0) {
    matches.push(index);
    index = text.indexOf(query, index + query.length);
  }
  return matches;
}

function selectNoteFindMatch(index) {
  const query = elements.noteFindInput.value.trim();
  const matches = noteFindMatches();
  if (!query || matches.length === 0) {
    elements.noteFindInput.dataset.index = "0";
    elements.noteFindCount.textContent = query ? "0개" : "0개";
    return;
  }
  const safeIndex = ((index % matches.length) + matches.length) % matches.length;
  const start = matches[safeIndex];
  elements.noteFindInput.dataset.index = String(safeIndex);
  elements.noteFindCount.textContent = `${safeIndex + 1}/${matches.length}`;
  elements.markdownPreview.classList.add("hidden");
  elements.treeContent.classList.remove("hidden");
  elements.previewToggleBtn.textContent = "Markdown 보기";
  elements.treeContent.focus();
  elements.treeContent.setSelectionRange(start, start + query.length);
}

function moveNoteFindMatch(direction) {
  const current = Number(elements.noteFindInput.dataset.index || 0);
  selectNoteFindMatch(current + direction);
}

async function copyNoteLink(node) {
  const link = `[[${node.title || "제목 없음"}]]`;
  const copied = await copyText(link);
  elements.treeSavedLabel.textContent = copied ? "링크 복사됨" : "복사 실패";
  showSaved(elements.treeSavedLabel);
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // file:// 환경에서는 권한 문제로 실패할 수 있어 아래 방식으로 재시도합니다.
  }
  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const ok = document.execCommand("copy");
  input.remove();
  return ok;
}

function treePath(id, nodes = state.data.tree, parents = []) {
  for (const node of nodes) {
    const current = [...parents, node.title || "제목 없음"];
    if (node.id === id) return current;
    const childPath = treePath(id, node.children, current);
    if (childPath.length > 0) return childPath;
  }
  return [];
}

function treePathNodes(id, nodes = state.data.tree, parents = []) {
  for (const node of nodes) {
    const current = [...parents, node];
    if (node.id === id) return current;
    const childPath = treePathNodes(id, node.children, current);
    if (childPath.length > 0) return childPath;
  }
  return [];
}

function renderMarkdownPreview(content) {
  const html = markdownToHtml(content || "");
  elements.markdownPreview.innerHTML = html || '<p class="empty-compact">미리 볼 내용이 없습니다.</p>';
}

function renderLinkPanel() {
  const selected = getSelectedTreeNode();
  if (!selected || !state.settings.showBacklinks) {
    elements.backlinksPanel.replaceChildren();
    return;
  }
  const outgoing = outgoingLinksFor(selected);
  const backlinks = backlinksFor(selected);
  const blocks = [];

  blocks.push(sectionTitle("연결"));
  if (outgoing.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-compact";
    empty.textContent = "본문에 [[메모 제목]]을 적으면 다른 메모와 연결됩니다.";
    blocks.push(empty);
  } else {
    const list = document.createElement("div");
    list.className = "backlink-list";
    list.append(...outgoing.map((link) => linkButton(link.title, link.node, link.exists)));
    blocks.push(list);
  }

  blocks.push(sectionTitle("백링크"));
  if (backlinks.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-compact";
    empty.textContent = "이 메모를 언급한 다른 메모가 없습니다.";
    blocks.push(empty);
    elements.backlinksPanel.replaceChildren(...blocks);
    return;
  }
  const list = document.createElement("div");
  list.className = "backlink-list";
  list.append(
    ...backlinks.map((node) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "backlink-item";
      button.innerHTML = `<strong>${escapeHtml(node.title || "제목 없음")}</strong><span>${escapeHtml(snippet(node.content))}</span>`;
      button.addEventListener("click", () => {
        selectTreeNode(node.id);
      });
      return button;
    }),
  );
  blocks.push(list);
  elements.backlinksPanel.replaceChildren(...blocks);
}

function markdownToHtml(markdown) {
  const lines = escapeHtml(markdown).split("\n");
  const blocks = [];
  let listItems = [];
  let listType = "ul";
  let taskIndex = 0;
  let codeLines = null;

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(`<${listType}>${listItems.map((item) => {
      const isTask = /^\[[ xX]\]\s*/.test(item);
      const html = renderMarkdownListItem(item, isTask ? taskIndex : null);
      if (isTask) taskIndex += 1;
      return html;
    }).join("")}</${listType}>`);
    listItems = [];
    listType = "ul";
  };

  const addListItem = (type, item) => {
    if (listItems.length > 0 && listType !== type) flushList();
    listType = type;
    listItems.push(item);
  };

  const flushCode = () => {
    if (!codeLines) return;
    blocks.push(`<pre><code>${codeLines.join("\n")}</code></pre>`);
    codeLines = null;
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      flushList();
      if (codeLines) {
        flushCode();
      } else {
        codeLines = [];
      }
      return;
    }
    if (codeLines) {
      codeLines.push(line);
      return;
    }
    if (!trimmed) {
      flushList();
      return;
    }
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      flushList();
      blocks.push("<hr>");
      return;
    }
    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushList();
      blocks.push(`<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>`);
      return;
    }
    const quote = trimmed.match(/^>\s*(.+)$/);
    if (quote) {
      flushList();
      blocks.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`);
      return;
    }
    const list = trimmed.match(/^[-*]\s+(.+)$/);
    if (list) {
      addListItem("ul", list[1]);
      return;
    }
    const orderedList = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedList) {
      addListItem("ol", orderedList[1]);
      return;
    }
    flushList();
    blocks.push(`<p>${inlineMarkdown(trimmed)}</p>`);
  });
  flushList();
  flushCode();
  return blocks.join("");
}

function renderMarkdownListItem(item, taskIndex) {
  const task = item.match(/^\[([ xX])\]\s*(.*)$/);
  if (!task) return `<li>${inlineMarkdown(item)}</li>`;
  const checked = task[1].toLowerCase() === "x";
  return `<li class="task-list-item" data-task-index="${taskIndex}"><input type="checkbox"${checked ? " checked" : ""}> <span>${inlineMarkdown(task[2])}</span></li>`;
}

function toggleMarkdownTask(taskIndex) {
  const selected = getSelectedTreeNode();
  if (!selected || Number.isNaN(taskIndex)) return;
  let currentTask = -1;
  const lines = (selected.content || "").split("\n");
  const nextLines = lines.map((line) => {
    const task = line.match(/^(\s*[-*]\s+\[)([ xX])(\]\s*)/);
    if (!task) return line;
    currentTask += 1;
    if (currentTask !== taskIndex) return line;
    const nextMark = task[2].toLowerCase() === "x" ? " " : "x";
    return line.replace(/^(\s*[-*]\s+\[)([ xX])(\]\s*)/, `$1${nextMark}$3`);
  });
  elements.treeContent.value = nextLines.join("\n");
  syncTreeContentFromEditor();
}

function inlineMarkdown(text) {
  const codeSpans = [];
  const protectedText = text.replace(/`([^`]+)`/g, (_, code) => {
    const index = codeSpans.push(code) - 1;
    return `\u0000CODE${index}\u0000`;
  });
  return protectedText
    .replace(/\[\[([^\]]+)\]\]/g, (_, title) => {
      const target = decodeHtml(title.trim());
      return `<button class="wiki-link" type="button" data-wiki-link="${escapeHtml(target)}">${title}</button>`;
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => renderExternalLink(label, url))
    .replace(/(^|\s)#([0-9A-Za-z가-힣_-]+)/g, '$1<span class="tag-inline">#$2</span>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/\u0000CODE(\d+)\u0000/g, (_, index) => `<code>${codeSpans[Number(index)] || ""}</code>`);
}

function renderExternalLink(label, url) {
  const trimmedUrl = decodeHtml(url.trim());
  if (!/^(https?:\/\/|mailto:)/i.test(trimmedUrl)) {
    return `[${label}](${url})`;
  }
  return `<a href="${escapeHtml(trimmedUrl)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

function openWikiLink(title) {
  const normalized = title.trim();
  if (!normalized) return;
  const existing = findTreeNodeByTitle(normalized);
  if (existing) {
    selectTreeNode(existing.id);
    return;
  }
  if (!confirm(`'${normalized}' 메모가 없습니다. 새로 만들까요?`)) return;
  const node = createLinkedNote(normalized);
  selectTreeNode(node.id);
}

function createLinkedNote(title) {
  const selected = getSelectedTreeNode();
  if (!selected) {
    const root = createNode(title, "", null, 1);
    state.data.tree.push(root);
    persist();
    renderTree();
    return root;
  }
  if (selected.level < 3) {
    const child = createNode(title, "", selected.id, selected.level + 1);
    selected.children.push(child);
    state.expandedTreeIds.add(selected.id);
    persist();
    renderTree();
    return child;
  }
  const parent = findTreeNode(state.data.tree, selected.parentId);
  if (parent) {
    const sibling = createNode(title, "", parent.id, selected.level);
    parent.children.push(sibling);
    state.expandedTreeIds.add(parent.id);
    persist();
    renderTree();
    return sibling;
  }
  const root = createNode(title, "", null, 1);
  state.data.tree.push(root);
  persist();
  renderTree();
  return root;
}

function outgoingLinksFor(node) {
  const allNodes = flattenTree(state.data.tree);
  const byTitle = new Map(allNodes.map((item) => [item.title.trim().toLowerCase(), item]));
  return uniqueWikiLinks(node.content).map((title) => {
    const linked = byTitle.get(title.toLowerCase());
    return {
      title,
      node: linked || null,
      exists: Boolean(linked),
    };
  });
}

function linkButton(title, node, exists) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "backlink-item";
  button.classList.toggle("missing-link", !exists);
  button.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${exists ? "메모로 이동" : "아직 없는 메모"}</span>`;
  button.addEventListener("click", () => {
    if (node) {
      selectTreeNode(node.id);
    } else {
      openWikiLink(title);
    }
  });
  return button;
}

function backlinksFor(target) {
  const targetTitle = target.title?.trim().toLowerCase();
  if (!targetTitle) return [];
  return flattenTree(state.data.tree).filter((node) => (
    node.id !== target.id && uniqueWikiLinks(node.content).some((title) => title.toLowerCase() === targetTitle)
  ));
}

function graphLinks() {
  const nodes = flattenTree(state.data.tree);
  const byTitle = new Map(nodes.map((node) => [node.title.trim().toLowerCase(), node]));
  return nodes.flatMap((from) => (
    uniqueWikiLinks(from.content)
      .map((title) => ({ from, to: byTitle.get(title.toLowerCase()) }))
      .filter((link) => link.to && link.to.id !== from.id)
  ));
}

function findTreeNodeByTitle(title) {
  const normalized = title.trim().toLowerCase();
  return flattenTree(state.data.tree).find((node) => node.title.trim().toLowerCase() === normalized) || null;
}

function extractWikiLinks(content) {
  return Array.from(stripMarkdownCode(content).matchAll(/\[\[([^\]]+)\]\]/g), (match) => match[1].trim())
    .filter(Boolean);
}

function uniqueWikiLinks(content) {
  const seen = new Set();
  return extractWikiLinks(content).filter((title) => {
    const key = title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stripMarkdownCode(content) {
  return String(content || "")
    .replace(/```[\s\S]*?(?:```|$)/g, "")
    .replace(/`[^`]*`/g, "");
}

function sectionTitle(title) {
  const heading = document.createElement("h3");
  heading.textContent = title;
  return heading;
}

function renderResults() {
  const query = state.search.toLowerCase();
  if (!query) {
    elements.resultsCount.textContent = "검색어를 입력하세요.";
    elements.resultsList.innerHTML = '<div class="empty-state"><strong>검색어를 입력하세요</strong><span>일자별 메모와 지식 메모를 함께 검색합니다.</span></div>';
    return;
  }

  const results = searchResults(query);
  elements.resultsCount.textContent = `검색 결과 ${results.length}개`;
  renderSearchResultsInto(elements.resultsList, results);
}

function clearSearchResults() {
  state.search = "";
  elements.searchInput.value = "";
  setView("tree");
  render();
}

function searchResults(query, options = {}) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const parsed = parseSearchQuery(normalizedQuery, options.scope || "all");
  const sort = options.sort || "updated-desc";
  const dailyResults = Object.values(state.data.daily)
    .map((note) => ({
      type: "daily",
      id: note.date,
      title: longDateLabel(note.date),
      meta: "일자별 메모",
      preview: note.content,
      content: note.content,
      path: `일자별 메모 / ${longDateLabel(note.date)}`,
      tags: [],
      updatedAt: note.updatedAt || note.date,
      createdAt: note.date,
    }))
    .filter((result) => matchesSearchResult(result, parsed))
    .map((note) => ({
      type: "daily",
      id: note.id,
      title: note.title,
      meta: `${note.meta} · ${formatDateTime(note.updatedAt)}`,
      preview: note.content,
      searchText: parsed.text,
      updatedAt: note.updatedAt,
      createdAt: note.createdAt,
    }));

  const treeResults = flattenTree(state.data.tree)
    .map((node) => ({
      type: "tree",
      id: node.id,
      title: node.title || "제목 없음",
      meta: `${levelName(node.level)} · ${treePath(node.id).join(" / ")}`,
      preview: node.content,
      content: node.content,
      path: treePath(node.id).join(" / "),
      tags: node.tags || [],
      updatedAt: node.updatedAt,
      createdAt: node.createdAt,
    }))
    .filter((result) => matchesSearchResult(result, parsed))
    .map((node) => ({ ...node, searchText: parsed.text }));

  return sortSearchResults([...dailyResults, ...treeResults], sort);
}

function parseSearchQuery(query, fallbackScope) {
  const prefixes = {
    "path:": "path",
    "file:": "title",
    "tag:": "tag",
    "line:": "content",
    "section:": "content",
    "[property]": "all",
  };
  const prefix = Object.keys(prefixes).find((item) => query.startsWith(item));
  if (!prefix) {
    return { scope: fallbackScope, text: query };
  }
  return {
    scope: prefixes[prefix],
    text: query.slice(prefix.length).trim(),
  };
}

function matchesSearchResult(result, parsed) {
  const text = parsed.text;
  if (!text) return true;
  const title = result.title.toLowerCase();
  const content = result.content.toLowerCase();
  const path = result.path.toLowerCase();
  const tags = result.tags.map((tag) => tag.toLowerCase());
  if (parsed.scope === "title") return title.includes(text);
  if (parsed.scope === "content") return content.includes(text);
  if (parsed.scope === "path") return path.includes(text);
  if (parsed.scope === "tag") return tags.some((tag) => tag.includes(text.replace(/^#/, "")));
  return [title, content, path, tags.join(" ")].some((value) => value.includes(text));
}

function sortSearchResults(results, sort) {
  const collator = new Intl.Collator("ko-KR", { numeric: true, sensitivity: "base" });
  const timeValue = (value) => new Date(value || 0).getTime() || 0;
  return [...results].sort((a, b) => {
    if (sort === "title-asc") return collator.compare(a.title, b.title);
    if (sort === "title-desc") return collator.compare(b.title, a.title);
    if (sort === "created-asc") return timeValue(a.createdAt) - timeValue(b.createdAt);
    if (sort === "created-desc") return timeValue(b.createdAt) - timeValue(a.createdAt);
    if (sort === "updated-asc") return timeValue(a.updatedAt) - timeValue(b.updatedAt);
    return timeValue(b.updatedAt) - timeValue(a.updatedAt);
  });
}

function renderSearchResultsInto(container, results, afterSelect) {
  if (results.length === 0) {
    container.innerHTML = '<div class="empty-state"><strong>검색 결과가 없습니다</strong><span>다른 검색어를 입력해보세요.</span></div>';
    return;
  }

  container.replaceChildren(
    ...results.map((result) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "result-item";
      button.innerHTML = [
        `<strong>${highlightSearchText(result.title, result.searchText)}</strong>`,
        `<span>${highlightSearchText(result.meta, result.searchText)}</span>`,
        `<p>${highlightSearchText(snippet(result.preview, result.searchText), result.searchText)}</p>`,
      ].join("");
      button.addEventListener("click", () => {
        if (result.type === "daily") {
          state.selectedDate = result.id;
          const [year, month] = result.id.split("-").map(Number);
          state.visibleMonth = new Date(year, month - 1, 1);
          setView("tree");
          openDailyPopup();
        } else {
          selectTreeNode(result.id);
        }
        if (afterSelect) afterSelect(result);
      });
      button.addEventListener("keydown", (event) => {
        handleResultItemKey(event, button);
      });
      return button;
    }),
  );
}

function handleSearchPopoverInputKey(event) {
  if (event.key !== "Enter" && event.key !== "ArrowDown") return;
  const first = firstSearchResult(elements.searchPopoverResults);
  if (!first) return;
  event.preventDefault();
  if (event.key === "Enter") {
    first.click();
  } else {
    first.focus();
  }
}

function handleMainSearchInputKey(event) {
  if (event.key !== "Enter" && event.key !== "ArrowDown") return;
  const first = firstSearchResult(elements.resultsList);
  if (!first || state.view !== "results") return;
  event.preventDefault();
  if (event.key === "Enter") {
    first.click();
  } else {
    first.focus();
  }
}

function handleResultItemKey(event, button) {
  if (!["Enter", "ArrowDown", "ArrowUp", "Escape"].includes(event.key)) return;
  event.preventDefault();
  const container = button.closest(".quick-results, .results-list");
  const results = Array.from(container?.querySelectorAll(".result-item") || []);
  const index = results.indexOf(button);
  if (event.key === "Enter") {
    button.click();
  } else if (event.key === "ArrowDown") {
    (results[index + 1] || results[0] || button).focus();
  } else if (event.key === "ArrowUp") {
    (results[index - 1] || results.at(-1) || button).focus();
  } else if (!elements.searchPopoverView.classList.contains("hidden")) {
    elements.searchPopoverInput.focus();
  } else {
    elements.searchInput.focus();
  }
}

function firstSearchResult(container) {
  return container.querySelector(".result-item");
}

function createNode(title, content, parentId, level) {
  return {
    id: crypto.randomUUID(),
    title,
    content,
    parentId,
    level,
    children: [],
    status: "active",
    syncState: "pending",
    favorite: false,
    tags: extractTags(content),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function defaultTitleForLevel(level) {
  if (level === 1) return "새 주제";
  if (level === 2) return "새 분류";
  return "새 메모";
}

function levelName(level) {
  if (level === 1) return "주제";
  if (level === 2) return "분류";
  return "메모";
}

function markTreeNodeChanged(node) {
  node.updatedAt = new Date().toISOString();
  node.status = node.status || "active";
  node.syncState = "pending";
}

function getSelectedTreeNode() {
  if (!state.selectedTreeId) return null;
  return findTreeNode(state.data.tree, state.selectedTreeId);
}

function treeSiblingPosition(node) {
  const siblings = node.parentId
    ? findTreeNode(state.data.tree, node.parentId)?.children || []
    : state.data.tree;
  return {
    siblings,
    index: siblings.findIndex((item) => item.id === node.id),
  };
}

function moveSelectedTreeNode(direction) {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  const { siblings, index } = treeSiblingPosition(selected);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= siblings.length) return;
  [siblings[index], siblings[nextIndex]] = [siblings[nextIndex], siblings[index]];
  markTreeNodeChanged(selected);
  persist();
  renderTree();
}

function findTreeNode(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findTreeNode(node.children, id);
    if (child) return child;
  }
  return null;
}

function expandAncestors(id, nodes = state.data.tree, parents = []) {
  for (const node of nodes) {
    if (node.id === id) {
      parents.forEach((parentId) => state.expandedTreeIds.add(parentId));
      return true;
    }
    if (expandAncestors(id, node.children, [...parents, node.id])) {
      return true;
    }
  }
  return false;
}

function archiveDeletedTreeNode(id) {
  const node = detachTreeNode(id);
  if (!node) return false;
  removeTreeTabReferences(id);
  state.data.deletedTree.unshift({
    ...node,
    children: [],
    status: "deleted",
    syncState: "pending",
    deletedAt: new Date().toISOString(),
  });
  return true;
}

function restoreDeletedTreeNode(id) {
  const index = state.data.deletedTree.findIndex((node) => node.id === id);
  if (index < 0) return;
  const [node] = state.data.deletedTree.splice(index, 1);
  const parent = node.parentId ? findTreeNode(state.data.tree, node.parentId) : null;
  const restored = {
    ...node,
    status: "active",
    syncState: "pending",
    deletedAt: undefined,
    updatedAt: new Date().toISOString(),
  };
  if (parent && parent.level < 3) {
    restored.level = parent.level + 1;
    restored.parentId = parent.id;
    parent.children.push(restored);
    state.expandedTreeIds.add(parent.id);
  } else {
    restored.level = 1;
    restored.parentId = null;
    state.data.tree.push(restored);
  }
  state.selectedTreeId = restored.id;
  persist();
  render();
  renderDeletedTreeList();
}

function permanentlyDeleteTreeNode(id) {
  const index = state.data.deletedTree.findIndex((node) => node.id === id);
  if (index < 0) return;
  const node = state.data.deletedTree[index];
  if (!confirm(`'${node.title || "제목 없음"}' 메모를 영구 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) {
    return;
  }
  state.data.deletedTree.splice(index, 1);
  persist();
  renderDeletedTreeList();
  renderDeletedTreeButton();
}

function detachTreeNode(id, nodes = state.data.tree) {
  const index = nodes.findIndex((node) => node.id === id);
  if (index >= 0) {
    const [node] = nodes.splice(index, 1);
    return node;
  }
  for (const node of nodes) {
    const child = detachTreeNode(id, node.children);
    if (child) return child;
  }
  return null;
}

function flattenTree(nodes) {
  return (Array.isArray(nodes) ? nodes : [])
    .filter(isPlainObject)
    .flatMap((node) => [node, ...flattenTree(node.children)]);
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    state.data.daily = parsed.daily || {};
    state.data.archivedDaily = parsed.archivedDaily || [];
    state.data.deletedTree = parsed.deletedTree || [];
    state.data.tree = parsed.tree || [];
    normalizeData();
    persist();
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    state.settings = normalizeSettings(parsed);
    persistSettings();
  } catch {
    localStorage.removeItem(SETTINGS_KEY);
  }
}

function normalizeSettings(settings = {}) {
  const defaults = defaultSettings();
  const normalized = {
    ...defaults,
    ...settings,
  };
  normalized.theme = ["system", "light", "dark"].includes(normalized.theme) ? normalized.theme : defaults.theme;
  normalized.accent = ACCENTS.some((accent) => accent.id === normalized.accent) ? normalized.accent : defaults.accent;
  normalized.fontSize = ["small", "medium", "large"].includes(normalized.fontSize) ? normalized.fontSize : defaults.fontSize;
  normalized.lineHeight = ["compact", "normal", "relaxed"].includes(normalized.lineHeight) ? normalized.lineHeight : defaults.lineHeight;
  normalized.wideEditor = normalizeToggle(normalized.wideEditor, defaults.wideEditor);
  normalized.sidebarCollapsed = normalizeToggle(normalized.sidebarCollapsed, defaults.sidebarCollapsed);
  normalized.showBacklinks = normalizeToggle(normalized.showBacklinks, defaults.showBacklinks);
  normalized.enableShortcuts = normalizeToggle(normalized.enableShortcuts, defaults.enableShortcuts);
  normalized.showTags = normalizeToggle(normalized.showTags, defaults.showTags);
  normalized.showSidebarAssist = normalizeToggle(normalized.showSidebarAssist, defaults.showSidebarAssist);
  normalized.openTreeTabs = normalizeIdList(normalized.openTreeTabs, 100);
  normalized.closedTreeTabs = normalizeIdList(normalized.closedTreeTabs, 10);
  normalized.pinnedTreeTabs = normalizeIdList(normalized.pinnedTreeTabs, 10);
  normalized.openTreeTabs = limitOpenTreeTabs(normalized.openTreeTabs, 10, normalized.pinnedTreeTabs);
  normalized.treeListWidth = Math.min(460, Math.max(180, Number(normalized.treeListWidth) || 280));
  return normalized;
}

function normalizeIdList(value, limit) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((id) => typeof id === "string" && id.trim()))).slice(0, limit);
}

function normalizeToggle(value, fallback) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function persistSettings() {
  writeStorage(SETTINGS_KEY, state.settings);
}

function normalizeData() {
  state.data.daily = state.data.daily && typeof state.data.daily === "object" && !Array.isArray(state.data.daily)
    ? state.data.daily
    : {};
  state.data.archivedDaily = Array.isArray(state.data.archivedDaily) ? state.data.archivedDaily : [];
  state.data.deletedTree = Array.isArray(state.data.deletedTree) ? state.data.deletedTree : [];
  state.data.tree = Array.isArray(state.data.tree) ? state.data.tree : [];

  state.data.daily = normalizeDailyNotes(state.data.daily);
  state.data.archivedDaily = state.data.archivedDaily.filter((note) => isPlainObject(note) && isDateKey(note.date));
  state.data.deletedTree = state.data.deletedTree.filter(isPlainObject);
  state.data.tree = state.data.tree.filter(isPlainObject);

  Object.values(state.data.daily).forEach((note) => {
    note.content = normalizeText(note.content);
    note.status = note.status || "active";
    note.syncState = note.syncState || "synced";
    note.updatedAt = note.updatedAt || new Date().toISOString();
  });
  state.data.archivedDaily.forEach((note) => {
    note.id = note.id || crypto.randomUUID();
    note.content = normalizeText(note.content);
    note.status = note.status || "archived";
    note.syncState = note.syncState || "synced";
    note.archivedAt = note.archivedAt || note.updatedAt || new Date().toISOString();
    note.updatedAt = note.updatedAt || note.archivedAt;
  });
  state.data.deletedTree.forEach((node) => {
    node.id = node.id || crypto.randomUUID();
    node.title = normalizeText(node.title);
    node.content = normalizeText(node.content);
    node.children = [];
    node.status = "deleted";
    node.syncState = node.syncState || "synced";
    node.deletedAt = node.deletedAt || node.updatedAt || new Date().toISOString();
    node.updatedAt = node.updatedAt || node.deletedAt;
    node.tags = Array.isArray(node.tags) ? node.tags : extractTags(node.content);
  });
  normalizeTreeNodes(state.data.tree, null, 1);
}

function normalizeDailyNotes(daily) {
  return Object.entries(daily).reduce((normalized, [dateKey, note]) => {
    const date = isPlainObject(note) && isDateKey(note.date)
      ? note.date
      : dateKey;
    if (!isDateKey(date)) return normalized;
    const entry = isPlainObject(note)
      ? { ...note, date }
      : { date, content: String(note || "") };
    if (normalized[date]) {
      normalized[date] = mergeDailyNote(normalized[date], entry);
    } else {
      normalized[date] = entry;
    }
    return normalized;
  }, {});
}

function mergeDailyNote(current, next) {
  const currentContent = current.content || "";
  const nextContent = next.content || "";
  const content = currentContent.trim() && nextContent.trim()
    ? `${currentContent.trimEnd()}\n\n${nextContent}`
    : currentContent || nextContent;
  return {
    ...current,
    ...next,
    content,
    updatedAt: next.updatedAt || current.updatedAt,
  };
}

function normalizeTreeNodes(nodes, parentId, level) {
  nodes.forEach((node) => {
    node.id = node.id || crypto.randomUUID();
    node.title = normalizeText(node.title);
    node.content = normalizeText(node.content);
    node.parentId = parentId;
    node.level = level;
    node.children = Array.isArray(node.children) ? node.children.filter(isPlainObject) : [];
    node.status = node.status || "active";
    node.syncState = node.syncState || "synced";
    node.favorite = Boolean(node.favorite);
    node.tags = Array.isArray(node.tags) ? node.tags : extractTags(node.content);
    node.createdAt = node.createdAt || new Date().toISOString();
    node.updatedAt = node.updatedAt || node.createdAt;
    if (node.level >= 3 && node.children.length > 0) {
      node.content = mergeOverflowTreeChildren(node.content, node.children);
      node.children = [];
      node.tags = extractTags(node.content);
    }
    normalizeTreeNodes(node.children, node.id, node.level + 1);
  });
}

function mergeOverflowTreeChildren(content, children) {
  const overflow = flattenTree(children)
    .map((child) => [`### ${child.title || "제목 없음"}`, child.content || ""].join("\n").trim())
    .filter(Boolean)
    .join("\n\n");
  return [content || "", overflow].filter((part) => part.trim()).join("\n\n--- 하위 메모 병합 ---\n\n");
}

function persist() {
  writeStorage(STORAGE_KEY, state.data);
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    if (!storageWarningShown) {
      storageWarningShown = true;
      alert("브라우저 저장소에 저장할 수 없습니다. 중요한 내용은 JSON 내보내기로 백업해 주세요.");
    }
    return false;
  }
}

function exportData() {
  downloadCurrentBackup();
}

function exportMarkdown() {
  const markdown = [
    "# NowNote 내보내기",
    "",
    `- 내보낸 날짜: ${new Date().toLocaleString("ko-KR")}`,
    `- 지식 메모: ${flattenTree(state.data.tree).length}개`,
    `- 일자별 메모: ${Object.keys(state.data.daily).length}개`,
    `- 보관 일자별 메모: ${state.data.archivedDaily.length}개`,
    "",
    "## 지식 메모",
    "",
    treeToMarkdown(state.data.tree),
    "",
    "## 일자별 메모",
    "",
    dailyToMarkdown(),
    "",
    "## 보관된 일자별 메모",
    "",
    archivedDailyToMarkdown(),
  ].join("\n");
  downloadText(`nownote-${toDateKey(new Date())}.md`, markdown, "text/markdown");
}

function treeToMarkdown(nodes) {
  if (nodes.length === 0) return "_지식 메모가 없습니다._\n";
  return nodes.map((node) => nodeToMarkdown(node)).join("\n");
}

function nodeToMarkdown(node) {
  const headingLevel = Math.min(node.level + 1, 6);
  const tags = node.tags.length ? `\n\n태그: ${node.tags.map((tag) => `#${tag}`).join(" ")}` : "";
  const favorite = node.favorite ? "\n\n즐겨찾기: 예" : "";
  const meta = [
    `경로: ${treePath(node.id).join(" / ")}`,
    `수정: ${formatDateTime(node.updatedAt)}`,
  ].join("\n");
  const content = node.content?.trim() || "_내용 없음_";
  const children = node.children.map((child) => nodeToMarkdown(child)).join("\n");
  return [
    `${"#".repeat(headingLevel)} [${levelName(node.level)}] ${node.title || "제목 없음"}`,
    "",
    meta,
    tags,
    favorite,
    "",
    content,
    "",
    children,
  ].filter((part) => part !== "").join("\n");
}

function dailyToMarkdown() {
  const entries = Object.values(state.data.daily)
    .filter((note) => note.content?.trim())
    .sort((a, b) => a.date.localeCompare(b.date));
  if (entries.length === 0) return "_일자별 메모가 없습니다._\n";
  return entries.map((note) => [
    `### ${longDateLabel(note.date)}`,
    "",
    note.content.trim(),
    "",
  ].join("\n")).join("\n");
}

function archivedDailyToMarkdown() {
  const entries = state.data.archivedDaily
    .filter((note) => note.content?.trim())
    .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.archivedAt || "").localeCompare(b.archivedAt || ""));
  if (entries.length === 0) return "_보관된 일자별 메모가 없습니다._\n";
  return entries.map((note) => [
    `### ${longDateLabel(note.date)}`,
    "",
    `- 보관 시각: ${formatDateTime(note.archivedAt || note.updatedAt)}`,
    "",
    note.content.trim(),
    "",
  ].join("\n")).join("\n");
}

function downloadText(filename, content, type) {
  let url = null;
  try {
    const blob = new Blob([content], { type });
    url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
  } catch {
    alert("파일을 내보낼 수 없습니다. 브라우저 다운로드 권한이나 저장 공간을 확인해 주세요.");
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const imported = parseBackupData(parsed);
      if (!imported.data) {
        alert("NowNote 백업 JSON 형식이 아닙니다.");
        return;
      }
      const summary = backupSummary(imported.data);
      if (!confirm([
        "JSON 백업을 가져오면 현재 메모와 설정이 백업 내용으로 교체됩니다.",
        "",
        `백업 파일: ${file.name}`,
        `백업 시각: ${imported.exportedAt ? formatBackupTime(imported.exportedAt) : "확인 안 됨"}`,
        `백업 내용: 일자별 메모 ${summary.daily}개, 보관 일자 ${summary.archivedDaily}개, 지식 메모 ${summary.tree}개, 삭제 보관 ${summary.deletedTree}개`,
        "",
        "계속할까요?",
      ].join("\n"))) {
        return;
      }
      downloadCurrentBackup("nownote-before-import");
      state.data = backupDataShape(imported.data);
      if (imported.settings) {
        state.settings = normalizeSettings(imported.settings);
        persistSettings();
        renderSettings();
        applySettings();
      }
      normalizeData();
      state.selectedTreeId = null;
      persist();
      render();
      alert("가져오기가 완료되었습니다.");
    } catch {
      alert("JSON 파일을 읽을 수 없습니다.");
    } finally {
      event.target.value = "";
    }
  };
  reader.onerror = () => {
    alert("JSON 파일을 읽을 수 없습니다. 파일 권한이나 형식을 확인해 주세요.");
    event.target.value = "";
  };
  try {
    reader.readAsText(file);
  } catch {
    alert("JSON 파일을 열 수 없습니다. 파일 권한이나 형식을 확인해 주세요.");
    event.target.value = "";
  }
}

function backupDataShape(data) {
  return {
    daily: data.daily,
    archivedDaily: data.archivedDaily,
    deletedTree: data.deletedTree,
    tree: data.tree,
  };
}

function parseBackupData(parsed) {
  const data = parsed?.data && isBackupData(parsed.data) ? parsed.data : parsed;
  if (!isBackupData(data)) {
    return { data: null, settings: null };
  }
  return {
    data,
    settings: parsed?.settings || null,
    exportedAt: parsed?.exportedAt || null,
  };
}

function isBackupData(data) {
  return Boolean(isPlainObject(data) && (
    isPlainObject(data.daily)
    || Array.isArray(data.tree)
    || Array.isArray(data.archivedDaily)
    || Array.isArray(data.deletedTree)
  ));
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeText(value) {
  return value == null ? "" : String(value);
}

function backupSummary(data) {
  return {
    daily: isPlainObject(data.daily) ? Object.keys(data.daily).length : 0,
    archivedDaily: Array.isArray(data.archivedDaily) ? data.archivedDaily.length : 0,
    tree: Array.isArray(data.tree) ? flattenTree(data.tree).length : 0,
    deletedTree: Array.isArray(data.deletedTree) ? data.deletedTree.length : 0,
  };
}

function formatBackupTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "확인 안 됨";
  return `${date.toLocaleDateString("ko-KR")} ${date.toLocaleTimeString("ko-KR")}`;
}

function downloadCurrentBackup(prefix = "nownote") {
  const backup = {
    app: "NowNote Web",
    version: 2,
    exportedAt: new Date().toISOString(),
    data: state.data,
    settings: state.settings,
  };
  downloadText(`${prefix}-${toDateKey(new Date())}.json`, JSON.stringify(backup, null, 2), "application/json");
}

function showSaved(label) {
  label.textContent = "저장됨";
  label.animate(
    [
      { opacity: 0.35 },
      { opacity: 1 },
    ],
    { duration: 280 },
  );
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && toDateKey(date) === value;
}

function monthLabel(date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function longDateLabel(key) {
  const date = new Date(`${key}T00:00:00`);
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

function timeLabel(date) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatArchivedAt(value) {
  if (!value) return "날짜 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "날짜 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function relativeTime(value) {
  if (!value) return "날짜 없음";
  const diffMs = Date.now() - new Date(value).getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return "방금 전";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}분 전`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}시간 전`;
  if (diffMs < day * 7) return `${Math.floor(diffMs / day)}일 전`;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function snippet(text, query = "") {
  const normalized = (text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "내용 없음";
  const term = String(query || "").trim().toLowerCase();
  if (term) {
    const index = normalized.toLowerCase().indexOf(term);
    if (index >= 0) {
      const start = Math.max(0, index - 45);
      const end = Math.min(normalized.length, index + term.length + 75);
      const prefix = start > 0 ? "..." : "";
      const suffix = end < normalized.length ? "..." : "";
      return `${prefix}${normalized.slice(start, end)}${suffix}`;
    }
  }
  return normalized.length > 120 ? `${normalized.slice(0, 120)}...` : normalized;
}

function extractTags(text) {
  return Array.from(stripMarkdownCode(text).matchAll(/(^|\s)#([0-9A-Za-z가-힣_-]+)/g), (match) => match[2])
    .filter(Boolean)
    .filter((tag, index, tags) => tags.indexOf(tag) === index);
}

function tagSummary() {
  const counts = new Map();
  flattenTree(state.data.tree).forEach((node) => {
    node.tags.forEach((tag) => {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    });
  });
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ko"));
}

function searchableTreeText(node) {
  return `${node.title} ${node.content} ${treePath(node.id).join(" ")} ${node.tags.join(" ")}`.toLowerCase();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function decodeHtml(value) {
  return String(value)
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&amp;", "&");
}

function highlightSearchText(value, query) {
  const text = String(value || "");
  const term = String(query || "").trim();
  if (!term) return escapeHtml(text);
  const pattern = new RegExp(escapeRegExp(term), "gi");
  let lastIndex = 0;
  let highlighted = "";
  text.replace(pattern, (match, offset) => {
    highlighted += escapeHtml(text.slice(lastIndex, offset));
    highlighted += `<mark class="search-hit">${escapeHtml(match)}</mark>`;
    lastIndex = offset + match.length;
    return match;
  });
  if (!highlighted) return escapeHtml(text);
  return highlighted + escapeHtml(text.slice(lastIndex));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
