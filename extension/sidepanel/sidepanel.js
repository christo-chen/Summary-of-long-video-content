/**
 * SidePanel 主逻辑 - Phase 3b
 *
 * 新增：
 * - Tab 导航（摘要 / 历史）
 * - 登录/注册
 * - 生成摘要后自动保存到后端
 * - 历史记录列表（分页、搜索、筛选）
 * - 历史详情查看和删除
 */

const $ = (id) => document.getElementById(id);

// ===== Tab 切换 =====
const tabBtns = document.querySelectorAll(".tab-btn");
const pageAuth = $("page-auth");

tabBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    tabBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
    const target = $(btn.dataset.tab);
    if (target) target.classList.remove("hidden");

    // 切到历史页时自动加载
    if (btn.dataset.tab === "tab-history") loadHistory(true);
  });
});

function switchToTab(tabId) {
  tabBtns.forEach(b => {
    b.classList.toggle("active", b.dataset.tab === tabId);
  });
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  $(tabId).classList.remove("hidden");
}

// ===== 状态管理 =====
function showState(state) {
  ["state-idle","state-loading","state-error","state-result"].forEach(id => {
    $(id).classList.add("hidden");
  });
  $("state-" + state).classList.remove("hidden");
}

function showError(msg) {
  $("error-message").textContent = msg;
  showState("error");
}

function showToast(msg) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// ===== 认证 =====
async function updateAuthUI() {
  const loggedIn = await BackendApi.isLoggedIn();
  const userInfo = await BackendApi.getUserInfo();

  if (loggedIn && userInfo) {
    $("user-email").textContent = userInfo.email;
    $("settings-account").classList.remove("hidden");
    $("settings-email").textContent = userInfo.email;
  } else {
    $("user-email").textContent = "";
    $("settings-account").classList.add("hidden");
  }
}

function showAuthPage() {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  pageAuth.classList.remove("hidden");
}

$("btn-login").addEventListener("click", async () => {
  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;
  $("auth-error").classList.add("hidden");

  if (!email || !password) {
    $("auth-error").textContent = "请填写邮箱和密码";
    $("auth-error").classList.remove("hidden");
    return;
  }

  try {
    $("btn-login").disabled = true;
    $("btn-login").textContent = "登录中...";
    await BackendApi.login(email, password);
    showToast("登录成功 ✅");
    await updateAuthUI();
    switchToTab("tab-summary");
  } catch (e) {
    $("auth-error").textContent = e.message;
    $("auth-error").classList.remove("hidden");
  } finally {
    $("btn-login").disabled = false;
    $("btn-login").textContent = "登录";
  }
});

$("btn-register").addEventListener("click", async () => {
  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;
  $("auth-error").classList.add("hidden");

  if (!email || !password) {
    $("auth-error").textContent = "请填写邮箱和密码";
    $("auth-error").classList.remove("hidden");
    return;
  }
  if (password.length < 6) {
    $("auth-error").textContent = "密码至少6位";
    $("auth-error").classList.remove("hidden");
    return;
  }

  try {
    $("btn-register").disabled = true;
    $("btn-register").textContent = "注册中...";
    await BackendApi.register(email, password);
    showToast("注册成功 ✅");
    await updateAuthUI();
    switchToTab("tab-summary");
  } catch (e) {
    $("auth-error").textContent = e.message;
    $("auth-error").classList.remove("hidden");
  } finally {
    $("btn-register").disabled = false;
    $("btn-register").textContent = "注册新账号";
  }
});

$("btn-skip-login").addEventListener("click", () => {
  switchToTab("tab-summary");
});

$("btn-goto-login").addEventListener("click", showAuthPage);

$("btn-logout").addEventListener("click", async () => {
  await BackendApi.logout();
  await updateAuthUI();
  closeSettings();
  showToast("已退出登录");
});

// ===== 摘要生成 =====
let lastResult = null;
let lastSavedId = null;

const SOURCE_TYPE_LABELS = {
  article: "📄 文章", bilibili: "📺 B站视频", youtube: "▶️ YouTube",
  github: "🐙 GitHub", stackoverflow: "💡 StackOverflow",
};
const SOURCE_TYPE_COLORS = {
  article: "#2e86c1", bilibili: "#fb7299", youtube: "#ff0000",
  github: "#333333", stackoverflow: "#f48024",
};

