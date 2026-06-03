const STORAGE_KEY = "nownote.desktop.v1";
const LEGACY_WEB_STORAGE_KEY = "nownote.web.v1";
const SETTINGS_KEY = "nownote.desktop.settings.v1";
const MAX_LEVEL = 3;

const $ = (selector) => document.querySelector(selector);

const elements = {
  searchInput: $("#searchInput"),
  addRootBtn: $("#addRootBtn"),
  addChildBtn: $("#addChildBtn"),
  deleteTreeBtn: $("#deleteTreeBtn"),
  exportMarkdownBtn: $("#exportMarkdownBtn"),
  importMarkdownInput: $("#importMarkdownInput"),
  saveNowBtn: $("#saveNowBtn"),
  storageStatus: $("#storageStatus"),
  openTabs: $("#openTabs"),
  reopenClosedTabBtn: $("#reopenClosedTabBtn"),
  closeOtherTabsBtn: $("#closeOtherTabsBtn"),
  closeAllTabsBtn: $("#closeAllTabsBtn"),
  treeCount: $("#treeCount"),
  treeList: $("#treeList"),
  treeEditor: $("#treeEditor"),
  emptyTreeEditor: $("#emptyTreeEditor"),
  treeTitleInput: $("#treeTitleInput"),
  favoriteBtn: $("#favoriteBtn"),
  copyLinkBtn: $("#copyLinkBtn"),
  previewToggleBtn: $("#previewToggleBtn"),
  treePathLabel: $("#treePathLabel"),
  noteStats: $("#noteStats"),
  treeContent: $("#treeContent"),
  markdownPreview: $("#markdownPreview"),
  treeSavedLabel: $("#treeSavedLabel"),
  toastRegion: $("#toastRegion"),
};

const state = {
  data: defaultData(),
  settings: defaultSettings(),
  selectedTreeId: null,
  expandedTreeIds: new Set(),
  search: "",
  preview: false,
  saveTimer: null,
};

function defaultData() {
  return {
    tree: [],
    deletedTree: [],
    updatedAt: null,
  };
}

function defaultSettings() {
  return {
    openTreeTabs: [],
    closedTreeTabs: [],
  };
}

async function initialize() {
  await loadState();
  bindEvents();
  if (!state.selectedTreeId) {
    state.selectedTreeId = firstTreeNodeId(state.data.tree);
  }
  render();
  updateStorageStatus();
}

async function loadState() {
  let storedData = await readDesktopValue(STORAGE_KEY);
  const legacyData = storedData ? null : await readDesktopValue(LEGACY_WEB_STORAGE_KEY);
  const storedSettings = await readDesktopValue(SETTINGS_KEY);
  state.data = normalizeData(storedData || legacyData || defaultData());
  state.settings = normalizeSettings(storedSettings || defaultSettings());
  if (!storedData && legacyData) {
    await writeDesktopValue(STORAGE_KEY, state.data);
  }
}

function bindEvents() {
  elements.searchInput.addEventListener("input", () => {
    state.search = elements.searchInput.value.trim();
    renderTreeListOnly();
  });
  elements.addRootBtn.addEventListener("click", addRootNote);
  elements.addChildBtn.addEventListener("click", addChildToSelectedTreeNode);
  elements.deleteTreeBtn.addEventListener("click", deleteSelectedTreeNode);
  elements.saveNowBtn.addEventListener("click", () => persistNow("저장했습니다."));
  elements.exportMarkdownBtn.addEventListener("click", exportMarkdown);
  elements.importMarkdownInput.addEventListener("change", importMarkdown);
  elements.reopenClosedTabBtn.addEventListener("click", reopenClosedTab);
  elements.closeOtherTabsBtn.addEventListener("click", closeOtherTabs);
  elements.closeAllTabsBtn.addEventListener("click", closeAllTabs);
  elements.treeTitleInput.addEventListener("input", updateSelectedTitle);
  elements.treeContent.addEventListener("input", updateSelectedContent);
  elements.favoriteBtn.addEventListener("click", toggleFavorite);
  elements.copyLinkBtn.addEventListener("click", copySelectedLink);
  elements.previewToggleBtn.addEventListener("click", togglePreview);
}

