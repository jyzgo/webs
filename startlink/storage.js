// loadState 从同目录 data.json 拉,localStorage 仅作离线兜底
// saveState 在配了 GitHub PAT 时,直接调 Contents API commit data.json
const DATA = "./data.json";
const LS_KEY = "startlink:state";
const GH_KEY = "startlink:gh";

function normalize(s) {
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

export async function loadState() {
  try {
    // cache buster 绕过 GitHub Pages CDN 缓存
    const res = await fetch(`${DATA}?t=${Date.now()}`, { cache: "no-store" });
    if (res.ok) {
      const raw = await res.json();
      const n = normalize(raw);
      if (n) {
        try { localStorage.setItem(LS_KEY, JSON.stringify(n)); } catch {}
        return n;
      }
    }
  } catch {}
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch {}
  return null;
}

export function getGhConfig() {
  try {
    const raw = localStorage.getItem(GH_KEY);
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

export function setGhConfig(cfg) {
  if (!cfg || !cfg.token) {
    localStorage.removeItem(GH_KEY);
  } else {
    localStorage.setItem(GH_KEY, JSON.stringify(cfg));
  }
}

function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

export async function saveState(state) {
  state.lastModified = Date.now();
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}

  const cfg = getGhConfig();
  if (!cfg) return { ok: true, online: false, message: "本地保存(未配置 GitHub)" };

  const apiBase = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}`;
  const headers = {
    Authorization: `Bearer ${cfg.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  let sha = null;
  try {
    const r = await fetch(`${apiBase}?ref=${encodeURIComponent(cfg.branch)}`, { headers });
    if (r.ok) {
      const j = await r.json();
      sha = j.sha;
    } else if (r.status !== 404) {
      const txt = await r.text();
      return { ok: false, online: true, message: `读取失败 ${r.status}: ${txt.slice(0, 200)}` };
    }
  } catch (e) {
    return { ok: false, online: false, message: `网络错误: ${e.message}` };
  }

  const json = JSON.stringify(state, null, 2);
  const body = {
    message: `update startlink (${state.items.length} links)`,
    content: utf8ToBase64(json),
    branch: cfg.branch,
  };
  if (sha) body.sha = sha;

  try {
    const r = await fetch(apiBase, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const txt = await r.text();
      return { ok: false, online: true, message: `提交失败 ${r.status}: ${txt.slice(0, 200)}` };
    }
    return { ok: true, online: true, message: "已 commit,Pages 部署 ~30s" };
  } catch (e) {
    return { ok: false, online: false, message: `网络错误: ${e.message}` };
  }
}
