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
  ["state-idle","state-manual","state-loading","state-error","state-result"].forEach(id => {
    $(id).classList.add("hidden");
  });
  $("state-" + state).classList.remove("hidden");
}

let currentRetryHandler = generateSummary;

function showError(msg, showSettingsBtn = false, retryHandler = null) {
  $("error-message").textContent = msg;
  const settingsBtn = $("btn-error-goto-settings");
  if (showSettingsBtn) {
    settingsBtn.classList.remove("hidden");
  } else {
    settingsBtn.classList.add("hidden");
  }
  currentRetryHandler = retryHandler || generateSummary;
  $("btn-retry").textContent = retryHandler === uploadSelectedAudio ? I18n.t("audioRetryUpload") : I18n.t("btnRetry");
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
  github: "#333333", stackoverflow: "#f48024", audio: "#16a085",
};

const AUDIO_MAX_BYTES = 50 * 1024 * 1024;
const AUDIO_MAX_DURATION_SECONDS = 30 * 60;
const ASR_POLL_INTERVAL_MS = 3000;
const ASR_FRONTEND_TIMEOUT_MS = 42 * 60 * 1000;
const ASR_MAX_NETWORK_FAILURES = 4;
const ASR_STORAGE_KEY = "activeAsrJob";
const AUDIO_ALLOWED_EXTENSIONS = new Set(["mp3", "m4a", "wav", "aac", "flac", "mp4"]);
const AUDIO_ALLOWED_MIME = new Set([
  "audio/mpeg", "audio/mp3", "audio/x-mpeg", "audio/mpeg3", "audio/x-mpeg-3",
  "audio/mp4", "audio/m4a", "audio/x-m4a",
  "audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave",
  "audio/aac", "audio/x-aac", "audio/aacp",
  "audio/flac", "audio/x-flac", "application/flac",
  "video/mp4", "application/mp4",
]);

let audioSelectedFile = null;
let audioSelectedDuration = null;
let asrPollTimer = null;
let asrElapsedTimer = null;
let activeAsrJob = null;
let asrNetworkFailures = 0;

function formatText(template, vars) {
  return Object.keys(vars).reduce((text, key) => (
    text.replace(new RegExp("\\{" + key + "\\}", "g"), vars[key])
  ), template);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + " KB";
  return bytes + " B";
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return mins + ":" + String(secs).padStart(2, "0");
}

function formatElapsed(startedAt) {
  const elapsedMs = Math.max(0, Date.now() - startedAt);
  const mins = Math.floor(elapsedMs / 60000);
  const secs = Math.floor((elapsedMs % 60000) / 1000);
  return mins + ":" + String(secs).padStart(2, "0");
}

function getFileExtension(file) {
  const name = file?.name || "";
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function getAudioSourceUrl(fileName) {
  return "audio://" + encodeURIComponent(fileName || "uploaded-audio");
}

function setAudioWarning(message) {
  const warning = $("audio-upload-warning");
  if (message) {
    warning.textContent = message;
    warning.classList.remove("hidden");
  } else {
    warning.textContent = "";
    warning.classList.add("hidden");
  }
}

function setAudioControlsDisabled(disabled) {
  $("btn-choose-audio").disabled = disabled;
  $("btn-upload-audio").disabled = disabled;
  $("audio-file-input").disabled = disabled;
}

function readMediaDuration(file) {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    const objectUrl = URL.createObjectURL(file);
    let settled = false;

    const finish = (duration) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objectUrl);
      audio.removeAttribute("src");
      audio.load();
      resolve(duration);
    };

    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : null;
      finish(duration);
    };
    audio.onerror = () => finish(null);
    audio.src = objectUrl;

    setTimeout(() => finish(null), 5000);
  });
}

