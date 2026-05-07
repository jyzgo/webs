// 网页代码版本(每次改 webs/startlink/* 时 patch +1, 满 9 进 minor)
const APP_VERSION = "0.0.5";

// 编辑后等多久(无新改动)才 commit 到 GitHub —— 合并连续编辑减少 commit 数
const SAVE_DEBOUNCE_MS = 5000;

// ============================================================================
// storage (内联,避免多文件 CDN 缓存不一致)
// ============================================================================
const _DATA = "./data.json";
const _LS_KEY = "startlink:state";
const _GH_KEY = "startlink:gh";

function _normalize(s) {
  if (!s || typeof s !== "object") return null;
  const cols = Number(s.cols);
  const items = Array.isArray(s.items) ? s.items : [];
  return {
    version: Number(s.version) || 1,
    cols: Number.isFinite(cols) ? cols : 4,
    lastModified: Number(s.lastModified) || 0,
    items: items
      .filter((x) => x && typeof x === "object")
      .map((x) => ({
        id: String(x.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
        alias: String(x.alias || x.title || "（无标题）"),
        url: String(x.url || ""),
        createdAt: Number(x.createdAt || Date.now()),
        updatedAt: Number(x.updatedAt || x.createdAt || Date.now()),
        titleColor: x.titleColor ? String(x.titleColor) : undefined,
        tintColor: x.tintColor ? String(x.tintColor) : undefined,
      }))
      .filter((x) => x.url),
  };
}

async function loadState() {
  try {
    const res = await fetch(`${_DATA}?t=${Date.now()}`, { cache: "no-store" });
    if (res.ok) {
      const raw = await res.json();
      const n = _normalize(raw);
      if (n) {
        try { localStorage.setItem(_LS_KEY, JSON.stringify(n)); } catch {}
        return n;
      }
    }
  } catch {}
  try {
    const raw = localStorage.getItem(_LS_KEY);
    if (raw) return _normalize(JSON.parse(raw));
  } catch {}
  return null;
}

function getGhConfig() {
  try {
    const raw = localStorage.getItem(_GH_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (!c || !c.token) return null;
    return {
      token: String(c.token),
      owner: String(c.owner || "jyzgo"),
      repo: String(c.repo || "webs"),
      path: String(c.path || "startlink/data.json"),
      branch: String(c.branch || "main"),
    };
  } catch {
    return null;
  }
}

function setGhConfig(cfg) {
  if (!cfg || !cfg.token) localStorage.removeItem(_GH_KEY);
  else localStorage.setItem(_GH_KEY, JSON.stringify(cfg));
}

function _utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

async function _ghGetSha(apiBase, branch, headers) {
  // cache buster 让 GitHub read replica 不返回旧 sha
  const r = await fetch(`${apiBase}?ref=${encodeURIComponent(branch)}&t=${Date.now()}`, {
    headers, cache: "no-store",
  });
  if (r.ok) {
    const j = await r.json();
    return { sha: j.sha };
  }
  if (r.status === 404) return { sha: null };
  return { error: `读取失败 ${r.status}: ${(await r.text()).slice(0, 200)}` };
}

async function _ghPut(apiBase, headers, body) {
  const r = await fetch(apiBase, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, ok: r.ok, text: r.ok ? null : await r.text() };
}

async function saveState(state) {
  state.lastModified = Date.now();
  try { localStorage.setItem(_LS_KEY, JSON.stringify(state)); } catch {}

  const cfg = getGhConfig();
  if (!cfg) return { ok: true, online: false, message: "本地保存(未配置 GitHub)" };

  const apiBase = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}`;
  const headers = {
    Authorization: `Bearer ${cfg.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const json = JSON.stringify(state, null, 2);
  const content = _utf8ToBase64(json);

  // 最多 3 次:每次重新拉 sha,409 sleep 后重试
  let lastError = "未知错误";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1500));

    const g = await _ghGetSha(apiBase, cfg.branch, headers).catch((e) => ({ error: `网络错误: ${e.message}` }));
    if (g.error) { lastError = g.error; continue; }

    const body = {
      message: `update startlink (${state.items.length} links)`,
      content,
      branch: cfg.branch,
    };
    if (g.sha) body.sha = g.sha;

    const p = await _ghPut(apiBase, headers, body).catch((e) => ({ status: 0, ok: false, text: `网络错误: ${e.message}` }));
    if (p.ok) {
      return { ok: true, online: true, message: `已 commit (${attempt + 1} 次尝试),Pages 部署 ~30s` };
    }
    lastError = `${p.status}: ${(p.text || "").slice(0, 200)}`;
    // 409 = sha 冲突,等下次循环重读 sha 再试。其他错误直接返回。
    if (p.status !== 409) break;
  }
  return { ok: false, online: true, message: `提交失败 ${lastError}` };
}

