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
    $("auth-error").textContent = I18n.t("authEmailAndPwdRequired");
    $("auth-error").classList.remove("hidden");
    return;
  }

  try {
    $("btn-login").disabled = true;
    $("btn-login").textContent = I18n.t("btnLoginLoading");
    await BackendApi.login(email, password);
    showToast(I18n.t("loginSuccess"));
    await updateAuthUI();
    switchToTab("tab-summary");
  } catch (e) {
    $("auth-error").textContent = e.message;
    $("auth-error").classList.remove("hidden");
  } finally {
    $("btn-login").disabled = false;
    $("btn-login").textContent = I18n.t("btnLogin");
  }
});

$("btn-register").addEventListener("click", async () => {
  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;
  $("auth-error").classList.add("hidden");

  if (!email || !password) {
    $("auth-error").textContent = I18n.t("authEmailAndPwdRequired");
    $("auth-error").classList.remove("hidden");
    return;
  }
  if (password.length < 6) {
    $("auth-error").textContent = I18n.t("authPwdTooShort");
    $("auth-error").classList.remove("hidden");
    return;
  }

  try {
    $("btn-register").disabled = true;
    $("btn-register").textContent = I18n.t("btnRegisterLoading");
    await BackendApi.register(email, password);
    showToast(I18n.t("registerSuccess"));
    await updateAuthUI();
    switchToTab("tab-summary");
  } catch (e) {
    $("auth-error").textContent = e.message;
    $("auth-error").classList.remove("hidden");
  } finally {
    $("btn-register").disabled = false;
    $("btn-register").textContent = I18n.t("btnRegister");
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
  showToast(I18n.t("loggedOut"));
});

// ===== 摘要生成 =====
let lastResult = null;
let lastSavedId = null;

const SOURCE_TYPE_LABELS = {
  article: "📄 文章", bilibili: "📺 B站视频", youtube: "▶️ YouTube",
  github: "🐙 GitHub", stackoverflow: "💡 StackOverflow",
};
function getSourceLabel(type) {
  return I18n.sourceLabel(type);
}
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
      throw new Error(extractResponse?.error || (I18n.currentLang === "en" ? "Content extraction failed, please refresh the page" : "内容提取失败，请刷新页面重试"));
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
    $("save-status-text").textContent = I18n.t("loginToSave");
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
    $("save-status-text").textContent = I18n.t("savedToCloud");
  } catch (e) {
    console.warn("自动保存失败：", e);
    $("save-status").classList.remove("hidden");
    $("save-status-text").textContent = I18n.t("saveFailed") + e.message;
  }
}

function renderResult(result, url, sourceType) {
  const badge = $("result-source-type");
  badge.textContent = getSourceLabel(sourceType);
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

  // Reset translate button
  isTranslated = false;
  $("btn-translate").textContent = I18n.t("btnTranslate");
  $("btn-translate").disabled = false;
}

// ===== 思维导图 =====
let currentMarkmap = null;
let fullscreenMarkmap = null;
let lastMarkmapMarkdown = null;

