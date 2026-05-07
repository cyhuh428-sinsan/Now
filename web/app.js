const STORAGE_KEY = "nownote.web.v1";

const state = {
  view: "tree",
  selectedDate: toDateKey(new Date()),
  visibleMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedTreeId: null,
  search: "",
  data: {
    daily: {},
    tree: [],
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
  prevMonthBtn: $("#prevMonthBtn"),
  nextMonthBtn: $("#nextMonthBtn"),
  addRootBtn: $("#addRootBtn"),
  treeList: $("#treeList"),
  emptyTreeEditor: $("#emptyTreeEditor"),
  treeEditor: $("#treeEditor"),
  treeTitleInput: $("#treeTitleInput"),
  treeContent: $("#treeContent"),
  treeLevelLabel: $("#treeLevelLabel"),
  treeSavedLabel: $("#treeSavedLabel"),
  addChildBtn: $("#addChildBtn"),
  deleteTreeBtn: $("#deleteTreeBtn"),
  resultsList: $("#resultsList"),
  exportBtn: $("#exportBtn"),
  importInput: $("#importInput"),
};

load();
bindEvents();
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

  elements.dailyContent.addEventListener("input", () => {
    saveDailyFromEditor();
  });

  elements.addRootBtn.addEventListener("click", () => {
    const node = createNode("새 부모 메모", "", null, 1);
    state.data.tree.push(node);
    state.selectedTreeId = node.id;
    persist();
    renderTree();
  });

  elements.treeTitleInput.addEventListener("input", () => {
    const selected = getSelectedTreeNode();
    if (!selected) return;
    selected.title = elements.treeTitleInput.value;
    selected.updatedAt = new Date().toISOString();
    persist();
    renderTreeListOnly();
    showSaved(elements.treeSavedLabel);
  });

  elements.treeContent.addEventListener("input", () => {
    const selected = getSelectedTreeNode();
    if (!selected) return;
    selected.content = elements.treeContent.value;
    selected.updatedAt = new Date().toISOString();
    persist();
    showSaved(elements.treeSavedLabel);
  });

  elements.addChildBtn.addEventListener("click", () => {
    const selected = getSelectedTreeNode();
    if (!selected) return;
    if (selected.level >= 3) {
      alert("계층 메모는 3단계까지만 만들 수 있습니다.");
      return;
    }
    const node = createNode("새 하위 메모", "", selected.id, selected.level + 1);
    selected.children.push(node);
    state.selectedTreeId = node.id;
    persist();
    renderTree();
  });

  elements.deleteTreeBtn.addEventListener("click", () => {
    const selected = getSelectedTreeNode();
    if (!selected) return;
    if (selected.children.length > 0) {
      alert("하위 메모가 있는 메모는 삭제할 수 없습니다.");
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
      updatedAt: new Date().toISOString(),
    };
  }
  persist();
  renderCalendar();
  showSaved(elements.dailySavedLabel);
}

function renderTree() {
  renderTreeListOnly();
  renderTreeEditor();
}

function renderTreeListOnly() {
  if (state.data.tree.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = "<strong>계층 메모가 없습니다</strong><span>부모 메모를 먼저 추가하세요.</span>";
    elements.treeList.replaceChildren(empty);
    return;
  }
  elements.treeList.replaceChildren(...state.data.tree.map((node) => treeNodeElement(node)));
}

function treeNodeElement(node) {
  const wrapper = document.createElement("div");
  wrapper.className = "tree-node";

  const row = document.createElement("button");
  row.type = "button";
  row.className = "tree-row";
  row.classList.toggle("active", node.id === state.selectedTreeId);
  row.addEventListener("click", () => {
    state.selectedTreeId = node.id;
    renderTree();
  });

  const label = document.createElement("div");
  label.innerHTML = `<div class="tree-title">${escapeHtml(node.title || "제목 없음")}</div><div class="tree-meta">${node.level}단계 · 하위 ${node.children.length}개</div>`;

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "small-btn";
  addButton.textContent = "+";
  addButton.title = "하위 메모 추가";
  addButton.disabled = node.level >= 3;
  addButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (node.level >= 3) return;
    const child = createNode("새 하위 메모", "", node.id, node.level + 1);
    node.children.push(child);
    state.selectedTreeId = child.id;
    persist();
    renderTree();
  });

  const openMark = document.createElement("span");
  openMark.className = "tree-meta";
  openMark.textContent = node.children.length ? "열림" : "";

  row.append(label, addButton, openMark);
  wrapper.append(row);

  if (node.children.length > 0) {
    const children = document.createElement("div");
    children.className = "tree-children";
    children.append(...node.children.map((child) => treeNodeElement(child)));
    wrapper.append(children);
  }

  return wrapper;
}

function renderTreeEditor() {
  const selected = getSelectedTreeNode();
  elements.emptyTreeEditor.classList.toggle("hidden", Boolean(selected));
  elements.treeEditor.classList.toggle("hidden", !selected);
  if (!selected) return;

  elements.treeLevelLabel.textContent = `${selected.level}단계 계층 메모`;
  elements.treeTitleInput.value = selected.title;
  elements.treeContent.value = selected.content;
  elements.addChildBtn.disabled = selected.level >= 3;
}

function renderResults() {
  const query = state.search.toLowerCase();
  if (!query) {
    elements.resultsList.innerHTML = '<div class="empty-state"><strong>검색어를 입력하세요</strong><span>일자별 메모와 계층 메모를 함께 검색합니다.</span></div>';
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
      meta: `${node.level}단계 계층 메모`,
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
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
    state.data.tree = parsed.tree || [];
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
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
      state.data = parsed;
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