async function readDesktopValue(key) {
  if (window.nownoteDesktop?.storage) {
    return await window.nownoteDesktop.storage.read(key);
  }
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

async function writeDesktopValue(key, value) {
  if (window.nownoteDesktop?.storage) {
    await window.nownoteDesktop.storage.write(key, value);
    return;
  }
  localStorage.setItem(key, JSON.stringify(value));
}

async function updateStorageStatus() {
  if (window.nownoteDesktop?.storage) {
    const info = await window.nownoteDesktop.storage.info();
    elements.storageStatus.textContent = info.path || "PC 로컬 저장소";
    return;
  }
  elements.storageStatus.textContent = "브라우저 대체 저장소";
}

function normalizeData(data) {
  const normalized = data && typeof data === "object" ? data : defaultData();
  normalized.tree = Array.isArray(normalized.tree) ? normalized.tree.filter(isPlainObject) : [];
  normalized.deletedTree = Array.isArray(normalized.deletedTree) ? normalized.deletedTree.filter(isPlainObject) : [];
  normalizeTreeNodes(normalized.tree, null, 1);
  normalized.updatedAt = typeof normalized.updatedAt === "string" ? normalized.updatedAt : null;
  return normalized;
}

function normalizeSettings(settings) {
  const normalized = settings && typeof settings === "object" ? settings : defaultSettings();
  return {
    openTreeTabs: normalizeIdList(normalized.openTreeTabs, 12),
    closedTreeTabs: normalizeIdList(normalized.closedTreeTabs, 12),
  };
}

function normalizeTreeNodes(nodes, parentId, level) {
  nodes.forEach((node) => {
    node.id = typeof node.id === "string" && node.id ? node.id : crypto.randomUUID();
    node.title = normalizeText(node.title) || defaultTitleForLevel(level);
    node.content = normalizeText(node.content);
    node.parentId = parentId;
    node.level = level;
    node.children = Array.isArray(node.children) ? node.children.filter(isPlainObject) : [];
    node.status = node.status || "active";
    node.favorite = node.favorite === true;
    node.tags = extractTags(node.content);
    node.createdAt = typeof node.createdAt === "string" ? node.createdAt : new Date().toISOString();
    node.updatedAt = typeof node.updatedAt === "string" ? node.updatedAt : node.createdAt;
    if (level >= MAX_LEVEL) node.children = [];
    normalizeTreeNodes(node.children, node.id, level + 1);
  });
}

function normalizeIdList(value, limit) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((id) => typeof id === "string" && id))).slice(0, limit);
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value) {
  return typeof value === "string" ? value : "";
}

function createNode(title, content, parentId, level) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title,
    content,
    parentId,
    level,
    children: [],
    status: "active",
    favorite: false,
    tags: extractTags(content),
    createdAt: now,
    updatedAt: now,
  };
}

function defaultTitleForLevel(level) {
  if (level === 1) return "새 주제";
  if (level === 2) return "새 분류";
  return "새 메모";
}

function addRootNote() {
  const node = createNode(defaultTitleForLevel(1), "", null, 1);
  state.data.tree.push(node);
  selectNode(node.id);
  state.expandedTreeIds.add(node.id);
  markChanged(node);
  render();
  focusTitle();
}

function addChildToSelectedTreeNode() {
  const selected = getSelectedTreeNode();
  if (!selected) {
    addRootNote();
    return;
  }
  if (selected.level >= MAX_LEVEL) {
    showNotice("3단계 메모 아래에는 더 이상 하위 메모를 만들 수 없습니다.");
    return;
  }
  const node = createNode(defaultTitleForLevel(selected.level + 1), "", selected.id, selected.level + 1);
  selected.children.push(node);
  state.expandedTreeIds.add(selected.id);
  selectNode(node.id);
  markChanged(selected);
  render();
  focusTitle();
}

function deleteSelectedTreeNode() {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  if (selected.children.length > 0) {
    showNotice("하위 메모가 있는 항목은 먼저 하위 메모를 정리하세요.");
    return;
  }
  if (!confirm(`'${noteTitle(selected.title)}' 메모를 삭제 보관함으로 보낼까요?`)) return;
  detachNode(selected.id);
  selected.status = "deleted";
  selected.deletedAt = new Date().toISOString();
  state.data.deletedTree.push(selected);
  removeTab(selected.id);
  state.selectedTreeId = firstTreeNodeId(state.data.tree);
  persistSoon();
  render();
}