async function handleAudioFileSelected(file) {
  audioSelectedFile = null;
  audioSelectedDuration = null;
  $("btn-upload-audio").classList.add("hidden");
  $("audio-file-info").classList.add("hidden");
  setAudioWarning("");

  if (!file) return;

  const extension = getFileExtension(file);
  if (!AUDIO_ALLOWED_EXTENSIONS.has(extension)) {
    setAudioWarning(I18n.t("audioUnsupportedExtension"));
    return;
  }

  if (file.size > AUDIO_MAX_BYTES) {
    setAudioWarning(I18n.t("audioFileTooLarge"));
    return;
  }

  const warnings = [];
  const normalizedMime = (file.type || "").trim().toLowerCase();
  if (normalizedMime && !AUDIO_ALLOWED_MIME.has(normalizedMime)) {
    warnings.push(I18n.t("audioMimeWarning"));
  }

  const duration = await readMediaDuration(file);
  audioSelectedDuration = duration;
  if (duration == null) {
    warnings.push(I18n.t("audioDurationUnknown"));
  } else if (duration > AUDIO_MAX_DURATION_SECONDS) {
    warnings.push(I18n.t("audioDurationTooLong"));
  }

  audioSelectedFile = file;
  $("audio-file-name").textContent = file.name;
  const metaKey = duration == null ? "audioSelectedMeta" : "audioSelectedMetaWithDuration";
  $("audio-file-meta").textContent = formatText(I18n.t(metaKey), {
    size: formatBytes(file.size),
    duration: formatDuration(duration),
  });
  $("audio-file-info").classList.remove("hidden");
  $("btn-upload-audio").classList.remove("hidden");
  setAudioWarning(warnings.join(" "));
}

function clearAsrPolling() {
  if (asrPollTimer) {
    clearTimeout(asrPollTimer);
    asrPollTimer = null;
  }
  if (asrElapsedTimer) {
    clearInterval(asrElapsedTimer);
    asrElapsedTimer = null;
  }
}

function saveActiveAsrJob(job) {
  return new Promise((resolve) => chrome.storage.local.set({ [ASR_STORAGE_KEY]: job }, resolve));
}

function clearActiveAsrJob() {
  activeAsrJob = null;
  return new Promise((resolve) => chrome.storage.local.remove(ASR_STORAGE_KEY, resolve));
}

function getActiveAsrJob() {
  return new Promise((resolve) => chrome.storage.local.get(ASR_STORAGE_KEY, res => resolve(res[ASR_STORAGE_KEY] || null)));
}

function updateAsrLoadingText(statusTextKey = "audioTranscribing", retryCount = null) {
  if (!activeAsrJob) return;
  const elapsed = formatElapsed(activeAsrJob.startedAt);
  $("loading-text-main").textContent = I18n.t(statusTextKey);
  const subKey = retryCount == null ? "audioLongTaskHint" : "audioNetworkRetry";
  $("loading-sub").textContent = formatText(I18n.t(subKey), {
    elapsed,
    count: retryCount,
    jobId: activeAsrJob.jobId,
  });
}

function startAsrElapsedTicker(statusTextKey = "audioTranscribing") {
  if (asrElapsedTimer) clearInterval(asrElapsedTimer);
  updateAsrLoadingText(statusTextKey);
  asrElapsedTimer = setInterval(() => updateAsrLoadingText(statusTextKey), 1000);
}

function mapAsrError(errorCode, fallbackMessage, status) {
  if (status === 401 || status === 403) return I18n.t("audioLoginRequired");
  if (status === 413 || errorCode === "ASR_FILE_TOO_LARGE") return I18n.t("audioFileTooLarge");
  if (errorCode === "ASR_TIMEOUT") return I18n.t("audioTimeout");
  if (errorCode === "FILE_NORMALIZE_FAILED") return I18n.t("audioNormalizeFailed");
  if (errorCode === "ASR_TASK_FAILED" || errorCode === "ASR_FAILED") return I18n.t("audioFailed");
  if (errorCode === "ASR_TASK_CANCELED") return I18n.t("audioFailed");
  if (errorCode === "ASR_TRANSCRIPTION_URL_MISSING") return I18n.t("audioFailed");
  if (errorCode === "ASR_UNSUPPORTED_EXTENSION") return I18n.t("audioUnsupportedExtension");
  if (errorCode === "ASR_UNSUPPORTED_MIME") return I18n.t("audioFailed");
  if (fallbackMessage && !/^ASR_|FILE_/.test(fallbackMessage)) return fallbackMessage;
  return I18n.t("audioUnknownError");
}

function handleAsrFailure(message) {
  clearAsrPolling();
  setAudioControlsDisabled(false);
  showError(message, false, audioSelectedFile ? uploadSelectedAudio : () => showState("idle"));
}