function renderMindmap(markdown) {
  lastMarkmapMarkdown = markdown;
  $("mindmap-markdown").textContent = markdown || (I18n.currentLang === "en" ? "(None)" : "（暂无）");

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

// ===== 思维导图全屏 =====
$("btn-mindmap-fullscreen").addEventListener("click", () => {
  if (!lastMarkmapMarkdown || !window.MarkmapLib) {
    showToast(I18n.currentLang === "en" ? "No mind map to display" : "暂无思维导图");
    return;
  }

  $("mindmap-fullscreen-overlay").classList.remove("hidden");

  // 渲染全屏版思维导图
  setTimeout(() => {
    try {
      const svgEl = $("mindmap-svg-fullscreen");
      svgEl.innerHTML = "";
      const { Transformer, Markmap } = window.MarkmapLib;
      const transformer = new Transformer();
      const { root } = transformer.transform(lastMarkmapMarkdown);
      fullscreenMarkmap = Markmap.create(svgEl, {
        autoFit: true, duration: 300, maxWidth: 300, paddingX: 20,
        color: (node) => {
          const colors = ["#2e86c1","#27ae60","#e67e22","#8e44ad","#e74c3c","#16a085"];
          return colors[node.state.depth % colors.length];
        },
      }, root);
      setTimeout(() => { if (fullscreenMarkmap) fullscreenMarkmap.fit(); }, 150);
    } catch (e) {
      console.error("全屏思维导图渲染失败:", e);
    }
  }, 50);
});

$("btn-fs-close").addEventListener("click", () => {
  $("mindmap-fullscreen-overlay").classList.add("hidden");
  if (fullscreenMarkmap) {
    fullscreenMarkmap = null;
    $("mindmap-svg-fullscreen").innerHTML = "";
  }
});

// ===== 导出思维导图 PNG =====
function exportMindmapPng(svgElement) {
  if (!svgElement || !svgElement.querySelector("g")) {
    showToast(I18n.currentLang === "en" ? "No mind map to export" : "暂无思维导图可导出");
    return;
  }

  try {
    // 获取 SVG 实际内容边界
    const svgRect = svgElement.getBoundingClientRect();
    const padding = 60;
    const width = Math.max(svgRect.width, 800);
    const height = Math.max(svgRect.height, 600);

    // 获取当前 viewBox 或使用 SVG 尺寸
    let viewBox = svgElement.getAttribute("viewBox");
    if (!viewBox) {
      viewBox = "0 0 " + width + " " + height;
    }

    // 克隆 SVG
    const clone = svgElement.cloneNode(true);

    // 收集页面中所有相关的 <style> 内容
    let styleText = "";
    document.querySelectorAll("style").forEach(s => { styleText += s.textContent; });

    // 注入内联样式到克隆的 SVG
    const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
    styleEl.textContent = styleText;
    clone.insertBefore(styleEl, clone.firstChild);

    // 确保设置 xmlns
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // 解析 viewBox 来设置导出尺寸
    const vbParts = viewBox.split(/[\s,]+/).map(Number);
    const vbW = vbParts[2] || width;
    const vbH = vbParts[3] || height;
    const exportW = vbW + padding * 2;
    const exportH = vbH + padding * 2;

    clone.setAttribute("width", exportW);
    clone.setAttribute("height", exportH);
    clone.setAttribute("viewBox", (vbParts[0] - padding) + " " + (vbParts[1] - padding) + " " + exportW + " " + exportH);

    // 添加白色背景作为第一个子元素（在 style 之后）
    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("x", vbParts[0] - padding);
    bgRect.setAttribute("y", vbParts[1] - padding);
    bgRect.setAttribute("width", exportW);
    bgRect.setAttribute("height", exportH);
    bgRect.setAttribute("fill", "#ffffff");
    // 插到 style 之后
    if (clone.children.length > 1) {
      clone.insertBefore(bgRect, clone.children[1]);
    } else {
      clone.appendChild(bgRect);
    }

    // 序列化
    const serializer = new XMLSerializer();
    let svgStr = serializer.serializeToString(clone);

    // 确保 XML 声明
    if (!svgStr.startsWith("<?xml")) {
      svgStr = '<?xml version="1.0" encoding="UTF-8"?>' + svgStr;
    }

    // 方案 A：直接用 data URI（比 Blob URL 更兼容 Chrome 扩展环境）
    const svgBase64 = btoa(unescape(encodeURIComponent(svgStr)));
    const dataUri = "data:image/svg+xml;base64," + svgBase64;

    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = exportW * scale;
    canvas.height = exportH * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, exportW, exportH);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, exportW, exportH);
      canvas.toBlob((blob) => {
        if (!blob) {
          showToast(I18n.currentLang === "en" ? "Export failed" : "导出失败");
          return;
        }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = (lastResult ? lastResult.title : "mindmap").replace(/[\\/:*?"<>|]/g, "_") + "_mindmap.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        showToast(I18n.currentLang === "en" ? "PNG exported ✅" : "PNG 已导出 ✅");
      }, "image/png");
    };

    img.onerror = (e) => {
      console.error("PNG img load error:", e);
      // 方案 B 降级：直接导出 SVG 文件
      const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(svgBlob);
      a.download = (lastResult ? lastResult.title : "mindmap").replace(/[\\/:*?"<>|]/g, "_") + "_mindmap.svg";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      showToast(I18n.currentLang === "en" ? "Saved as SVG (PNG not supported in this context)" : "已保存为 SVG（当前环境不支持 PNG）");
    };

    img.src = dataUri;

  } catch (e) {
    console.error("导出失败:", e);
    showToast(I18n.currentLang === "en" ? "Export failed: " + e.message : "导出失败：" + e.message);
  }
}

$("btn-mindmap-export-png").addEventListener("click", () => {
  exportMindmapPng($("mindmap-svg"));
});

$("btn-fs-export-png").addEventListener("click", () => {
  exportMindmapPng($("mindmap-svg-fullscreen"));
});

// ===== 导出 PDF =====
$("btn-export-pdf").addEventListener("click", () => {
  if (!lastResult) {
    showToast(I18n.t("exportNeedGenerate"));
    return;
  }

  try {
    $("btn-export-pdf").disabled = true;
    showExportStatus(I18n.currentLang === "en" ? "Generating PDF..." : "正在生成 PDF...", "loading");

    const r = lastResult;
    const isEn = I18n.currentLang === "en";

    const html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
      + '<title>' + r.title + '</title>'
      + '<style>'
      + 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;color:#2c3e50;line-height:1.7;}'
      + 'h1{font-size:22px;border-bottom:2px solid #2e86c1;padding-bottom:8px;margin-bottom:16px;}'
      + '.meta{color:#7f8c8d;font-size:13px;margin-bottom:20px;}'
      + '.meta a{color:#2e86c1;}'
      + '.summary-box{background:#eaf2f8;border-left:4px solid #2e86c1;padding:12px 16px;margin:16px 0;border-radius:4px;font-size:15px;}'
      + 'h2{font-size:17px;color:#2e86c1;margin:24px 0 12px;}'
      + 'ul{padding-left:20px;}'
      + 'li{margin:8px 0;}'
      + '.mindmap-section{background:#f8f9fa;padding:16px;border-radius:6px;margin-top:16px;}'
      + '.mindmap-section pre{white-space:pre-wrap;font-size:13px;line-height:1.6;}'
      + '.footer{margin-top:32px;padding-top:12px;border-top:1px solid #eee;color:#aaa;font-size:12px;text-align:center;}'
      + '@media print{body{margin:20px;}}'
      + '</style></head><body>'
      + '<h1>' + escapeHtml(r.title) + '</h1>'
      + '<div class="meta"><span>' + (r.sourceType || "article") + '</span> · <a href="' + r.url + '">' + (isEn ? "Source Link" : "原文链接") + '</a></div>'
      + '<div class="summary-box">' + escapeHtml(r.one_line_summary) + '</div>'
      + '<h2>' + (isEn ? "Key Points" : "📌 核心要点") + '</h2><ul>'
      + r.key_points.map(p => '<li>' + escapeHtml(p) + '</li>').join("")
      + '</ul>'
      + (r.mindmap_markdown ? '<h2>' + (isEn ? "Mind Map" : "🗺️ 思维导图") + '</h2><div class="mindmap-section"><pre>' + escapeHtml(r.mindmap_markdown) + '</pre></div>' : '')
      + '<div class="footer">' + (isEn ? "Generated by AI Summary Assistant" : "由 AI Summary Assistant 自动生成") + ' · ' + new Date().toLocaleDateString() + '</div>'
      + '</body></html>';

    // 打开新窗口触发打印
    const printWindow = window.open("", "_blank");
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 300);
    };

    showExportStatus(I18n.currentLang === "en" ? "✅ PDF ready - use print dialog to save" : "✅ PDF 已准备 - 在打印对话框中保存", "success");

  } catch (e) {
    showExportStatus("❌ " + e.message, "error");
  } finally {
    $("btn-export-pdf").disabled = false;
  }
});

