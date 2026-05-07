import { loadState } from "./storage.js";

const els = {
  cols: document.getElementById("cols"),
  search: document.getElementById("search"),
  count: document.getElementById("count"),
  version: document.getElementById("version"),
  lastUpdate: document.getElementById("lastUpdate"),
  grid: document.getElementById("grid"),
  empty: document.getElementById("empty"),
};

let state = { version: 1, cols: 4, items: [], lastModified: 0 };
let filter = "";

function getOriginFavicon(url) {
  try {
    return `${new URL(url).origin}/favicon.ico`;
  } catch {
    return "";
  }
}

function getGoogleFavicon(url) {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`;
  } catch {
    return "";
  }
}

const _decoder = document.createElement("textarea");
function decodeHtmlEntities(s) {
  _decoder.innerHTML = s;
  return _decoder.value;
}

function applyCols(n) {
  const v = Math.max(1, Math.min(12, Number(n) || 4));
  document.documentElement.style.setProperty("--cols", String(v));
  return v;
}

function fmtDate(ts) {
  if (!ts) return "未知";
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function render() {
  const items = state.items.filter((it) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (it.alias || "").toLowerCase().includes(q) || (it.url || "").toLowerCase().includes(q);
  });
  els.count.textContent = `${items.length} / ${state.items.length} 条链接`;
  els.empty.hidden = state.items.length > 0;
  els.grid.innerHTML = "";

  const frag = document.createDocumentFragment();
  for (const it of items) {
    const url = decodeHtmlEntities(it.url);
    const card = document.createElement("a");
    card.className = "card";
    card.href = url;
    card.target = "_blank";
    card.rel = "noopener noreferrer";

    const top = document.createElement("div");
    top.className = "card__top";

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
    card.style.setProperty("--tint", it.tintColor || "transparent");

    meta.appendChild(alias);
    meta.appendChild(urlEl);
    row.appendChild(icon);
    row.appendChild(meta);
    top.appendChild(row);
    card.appendChild(top);
    frag.appendChild(card);
  }
  els.grid.appendChild(frag);
}

async function init() {
  const loaded = await loadState();
  if (loaded) state = loaded;

  els.version.textContent = `版本 ${state.version}`;
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

  render();
}

init();