async function uploadSelectedAudio() {
  if (!audioSelectedFile) {
    showError(I18n.t("audioUnsupportedExtension"), false, () => showState("idle"));
    return;
  }

  const token = await BackendApi.getToken();
  if (!token) {
    showError(I18n.t("audioLoginRequired"), false, showAuthPage);
    return;
  }

  clearAsrPolling();
  setAudioControlsDisabled(true);
  $("save-status").classList.add("hidden");
  $("proxy-reminder").classList.add("hidden");
  $("loading-text-main").textContent = I18n.t("audioUploading");
  $("loading-sub").textContent = I18n.t("audioUploadHint");
  showState("loading");

  try {
    const created = await BackendApi.uploadAudioForSummary(audioSelectedFile);
    const job = {
      jobId: created.jobId,
      status: created.status,
      fileName: audioSelectedFile.name,
      fileSize: audioSelectedFile.size,
      startedAt: Date.now(),
      sourceUrl: getAudioSourceUrl(audioSelectedFile.name),
    };
    activeAsrJob = job;
    asrNetworkFailures = 0;
    await saveActiveAsrJob(job);
    startAsrElapsedTicker(created.status === "QUEUED" ? "audioJobQueued" : "audioTranscribing");
    pollAsrJob();
  } catch (e) {
    setAudioControlsDisabled(false);
    const message = e.status ? mapAsrError(e.errorCode, e.message, e.status) : I18n.t("audioNetworkError");
    handleAsrFailure(message);
  }
}

async function pollAsrJob() {
  if (!activeAsrJob) return;

  if (Date.now() - activeAsrJob.startedAt > ASR_FRONTEND_TIMEOUT_MS) {
    await clearActiveAsrJob();
    handleAsrFailure(I18n.t("audioTimeout"));
    return;
  }

  try {
    const status = await BackendApi.getAsrJob(activeAsrJob.jobId);
    asrNetworkFailures = 0;
    activeAsrJob.status = status.status;
    await saveActiveAsrJob(activeAsrJob);

    if (status.status === "QUEUED" || status.status === "RUNNING") {
      startAsrElapsedTicker(status.status === "QUEUED" ? "audioJobQueued" : "audioTranscribing");
      asrPollTimer = setTimeout(pollAsrJob, ASR_POLL_INTERVAL_MS);
      return;
    }

    if (status.status === "SUCCEEDED") {
      const completedJob = { ...activeAsrJob };
      clearAsrPolling();
      await clearActiveAsrJob();
      setAudioControlsDisabled(false);
      const summary = status.summary || {};
      const url = completedJob.sourceUrl || getAudioSourceUrl(completedJob.fileName);
      lastResult = { ...summary, url, sourceType: "audio", durationSeconds: status.durationSeconds };
      renderResult(summary, url, "audio");
      showState("result");
      showProxyReminderIfNeeded(summary);
      autoSave(summary, url, "audio");
      return;
    }

    if (status.status === "FAILED") {
      await clearActiveAsrJob();
      handleAsrFailure(mapAsrError(status.errorCode, null));
      return;
    }

    asrPollTimer = setTimeout(pollAsrJob, ASR_POLL_INTERVAL_MS);
  } catch (e) {
    asrNetworkFailures++;
    if (e.status === 401 || e.status === 403) {
      await clearActiveAsrJob();
      handleAsrFailure(I18n.t("audioLoginRequired"));
      return;
    }
    if (asrNetworkFailures <= ASR_MAX_NETWORK_FAILURES) {
      updateAsrLoadingText("audioTranscribing", asrNetworkFailures);
      asrPollTimer = setTimeout(pollAsrJob, ASR_POLL_INTERVAL_MS);
      return;
    }
    await clearActiveAsrJob();
    handleAsrFailure(I18n.t("audioNetworkError"));
  }
}

async function restoreActiveAsrJobIfNeeded() {
  const job = await getActiveAsrJob();
  if (!job || !job.jobId) return;
  const token = await BackendApi.getToken();
  if (!token) return;
  activeAsrJob = job;
  asrNetworkFailures = 0;
  setAudioControlsDisabled(true);
  showToast(I18n.t("audioRestoredJob"));
  showState("loading");
  startAsrElapsedTicker(job.status === "QUEUED" ? "audioJobQueued" : "audioTranscribing");
  pollAsrJob();
}