async function generateSummary() {
  showState("loading");
  $("save-status").classList.add("hidden");

  try {
    const extractResponse = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "EXTRACT_CONTENT" }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });

    if (!extractResponse || !extractResponse.success) {
      throw new Error(extractResponse?.error || "内容提取失败，请刷新页面重试");
    }

    const { title, content, url, sourceType } = extractResponse.data;
    const result = await AiClient.generateSummary(sourceType, content);
    lastResult = { ...result, url, sourceType };

    renderResult(result, url, sourceType);
    showState("result");

    // 自动保存到后端
    autoSave(result, url, sourceType);

  } catch (err) {
    console.error("生成摘要失败：", err);
    showError(err.message);
  }
}

async function autoSave(result, url, sourceType) {
  const loggedIn = await BackendApi.isLoggedIn();
  if (!loggedIn) {
    $("save-status").classList.remove("hidden");
    $("save-status-text").textContent = "💡 登录后可自动保存到云端";
    return;
  }

  try {
    const saved = await BackendApi.saveSummary({
      url: url,
      title: result.title,
      sourceType: sourceType,
      summaryJson: result,
      language: "zh",
    });
    lastSavedId = saved.id;
    $("save-status").classList.remove("hidden");
    $("save-status-text").textContent = "✅ 已保存到云端";
  } catch (e) {
    console.warn("自动保存失败：", e);
    $("save-status").classList.remove("hidden");
    $("save-status-text").textContent = "⚠️ 保存失败：" + e.message;
  }
}

function renderResult(result, url, sourceType) {
  const badge = $("result-source-type");
  badge.textContent = SOURCE_TYPE_LABELS[sourceType] || "📄 文章";
  badge.style.background = (SOURCE_TYPE_COLORS[sourceType] || "#2e86c1") + "20";
  badge.style.color = SOURCE_TYPE_COLORS[sourceType] || "#2e86c1";

  $("result-url").href = url;
  $("result-url").textContent = url;
  $("result-title").textContent = result.title;
  $("result-summary").textContent = result.one_line_summary;

  const keypointsList = $("result-keypoints");
  keypointsList.innerHTML = "";
  if (result.key_points) {
    result.key_points.forEach(point => {
      const li = document.createElement("li");
      li.textContent = point;
      keypointsList.appendChild(li);
    });
  }

  renderMindmap(result.mindmap_markdown);
}

// ===== 思维导图 =====
let currentMarkmap = null;

function renderMindmap(markdown) {
  $("mindmap-markdown").textContent = markdown || "（暂无）";

  if (markdown && window.MarkmapLib) {
    try {
      const svgEl = $("mindmap-svg");
      svgEl.innerHTML = "";
      const { Transformer, Markmap } = window.MarkmapLib;
      const transformer = new Transformer();
      const { root } = transformer.transform(markdown);
      currentMarkmap = Markmap.create(svgEl, {
        autoFit: true, duration: 300, maxWidth: 200, paddingX: 16,
        color: (node) => {
          const colors = ["#2e86c1","#27ae60","#e67e22","#8e44ad","#e74c3c","#16a085"];
          return colors[node.state.depth % colors.length];
        },
      }, root);
      setTimeout(() => { if (currentMarkmap) currentMarkmap.fit(); }, 100);
    } catch (e) {
      $("mindmap-visual-container").classList.add("hidden");
      $("mindmap-text-container").classList.remove("hidden");
    }
  }
}

$("btn-mindmap-visual").addEventListener("click", () => {
  $("mindmap-visual-container").classList.remove("hidden");
  $("mindmap-text-container").classList.add("hidden");
  $("btn-mindmap-visual").classList.add("active");
  $("btn-mindmap-text").classList.remove("active");
  if (currentMarkmap) setTimeout(() => currentMarkmap.fit(), 50);
});

$("btn-mindmap-text").addEventListener("click", () => {
  $("mindmap-text-container").classList.remove("hidden");
  $("mindmap-visual-container").classList.add("hidden");
  $("btn-mindmap-text").classList.add("active");
  $("btn-mindmap-visual").classList.remove("active");
});