// ===== 复制 =====
function copySummary() {
  if (!lastResult) return;
  const text = [
    "# " + lastResult.title, "",
    "> " + lastResult.one_line_summary, "",
    "## " + I18n.t("copyKeyPoints"),
    ...lastResult.key_points.map((p, i) => (i+1) + ". " + p),
    "", "---", I18n.t("copySource") + lastResult.url,
  ].join("\n");
  navigator.clipboard.writeText(text).then(() => showToast(I18n.t("copied"))).catch(() => showToast(I18n.t("copyFailed")));
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
    showToast(I18n.t("exportNotionLogin"));
    return;
  }
  if (!lastSavedId) {
    showToast(I18n.t("exportNeedSummary"));
    return;
  }

  try {
    // 检查 Notion 绑定状态
    const status = await BackendApi.getNotionStatus();
    if (!status.connected) {
      // 未绑定，跳转授权
      showExportStatus(I18n.t("exportNotionRedirect"), "loading");
      const authData = await BackendApi.getNotionAuthUrl();
      window.open(authData.authUrl, "_blank");
      showExportStatus(I18n.t("exportNotionAuth"), "loading");
      return;
    }

    // 已绑定，执行导出
    $("btn-export-notion").disabled = true;
    showExportStatus(I18n.t("exportNotionLoading"), "loading");

    const result = await BackendApi.exportToNotion(lastSavedId);
    showExportStatus(I18n.t("exportNotionSuccess"), "success");
    showToast(I18n.t("exportSuccess"));

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
    showExportStatus(I18n.t("exportObsidianLoading"), "loading");

    const url = BackendApi.getObsidianDownloadUrl(lastSavedId);
    const filename = (lastResult ? lastResult.title : "summary") + ".md";
    await BackendApi.downloadFile(url, filename);

    showExportStatus(I18n.t("exportObsidianSuccess"), "success");
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
    showExportStatus(I18n.t("exportLogseqLoading"), "loading");

    const url = BackendApi.getLogseqDownloadUrl(lastSavedId);
    const filename = (lastResult ? lastResult.title : "summary") + ".md";
    await BackendApi.downloadFile(url, filename);

    showExportStatus(I18n.t("exportLogseqSuccess"), "success");
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
    showToast(I18n.t("exportNeedGenerate"));
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

  showExportStatus("✅ " + (format === "obsidian" ? "Obsidian" : "Logseq") + " Markdown ✓", "success");
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
    showToast(I18n.t("historyLoadFailed") + e.message);
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

  const time = item.createTime ? new Date(item.createTime).toLocaleDateString(I18n.currentLang === "zh" ? "zh-CN" : "en-US") : "";
  const typeBadge = getSourceLabel(item.sourceType);

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
    $("detail-source-type").textContent = getSourceLabel(item.sourceType);
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
      if (confirm(I18n.t("confirmDelete"))) {
        try {
          await BackendApi.deleteSummary(id);
          showToast(I18n.t("deleted"));
          $("history-detail-overlay").classList.add("hidden");
          loadHistory(true);
        } catch (e) {
          showToast(I18n.t("deleteFailed") + e.message);
        }
      }
    };

    $("history-detail-overlay").classList.remove("hidden");
  } catch (e) {
    showToast(I18n.t("historyDetailFailed") + e.message);
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
  $("select-lang").value = I18n.currentLang;
  await updateAuthUI();
  $("settings-overlay").classList.remove("hidden");
}