async function generateSummary() {
  clearAsrPolling();
  showState("loading");
  $("loading-text-main").textContent = I18n.t("loadingText");
  $("loading-sub").textContent = I18n.t("loadingSub");
  $("save-status").classList.add("hidden");
  $("proxy-reminder").classList.add("hidden");

  try {
    const extractResponse = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "EXTRACT_CONTENT" }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(I18n.errorMessage("CONTENT_SCRIPT_CONNECTION_FAILED")));
          return;
        }
        resolve(response);
      });
    });

    if (!extractResponse || !extractResponse.success) {
      throw new Error(I18n.errorMessage(
        extractResponse?.errorCode,
        extractResponse?.error,
        "contentExtractionError"
      ));
    }

    const { title, content, url, sourceType } = extractResponse.data;

    $("loading-text-main").textContent = I18n.t("aiLoadingText");

    const result = extractResponse.data.transcriptUnavailable
      ? await AiClient.generateVideoTranscriptSummary(url, sourceType)
      : await AiClient.generateSummary(sourceType, content);
    lastResult = { ...result, url, sourceType };

    renderResult(result, url, sourceType);
    showState("result");
    showProxyReminderIfNeeded(result);

    // 自动保存到后端
    autoSave(result, url, sourceType);

  } catch (err) {
    console.error("生成摘要失败：", err);
    showError(err.message, err.isQuotaExhausted);
  }
}

function showProxyReminderIfNeeded(result) {
  if (!result.__showSoftReminder) {
    $("proxy-reminder").classList.add("hidden");
    return;
  }

  $("proxy-reminder-text").textContent = I18n.t("backendProxySoftReminder");
  $("proxy-reminder").classList.remove("hidden");
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

    const translation = await AiClient.translate(toTranslate, targetLang, lastResult.sourceType);
    let translated;
    try {
      translated = JSON.parse(translation.translated);
    } catch (parseError) {
      throw new Error(I18n.t("translateRetryLater"));
    }

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
    showProxyReminderIfNeeded({ __showSoftReminder: translation.showSoftReminder });

  } catch (e) {
    console.error("翻译失败：", e);
    showToast(e.isQuotaExhausted ? I18n.t("errorFreeQuotaExhausted") : (e.message || I18n.t("translateRetryLater")));
    $("btn-translate").textContent = I18n.t("btnTranslate");
    $("btn-translate").disabled = false;
  }
});

// ===== 事件绑定 =====
$("btn-generate").addEventListener("click", generateSummary);
$("btn-retry").addEventListener("click", () => currentRetryHandler());
$("btn-copy").addEventListener("click", copySummary);
$("btn-new").addEventListener("click", () => {
  clearAsrPolling();
  clearActiveAsrJob();
  setAudioControlsDisabled(false);
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
  $("proxy-reminder").classList.add("hidden");
  showState("idle");
});

$("btn-choose-audio").addEventListener("click", async () => {
  const token = await BackendApi.getToken();
  if (!token) {
    showError(I18n.t("audioLoginRequired"), false, showAuthPage);
    return;
  }
  $("audio-file-input").click();
});

$("audio-file-input").addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  await handleAudioFileSelected(file);
});

$("btn-upload-audio").addEventListener("click", uploadSelectedAudio);

window.addEventListener("beforeunload", clearAsrPolling);

$("btn-settings").addEventListener("click", openSettings);
$("btn-error-goto-settings").addEventListener("click", openSettings);

// ===== 手动输入 =====
$("btn-show-manual").addEventListener("click", () => {
  showState("manual");
  $("manual-textarea").value = "";
  $("manual-textarea").focus();
});

$("btn-manual-cancel").addEventListener("click", () => {
  showState("idle");
});

$("btn-manual-submit").addEventListener("click", async () => {
  const text = $("manual-textarea").value.trim();
  if (!text) {
    showToast(I18n.t("manualEmpty"));
    return;
  }

  showState("loading");
  $("loading-text-main").textContent = I18n.t("aiLoadingText");
  $("loading-sub").textContent = I18n.t("loadingSub");
  $("save-status").classList.add("hidden");
  $("proxy-reminder").classList.add("hidden");

  try {
    const result = await AiClient.generateSummary("article", text);
    const url = window.location ? window.location.href : "";
    lastResult = { ...result, url, sourceType: "manual" };

    renderResult(result, url, "manual");
    showState("result");
    showProxyReminderIfNeeded(result);

    autoSave(result, url, "article");
  } catch (err) {
    console.error("手动输入生成摘要失败：", err);
    showError(err.message, err.isQuotaExhausted);
  }
});
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

  const loggedIn = await BackendApi.isLoggedIn();

  await updateAuthUI();
  await restoreActiveAsrJobIfNeeded();

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
