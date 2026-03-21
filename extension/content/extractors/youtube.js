/**
 * YouTube 视频字幕提取器
 *
 * 提取思路：
 * 1. 从页面 HTML 中提取 ytInitialPlayerResponse 的字幕轨道
 * 2. 从 YouTube player API (ytplayer.config) 获取字幕轨道
 * 3. 请求字幕 JSON，解析为纯文本
 * 4. 如果没有字幕，降级提取视频描述
 */

// eslint-disable-next-line no-unused-vars
const YoutubeExtractor = {

  extract() {
    return {
      title: this._getTitle(),
      content: null,
      url: window.location.href,
      sourceType: "youtube",
      needAsync: true,
    };
  },

  async extractAsync() {
    const title = this._getTitle();
    const url = window.location.href;

    try {
      const subtitleText = await this._fetchSubtitle();
      if (subtitleText && subtitleText.length > 50) {
        return {
          title: title,
          content: this._truncate(subtitleText),
          url: url,
          sourceType: "youtube",
        };
      }
    } catch (e) {
      console.warn("[AI Summary] YouTube 字幕获取失败：", e);
    }

    return this._fallbackExtract(title, url);
  },

  _getTitle() {
    const titleEl = document.querySelector("h1.ytd-video-primary-info-renderer yt-formatted-string") ||
                    document.querySelector("h1.ytd-watch-metadata yt-formatted-string") ||
                    document.querySelector("h1 yt-formatted-string") ||
                    document.querySelector("h1");
    if (titleEl) return titleEl.textContent.trim();
    return document.title.replace(/ - YouTube$/, "").trim();
  },

  /**
   * 从页面数据中获取字幕轨道并下载
   */
  async _fetchSubtitle() {
    const captionTracks = await this._getCaptionTracks();
    console.log("[AI Summary] Found caption tracks:", captionTracks ? captionTracks.length : 0);

    if (!captionTracks || captionTracks.length === 0) return null;

    // 选择最佳字幕轨道：优先中文（所有变体），其次英文，最后第一个
    let track = captionTracks.find(t => this._isChineseTrack(t));
    if (!track) track = captionTracks.find(t => t.languageCode === "en" || t.languageCode === "en-US" || t.languageCode === "en-GB");
    if (!track) track = captionTracks[0];

    console.log("[AI Summary] Selected track:", track.languageCode, track.name?.simpleText || "");

    // 请求字幕（加 fmt=json3 获取 JSON 格式）
    let captionUrl = track.baseUrl;
    if (!captionUrl) return null;

    if (captionUrl.includes("?")) {
      captionUrl += "&fmt=json3";
    } else {
      captionUrl += "?fmt=json3";
    }

    const resp = await fetch(captionUrl);
    if (!resp.ok) {
      console.warn("[AI Summary] 字幕请求失败:", resp.status);
      return null;
    }

    const data = await resp.json();
    if (!data.events) return null;

    // 解析字幕事件，提取文本
    const lines = [];
    for (const event of data.events) {
      if (event.segs) {
        const text = event.segs.map(seg => seg.utf8 || "").join("").trim();
        if (text && text !== "\n") lines.push(text);
      }
    }

    const result = lines.join("\n");
    console.log("[AI Summary] 提取到字幕长度:", result.length);
    return result;
  },

  /**
   * 判断是否为中文轨道（覆盖所有中文变体）
   */
  _isChineseTrack(track) {
    const code = (track.languageCode || "").toLowerCase();
    return code === "zh" || code === "zh-cn" || code === "zh-tw" ||
           code === "zh-hans" || code === "zh-hant" ||
           code === "zh-hk" || code === "zh-sg" ||
           code.startsWith("zh");
  },

  /**
   * 从页面中提取字幕轨道信息（多种方法）
   */
  async _getCaptionTracks() {
    let tracks = null;

    // 方法1：从页面 HTML script 标签中提取（直接打开视频链接时有效）
    tracks = this._extractFromPageSource();
    if (tracks && tracks.length > 0) return tracks;

    // 方法2（最可靠）：主动 fetch 视频页面 HTML 提取（SPA 导航时兜底）
    tracks = await this._extractByFetchingPage();
    if (tracks && tracks.length > 0) return tracks;

    return null;
  },

  /**
   * 方法1：从页面 script 标签中用正则提取 captionTracks
   */
  _extractFromPageSource() {
    const scripts = document.querySelectorAll("script");
    for (const script of scripts) {
      const text = script.textContent;
      if (!text || !text.includes("captionTracks")) continue;

      try {
        // 用更健壮的方式提取：找到 "captionTracks": 后匹配完整的 JSON 数组
        const startMarker = '"captionTracks":';
        const startIdx = text.indexOf(startMarker);
        if (startIdx === -1) continue;

        const arrayStart = startIdx + startMarker.length;
        // 手动匹配括号来找到完整的数组
        let depth = 0;
        let endIdx = -1;
        for (let i = arrayStart; i < text.length && i < arrayStart + 10000; i++) {
          if (text[i] === "[") depth++;
          if (text[i] === "]") {
            depth--;
            if (depth === 0) {
              endIdx = i + 1;
              break;
            }
          }
        }

        if (endIdx > arrayStart) {
          const jsonStr = text.substring(arrayStart, endIdx);
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log("[AI Summary] 方法1成功: 从 script 标签提取到", parsed.length, "个字幕轨道");
            return parsed;
          }
        }
      } catch (e) {
        console.warn("[AI Summary] 方法1解析失败:", e.message);
      }
    }
    return null;
  },

  /**
   * 方法2（最可靠）：主动 fetch 视频页面 HTML，从中提取 captionTracks
   * 这解决了 YouTube SPA 导航后 DOM 中不再包含 captionTracks 的问题
   */
  async _extractByFetchingPage() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const videoId = new URL(window.location.href).searchParams.get("v");
      if (!videoId) return null;

      console.log("[AI Summary] 方法2: 正在 fetch 视频页面 HTML, videoId:", videoId);

      const resp = await fetch("https://www.youtube.com/watch?v=" + videoId, {
        credentials: "omit",
        signal: controller.signal,
      });
      if (!resp.ok) return null;

      const html = await resp.text();

      // 从 HTML 中提取 captionTracks
      const marker = '"captionTracks":';
      const startIdx = html.indexOf(marker);
      if (startIdx === -1) {
        console.log("[AI Summary] 方法2: HTML 中未找到 captionTracks");
        return null;
      }

      const arrayStart = startIdx + marker.length;
      let depth = 0;
      let endIdx = -1;
      for (let i = arrayStart; i < html.length && i < arrayStart + 20000; i++) {
        if (html[i] === "[") depth++;
        if (html[i] === "]") {
          depth--;
          if (depth === 0) {
            endIdx = i + 1;
            break;
          }
        }
      }

      if (endIdx <= arrayStart) return null;

      const jsonStr = html.substring(arrayStart, endIdx);
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log("[AI Summary] 方法2成功: fetch 页面提取到", parsed.length, "个字幕轨道");
        return parsed;
      }
    } catch (e) {
      console.warn("[AI Summary] 方法2失败:", e.message);
    } finally {
      clearTimeout(timer);
    }
    return null;
  },

  _fallbackExtract(title, url) {
    let desc = "";
    const descEl = document.querySelector("#description-text") ||
                   document.querySelector("ytd-text-inline-expander") ||
                   document.querySelector('[id="description"]') ||
                   document.querySelector("#info-container");
    if (descEl) desc = descEl.textContent.trim();

    if (!desc || desc.length < 20) {
      desc = "（该视频无字幕且描述过短，请手动复制视频内容后粘贴）";
    }

    return {
      title: title,
      content: "[YouTube 视频描述]\n\n" + desc,
      url: url,
      sourceType: "youtube",
    };
  },

  _truncate(text, maxLength = 8000) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "\n\n[字幕已截断，原文共 " + text.length + " 字]";
  },
};
