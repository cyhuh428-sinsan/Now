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
  settings: {
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
  },
};

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
  addChildBtn: $("#addChildBtn"),
  deleteTreeBtn: $("#deleteTreeBtn"),
  deletedTreeBtn: $("#deletedTreeBtn"),
  deletedTreeView: $("#deletedTreeView"),
  deletedTreeList: $("#deletedTreeList"),
  deletedTreeCloseBtn: $("#deletedTreeCloseBtn"),
  resultsList: $("#resultsList"),
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
  treeResizeHandle: $("#treeResizeHandle"),
  backlinksPanel: $("#backlinksPanel"),
  quickSwitchView: $("#quickSwitchView"),
  quickInput: $("#quickInput"),
  quickResults: $("#quickResults"),
  quickCloseBtn: $("#quickCloseBtn"),
  searchPopoverView: $("#searchPopoverView"),
  searchPopoverInput: $("#searchPopoverInput"),
  searchScopeSelect: $("#searchScopeSelect"),
  searchSortSelect: $("#searchSortSelect"),
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
    renderTreePath(selected);
    renderNoteStats(selected);
    showSaved(elements.treeSavedLabel);
  });

  elements.treeContent.addEventListener("input", () => {
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
  });

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
  elements.noteFindPrevBtn.addEventListener("click", () => moveNoteFindMatch(-1));
  elements.noteFindNextBtn.addEventListener("click", () => moveNoteFindMatch(1));
  elements.noteFindCloseBtn.addEventListener("click", closeNoteFind);
  elements.outlineToggleBtn.addEventListener("click", toggleOutlinePanel);
  elements.reopenClosedTabBtn.addEventListener("click", reopenClosedTreeTab);
  elements.closeOtherTabsBtn.addEventListener("click", closeOtherTreeTabs);
  elements.closeAllTabsBtn.addEventListener("click", closeAllTreeTabs);

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

  elements.addChildBtn.addEventListener("click", () => {
    const selected = getSelectedTreeNode();
    if (!selected) return;
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
  });

  elements.deleteTreeBtn.addEventListener("click", () => {
    const selected = getSelectedTreeNode();
    if (!selected) return;
    if (selected.children.length > 0) {
      alert("아래에 연결된 항목이 있으면 삭제할 수 없습니다.");
      return;
    }
    if (!confirm(`'${selected.title || "제목 없음"}' 메모를 삭제 보관함으로 이동할까요?`)) return;
    archiveDeletedTreeNode(selected.id);
    state.selectedTreeId = null;
    persist();
    renderTree();
  });

  elements.deletedTreeBtn.addEventListener("click", toggleDeletedTreeBox);
  elements.deletedTreeCloseBtn.addEventListener("click", closeDeletedTreeBox);
  elements.exportBtn.addEventListener("click", exportData);
  elements.exportMarkdownBtn.addEventListener("click", exportMarkdown);
  elements.importInput.addEventListener("change", importData);
  elements.searchPopoverInput.addEventListener("input", renderSearchPopoverResults);
  elements.searchScopeSelect.addEventListener("change", renderSearchPopoverResults);
  elements.searchSortSelect.addEventListener("change", renderSearchPopoverResults);
  elements.searchPopoverCloseBtn.addEventListener("click", closeSearchPopover);
  elements.quickInput.addEventListener("input", renderQuickResults);
  elements.quickCloseBtn.addEventListener("click", closeQuickSwitch);
  elements.graphCloseBtn.addEventListener("click", closeGraph);
  elements.markdownPreview.addEventListener("click", (event) => {
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
    elements.searchPopoverResults.innerHTML = '<div class="empty-compact">검색어를 입력하세요.</div>';
    return;
  }
  const results = searchResults(query, {
    scope: elements.searchScopeSelect.value,
    sort: elements.searchSortSelect.value,
  });
  renderSearchResultsInto(elements.searchPopoverResults, results, () => closeSearchPopover());
}

function renderQuickResults() {
  const query = elements.quickInput.value.trim().toLowerCase();
  const nodes = flattenTree(state.data.tree)
    .filter((node) => !query || searchableTreeText(node).includes(query))
    .slice(0, 30);
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
        selectTreeNode(node.id);
        closeQuickSwitch();
      });
      return button;
    }),
  );
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
  if (key === "w") {
    event.preventDefault();
    if (event.shiftKey) {
      closeOtherTreeTabs();
    } else {
      closeOpenTreeTab(state.selectedTreeId);
    }
  }
  if (key === "t" && event.shiftKey) {
    event.preventDefault();
    reopenClosedTreeTab();
  }
  if (key === ",") {
    event.preventDefault();
    toggleSettings();
  }
  if (key === "n") {
    event.preventDefault();
    addRootNote();
  }
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
        </div>
      `;
      item.querySelector('[data-action="restore"]').addEventListener("click", () => {
        restoreDeletedTreeNode(node.id);
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
        elements.searchInput.value = `#${tag.name}`;
        state.search = `#${tag.name}`;
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
}