const els = {
  cols: document.getElementById("cols"),
  search: document.getElementById("search"),
  count: document.getElementById("count"),
  version: document.getElementById("version"),
  saveStatus: document.getElementById("saveStatus"),
  lastUpdate: document.getElementById("lastUpdate"),
  modeTitle: document.getElementById("modeTitle"),
  modeDesc: document.getElementById("modeDesc"),
  grid: document.getElementById("grid"),
  empty: document.getElementById("empty"),
  addBtn: document.getElementById("addBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  settingsDialog: document.getElementById("settingsDialog"),
  settingsForm: document.getElementById("settingsForm"),
  ghToken: document.getElementById("ghToken"),
  ghOwner: document.getElementById("ghOwner"),
  ghRepo: document.getElementById("ghRepo"),
  ghPath: document.getElementById("ghPath"),
  ghBranch: document.getElementById("ghBranch"),
  ghClear: document.getElementById("ghClear"),
  editDialog: document.getElementById("editDialog"),
  editForm: document.getElementById("editForm"),
  editTitle: document.getElementById("editTitle"),
  alias: document.getElementById("alias"),
  url: document.getElementById("url"),
  useTitleColor: document.getElementById("useTitleColor"),
  titleColor: document.getElementById("titleColor"),
  useTintColor: document.getElementById("useTintColor"),
  tintColor: document.getElementById("tintColor"),
  deleteBtn: document.getElementById("deleteBtn"),
};

let state = { version: 1, cols: 4, items: [], lastModified: 0 };
let filter = "";
let editMode = false;
let draggingId = null;
let editingId = null;

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// 与 ToolBox · startlink GUI 用的同一组调色板,按 URL 字符和取模派生默认 alias 颜色
const AVATAR_COLORS = [
  "#e74c3c", "#e67e22", "#f39c12", "#27ae60", "#1abc9c",
  "#2980b9", "#8e44ad", "#e91e63", "#00acc1", "#ff7043",
];
function avatarColor(url) {
  const s = url || "";
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += s.charCodeAt(i);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function getOriginFavicon(url) {
  try { return `${new URL(url).origin}/favicon.ico`; } catch { return ""; }
}
function getGoogleFavicon(url) {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`; } catch { return ""; }
}
const _decoder = document.createElement("textarea");
function decodeHtmlEntities(s) { _decoder.innerHTML = s; return _decoder.value; }
function fmtDate(ts) {
  if (!ts) return "未知";
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function applyCols(n) {
  const v = Math.max(1, Math.min(12, Number(n) || 4));
  document.documentElement.style.setProperty("--cols", String(v));
  return v;
}

let _statusTimer = null;
function showSaveStatus(text, err = false, sticky = false) {
  els.saveStatus.textContent = text;
  els.saveStatus.hidden = false;
  els.saveStatus.style.color = err ? "#ff8a8a" : "";
  if (_statusTimer) { clearTimeout(_statusTimer); _statusTimer = null; }
  if (!sticky) _statusTimer = setTimeout(() => { els.saveStatus.hidden = true; }, err ? 8000 : 4000);
}

// ---- debounce 队列(连续编辑合并成一次 commit) ----
let _saveTimer = null;
let _saveCountdown = null;
let _pendingSave = false;
let _pendingChangeCount = 0;

function scheduleSave() {
  _pendingSave = true;
  _pendingChangeCount += 1;
  if (_saveTimer) clearTimeout(_saveTimer);
  if (_saveCountdown) clearInterval(_saveCountdown);

  let remain = Math.ceil(SAVE_DEBOUNCE_MS / 1000);
  showSaveStatus(`未保存 (${_pendingChangeCount}) ${remain}s 后提交`, false, true);
  _saveCountdown = setInterval(() => {
    remain -= 1;
    if (remain > 0) {
      showSaveStatus(`未保存 (${_pendingChangeCount}) ${remain}s 后提交`, false, true);
    } else {
      clearInterval(_saveCountdown);
      _saveCountdown = null;
    }
  }, 1000);

  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    if (_saveCountdown) { clearInterval(_saveCountdown); _saveCountdown = null; }
    commitNow();
  }, SAVE_DEBOUNCE_MS);
}

async function commitNow() {
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  if (_saveCountdown) { clearInterval(_saveCountdown); _saveCountdown = null; }
  const n = _pendingChangeCount;
  _pendingChangeCount = 0;
  showSaveStatus(`提交中… (合并 ${n} 处改动)`, false, true);
  const r = await saveState(state);
  _pendingSave = false;
  showSaveStatus(r.message, !r.ok);
  if (r.ok) {
    els.lastUpdate.textContent = `数据更新于 ${fmtDate(state.lastModified)}`;
  }
}

window.addEventListener("beforeunload", (e) => {
  if (_pendingSave) {
    e.preventDefault();
    e.returnValue = "有未保存的改动,确定离开?";
    return e.returnValue;
  }
});

function refreshMode() {
  editMode = !!getGhConfig();
  els.addBtn.hidden = !editMode;
  if (editMode) {
    els.modeTitle.textContent = "编辑模式 (GitHub 已连)";
    els.modeDesc.textContent = "改动会 commit 到 GitHub,Pages 自动部署 ~30s";
  } else {
    els.modeTitle.textContent = "只读视图";
    els.modeDesc.textContent = "点 ⚙ 输入 PAT 进入编辑模式";
  }
}

function render() {
  const items = state.items.filter((it) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (it.alias || "").toLowerCase().includes(q) || (it.url || "").toLowerCase().includes(q);
  });
  els.count.textContent = items.length === state.items.length
    ? `${items.length} 条链接`
    : `${items.length} / ${state.items.length} 条链接`;
  els.empty.hidden = state.items.length > 0;
  els.grid.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (const it of items) frag.appendChild(makeCard(it));
  els.grid.appendChild(frag);
}

function makeCard(it) {
  const url = decodeHtmlEntities(it.url);
  const card = document.createElement(editMode ? "div" : "a");
  card.className = "card";
  card.dataset.id = it.id;
  if (!editMode) {
    card.href = url;
    card.target = "_blank";
    card.rel = "noopener noreferrer";
  }

  if (editMode) {
    card.addEventListener("dragenter", (e) => {
      if (!draggingId || draggingId === it.id) return;
      e.preventDefault();
      card.classList.add("drag-over");
    });
    card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
    card.addEventListener("dragover", (e) => {
      if (!draggingId || draggingId === it.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });
    card.addEventListener("drop", async (e) => {
      if (!draggingId || draggingId === it.id) return;
      e.preventDefault();
      card.classList.remove("drag-over");
      const from = state.items.findIndex((x) => x.id === draggingId);
      const to = state.items.findIndex((x) => x.id === it.id);
      if (from < 0 || to < 0 || from === to) return;
      const [moved] = state.items.splice(from, 1);
      const insertAt = from < to ? to - 1 : to;
      state.items.splice(insertAt, 0, moved);
      render();
      scheduleSave();
    });
  }

  const top = document.createElement("div");
  top.className = "card__top";
  if (editMode) {
    top.style.cursor = "pointer";
    top.addEventListener("click", () => window.open(url, "_blank", "noopener,noreferrer"));
  }

  const row = document.createElement("div");
  row.className = "card__row";

  const icon = document.createElement("img");
  icon.className = "favicon";
  icon.alt = "";
  icon.loading = "lazy";
  icon.decoding = "async";
  icon.referrerPolicy = "no-referrer";
  const primary = getOriginFavicon(url);
  const fallback = getGoogleFavicon(url);
  if (primary) icon.src = primary;
  icon.addEventListener("error", () => {
    if (icon.dataset.fb === "1") return;
    icon.dataset.fb = "1";
    icon.src = fallback;
  });

  const meta = document.createElement("div");
  meta.className = "card__meta";

  const alias = document.createElement("div");
  alias.className = "card__alias";
  alias.textContent = it.alias || "（无标题）";
  if (it.titleColor) alias.style.color = it.titleColor;

  const urlEl = document.createElement("div");
  urlEl.className = "card__url";
  urlEl.textContent = url;

  if (primary) card.style.setProperty("--bg-icon", `url("${primary}")`);
  card.style.setProperty("--tint", it.tintColor || avatarColor(url));

  meta.appendChild(alias);
  meta.appendChild(urlEl);
  row.appendChild(icon);
  row.appendChild(meta);
  top.appendChild(row);
  card.appendChild(top);

  if (editMode) {
    const actions = document.createElement("div");
    actions.className = "card__actions";

    const dragBtn = document.createElement("button");
    dragBtn.className = "btn btn--ghost btn--handle";
    dragBtn.type = "button";
    dragBtn.textContent = "⇅";
    dragBtn.title = "拖动排序";
    dragBtn.draggable = true;
    dragBtn.addEventListener("dragstart", (e) => {
      draggingId = it.id;
      card.classList.add("is-dragging");
      try {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", it.id);
      } catch {}
    });
    dragBtn.addEventListener("dragend", () => {
      draggingId = null;
      card.classList.remove("is-dragging");
      for (const el of document.querySelectorAll(".card.drag-over")) el.classList.remove("drag-over");
    });

    const editBtn = document.createElement("button");
    editBtn.className = "btn";
    editBtn.type = "button";
    editBtn.textContent = "编辑";
    editBtn.addEventListener("click", () => openEdit(it.id));

    const delBtn = document.createElement("button");
    delBtn.className = "btn btn--danger";
    delBtn.type = "button";
    delBtn.textContent = "删除";
    delBtn.addEventListener("click", async () => {
      if (!confirm(`删除"${it.alias}"?`)) return;
      state.items = state.items.filter((x) => x.id !== it.id);
      render();
      scheduleSave();
    });

    actions.appendChild(dragBtn);
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    card.appendChild(actions);
  }

  return card;
}

function openEdit(id) {
  editingId = id ?? null;
  const existing = id ? state.items.find((x) => x.id === id) : null;
  els.editTitle.textContent = existing ? "编辑链接" : "添加链接";
  els.alias.value = existing ? existing.alias : "";
  els.url.value = existing ? existing.url : "";
  els.useTitleColor.checked = !!existing?.titleColor;
  els.titleColor.value = existing?.titleColor || "#ffffff";
  els.useTintColor.checked = !!existing?.tintColor;
  els.tintColor.value = existing?.tintColor || "#7c5cff";
  els.deleteBtn.hidden = !existing;
  els.editDialog.showModal();
}

els.editForm.addEventListener("submit", async (e) => {
  if (els.editForm.returnValue === "cancel") return;
  if (!els.alias.value.trim() || !els.url.value.trim()) return;
  const now = Date.now();
  const data = {
    alias: els.alias.value.trim(),
    url: els.url.value.trim(),
    titleColor: els.useTitleColor.checked ? els.titleColor.value : undefined,
    tintColor: els.useTintColor.checked ? els.tintColor.value : undefined,
  };
  if (editingId) {
    const idx = state.items.findIndex((x) => x.id === editingId);
    if (idx >= 0) state.items[idx] = { ...state.items[idx], ...data, updatedAt: now };
  } else {
    state.items.push({ id: uid(), createdAt: now, updatedAt: now, ...data });
  }
  render();
  scheduleSave();
});

els.deleteBtn.addEventListener("click", async () => {
  if (!editingId) return;
  if (!confirm("确认删除?")) return;
  els.editDialog.close();
  state.items = state.items.filter((x) => x.id !== editingId);
  render();
  scheduleSave();
});

els.settingsBtn.addEventListener("click", () => {
  const cfg = getGhConfig();
  if (cfg) {
    els.ghToken.value = "";
    els.ghToken.placeholder = "已设置(留空保留原 token)";
    els.ghOwner.value = cfg.owner;
    els.ghRepo.value = cfg.repo;
    els.ghPath.value = cfg.path;
    els.ghBranch.value = cfg.branch;
  } else {
    els.ghToken.placeholder = "github_pat_...";
    els.ghToken.value = "";
  }
  els.settingsDialog.showModal();
});

els.settingsForm.addEventListener("submit", () => {
  if (els.settingsForm.returnValue === "cancel") return;
  const cur = getGhConfig();
  const token = els.ghToken.value.trim() || cur?.token;
  if (!token) return;
  setGhConfig({
    token,
    owner: els.ghOwner.value.trim(),
    repo: els.ghRepo.value.trim(),
    path: els.ghPath.value.trim(),
    branch: els.ghBranch.value.trim(),
  });
  refreshMode();
  render();
  showSaveStatus("GitHub 编辑模式已启用");
});

els.ghClear.addEventListener("click", () => {
  if (!confirm("退出编辑模式并清除 PAT?")) return;
  setGhConfig(null);
  els.settingsDialog.close();
  refreshMode();
  render();
  showSaveStatus("已退出编辑模式");
});

async function init() {
  const loaded = await loadState();
  if (loaded) state = loaded;

  els.version.textContent = `v${APP_VERSION}`;
  els.lastUpdate.textContent = `数据更新于 ${fmtDate(state.lastModified)}`;

  const storedCols = Number(localStorage.getItem("startlink:cols"));
  const cols = applyCols(storedCols || state.cols);
  els.cols.value = cols;

  els.cols.addEventListener("input", () => {
    const v = applyCols(els.cols.value);
    localStorage.setItem("startlink:cols", String(v));
  });

  els.search.addEventListener("input", () => {
    filter = els.search.value.trim();
    render();
  });

  els.addBtn.addEventListener("click", () => openEdit(null));

  refreshMode();
  render();
}

init();
