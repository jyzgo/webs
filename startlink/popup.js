/* global chrome */

const els = {
  q: document.getElementById("q"),
  refresh: document.getElementById("refresh"),
  status: document.getElementById("status"),
  list: document.getElementById("list"),
};

/** @typedef {{id?: string, title?: string, url?: string, children?: any[]}} BookmarkNode */

/** @type {{flat: Array<{type: 'folder'|'link', depth: number, title: string, url?: string}>}} */
const state = {
  flat: [],
};

function setStatus(text) {
  els.status.textContent = text;
  els.status.style.display = text ? "block" : "none";
}

function clearList() {
  while (els.list.firstChild) els.list.removeChild(els.list.firstChild);
}

function escapeText(s) {
  return (s ?? "").toString();
}

function buildFlatList(nodes, depth = 0) {
  /** @type {Array<{type: 'folder'|'link', depth: number, title: string, url?: string}>} */
  const out = [];

  /** @param {BookmarkNode[]} ns */
  function walk(ns, d) {
    for (const n of ns) {
      const title = escapeText(n.title || (n.url ? n.url : "（无标题）"));
      if (n.url) {
        out.push({ type: "link", depth: d, title, url: n.url });
      } else if (Array.isArray(n.children)) {
        // Some roots may have empty title; don't render them as folders, but still traverse.
        if (title && title.trim()) out.push({ type: "folder", depth: d, title });
        walk(n.children, d + (title && title.trim() ? 1 : 0));
      }
    }
  }

  walk(nodes, depth);
  return out;
}

function matchesQuery(item, q) {
  if (!q) return true;
  const hay = `${item.title || ""} ${item.url || ""}`.toLowerCase();
  return hay.includes(q);
}

function getOriginFavicon(url) {
  try {
    const u = new URL(url);
    return `${u.origin}/favicon.ico`;
  } catch {
    return null;
  }
}

function getGoogleFavicon(url) {
  return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(url)}`;
}

function render() {
  const q = (els.q.value || "").trim().toLowerCase();
  const filtered = state.flat.filter((x) => matchesQuery(x, q));

  clearList();

  if (filtered.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = q ? "没有匹配的书签。" : "没有可展示的书签。";
    els.list.appendChild(li);
    setStatus(q ? `未找到匹配：${q}` : "未找到书签");
    return;
  }

  let linkCount = 0;
  for (const item of filtered) {
    const li = document.createElement("li");
    li.className = "item";

    const row = document.createElement("div");
    row.className = "row";
    row.style.paddingLeft = `${10 + item.depth * 14}px`;

    if (item.type === "folder") {
      const name = document.createElement("div");
      name.className = "folder";
      name.textContent = item.title;

      const pill = document.createElement("div");
      pill.className = "pill";
      pill.textContent = "文件夹";

      row.appendChild(name);
      row.appendChild(pill);
    } else {
      linkCount += 1;

      const icon = document.createElement("img");
      icon.className = "favicon";
      icon.alt = "";
      icon.loading = "lazy";
      icon.decoding = "async";
      icon.referrerPolicy = "no-referrer";
      const primaryIcon = getOriginFavicon(item.url);
      const fallbackIcon = getGoogleFavicon(item.url);
      if (primaryIcon) icon.src = primaryIcon;
      icon.addEventListener("error", () => {
        if (icon.dataset.fallbackDone === "1") return;
        icon.dataset.fallbackDone = "1";
        icon.src = fallbackIcon;
      });

      const a = document.createElement("a");
      a.className = "link";
      a.href = item.url;
      a.target = "_blank";
      a.rel = "noreferrer";

      const name = document.createElement("div");
      name.className = "name";
      name.textContent = item.title;

      const url = document.createElement("div");
      url.className = "url";
      url.textContent = item.url;

      a.appendChild(name);
      a.appendChild(url);

      a.addEventListener("click", (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: item.url });
      });

      icon.style.cursor = "pointer";
      icon.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        chrome.tabs.create({ url: item.url });
      });

      row.appendChild(icon);
      row.appendChild(a);
    }

    li.appendChild(row);
    els.list.appendChild(li);
  }

  setStatus(`显示 ${linkCount} 个链接（含文件夹：${filtered.length - linkCount}）`);
}

async function loadBookmarks() {
  try {
    setStatus("加载书签中…");
    clearList();
    const tree = await chrome.bookmarks.getTree();
    state.flat = buildFlatList(tree);
    render();
  } catch (err) {
    console.error(err);
    setStatus("读取书签失败：请确认已安装扩展且授予书签权限。");
  }
}

els.q.addEventListener("input", () => render());
els.refresh.addEventListener("click", () => loadBookmarks());

loadBookmarks();


