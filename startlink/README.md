## StartLink（书签启动页）

普通网页 **无法直接读取浏览器书签**（浏览器安全限制）。要实现“读取当前浏览器全部书签并展示可点击链接”，需要使用浏览器扩展能力。

这个项目就是一个最小可用的 **Chrome / Edge 扩展（Manifest V3）**：点开扩展弹窗后，会读取全部书签并展示，支持搜索，点击即可在新标签打开。

---

## StartLink 网页版（自定义链接页）

你也可以直接使用本项目提供的 **网页版**：支持添加/编辑/删除自定义链接、设置一页 N 列（Cols），并支持导入/导出 Chrome 书签 HTML。

### 运行方式（推荐）

为了能把数据 **保存到你的电脑文件夹**（File System Access API），建议通过本地 http 服务打开（`file://` 直接双击打开时，部分浏览器会限制文件夹写入能力）。

在 `D:\Documents\StartLink` 目录里启动一个静态服务（二选一）：

- Windows 自带 Python（如果你装了 Python）：
  - `python -m http.server 5173`
- 或 Node（如果你装了 Node）：
  - `npx --yes serve -l 5173 .`

然后打开：`http://localhost:5173/index.html`

### 网页版如何保存到“用户文件夹”

- 首次使用点击 **“选择保存目录”**，选择你想存放数据的任意目录（例如 `C:\Users\<你>\Documents\StartLinkData`）。
- 会在该目录创建/写入文件：`startlink.links.json`
- 下次打开网页会自动从该文件读取（浏览器可能会再次询问权限）
- 同时会额外写一份到 **localStorage** 作为备份（同一浏览器/同一设备内有效）

### 导入/导出 Chrome 书签 HTML

- **导入**：Chrome/Edge 书签管理器 → 右上角 ⋮ → **导出书签** → 生成 `.html`，在网页里点 **“导入书签 HTML”**
  - 支持 **合并**（按 URL 去重）或 **替换**
- **导出**：点 **“导出书签 HTML”**，会下载 `startlink-bookmarks.html`，可在 Chrome/Edge 中导入

### 安装（Chrome / Edge）

- 打开扩展管理页
  - Chrome：地址栏输入 `chrome://extensions`
  - Edge：地址栏输入 `edge://extensions`
- 打开右上角 **开发者模式**
- 点击 **加载已解压的扩展程序**
- 选择本项目目录 `StartLink`（包含 `manifest.json` 的目录）
- 安装后，点击工具栏里的 **StartLink** 图标即可使用

### 文件说明

- `manifest.json`: 扩展清单（权限：`bookmarks`, `tabs`）
- `popup.html`: 弹窗页面
- `popup.js`: 读取并渲染书签树、搜索过滤、点击打开新标签
- `popup.css`: 弹窗样式

- `index.html`: 网页版入口（自定义链接页）
- `app.js`: 网页版逻辑（增删改、渲染、导入导出）
- `storage.js`: 持久化（优先保存到用户选择的文件夹；localStorage 备份）
- `bookmarksHtml.js`: 书签 HTML 解析/生成
- `styles.css`: 网页版样式