function renderTreePath(node) {
  elements.treePathLabel.textContent = treePath(node.id).join(" / ");
}

function addOpenTreeTab(id) {
  if (!id) return;
  if (!state.settings.openTreeTabs.includes(id)) {
    state.settings.openTreeTabs = [...state.settings.openTreeTabs, id].slice(-10);
  }
  persistSettings();
}

function renderOpenTreeTabs() {
  const tabs = state.settings.openTreeTabs
    .map((id) => findTreeNode(state.data.tree, id))
    .filter(Boolean);
  state.settings.openTreeTabs = tabs.map((node) => node.id);
  elements.openTabsBar.classList.toggle("hidden", tabs.length === 0);
  if (tabs.length === 0) {
    elements.openTabs.replaceChildren();
    persistSettings();
    return;
  }
  elements.openTabs.replaceChildren(
    ...tabs.map((node) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "open-tab";
      tab.classList.toggle("active", node.id === state.selectedTreeId);
      tab.innerHTML = `<span>${escapeHtml(node.title || "제목 없음")}</span><strong aria-label="닫기">×</strong>`;
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
  elements.reopenClosedTabBtn.disabled = !state.settings.closedTreeTabs.some((id) => findTreeNode(state.data.tree, id));
  persistSettings();
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

function closeOtherTreeTabs() {
  if (!state.selectedTreeId) return;
  rememberClosedTreeTabs(state.settings.openTreeTabs.filter((tabId) => tabId !== state.selectedTreeId));
  state.settings.openTreeTabs = state.settings.openTreeTabs.includes(state.selectedTreeId)
    ? [state.selectedTreeId]
    : [];
  persistSettings();
  renderTree();
}

function closeAllTreeTabs() {
  rememberClosedTreeTabs(state.settings.openTreeTabs);
  state.settings.openTreeTabs = [];
  state.selectedTreeId = null;
  persistSettings();
  renderTree();
}

function closeOpenTreeTab(id) {
  if (!id) return;
  const tabs = state.settings.openTreeTabs.filter((tabId) => tabId !== id);
  const wasSelected = state.selectedTreeId === id;
  rememberClosedTreeTabs([id]);
  state.settings.openTreeTabs = tabs;
  if (wasSelected) {
    state.selectedTreeId = tabs.find((tabId) => findTreeNode(state.data.tree, tabId)) || null;
  }
  persistSettings();
  renderTree();
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
        elements.searchInput.value = `#${tag}`;
        state.search = `#${tag}`;
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

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(`<ul>${listItems.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
    listItems = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }
    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushList();
      blocks.push(`<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>`);
      return;
    }
    const list = trimmed.match(/^[-*]\s+(.+)$/);
    if (list) {
      listItems.push(list[1]);
      return;
    }
    flushList();
    blocks.push(`<p>${inlineMarkdown(trimmed)}</p>`);
  });
  flushList();
  return blocks.join("");
}

function inlineMarkdown(text) {
  return text
    .replace(/\[\[([^\]]+)\]\]/g, (_, title) => `<button class="wiki-link" type="button" data-wiki-link="${escapeHtml(title.trim())}">${title}</button>`)
    .replace(/(^|\s)#([0-9A-Za-z가-힣_-]+)/g, '$1<span class="tag-inline">#$2</span>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
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
  return extractWikiLinks(node.content).map((title) => {
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
  const token = `[[${target.title}]]`.toLowerCase();
  if (!target.title?.trim()) return [];
  return flattenTree(state.data.tree).filter((node) => (
    node.id !== target.id && node.content.toLowerCase().includes(token)
  ));
}

function graphLinks() {
  const nodes = flattenTree(state.data.tree);
  const byTitle = new Map(nodes.map((node) => [node.title.trim().toLowerCase(), node]));
  return nodes.flatMap((from) => (
    extractWikiLinks(from.content)
      .map((title) => ({ from, to: byTitle.get(title.toLowerCase()) }))
      .filter((link) => link.to && link.to.id !== from.id)
  ));
}

function findTreeNodeByTitle(title) {
  const normalized = title.trim().toLowerCase();
  return flattenTree(state.data.tree).find((node) => node.title.trim().toLowerCase() === normalized) || null;
}

function extractWikiLinks(content) {
  return Array.from(content.matchAll(/\[\[([^\]]+)\]\]/g), (match) => match[1].trim())
    .filter(Boolean);
}

function sectionTitle(title) {
  const heading = document.createElement("h3");
  heading.textContent = title;
  return heading;
}

function renderResults() {
  const query = state.search.toLowerCase();
  if (!query) {
    elements.resultsList.innerHTML = '<div class="empty-state"><strong>검색어를 입력하세요</strong><span>일자별 메모와 지식 메모를 함께 검색합니다.</span></div>';
    return;
  }

  renderSearchResultsInto(elements.resultsList, searchResults(query));
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
    .filter((result) => matchesSearchResult(result, parsed));

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
      button.innerHTML = `<strong>${escapeHtml(result.title)}</strong><span>${escapeHtml(result.meta)}</span><p>${escapeHtml(snippet(result.preview))}</p>`;
      button.addEventListener("click", () => {
        if (result.type === "daily") {
          state.selectedDate = result.id;
          const [year, month] = result.id.split("-").map(Number);
          state.visibleMonth = new Date(year, month - 1, 1);
          setView("tree");
          openDailyPopup();
        } else {
          state.selectedTreeId = result.id;
          expandAncestors(result.id);
          setView("tree");
        }
        if (afterSelect) afterSelect(result);
      });
      return button;
    }),
  );
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
  return nodes.flatMap((node) => [node, ...flattenTree(node.children)]);
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
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    state.settings = {
      ...state.settings,
      ...parsed,
    };
    if (!Array.isArray(state.settings.openTreeTabs)) {
      state.settings.openTreeTabs = [];
    }
    if (!Array.isArray(state.settings.closedTreeTabs)) {
      state.settings.closedTreeTabs = [];
    }
  } catch {
    localStorage.removeItem(SETTINGS_KEY);
  }
}

function persistSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function normalizeData() {
  Object.values(state.data.daily).forEach((note) => {
    note.status = note.status || "active";
    note.syncState = note.syncState || "synced";
    note.updatedAt = note.updatedAt || new Date().toISOString();
  });
  state.data.archivedDaily.forEach((note) => {
    note.id = note.id || crypto.randomUUID();
    note.status = note.status || "archived";
    note.syncState = note.syncState || "synced";
    note.archivedAt = note.archivedAt || note.updatedAt || new Date().toISOString();
    note.updatedAt = note.updatedAt || note.archivedAt;
  });
  state.data.deletedTree = state.data.deletedTree || [];
  state.data.deletedTree.forEach((node) => {
    node.id = node.id || crypto.randomUUID();
    node.title = node.title || "";
    node.content = node.content || "";
    node.children = [];
    node.status = "deleted";
    node.syncState = node.syncState || "synced";
    node.deletedAt = node.deletedAt || node.updatedAt || new Date().toISOString();
    node.updatedAt = node.updatedAt || node.deletedAt;
    node.tags = Array.isArray(node.tags) ? node.tags : extractTags(node.content);
  });
  normalizeTreeNodes(state.data.tree, null, 1);
}

function normalizeTreeNodes(nodes, parentId, level) {
  nodes.forEach((node) => {
    node.id = node.id || crypto.randomUUID();
    node.title = node.title || "";
    node.content = node.content || "";
    node.parentId = node.parentId ?? parentId;
    node.level = node.level || level;
    node.children = node.children || [];
    node.status = node.status || "active";
    node.syncState = node.syncState || "synced";
    node.favorite = Boolean(node.favorite);
    node.tags = Array.isArray(node.tags) ? node.tags : extractTags(node.content);
    node.createdAt = node.createdAt || new Date().toISOString();
    node.updatedAt = node.updatedAt || node.createdAt;
    normalizeTreeNodes(node.children, node.id, node.level + 1);
  });
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function exportData() {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `nownote-${toDateKey(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function exportMarkdown() {
  const markdown = [
    "# NowNote 내보내기",
    "",
    `- 내보낸 날짜: ${new Date().toLocaleString("ko-KR")}`,
    `- 지식 메모: ${flattenTree(state.data.tree).length}개`,
    `- 일자별 메모: ${Object.keys(state.data.daily).length}개`,
    "",
    "## 지식 메모",
    "",
    treeToMarkdown(state.data.tree),
    "",
    "## 일자별 메모",
    "",
    dailyToMarkdown(),
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
    `${"#".repeat(headingLevel)} ${node.title || "제목 없음"}`,
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

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!parsed.daily || !Array.isArray(parsed.tree)) {
        alert("NowNote 백업 JSON 형식이 아닙니다.");
        return;
      }
      parsed.archivedDaily = parsed.archivedDaily || [];
      parsed.deletedTree = parsed.deletedTree || [];
      state.data = parsed;
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
  reader.readAsText(file);
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

function snippet(text) {
  const normalized = (text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "내용 없음";
  return normalized.length > 120 ? `${normalized.slice(0, 120)}...` : normalized;
}

function extractTags(text) {
  return Array.from(String(text || "").matchAll(/(^|\s)#([0-9A-Za-z가-힣_-]+)/g), (match) => match[2])
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