function updateSelectedTitle() {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  selected.title = elements.treeTitleInput.value;
  markChanged(selected);
  renderTreeListOnly();
  renderOpenTabs();
  renderPath();
  persistSoon();
}

function updateSelectedContent() {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  selected.content = readEditorText();
  selected.tags = extractTags(selected.content);
  markChanged(selected);
  renderNoteStats();
  persistSoon();
}

function toggleFavorite() {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  selected.favorite = !selected.favorite;
  markChanged(selected);
  persistSoon();
  render();
}

async function copySelectedLink() {
  const selected = getSelectedTreeNode();
  if (!selected) return;
  const link = `[[${noteTitle(selected.title)}]]`;
  try {
    await navigator.clipboard.writeText(link);
    showNotice("링크를 복사했습니다.");
  } catch {
    showNotice(link);
  }
}

function togglePreview() {
  state.preview = !state.preview;
  renderEditor();
}

function selectNode(id) {
  state.selectedTreeId = id;
  addOpenTab(id);
  expandAncestors(id);
}

function render() {
  renderTreeListOnly();
  renderOpenTabs();
  renderEditor();
}

function renderTreeListOnly() {
  const roots = filteredTree();
  elements.treeCount.textContent = String(flattenTree(state.data.tree).length);
  if (roots.length === 0) {
    elements.treeList.innerHTML = `<div class="tree-meta">표시할 메모가 없습니다.</div>`;
    return;
  }
  elements.treeList.replaceChildren(...roots.map(treeNodeElement));
}

function filteredTree() {
  if (!state.search) return state.data.tree;
  const query = state.search.toLowerCase();
  return filterTree(state.data.tree, (node) =>
    `${node.title}\n${node.content}\n${node.tags.join(" ")}`.toLowerCase().includes(query),
  );
}

function filterTree(nodes, predicate) {
  return nodes
    .map((node) => {
      const children = filterTree(node.children, predicate);
      if (!predicate(node) && children.length === 0) return null;
      return { ...node, children };
    })
    .filter(Boolean);
}

function treeNodeElement(node) {
  const sourceNode = findTreeNode(state.data.tree, node.id) || node;
  const wrapper = document.createElement("div");
  wrapper.className = "tree-node";

  const row = document.createElement("div");
  row.className = "tree-row";
  row.classList.toggle("active", node.id === state.selectedTreeId);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "tree-toggle";
  toggle.textContent = node.children.length ? (state.expandedTreeIds.has(node.id) ? "⌄" : "›") : "";
  toggle.disabled = node.children.length === 0;
  toggle.addEventListener("click", () => {
    if (state.expandedTreeIds.has(node.id)) state.expandedTreeIds.delete(node.id);
    else state.expandedTreeIds.add(node.id);
    renderTreeListOnly();
  });

  const label = document.createElement("button");
  label.type = "button";
  label.className = "tree-label";
  label.innerHTML = `<div class="tree-title">${escapeHtml(sourceNode.favorite ? `★ ${noteTitle(node.title)}` : noteTitle(node.title))}</div><div class="tree-meta">${levelName(node.level)}${node.tags.length ? ` · #${escapeHtml(node.tags[0])}` : ""}</div>`;
  label.addEventListener("click", () => {
    selectNode(node.id);
    render();
  });

  const add = document.createElement("button");
  add.type = "button";
  add.className = "tree-add";
  add.textContent = "+";
  add.disabled = sourceNode.level >= MAX_LEVEL;
  add.addEventListener("click", (event) => {
    event.stopPropagation();
    state.selectedTreeId = sourceNode.id;
    addChildToSelectedTreeNode();
  });

  row.append(toggle, label, add);
  wrapper.append(row);

  if (node.children.length && state.expandedTreeIds.has(node.id)) {
    const children = document.createElement("div");
    children.className = "tree-children";
    children.append(...node.children.map(treeNodeElement));
    wrapper.append(children);
  }
  return wrapper;
}