// ===== 复制 =====
function copySummary() {
  if (!lastResult) return;
  const text = [
    "# " + lastResult.title, "",
    "> " + lastResult.one_line_summary, "",
    "## 核心要点",
    ...lastResult.key_points.map((p, i) => (i+1) + ". " + p),
    "", "---", "来源：" + lastResult.url,
  ].join("\n");
  navigator.clipboard.writeText(text).then(() => showToast("已复制 ✅")).catch(() => showToast("复制失败"));
}

// ===== 导出功能（亮点 A）=====

function showExportStatus(text, type) {
  const el = $("export-status");
  el.textContent = text;
  el.className = "export-status " + type;
  el.classList.remove("hidden");
  if (type !== "loading") {
    setTimeout(() => el.classList.add("hidden"), 4000);
  }
}

// Notion 导出
$("btn-export-notion").addEventListener("click", async () => {
  const loggedIn = await BackendApi.isLoggedIn();
  if (!loggedIn) {
    showToast("请先登录后再导出");
    return;
  }
  if (!lastSavedId) {
    showToast("请先生成摘要并等待保存完成");
    return;
  }

  try {
    // 检查 Notion 绑定状态
    const status = await BackendApi.getNotionStatus();
    if (!status.connected) {
      // 未绑定，跳转授权
      showExportStatus("正在跳转 Notion 授权...", "loading");
      const authData = await BackendApi.getNotionAuthUrl();
      window.open(authData.authUrl, "_blank");
      showExportStatus("请在新窗口完成 Notion 授权，完成后重新点击导出", "loading");
      return;
    }

    // 已绑定，执行导出
    $("btn-export-notion").disabled = true;
    showExportStatus("正在导出到 Notion...", "loading");

    const result = await BackendApi.exportToNotion(lastSavedId);
    showExportStatus("✅ 已导出到 Notion", "success");
    showToast("导出成功！");

  } catch (e) {
    showExportStatus("❌ " + e.message, "error");
  } finally {
    $("btn-export-notion").disabled = false;
  }
});

// Obsidian 导出
$("btn-export-obsidian").addEventListener("click", async () => {
  const loggedIn = await BackendApi.isLoggedIn();
  if (!loggedIn || !lastSavedId) {
    // 未登录时直接本地生成 Markdown
    downloadLocalMarkdown("obsidian");
    return;
  }

  try {
    $("btn-export-obsidian").disabled = true;
    showExportStatus("正在生成 Obsidian Markdown...", "loading");

    const url = BackendApi.getObsidianDownloadUrl(lastSavedId);
    const filename = (lastResult ? lastResult.title : "summary") + ".md";
    await BackendApi.downloadFile(url, filename);

    showExportStatus("✅ 已下载 Obsidian Markdown", "success");
  } catch (e) {
    // 后端下载失败时降级到本地生成
    downloadLocalMarkdown("obsidian");
  } finally {
    $("btn-export-obsidian").disabled = false;
  }
});

// Logseq 导出
$("btn-export-logseq").addEventListener("click", async () => {
  const loggedIn = await BackendApi.isLoggedIn();
  if (!loggedIn || !lastSavedId) {
    downloadLocalMarkdown("logseq");
    return;
  }

  try {
    $("btn-export-logseq").disabled = true;
    showExportStatus("正在生成 Logseq Markdown...", "loading");

    const url = BackendApi.getLogseqDownloadUrl(lastSavedId);
    const filename = (lastResult ? lastResult.title : "summary") + ".md";
    await BackendApi.downloadFile(url, filename);

    showExportStatus("✅ 已下载 Logseq Markdown", "success");
  } catch (e) {
    downloadLocalMarkdown("logseq");
  } finally {
    $("btn-export-logseq").disabled = false;
  }
});

/**
 * 本地生成 Markdown 并下载（不依赖后端的降级方案）
 */
