/**
 * 国际化（i18n）语言包
 *
 * 支持中英双语切换，语言偏好存储在 chrome.storage.local
 */

// eslint-disable-next-line no-unused-vars
const I18n = {

  currentLang: "en",

  strings: {
    zh: {
      // 顶部
      headerTitle: "📝 AI Summary",
      btnSettings: "设置",

      // Tab
      tabSummary: "📄 摘要",
      tabHistory: "📚 历史",

      // 登录页
      authTitle: "登录以同步历史记录",
      authDesc: "登录后摘要会自动保存到云端",
      authEmailPlaceholder: "邮箱",
      authPasswordPlaceholder: "密码（至少6位）",
      authEmailAndPwdRequired: "请填写邮箱和密码",
      authPwdTooShort: "密码至少6位",
      btnLogin: "登录",
      btnLoginLoading: "登录中...",
      btnRegister: "注册新账号",
      btnRegisterLoading: "注册中...",
      btnSkipLogin: "跳过，不登录使用",
      loginSuccess: "登录成功 ✅",
      registerSuccess: "注册成功 ✅",

      // 摘要页 - 空闲
      idleText: "打开任意网页文章，点击下方按钮生成摘要",
      btnGenerate: "生成摘要",
      orManualInput: "或手动输入内容",
      btnManualInput: "📋 粘贴文本生成摘要",
      manualTitle: "粘贴内容",
      manualHint: "粘贴视频字幕、文档内容、或任意文本",
      manualPlaceholder: "在此粘贴文本内容...",
      btnManualSubmit: "生成摘要",
      btnManualCancel: "返回",
      manualEmpty: "请先粘贴内容",

      // 摘要页 - 加载
      loadingText: "正在提取内容并生成摘要...",
      loadingSub: "首次使用可能需要 10-20 秒",

      // 摘要页 - 错误
      btnRetry: "重试",

      // 摘要页 - 结果
      sourceLink: "原文链接",
      sectionKeyPoints: "📌 核心要点",
      sectionMindmap: "🗺️ 思维导图",
      btnMindmapVisual: "图形",
      btnMindmapText: "文本",
      sectionExport: "📤 导出笔记",
      btnCopy: "📋 复制摘要",
      btnNew: "🔄 新的摘要",
      btnTranslate: "🌐 翻译",
      btnTranslating: "🌐 翻译中...",
      btnTranslated: "🌐 已翻译",
      translateToEn: "翻译为英文",
      translateToZh: "翻译为中文",

      // 保存状态
      savedToCloud: "✅ 已保存到云端",
      loginToSave: "💡 登录后可自动保存到云端",
      saveFailed: "⚠️ 保存失败：",
      backendProxySoftReminder: "你仍然可以继续使用默认 AI 服务。为了获得更稳定的长期使用体验，建议你在右上角设置中配置自己的 API Key。",

      // 导出
      exportNotionLogin: "请先登录后再导出",
      exportNeedSummary: "请先生成摘要并等待保存完成",
      exportNotionRedirect: "正在跳转 Notion 授权...",
      exportNotionAuth: "请在新窗口完成 Notion 授权，完成后重新点击导出",
      exportNotionLoading: "正在导出到 Notion...",
      exportNotionSuccess: "✅ 已导出到 Notion",
      exportSuccess: "导出成功！",
      exportObsidianLoading: "正在生成 Obsidian Markdown...",
      exportObsidianSuccess: "✅ 已下载 Obsidian Markdown",
      exportLogseqLoading: "正在生成 Logseq Markdown...",
      exportLogseqSuccess: "✅ 已下载 Logseq Markdown",
      exportNeedGenerate: "请先生成摘要",

      // 复制
      copied: "已复制 ✅",
      copyFailed: "复制失败",
      copyKeyPoints: "核心要点",
      copySource: "来源：",

      // 历史页
      historySearchPlaceholder: "🔍 搜索标题或内容...",
      historyFilterAll: "全部类型",
      historyFilterArticle: "📄 文章",
      historyFilterBilibili: "📺 B站",
      historyFilterYoutube: "▶️ YouTube",
      historyFilterGithub: "🐙 GitHub",
      historyFilterSO: "💡 SO",
      historyNeedLogin: "登录后即可查看历史记录",
      btnGotoLogin: "去登录",
      historyEmpty: "暂无历史记录",
      btnLoadMore: "加载更多",
      historyLoadFailed: "加载失败：",
      historyDetailFailed: "加载详情失败：",
      confirmDelete: "确定删除这条摘要？",
      deleted: "已删除 ✅",
      deleteFailed: "删除失败：",
      btnDelete: "删除",

      // 设置
      settingsTitle: "设置",
      settingsProvider: "AI 服务商",
      providerDeepseek: "DeepSeek（推荐，便宜）",
      providerOpenai: "OpenAI",
      settingsApiKey: "API Key",
      settingsApiKeyPlaceholder: "输入你的 API Key",
      settingsApiKeyHint: "Key 仅存储在本地浏览器中",
      settingsAccount: "当前账号",
      btnLogout: "退出登录",
      btnSaveSettings: "保存设置",
      settingsSaved: "设置已保存 ✅",
      loggedOut: "已退出登录",

      // 语言
      settingsLang: "界面语言",
      langZh: "中文",
      langEn: "English",

      // 错误提示
      errorFreeQuotaExhausted: "免费额度已用完，请在设置中配置自己的 API Key",
      errorProxyFailed: "后端代理请求失败",
      backendRequestFailed: "请求失败，请稍后重试。",
      videoNoTranscript: "当前视频没有检测到可用字幕/转录文本，因此无法准确总结视频内容。为了避免生成不准确内容，本次不会仅根据标题或简介生成总结。",
      videoInvalidUrl: "不支持或无效的视频链接。",
      videoYtDlpNotAvailable: "视频字幕提取服务当前不可用，请稍后重试。",
      videoTranscriptFailed: "视频字幕/转录文本提取失败，请稍后重试。",
      noActiveTab: "没有找到当前标签页。",
      contentScriptConnectionFailed: "无法连接到页面，请刷新后重试。",
      videoContentExtractionFailed: "未能提取到有效内容（字幕获取失败或视频无字幕）。",
      contentExtractionFailed: "未能提取到有效内容，该页面可能不包含文章正文。",
      contentExtractionError: "内容提取失败，请刷新页面后重试。",

      // 加载状态
      aiLoadingText: "AI 正在分析内容...",

      // 设置引导
      btnGoToSettings: "前往设置",

      // 翻译
      translateFailed: "翻译失败：",
      translateRetryLater: "翻译服务暂时不可用，请稍后重试。",

      // source types
      sourceArticle: "📄 文章",
      sourceBilibili: "📺 B站视频",
      sourceYoutube: "▶️ YouTube",
      sourceGithub: "🐙 GitHub",
      sourceSO: "💡 StackOverflow",
      sourceManual: "📋 手动输入",
    },

    en: {
      headerTitle: "📝 AI Summary",
      btnSettings: "Settings",

      tabSummary: "📄 Summary",
      tabHistory: "📚 History",

      authTitle: "Sign in to sync history",
      authDesc: "Summaries will be saved to cloud after sign in",
      authEmailPlaceholder: "Email",
      authPasswordPlaceholder: "Password (min 6 chars)",
      authEmailAndPwdRequired: "Please enter email and password",
      authPwdTooShort: "Password must be at least 6 characters",
      btnLogin: "Sign In",
      btnLoginLoading: "Signing in...",
      btnRegister: "Create Account",
      btnRegisterLoading: "Creating...",
      btnSkipLogin: "Skip, use without signing in",
      loginSuccess: "Signed in ✅",
      registerSuccess: "Account created ✅",

      idleText: "Open any webpage and click the button below to generate a summary",
      btnGenerate: "Generate Summary",
      orManualInput: "or paste text manually",
      btnManualInput: "📋 Paste Text to Summarize",
      manualTitle: "Paste Content",
      manualHint: "Paste video subtitles, document text, or any content",
      manualPlaceholder: "Paste text content here...",
      btnManualSubmit: "Generate Summary",
      btnManualCancel: "Back",
      manualEmpty: "Please paste content first",

      loadingText: "Extracting content and generating summary...",
      loadingSub: "First time may take 10-20 seconds",

      btnRetry: "Retry",

      sourceLink: "Source Link",
      sectionKeyPoints: "📌 Key Points",
      sectionMindmap: "🗺️ Mind Map",
      btnMindmapVisual: "Visual",
      btnMindmapText: "Text",
      sectionExport: "📤 Export Notes",
      btnCopy: "📋 Copy Summary",
      btnNew: "🔄 New Summary",
      btnTranslate: "🌐 Translate",
      btnTranslating: "🌐 Translating...",
      btnTranslated: "🌐 Translated",
      translateToEn: "Translate to English",
      translateToZh: "Translate to Chinese",

      savedToCloud: "✅ Saved to cloud",
      loginToSave: "💡 Sign in to auto-save to cloud",
      saveFailed: "⚠️ Save failed: ",

      exportNotionLogin: "Please sign in before exporting",
      exportNeedSummary: "Please generate a summary first",
      exportNotionRedirect: "Redirecting to Notion auth...",
      exportNotionAuth: "Complete Notion auth in the new window, then click export again",
      exportNotionLoading: "Exporting to Notion...",
      exportNotionSuccess: "✅ Exported to Notion",
      exportSuccess: "Export successful!",
      exportObsidianLoading: "Generating Obsidian Markdown...",
      exportObsidianSuccess: "✅ Downloaded Obsidian Markdown",
      exportLogseqLoading: "Generating Logseq Markdown...",
      exportLogseqSuccess: "✅ Downloaded Logseq Markdown",
      exportNeedGenerate: "Please generate a summary first",

      copied: "Copied ✅",
      copyFailed: "Copy failed",
      copyKeyPoints: "Key Points",
      copySource: "Source: ",

      historySearchPlaceholder: "🔍 Search title or content...",
      historyFilterAll: "All Types",
      historyFilterArticle: "📄 Article",
      historyFilterBilibili: "📺 Bilibili",
      historyFilterYoutube: "▶️ YouTube",
      historyFilterGithub: "🐙 GitHub",
      historyFilterSO: "💡 SO",
      historyNeedLogin: "Sign in to view history",
      btnGotoLogin: "Sign In",
      historyEmpty: "No history yet",
      btnLoadMore: "Load More",
      historyLoadFailed: "Load failed: ",
      historyDetailFailed: "Load detail failed: ",
      confirmDelete: "Delete this summary?",
      deleted: "Deleted ✅",
      deleteFailed: "Delete failed: ",
      btnDelete: "Delete",

      settingsTitle: "Settings",
      settingsProvider: "AI Provider",
      providerDeepseek: "DeepSeek (Recommended)",
      providerOpenai: "OpenAI",
      settingsApiKey: "API Key",
      settingsApiKeyPlaceholder: "Enter your API Key",
      settingsApiKeyHint: "Key is stored locally in your browser only",
      settingsAccount: "Current Account",
      btnLogout: "Sign Out",
      btnSaveSettings: "Save Settings",
      settingsSaved: "Settings saved ✅",
      loggedOut: "Signed out",

      settingsLang: "Language",
      langZh: "中文",
      langEn: "English",

      backendProxySoftReminder: "You can continue using the default AI service. For more stable long-term use, we recommend adding your own API key from the top-right Settings.",
      errorFreeQuotaExhausted: "Free quota exhausted, please configure your own API Key in Settings",
      errorProxyFailed: "Backend proxy request failed",
      backendRequestFailed: "Request failed. Please try again later.",
      videoNoTranscript: "No available subtitles or transcript were detected for this video, so the content cannot be summarized accurately. To avoid inaccurate results, this summary will not be generated from only the title or description.",
      videoInvalidUrl: "Unsupported or invalid video URL.",
      videoYtDlpNotAvailable: "The video subtitle extraction service is currently unavailable. Please try again later.",
      videoTranscriptFailed: "Failed to extract subtitles or transcript for this video. Please try again later.",
      noActiveTab: "No active tab was found.",
      contentScriptConnectionFailed: "Unable to connect to this page. Please refresh and try again.",
      videoContentExtractionFailed: "No usable content was extracted because subtitle retrieval failed or this video has no subtitles.",
      contentExtractionFailed: "No usable content was extracted. This page may not contain article text.",
      contentExtractionError: "Content extraction failed. Please refresh the page and try again.",

      aiLoadingText: "AI is analyzing the content...",

      btnGoToSettings: "Go to Settings",

      translateFailed: "Translation failed: ",
      translateRetryLater: "Translation is temporarily unavailable. Please try again later.",

      sourceArticle: "📄 Article",
      sourceBilibili: "📺 Bilibili",
      sourceYoutube: "▶️ YouTube",
      sourceGithub: "🐙 GitHub",
      sourceSO: "💡 StackOverflow",
      sourceManual: "📋 Manual Input",
    },
  },

  /**
   * 获取当前语言的文本
   */
  t(key) {
    return this.strings[this.currentLang][key] || this.strings["zh"][key] || key;
  },

  /**
   * Map stable failure identifiers to messages in the selected UI language.
   */
  errorMessage(code, fallbackMessage, defaultKey = "contentExtractionError") {
    const errorKeys = {
      NO_TRANSCRIPT_AVAILABLE: "videoNoTranscript",
      INVALID_VIDEO_URL: "videoInvalidUrl",
      YTDLP_NOT_AVAILABLE: "videoYtDlpNotAvailable",
      VIDEO_TRANSCRIPT_FAILED: "videoTranscriptFailed",
      BACKEND_PROXY_FAILED: "errorProxyFailed",
      NO_ACTIVE_TAB: "noActiveTab",
      CONTENT_SCRIPT_CONNECTION_FAILED: "contentScriptConnectionFailed",
      VIDEO_CONTENT_EXTRACTION_FAILED: "videoContentExtractionFailed",
      CONTENT_EXTRACTION_FAILED: "contentExtractionFailed",
      CONTENT_EXTRACTION_ERROR: "contentExtractionError",
    };
    const key = errorKeys[code];
    return key ? this.t(key) : (fallbackMessage || this.t(defaultKey));
  },

  /**
   * 获取 source type 的标签
   */
  sourceLabel(type) {
    const map = {
      article: this.t("sourceArticle"),
      bilibili: this.t("sourceBilibili"),
      youtube: this.t("sourceYoutube"),
      github: this.t("sourceGithub"),
      stackoverflow: this.t("sourceSO"),
      manual: this.t("sourceManual"),
    };
    return map[type] || this.t("sourceArticle");
  },

  /**
   * 从 storage 加载语言偏好
   */
  async load() {
    return new Promise((resolve) => {
      chrome.storage.local.get("uiLang", (result) => {
        if (result.uiLang) this.currentLang = result.uiLang;
        resolve(this.currentLang);
      });
    });
  },

  /**
   * 保存语言偏好
   */
  async save(lang) {
    this.currentLang = lang;
    return new Promise((resolve) => {
      chrome.storage.local.set({ uiLang: lang }, resolve);
    });
  },

  /**
   * 应用语言到所有 UI 元素
   */
  applyToUI() {
    // 带 data-i18n 属性的元素自动替换文本
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      const text = this.t(key);
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        el.placeholder = text;
      } else if (el.tagName === "OPTION") {
        el.textContent = text;
      } else {
        el.textContent = text;
      }
    });
  },
};