function renderOpenTabs() {
  const tabs = state.settings.openTreeTabs
    .map((id) => findTreeNode(state.data.tree, id))
    .filter(Boolean);
  elements.openTabs.replaceChildren(...tabs.map((node) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "open-tab";
    tab.classList.toggle("active", node.id === state.selectedTreeId);
    tab.innerHTML = `<span>${escapeHtml(noteTitle(node.title))}</span>`;
    tab.addEventListener("click", () => {
      selectNode(node.id);
      render();
    });
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.addEventListener("click", (event) => {
      event.stopPropagation();
      closeTab(node.id);
    });
    tab.append(close);
    return tab;
  }));
  elements.reopenClosedTabBtn.disabled = !state.settings.closedTreeTabs.some((id) => findTreeNode(state.data.tree, id));
  elements.closeOtherTabsBtn.disabled = !state.selectedTreeId || tabs.length <= 1;
  elements.closeAllTabsBtn.disabled = tabs.length === 0;
}

function renderEditor() {
  const selected = getSelectedTreeNode();
  elements.emptyTreeEditor.classList.toggle("hidden", Boolean(selected));
  elements.treeEditor.classList.toggle("hidden", !selected);
  if (!selected) return;
  addOpenTab(selected.id);
  elements.treeTitleInput.disabled = false;
  elements.treeTitleInput.value = selected.title;
  writeEditorText(selected.content || "");
  elements.favoriteBtn.classList.toggle("primary", selected.favorite);
  elements.previewToggleBtn.textContent = state.preview ? "편집" : "Markdown 보기";
  renderPath();
  renderNoteStats();
  renderMarkdownPreview();
  elements.treeContent.classList.toggle("hidden", state.preview);
  elements.markdownPreview.classList.toggle("hidden", !state.preview);
}

function renderPath() {
  const selected = getSelectedTreeNode();
  if (!selected) {
    elements.treePathLabel.textContent = "";
    return;
  }
  elements.treePathLabel.textContent = treePathNodes(selected.id).map((node) => noteTitle(node.title)).join(" / ");
}

function renderNoteStats() {
  const selected = getSelectedTreeNode();
  if (!selected) {
    elements.noteStats.textContent = "";
    return;
  }
  const text = selected.content || "";
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  elements.noteStats.textContent = `글자 ${text.length} · 단어 ${words} · 태그 ${selected.tags.length} · 최근 수정 ${formatDateTime(selected.updatedAt)}`;
}

function renderMarkdownPreview() {
  const selected = getSelectedTreeNode();
  elements.markdownPreview.innerHTML = markdownToHtml(selected?.content || "");
}

function addOpenTab(id) {
  if (!id || !findTreeNode(state.data.tree, id)) return;
  state.settings.openTreeTabs = [id, ...state.settings.openTreeTabs.filter((item) => item !== id)].slice(0, 12);
  state.settings.closedTreeTabs = state.settings.closedTreeTabs.filter((item) => item !== id);
  persistSettingsSoon();
}

function closeTab(id) {
  state.settings.openTreeTabs = state.settings.openTreeTabs.filter((item) => item !== id);
  state.settings.closedTreeTabs = [id, ...state.settings.closedTreeTabs.filter((item) => item !== id)].slice(0, 12);
  if (state.selectedTreeId === id) {
    state.selectedTreeId = state.settings.openTreeTabs.find((item) => findTreeNode(state.data.tree, item)) || firstTreeNodeId(state.data.tree);
  }
  persistSettingsSoon();
  render();
}

function removeTab(id) {
  state.settings.openTreeTabs = state.settings.openTreeTabs.filter((item) => item !== id);
  state.settings.closedTreeTabs = state.settings.closedTreeTabs.filter((item) => item !== id);
}

function reopenClosedTab() {
  const id = state.settings.closedTreeTabs.find((item) => findTreeNode(state.data.tree, item));
  if (!id) return;
  selectNode(id);
  render();
}

function closeOtherTabs() {
  if (!state.selectedTreeId) return;
  state.settings.openTreeTabs = [state.selectedTreeId];
  persistSettingsSoon();
  renderOpenTabs();
}

function closeAllTabs() {
  state.settings.closedTreeTabs = [...state.settings.openTreeTabs, ...state.settings.closedTreeTabs].slice(0, 12);
  state.settings.openTreeTabs = [];
  persistSettingsSoon();
  renderOpenTabs();
}

function markChanged(node) {
  const now = new Date().toISOString();
  node.updatedAt = now;
  state.data.updatedAt = now;
  elements.treeSavedLabel.textContent = "저장 대기";
}