function downloadLocalMarkdown(format) {
  if (!lastResult) {
    showToast("请先生成摘要");
    return;
  }

  let content = "";
  const r = lastResult;

  if (format === "obsidian") {
    content = "---\n"
      + "title: \"" + r.title + "\"\n"
      + "source: " + r.url + "\n"
      + "type: " + r.sourceType + "\n"
      + "created: " + new Date().toISOString().slice(0, 16) + "\n"
      + "---\n\n"
      + "# " + r.title + "\n\n"
      + "> 来源: [原文链接](" + r.url + ")\n\n"
      + "## 💡 一句话摘要\n\n> " + r.one_line_summary + "\n\n"
      + "## 📌 核心要点\n\n"
      + r.key_points.map(p => "- " + p).join("\n") + "\n\n"
      + (r.mindmap_markdown ? "## 🗺️ 思维导图\n\n```\n" + r.mindmap_markdown + "\n```\n\n" : "")
      + "---\n*由 AI Summary Assistant 自动生成*\n";
  } else {
    // Logseq 大纲格式
    content = "- " + r.title + "\n"
      + "  - 来源:: [原文链接](" + r.url + ")\n"
      + "  - 类型:: " + r.sourceType + "\n"
      + "  - **一句话摘要**\n"
      + "    - " + r.one_line_summary + "\n"
      + "  - **核心要点**\n"
      + r.key_points.map(p => "    - " + p).join("\n") + "\n";
  }

  // 触发下载
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = r.title.replace(/[\\/:*?"<>|]/g, "_") + ".md";
  a.click();
  URL.revokeObjectURL(a.href);

  showExportStatus("✅ 已下载 " + (format === "obsidian" ? "Obsidian" : "Logseq") + " Markdown", "success");
}

// ===== 历史记录 =====
let historyPage = 1;
const historySize = 10;
let historyHasMore = false;

async function loadHistory(reset) {
  const loggedIn = await BackendApi.isLoggedIn();
  if (!loggedIn) {
    $("history-need-login").classList.remove("hidden");
    $("history-list").classList.add("hidden");
    $("history-empty").classList.add("hidden");
    $("btn-load-more").classList.add("hidden");
    return;
  }

  $("history-need-login").classList.add("hidden");
  $("history-list").classList.remove("hidden");

  if (reset) {
    historyPage = 1;
    $("history-list").innerHTML = "";
  }

  $("history-loading").classList.remove("hidden");
  $("btn-load-more").classList.add("hidden");

  try {
    const keyword = $("history-search").value.trim();
    const sourceType = $("history-filter").value;

    const data = await BackendApi.getSummaryList(historyPage, historySize, keyword, sourceType);
    const records = data.records || [];

    if (reset && records.length === 0) {
      $("history-empty").classList.remove("hidden");
    } else {
      $("history-empty").classList.add("hidden");
    }

    records.forEach(item => {
      $("history-list").appendChild(createHistoryItem(item));
    });

    historyHasMore = historyPage < data.pages;
    if (historyHasMore) {
      $("btn-load-more").classList.remove("hidden");
    }

  } catch (e) {
    console.error("加载历史记录失败：", e);
    showToast("加载失败：" + e.message);
  } finally {
    $("history-loading").classList.add("hidden");
  }
}

function createHistoryItem(item) {
  const div = document.createElement("div");
  div.className = "history-item";
  div.dataset.id = item.id;

  let summaryText = "";
  try {
    const json = typeof item.summaryJson === "string" ? JSON.parse(item.summaryJson) : item.summaryJson;
    summaryText = json.one_line_summary || "";
  } catch (e) { /* ignore */ }

  const time = item.createTime ? new Date(item.createTime).toLocaleDateString("zh-CN") : "";
  const typeBadge = SOURCE_TYPE_LABELS[item.sourceType] || "📄 文章";

  let tagsHtml = "";
  if (item.tags && item.tags.length > 0) {
    tagsHtml = item.tags.map(t => '<span class="history-tag">' + t.name + '</span>').join("");
  }

  div.innerHTML =
    '<div class="history-item-header">' +
      '<span class="history-item-title">' + escapeHtml(item.title) + '</span>' +
      '<span class="history-item-badge">' + typeBadge + '</span>' +
    '</div>' +
    '<div class="history-item-summary">' + escapeHtml(summaryText) + '</div>' +
    '<div class="history-item-footer">' +
      '<span class="history-item-time">' + time + '</span>' +
      '<div class="history-item-tags">' + tagsHtml + '</div>' +
    '</div>';

  div.addEventListener("click", () => openHistoryDetail(item.id));
  return div;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// 搜索与筛选
let searchTimer = null;
$("history-search").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadHistory(true), 400);
});
$("history-filter").addEventListener("change", () => loadHistory(true));

