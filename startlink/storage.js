// 只读 storage:从同目录 data.json fetch,localStorage 仅作离线缓存
const DATA = "./data.json";
const LS_KEY = "startlink:state";

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
        id: String(x.id || `${Date.now()}_${Math.random()}`),
        alias: String(x.alias || x.title || "（无标题）"),
        url: String(x.url || ""),
        titleColor: x.titleColor ? String(x.titleColor) : undefined,
        tintColor: x.tintColor ? String(x.tintColor) : undefined,
      }))
      .filter((x) => x.url),
  };
}

export async function loadState() {
  try {
    const res = await fetch(DATA, { cache: "no-store" });
    if (res.ok) {
      const raw = await res.json();
      const n = normalize(raw);
      if (n) {
        try {
          localStorage.setItem(LS_KEY, JSON.stringify(n));
        } catch {}
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
