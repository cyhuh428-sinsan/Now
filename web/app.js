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
    tree: [],
  },
  settings: {
    theme: "system",
    accent: "blue",
    wideEditor: true,
    treeListWidth: 280,
    sidebarCollapsed: false,
  },
};

const $ = (selector) => document.querySelector(selector);

const elements = {
  searchInput: $("#searchInput"),
  navTabs: document.querySelectorAll(".nav-tab"),
  dailyToggleBtn: $("#dailyToggleBtn"),
  dailyCloseBtn: $("#dailyCloseBtn"),
  todayMemoState: $("#todayMemoState"),
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
  addRootBtn: $("#addRootBtn"),
  emptyAddRootBtn: $("#emptyAddRootBtn"),
  treeList: $("#treeList"),
  emptyTreeEditor: $("#emptyTreeEditor"),
  treeEditor: $("#treeEditor"),
  treeTitleInput: $("#treeTitleInput"),
  treeContent: $("#treeContent"),
  treePathLabel: $("#treePathLabel"),
  treeLevelLabel: $("#treeLevelLabel"),
  treeSavedLabel: $("#treeSavedLabel"),
  previewToggleBtn: $("#previewToggleBtn"),
  markdownPreview: $("#markdownPreview"),
  addChildBtn: $("#addChildBtn"),
  deleteTreeBtn: $("#deleteTreeBtn"),
  resultsList: $("#resultsList"),
  exportBtn: $("#exportBtn"),
  importInput: $("#importInput"),
  settingsBtn: $("#settingsBtn"),
  railSidebarBtn: $("#railSidebarBtn"),
  railDailyBtn: $("#railDailyBtn"),
  railSearchBtn: $("#railSearchBtn"),
  railSettingsBtn: $("#railSettingsBtn"),
  settingsCloseBtn: $("#settingsCloseBtn"),
  settingsView: $("#settingsView"),
  themeSelect: $("#themeSelect"),
  accentChoices: $("#accentChoices"),
  wideEditorToggle: $("#wideEditorToggle"),
  treeResizeHandle: $("#treeResizeHandle"),
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
    openDailyPopup();
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
    if (state.settings.sidebarCollapsed) {
      state.settings.sidebarCollapsed = false;
      persistSettings();
      applySettings();
    }
    elements.searchInput.focus();
  });

  elements.settingsBtn.addEventListener("click", () => {
    openSettings();
  });

  elements.railSettingsBtn.addEventListener("click", () => {
    openSettings();
  });

  elements.railDailyBtn.addEventListener("click", () => {
    openDailyPopup();
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

  elements.addRootBtn.addEventListener("click", () => {
    addRootNote();
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
    showSaved(elements.treeSavedLabel);
  });

  elements.treeContent.addEventListener("input", () => {
    const selected = getSelectedTreeNode();
    if (!selected) return;
    selected.content = elements.treeContent.value;
    markTreeNodeChanged(selected);
    persist();
    renderMarkdownPreview(selected.content);
    showSaved(elements.treeSavedLabel);
  });

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
    if (!confirm(`'${selected.title || "제목 없음"}' 메모를 삭제할까요?`)) return;
    deleteTreeNode(selected.id);
    state.selectedTreeId = null;
    persist();
    renderTree();
  });

  elements.exportBtn.addEventListener("click", exportData);
  elements.importInput.addEventListener("change", importData);
  bindTreeResize();

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (state.settings.theme === "system") applySettings();
  });
}

function openSettings() {
  elements.settingsView.classList.remove("hidden");
}

function renderSettings() {
  elements.themeSelect.value = state.settings.theme;
  elements.wideEditorToggle.checked = state.settings.wideEditor;
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
  document.documentElement.style.setProperty("--blue", accent.value);
  document.documentElement.style.setProperty("--tree-list-width", `${state.settings.treeListWidth}px`);
  elements.railSidebarBtn.title = state.settings.sidebarCollapsed ? "목록 펼치기" : "목록 접기";
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

  labelButton.innerHTML = `<div class="tree-title">${escapeHtml(node.title || "제목 없음")}</div><div class="tree-meta">${escapeHtml(levelName(node.level))} · 아래 ${node.children.length}개</div>`;

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

function renderTreeEditor() {
  const selected = getSelectedTreeNode();
  elements.emptyTreeEditor.classList.toggle("hidden", Boolean(selected));
  elements.treeEditor.classList.toggle("hidden", !selected);
  if (!selected) return;

  elements.treeLevelLabel.textContent = levelName(selected.level);
  elements.treeTitleInput.value = selected.title;
  elements.treeContent.value = selected.content;
  elements.markdownPreview.classList.add("hidden");
  elements.treeContent.classList.remove("hidden");
  elements.previewToggleBtn.textContent = "Markdown 보기";
  renderTreePath(selected);
  renderMarkdownPreview(selected.content);
  elements.addChildBtn.disabled = selected.level >= 3;
}

function renderTreePath(node) {
  elements.treePathLabel.textContent = treePath(node.id).join(" / ");
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
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function renderResults() {
  const query = state.search.toLowerCase();
  if (!query) {
    elements.resultsList.innerHTML = '<div class="empty-state"><strong>검색어를 입력하세요</strong><span>일자별 메모와 지식 메모를 함께 검색합니다.</span></div>';
    return;
  }

  const dailyResults = Object.values(state.data.daily)
    .filter((note) => note.content.toLowerCase().includes(query))
    .map((note) => ({
      type: "daily",
      id: note.date,
      title: longDateLabel(note.date),
      meta: "일자별 메모",
      preview: note.content,
    }));

  const treeResults = flattenTree(state.data.tree)
    .filter((node) => `${node.title} ${node.content}`.toLowerCase().includes(query))
    .map((node) => ({
      type: "tree",
      id: node.id,
      title: node.title || "제목 없음",
      meta: levelName(node.level),
      preview: node.content,
    }));

  const results = [...dailyResults, ...treeResults];
  if (results.length === 0) {
    elements.resultsList.innerHTML = '<div class="empty-state"><strong>검색 결과가 없습니다</strong><span>다른 검색어를 입력해보세요.</span></div>';
    return;
  }

  elements.resultsList.replaceChildren(
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

function deleteTreeNode(id, nodes = state.data.tree) {
  const index = nodes.findIndex((node) => node.id === id);
  if (index >= 0) {
    nodes.splice(index, 1);
    return true;
  }
  return nodes.some((node) => deleteTreeNode(id, node.children));
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

function snippet(text) {
  const normalized = (text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "내용 없음";
  return normalized.length > 120 ? `${normalized.slice(0, 120)}...` : normalized;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