$("btn-load-more").addEventListener("click", () => {
  historyPage++;
  loadHistory(false);
});

// ===== 历史详情 =====
async function openHistoryDetail(id) {
  try {
    const item = await BackendApi.getSummaryDetail(id);
    let json = {};
    try {
      json = typeof item.summaryJson === "string" ? JSON.parse(item.summaryJson) : item.summaryJson;
    } catch (e) { /* ignore */ }

    $("detail-title").textContent = item.title;
    $("detail-source-type").textContent = SOURCE_TYPE_LABELS[item.sourceType] || "文章";
    $("detail-url").href = item.url;
    $("detail-url").textContent = item.url;
    $("detail-summary").textContent = json.one_line_summary || "";

    const kpList = $("detail-keypoints");
    kpList.innerHTML = "";
    if (json.key_points) {
      json.key_points.forEach(point => {
        const li = document.createElement("li");
        li.textContent = point;
        kpList.appendChild(li);
      });
    }

    $("btn-detail-delete").onclick = async () => {
      if (confirm("确定删除这条摘要？")) {
        try {
          await BackendApi.deleteSummary(id);
          showToast("已删除 ✅");
          $("history-detail-overlay").classList.add("hidden");
          loadHistory(true);
        } catch (e) {
          showToast("删除失败：" + e.message);
        }
      }
    };

    $("history-detail-overlay").classList.remove("hidden");
  } catch (e) {
    showToast("加载详情失败：" + e.message);
  }
}

$("btn-close-detail").addEventListener("click", () => {
  $("history-detail-overlay").classList.add("hidden");
});

$("history-detail-overlay").addEventListener("click", (e) => {
  if (e.target === $("history-detail-overlay")) {
    $("history-detail-overlay").classList.add("hidden");
  }
});

// ===== 设置 =====
async function openSettings() {
  const config = await AiClient.getConfig();
  $("select-provider").value = config.provider;
  $("input-apikey").value = config.apiKey;
  await updateAuthUI();
  $("settings-overlay").classList.remove("hidden");
}

function closeSettings() { $("settings-overlay").classList.add("hidden"); }

async function saveSettings() {
  const config = await AiClient.getConfig();
  config.provider = $("select-provider").value;
  config.apiKey = $("input-apikey").value.trim();
  await AiClient.saveConfig(config);
  showToast("设置已保存 ✅");
  closeSettings();
}

// ===== 事件绑定 =====
$("btn-generate").addEventListener("click", generateSummary);
$("btn-retry").addEventListener("click", generateSummary);
$("btn-copy").addEventListener("click", copySummary);
$("btn-new").addEventListener("click", () => {
  $("mindmap-visual-container").classList.remove("hidden");
  $("mindmap-text-container").classList.add("hidden");
  $("btn-mindmap-visual").classList.add("active");
  $("btn-mindmap-text").classList.remove("active");
  currentMarkmap = null;
  lastSavedId = null;
  $("save-status").classList.add("hidden");
  showState("idle");
});

$("btn-settings").addEventListener("click", openSettings);
$("btn-close-settings").addEventListener("click", closeSettings);
$("btn-save-settings").addEventListener("click", saveSettings);
$("settings-overlay").addEventListener("click", (e) => {
  if (e.target === $("settings-overlay")) closeSettings();
});

// ===== 初始化 =====
(async function init() {
  const config = await AiClient.getConfig();
  const loggedIn = await BackendApi.isLoggedIn();

  await updateAuthUI();

  // 没设置 API Key 则打开设置
  if (!config.apiKey) {
    setTimeout(openSettings, 300);
  }

  // 未登录且首次使用，显示登录页
  if (!loggedIn) {
    const hasSkipped = await new Promise(r => chrome.storage.local.get("hasSkippedLogin", res => r(res.hasSkippedLogin)));
    if (!hasSkipped) {
      showAuthPage();
      // 记录已展示过登录页
      $("btn-skip-login").addEventListener("click", () => {
        chrome.storage.local.set({ hasSkippedLogin: true });
      }, { once: true });
    }
  }
})();