function persistSoon() {
  window.clearTimeout(state.saveTimer);
  state.saveTimer = window.setTimeout(() => persistNow(), 500);
}

function persistSettingsSoon() {
  window.setTimeout(() => writeDesktopValue(SETTINGS_KEY, state.settings), 0);
}

async function persistNow(message = null) {
  window.clearTimeout(state.saveTimer);
  await writeDesktopValue(STORAGE_KEY, state.data);
  await writeDesktopValue(SETTINGS_KEY, state.settings);
  elements.treeSavedLabel.textContent = "저장됨";
  if (message) showNotice(message);
  updateStorageStatus();
}

function getSelectedTreeNode() {
  return state.selectedTreeId ? findTreeNode(state.data.tree, state.selectedTreeId) : null;
}

function findTreeNode(nodes, id) {
  for (const node of nodes || []) {
    if (node.id === id) return node;
    const child = findTreeNode(node.children || [], id);
    if (child) return child;
  }
  return null;
}

function detachNode(id, nodes = state.data.tree) {
  const index = nodes.findIndex((node) => node.id === id);
  if (index >= 0) {
    return nodes.splice(index, 1)[0];
  }
  for (const node of nodes) {
    const removed = detachNode(id, node.children);
    if (removed) return removed;
  }
  return null;
}

function flattenTree(nodes) {
  return (nodes || []).flatMap((node) => [node, ...flattenTree(node.children)]);
}

function firstTreeNodeId(nodes) {
  return nodes?.[0]?.id || null;
}

function treePathNodes(id) {
  const path = [];
  let current = findTreeNode(state.data.tree, id);
  while (current) {
    path.unshift(current);
    current = current.parentId ? findTreeNode(state.data.tree, current.parentId) : null;
  }
  return path;
}

function expandAncestors(id) {
  treePathNodes(id).forEach((node) => {
    if (node.id !== id) state.expandedTreeIds.add(node.id);
  });
}

function levelName(level) {
  if (level === 1) return "주제";
  if (level === 2) return "분류";
  return "메모";
}

function noteTitle(title) {
  return normalizeText(title).trim() || "제목 없음";
}

function extractTags(text) {
  return Array.from(new Set((text.match(/(^|\s)#([\p{L}\p{N}_-]+)/gu) || []).map((tag) => tag.trim().slice(1))));
}

function readEditorText() {
  return elements.treeContent.innerText.replace(/\n\n$/u, "");
}

function writeEditorText(text) {
  elements.treeContent.textContent = text || "";
}

function focusTitle() {
  window.setTimeout(() => {
    elements.treeTitleInput.focus();
    elements.treeTitleInput.select();
  }, 0);
}

function exportMarkdown() {
  const lines = [];
  state.data.tree.forEach((node) => appendMarkdownNode(lines, node));
  downloadText(`nownote-desktop-${fileTimestamp(new Date())}.md`, lines.join("\n\n"), "text/markdown");
}

function appendMarkdownNode(lines, node) {
  const prefix = "#".repeat(Math.min(3, node.level));
  lines.push(`${prefix} ${noteTitle(node.title)}`);
  if ((node.content || "").trim()) lines.push(node.content.trim());
  node.children.forEach((child) => appendMarkdownNode(lines, child));
}

async function importMarkdown(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  const text = await file.text();
  const node = createNode(file.name.replace(/\.(md|txt)$/i, ""), text, null, 1);
  state.data.tree.push(node);
  selectNode(node.id);
  markChanged(node);
  persistSoon();
  render();
  showNotice("Markdown 파일을 새 주제로 가져왔습니다.");
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function markdownToHtml(markdown) {
  const escaped = escapeHtml(markdown || "");
  return escaped
    .replace(/^### (.*)$/gmu, "<h3>$1</h3>")
    .replace(/^## (.*)$/gmu, "<h2>$1</h2>")
    .replace(/^# (.*)$/gmu, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/gu, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/gu, "<em>$1</em>")
    .replace(/\n/g, "<br>");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateTime(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function fileTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function showNotice(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  elements.toastRegion.append(toast);
  window.setTimeout(() => toast.remove(), 2600);
}

initialize().catch((error) => {
  console.error(error);
  showNotice(`초기화 실패: ${error.message}`);
});