function closeSettings() { $("settings-overlay").classList.add("hidden"); }

async function saveSettings() {
  const config = await AiClient.getConfig();
  config.provider = $("select-provider").value;
  config.apiKey = $("input-apikey").value.trim();
  await AiClient.saveConfig(config);

  // Save language
  const newLang = $("select-lang").value;
  if (newLang !== I18n.currentLang) {
    await I18n.save(newLang);
    I18n.applyToUI();
  }

  showToast(I18n.t("settingsSaved"));
  closeSettings();
}

// ===== 翻译功能 =====
let isTranslated = false;
let originalResult = null;

$("btn-translate").addEventListener("click", async () => {
  if (!lastResult) {
    showToast(I18n.t("exportNeedGenerate"));
    return;
  }

  if (isTranslated && originalResult) {
    // 切回原文
    lastResult = { ...originalResult };
    renderResult(originalResult, originalResult.url, originalResult.sourceType);
    isTranslated = false;
    $("btn-translate").textContent = I18n.t("btnTranslate");
    return;
  }

  // 保存原文
  originalResult = { ...lastResult };

  try {
    $("btn-translate").disabled = true;
    $("btn-translate").textContent = I18n.t("btnTranslating");

    // 检测当前摘要语言，决定翻译方向
    const isChineseContent = /[\u4e00-\u9fff]/.test(lastResult.one_line_summary);
    const targetLang = isChineseContent ? "English" : "中文";

    // 构建翻译内容
    const toTranslate = JSON.stringify({
      title: lastResult.title,
      one_line_summary: lastResult.one_line_summary,
      key_points: lastResult.key_points,
      mindmap_markdown: lastResult.mindmap_markdown || "",
    });

    const config = await AiClient.getConfig();
    if (!config.apiKey) {
      throw new Error("No API Key");
    }

    let baseUrl, model;
    if (config.provider === "openai") {
      baseUrl = config.openaiBaseUrl;
      model = config.openaiModel;
    } else {
      baseUrl = config.deepseekBaseUrl;
      model = config.deepseekModel;
    }

    const response = await fetch(baseUrl + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + config.apiKey,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: "You are a professional translator. Translate the following JSON content to " + targetLang + ". Keep the exact same JSON structure and keys. Only translate the values. For mindmap_markdown, translate the text content but keep the Markdown heading syntax (#, ##, ###, -) intact. Return ONLY valid JSON, no extra text or markdown code blocks."
          },
          { role: "user", content: toTranslate }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error("API " + response.status);
    }

    const data = await response.json();
    let text = data.choices[0].message.content.trim();

    // 清理可能的 markdown 代码块
    if (text.startsWith("```json")) text = text.slice(7);
    else if (text.startsWith("```")) text = text.slice(3);
    if (text.endsWith("```")) text = text.slice(0, -3);
    text = text.trim();

    const translated = JSON.parse(text);

    // 更新显示
    lastResult = {
      ...lastResult,
      title: translated.title || lastResult.title,
      one_line_summary: translated.one_line_summary || lastResult.one_line_summary,
      key_points: translated.key_points || lastResult.key_points,
      mindmap_markdown: translated.mindmap_markdown || lastResult.mindmap_markdown,
    };

    $("result-title").textContent = lastResult.title;
    $("result-summary").textContent = lastResult.one_line_summary;

    const keypointsList = $("result-keypoints");
    keypointsList.innerHTML = "";
    lastResult.key_points.forEach(point => {
      const li = document.createElement("li");
      li.textContent = point;
      keypointsList.appendChild(li);
    });

    // 重新渲染思维导图
    renderMindmap(lastResult.mindmap_markdown);

    isTranslated = true;
    $("btn-translate").textContent = I18n.t("btnTranslated") + " ↩";
    $("btn-translate").disabled = false;

  } catch (e) {
    console.error("翻译失败：", e);
    showToast(I18n.t("translateFailed") + e.message);
    $("btn-translate").textContent = I18n.t("btnTranslate");
    $("btn-translate").disabled = false;
  }
});

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
  isTranslated = false;
  originalResult = null;
  $("btn-translate").textContent = I18n.t("btnTranslate");
  $("btn-translate").disabled = false;
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
  // 加载语言偏好并应用
  await I18n.load();
  I18n.applyToUI();

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
