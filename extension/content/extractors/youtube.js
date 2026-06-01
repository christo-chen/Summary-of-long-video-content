/**
 * YouTube 视频字幕提取器
 *
 * 提取思路：
 * 1. 从页面主世界中的播放器响应读取字幕轨道
 * 2. 从页面 HTML 中扫描字幕轨道作为兼容兜底
 * 3. 通过浏览器侧 InnerTube player API 获取字幕轨道
 * 4. 请求字幕 JSON/XML/VTT，解析为纯文本
 * 5. 如果没有字幕，交给后端 yt-dlp 字幕提取兜底
 */

// eslint-disable-next-line no-unused-vars
const YoutubeExtractor = {

  MIN_TRANSCRIPT_LENGTH: 50,
  lastFailureReason: null,

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
    const videoId = this._getVideoId(url);
    console.debug("[YouTubeExtractor] Starting extraction", { videoId: videoId });

    if (!videoId) {
      this._recordFailure("UNSUPPORTED_YOUTUBE_PAGE");
      return this._transcriptUnavailable(title, url);
    }

    try {
      const subtitleText = await this._fetchSubtitle(videoId);
      if (subtitleText && subtitleText.length >= this.MIN_TRANSCRIPT_LENGTH) {
        return {
          title: title,
          content: this._truncate(subtitleText),
          url: url,
          sourceType: "youtube",
        };
      }
    } catch (e) {
      console.warn("[YouTubeExtractor] Unexpected extraction error", e.message);
    }

    console.debug("[YouTubeExtractor] Frontend extraction unavailable; allowing backend fallback", {
      failureReason: this.lastFailureReason,
    });
    return this._transcriptUnavailable(title, url);
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
  async _fetchSubtitle(videoId) {
    this.lastFailureReason = null;
    const captionTracks = await this._getCaptionTracks(videoId);
    console.debug("[YouTubeExtractor] Caption tracks resolved", {
      found: Boolean(captionTracks?.length),
      count: captionTracks?.length || 0,
    });

    if (!captionTracks || captionTracks.length === 0) {
      this._recordFailure("NO_CAPTION_TRACKS");
      return null;
    }

    for (const track of this._orderCaptionTracks(captionTracks)) {
      if (!track.baseUrl || !this._isAllowedCaptionUrl(track.baseUrl)) {
        continue;
      }
      const subtitleText = await this._downloadTrack(track);
      if (subtitleText && subtitleText.length >= this.MIN_TRANSCRIPT_LENGTH) {
        return subtitleText;
      }
    }

    return null;
  },

  /**
   * 下载并解析一个字幕轨道，支持 JSON、XML 和 VTT 格式。
   */
  async _downloadTrack(track) {
    const attempts = [
      { url: this._withCaptionFormat(track.baseUrl, "json3"), format: "json", label: "json3" },
      { url: track.baseUrl, format: "timedText", label: "default" },
      { url: this._withCaptionFormat(track.baseUrl, "vtt"), format: "timedText", label: "vtt" },
    ];

    for (const attempt of attempts) {
      const subtitle = await this._downloadSubtitle(attempt.url, attempt.format, attempt.label);
      if (subtitle && subtitle.length >= this.MIN_TRANSCRIPT_LENGTH) {
        return subtitle;
      }
    }
    return null;
  },

  _withCaptionFormat(url, format) {
    const encodedFormat = encodeURIComponent(format);
    if (/[?&]fmt=/i.test(url)) {
      return url.replace(/([?&]fmt=)[^&]*/i, "$1" + encodedFormat);
    }
    return url + (url.includes("?") ? "&" : "?") + "fmt=" + encodedFormat;
  },

  _isAllowedCaptionUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" &&
        (parsed.hostname === "youtube.com" || parsed.hostname.endsWith(".youtube.com"));
    } catch {
      return false;
    }
  },

  async _downloadSubtitle(url, format, label) {
    try {
      const resp = await fetch(url, { credentials: "include" });
      if (!resp.ok) {
        this._recordFailure("CAPTION_URL_FETCH_FAILED", String(resp.status));
        return null;
      }
      let text = await resp.text();

      if (!text || text.length < 10) {
        const pageResponse = await this._requestMainWorldCaptionText(url);
        if (pageResponse) {
          text = pageResponse.text || "";
        }
        if (!text || text.length < 10) {
          this._recordFailure("CAPTION_RESPONSE_EMPTY", label);
          return null;
        }
      }

      const subtitle = format === "json"
        ? this._parseJsonSubtitle(text)
        : this._parseTimedTextSubtitle(text);
      if (!subtitle) this._recordFailure("SUBTITLE_PARSE_FAILED", label);
      return subtitle;
    } catch (e) {
      this._recordFailure("CAPTION_URL_FETCH_FAILED", e.message);
      return null;
    }
  },

  _requestMainWorldCaptionText(url) {
    return new Promise((resolve) => {
      const requestId = "youtube-caption-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      const timer = setTimeout(() => {
        window.removeEventListener("message", onMessage);
        resolve(null);
      }, 3000);

      const onMessage = (event) => {
        const message = event.data;
        if (event.source !== window || message?.source !== "ai-summary-extension" ||
            message.type !== "AI_SUMMARY_YOUTUBE_CAPTION_TEXT" || message.requestId !== requestId) {
          return;
        }
        clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        resolve(message.data || null);
      };

      window.addEventListener("message", onMessage);
      window.postMessage({
        source: "ai-summary-extension",
        type: "AI_SUMMARY_REQUEST_YOUTUBE_CAPTION_TEXT",
        requestId: requestId,
        url: url,
      }, "*");
    });
  },

  /**
   * 解析 JSON 格式字幕（fmt=json3）
   */
  _parseJsonSubtitle(text) {
    try {
      const data = JSON.parse(text);
      if (!data.events) return null;

      const lines = [];
      for (const event of data.events) {
        if (event.segs) {
          const line = event.segs.map(seg => seg.utf8 || "").join("").trim();
          if (line && line !== "\n") lines.push(line);
        }
      }

      return this._normalizeTranscript(lines);
    } catch {
      return null;
    }
  },

  _parseTimedTextSubtitle(text) {
    if (text.trimStart().startsWith("WEBVTT")) {
      return this._parseVttSubtitle(text);
    }
    return this._parseXmlSubtitle(text);
  },

  _parseXmlSubtitle(text) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "text/xml");
      const lines = [];
      const textElements = doc.querySelectorAll("text");
      const paragraphs = doc.querySelectorAll("p");
      if (textElements.length > 0) {
        textElements.forEach(el => {
          const content = el.textContent.trim();
          if (content) lines.push(content);
        });
      } else {
        paragraphs.forEach(paragraph => {
          const segments = paragraph.querySelectorAll("s");
          const content = segments.length > 0
            ? Array.from(segments).map(segment => segment.textContent).join("")
            : paragraph.textContent;
          if (content.trim()) lines.push(content.trim());
        });
      }

      return this._normalizeTranscript(lines);
    } catch {
      return null;
    }
  },

  _parseVttSubtitle(text) {
    const lines = [];
    for (const line of text.split(/\r?\n/)) {
      const cleaned = line.trim();
      if (!cleaned || cleaned === "WEBVTT" || cleaned.startsWith("Kind:") ||
          cleaned.startsWith("Language:") || cleaned.includes("-->") ||
          /^\d+$/.test(cleaned)) {
        continue;
      }
      lines.push(cleaned);
    }
    return this._normalizeTranscript(lines);
  },

  _normalizeTranscript(lines) {
    const normalized = [];
    for (const line of lines) {
      const cleanLine = this._decodeHtmlEntities(line.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
      if (cleanLine && cleanLine !== normalized[normalized.length - 1]) {
        normalized.push(cleanLine);
      }
    }
    const text = normalized.join("\n");
    return text.length >= this.MIN_TRANSCRIPT_LENGTH ? text : null;
  },

  _decodeHtmlEntities(text) {
    const element = document.createElement("textarea");
    element.innerHTML = text;
    return element.value;
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

  _isEnglishTrack(track) {
    const code = (track.languageCode || "").toLowerCase();
    return code === "en" || code.startsWith("en-");
  },

  /**
   * Manual captions are preferred first, then Chinese, English and other languages.
   */
  _orderCaptionTracks(tracks) {
    return [...tracks].sort((left, right) => this._trackPriority(left) - this._trackPriority(right));
  },

  _trackPriority(track) {
    const generatedPenalty = track.kind === "asr" ? 100 : 0;
    if (this._isChineseTrack(track)) return generatedPenalty;
    if (this._isEnglishTrack(track)) return generatedPenalty + 10;
    return generatedPenalty + 20;
  },

  /**
   * 从页面中提取字幕轨道信息（多种方法）
   */
  async _getCaptionTracks(videoId) {
    let tracks = null;

    // Layer 1: read live player state through the main-world bridge.
    const playerData = await this._requestMainWorldPlayerData(videoId);
    tracks = playerData?.captionTracks;
    if (tracks && tracks.length > 0) {
      return tracks;
    }

    // Layer 2: existing script and HTML scan fallback.
    tracks = this._extractFromPageSource(videoId);
    if (tracks && tracks.length > 0) return tracks;

    tracks = await this._extractByFetchingPage(videoId);
    if (tracks && tracks.length > 0) return tracks;

    // Layer 3: browser-side InnerTube request using page-provided web client context.
    tracks = await this._extractFromInnerTube(videoId, playerData?.innerTube);
    if (tracks && tracks.length > 0) return tracks;

    return null;
  },

  _requestMainWorldPlayerData(videoId) {
    return new Promise((resolve) => {
      const requestId = "youtube-player-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      const timer = setTimeout(() => {
        window.removeEventListener("message", onMessage);
        resolve(null);
      }, 800);

      const onMessage = (event) => {
        const message = event.data;
        if (event.source !== window || message?.source !== "ai-summary-extension" ||
            message.type !== "AI_SUMMARY_YOUTUBE_PLAYER_DATA" || message.requestId !== requestId) {
          return;
        }
        clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        resolve(message.data || null);
      };

      window.addEventListener("message", onMessage);
      window.postMessage({
        source: "ai-summary-extension",
        type: "AI_SUMMARY_REQUEST_YOUTUBE_PLAYER_DATA",
        requestId: requestId,
        videoId: videoId,
      }, "*");
    });
  },

  /**
   * 方法1：从页面 script 标签中用正则提取 captionTracks
   */
  _extractFromPageSource(videoId) {
    const scripts = document.querySelectorAll("script");
    for (const script of scripts) {
      const text = script.textContent;
      if (!text || !text.includes("captionTracks")) continue;
      // 优先匹配包含当前视频 ID 的 script 块，避免拿到推荐视频的字幕
      if (videoId && !text.includes(videoId)) continue;

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
            return parsed;
          }
        }
      } catch { /* Ignore malformed embedded player data and continue scanning. */ }
    }
    return null;
  },

  /**
   * 方法2（最可靠）：主动 fetch 视频页面 HTML，从中提取 captionTracks
   * 这解决了 YouTube SPA 导航后 DOM 中不再包含 captionTracks 的问题
   */
  async _extractByFetchingPage(videoId) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const resp = await fetch("https://www.youtube.com/watch?v=" + videoId, {
        credentials: "same-origin",
        signal: controller.signal,
      });
      if (!resp.ok) return null;

      const html = await resp.text();

      // 从 HTML 中提取 captionTracks
      const marker = '"captionTracks":';
      const startIdx = html.indexOf(marker);
      if (startIdx === -1) {
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
        return parsed;
      }
    } catch { /* Continue to the next extraction fallback. */ } finally {
      clearTimeout(timer);
    }
    return null;
  },

  async _extractFromInnerTube(videoId, config) {
    let innerTube = config;
    if (!innerTube?.apiKey || !innerTube.client?.clientVersion) {
      innerTube = this._extractInnerTubeConfigFromPageSource() || innerTube;
    }
    if (!innerTube?.apiKey || !innerTube.client?.clientVersion) {
      this._recordFailure("INNERTUBE_CONFIG_UNAVAILABLE");
      return null;
    }
    const client = {
      clientName: innerTube.client.clientName || "WEB",
      clientVersion: innerTube.client.clientVersion,
      hl: innerTube.client.hl || "en",
    };
    if (innerTube.client.gl) client.gl = innerTube.client.gl;
    if (innerTube.client.visitorData) client.visitorData = innerTube.client.visitorData;

    try {
      const response = await fetch(
        "https://www.youtube.com/youtubei/v1/player?key=" + encodeURIComponent(innerTube.apiKey),
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-YouTube-Client-Name": innerTube.clientNameHeader || "1",
            "X-YouTube-Client-Version": client.clientVersion,
          },
          body: JSON.stringify({
            videoId: videoId,
            context: { client: client },
          }),
        }
      );
      if (!response.ok) {
        this._recordFailure("CAPTION_URL_FETCH_FAILED", "InnerTube " + response.status);
        return null;
      }

      const playerResponse = await response.json();
      const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (Array.isArray(tracks) && tracks.length > 0) {
        return tracks;
      }
      this._recordFailure("NO_CAPTION_TRACKS", "InnerTube");
    } catch (e) {
      this._recordFailure("CAPTION_URL_FETCH_FAILED", "InnerTube " + e.message);
    }
    return null;
  },

  _extractInnerTubeConfigFromPageSource() {
    for (const script of document.querySelectorAll("script")) {
      const text = script.textContent || "";
      if (!text.includes("INNERTUBE_API_KEY")) continue;
      const apiKey = text.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/)?.[1];
      const version = text.match(/"INNERTUBE_CLIENT_VERSION"\s*:\s*"([^"]+)"/)?.[1];
      const clientNameHeader = text.match(/"INNERTUBE_CONTEXT_CLIENT_NAME"\s*:\s*(\d+)/)?.[1];
      if (apiKey && version) {
        return {
          apiKey: apiKey,
          clientNameHeader: clientNameHeader || "1",
          client: { clientName: "WEB", clientVersion: version, hl: "en" },
        };
      }
    }
    return null;
  },

  _getVideoId(url) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === "youtu.be") return parsed.pathname.split("/")[1] || null;
      if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
      if (parsed.pathname.startsWith("/shorts/")) return parsed.pathname.split("/")[2] || null;
    } catch {
      return null;
    }
    return null;
  },

  _recordFailure(reason, detail) {
    this.lastFailureReason = reason;
    console.warn("[YouTubeExtractor] Failure", { code: reason, detail: detail || "" });
  },

  _transcriptUnavailable(title, url) {
    return {
      title: title,
      content: null,
      url: url,
      sourceType: "youtube",
      transcriptUnavailable: true,
    };
  },

  _truncate(text, maxLength = 8000) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "\n\n[字幕已截断，原文共 " + text.length + " 字]";
  },
};
