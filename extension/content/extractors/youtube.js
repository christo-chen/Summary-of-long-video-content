/**
 * YouTube 视频字幕提取器
 *
 * 提取思路：
 * 1. 模拟点击 YouTube 页面上的“显示文字稿 / Show transcript”
 * 2. 等 YouTube 自己渲染文字稿面板
 * 3. 从渲染后的 DOM 读取两套已知文字稿 UI
 * 4. 如果没有文字稿，交给上层降级到手动粘贴/后端兜底
 */

// eslint-disable-next-line no-unused-vars
const YoutubeExtractor = {

  MIN_TRANSCRIPT_LENGTH: 50,
  TRANSCRIPT_SEGMENT_SELECTORS: [
    "ytd-transcript-segment-renderer",
    "transcript-segment-view-model",
  ],
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
    const transcript = await this.getTranscript(videoId);
    if (!transcript || !transcript.lines.length) {
      this._recordFailure("TRANSCRIPT_PANEL_UNAVAILABLE");
      return null;
    }

    console.debug("[YouTubeExtractor] Transcript panel extracted", {
      selector: transcript.selector,
      lines: transcript.lines.length,
    });

    return this._normalizeTranscript(transcript.lines);
  },

  async getTranscript(videoId) {
    let openButton = null;
    try {
      await this._resetTranscriptPanelBeforeOpen(videoId);
      openButton = this._findTranscriptButton();
      if (!openButton) {
        this._recordFailure("TRANSCRIPT_BUTTON_NOT_FOUND");
        return null;
      }

      this._clickElement(openButton);

      // YouTube renders transcript segments asynchronously. Existing nodes are
      // valid too; wait until the current total segment count stops changing.
      const stable = await this._waitForTranscriptSegments({
        timeoutMs: 8000,
        stableMs: 500,
      });
      if (!stable) {
        this._recordFailure("TRANSCRIPT_PANEL_TIMEOUT");
        return null;
      }

      const transcript = this._readTranscriptSegments();
      if (!transcript || !transcript.lines.length) {
        this._recordFailure("TRANSCRIPT_PANEL_EMPTY");
        return null;
      }

      return transcript;
    } catch (e) {
      this._recordFailure("TRANSCRIPT_PANEL_ERROR", e.message);
      return null;
    } finally {
      if (openButton) {
        this._closeTranscriptPanel(openButton);
      }
    }
  },

  _findTranscriptButton() {
    const candidates = Array.from(document.querySelectorAll([
      "button",
      "[role='button']",
      "a",
      "tp-yt-paper-button",
      "yt-button-shape",
      "ytd-button-renderer",
    ].join(",")));

    for (const element of candidates) {
      if (!this._isVisible(element)) continue;
      if (!this._textLooksLikeTranscriptButton(element.textContent || "")) continue;

      const clickable = element.closest("button, [role='button'], a, tp-yt-paper-button, yt-button-shape, ytd-button-renderer") || element;
      if (this._isVisible(clickable)) return clickable;
    }
    return null;
  },

  _textLooksLikeTranscriptButton(text) {
    const normalized = text.replace(/\s+/g, " ").trim().toLowerCase();
    return normalized.includes("transcript") || normalized.includes("显示文字稿");
  },

  _clickElement(element) {
    element.scrollIntoView({ block: "center", inline: "center" });
    element.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
    }));
  },

  async _resetTranscriptPanelBeforeOpen(videoId) {
    if (this._getVideoId(window.location.href) !== videoId) return;
    if (this._getTranscriptSegmentCount() === 0) return;

    // YouTube is an SPA, so a transcript panel may survive navigation. Close
    // any existing panel before reopening it for the current URL.
    this._closeTranscriptPanel();
    await this._sleep(150);
  },

  _waitForTranscriptSegments({ timeoutMs, stableMs }) {
    return new Promise((resolve) => {
      let lastCount = -1;
      let stableTimer = null;
      let intervalTimer = null;
      let done = false;

      const cleanup = (value) => {
        if (done) return;
        done = true;
        clearTimeout(timeoutTimer);
        clearTimeout(stableTimer);
        clearInterval(intervalTimer);
        observer.disconnect();
        resolve(value);
      };

      const armStableTimer = (count) => {
        clearTimeout(stableTimer);
        stableTimer = setTimeout(() => {
          cleanup(this._getTranscriptSegmentCount() === count && count > 0);
        }, stableMs);
      };

      const check = () => {
        const count = this._getTranscriptSegmentCount();
        if (count === lastCount) return;
        lastCount = count;
        if (count > 0) armStableTimer(count);
      };

      const observer = new MutationObserver(check);
      observer.observe(document.body, { childList: true, subtree: true });

      const timeoutTimer = setTimeout(() => cleanup(false), timeoutMs);
      intervalTimer = setInterval(check, 100);
      check();
    });
  },

  _getTranscriptSegmentCount() {
    return this._getTranscriptSegmentNodes().length;
  },

  _getTranscriptSegmentNodes() {
    return this.TRANSCRIPT_SEGMENT_SELECTORS
      .flatMap(selector => Array.from(document.querySelectorAll(selector)));
  },

  _readTranscriptSegments() {
    for (const selector of this.TRANSCRIPT_SEGMENT_SELECTORS) {
      const nodes = Array.from(document.querySelectorAll(selector));
      if (nodes.length === 0) continue;

      const seen = new Set();
      const lines = [];
      for (const node of nodes) {
        const segment = this._readTranscriptSegment(node, selector);
        if (!segment.text) continue;

        // The old transcript UI can double-render segments during virtual
        // scrolling, so de-dupe by timestamp+text; pure text de-dupe would
        // incorrectly remove repeated sentences from the actual transcript.
        const key = segment.timestamp + "\n" + segment.text;
        if (seen.has(key)) continue;
        seen.add(key);
        lines.push(segment.text);
      }

      return { selector: selector, lines: lines };
    }
    return null;
  },

  _readTranscriptSegment(node, selector) {
    if (selector === "ytd-transcript-segment-renderer") {
      return {
        timestamp: this._cleanText(node.querySelector(".segment-timestamp")?.textContent || ""),
        text: this._cleanText(node.querySelector(".segment-text")?.textContent || node.textContent || ""),
      };
    }

    // Verified new UI selector. Timestamp class names are less stable there,
    // so use timestamp-like text as a fallback while keeping text from the
    // verified span.ytAttributedStringHost when available.
    const textSpans = Array.from(node.querySelectorAll("span.ytAttributedStringHost"))
      .filter(span => !this._looksLikeTimestamp(span.textContent || ""));
    const text = this._cleanText(
      textSpans
        .map(span => span.textContent || "")
        .join(" ") || node.textContent || ""
    );
    return {
      timestamp: this._extractTimestampFromSegment(node),
      text: text,
    };
  },

  _extractTimestampFromSegment(node) {
    const timestampNode = Array.from(node.querySelectorAll("*"))
      .find(el => this._looksLikeTimestamp(el.textContent || ""));
    return this._cleanText(timestampNode?.textContent || "");
  },

  _looksLikeTimestamp(text) {
    return /^\s*(?:\d{1,2}:)?\d{1,2}:\d{2}\s*$/.test(text);
  },

  _cleanText(text) {
    return text.replace(/\s+/g, " ").trim();
  },

  _closeTranscriptPanel(openButton) {
    const closeButton = this._findTranscriptCloseButton();
    if (closeButton) {
      this._clickElement(closeButton);
      return;
    }

    if (openButton?.isConnected && this._isVisible(openButton)) {
      this._clickElement(openButton);
    }
  },

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  _findTranscriptCloseButton() {
    const segment = document.querySelector(this.TRANSCRIPT_SEGMENT_SELECTORS.join(","));
    const panel = segment?.closest("ytd-engagement-panel-section-list-renderer, ytd-transcript-renderer, tp-yt-paper-dialog, ytd-popup-container") ||
      document.querySelector("ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-searchable-transcript']");
    if (!panel) return null;

    const buttons = Array.from(panel.querySelectorAll("button, [role='button'], yt-button-shape"));
    return buttons.find(button => {
      if (!this._isVisible(button)) return false;
      const label = (button.getAttribute("aria-label") || button.getAttribute("title") || button.textContent || "").toLowerCase();
      return label.includes("close") || label.includes("关闭");
    }) || null;
  },

  _isVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 &&
      style.visibility !== "hidden" &&
      style.display !== "none";
  },

  async _fetchTranscriptFromPanel(playerData) {
    const params = playerData?.transcriptParams;
    if (!params) {
      this._recordFailure("TRANSCRIPT_PANEL_UNAVAILABLE");
      return null;
    }

    let innerTube = playerData?.innerTube;
    if (!innerTube?.apiKey) {
      innerTube = this._extractInnerTubeConfigFromPageSource() || innerTube;
    }
    if (!innerTube?.apiKey) {
      this._recordFailure("TRANSCRIPT_INNERTUBE_CONFIG_UNAVAILABLE");
      return null;
    }

    try {
      const response = await fetch(
        "https://www.youtube.com/youtubei/v1/get_transcript?key=" + encodeURIComponent(innerTube.apiKey),
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: "WEB",
                clientVersion: "2.20240101",
              },
            },
            params: params,
          }),
        }
      );
      if (!response.ok) {
        this._recordFailure("TRANSCRIPT_FETCH_FAILED", String(response.status));
        return null;
      }

      const data = await response.json();
      const transcript = this._parseTranscriptResponse(data);
      if (!transcript) {
        this._recordFailure("TRANSCRIPT_PARSE_FAILED");
      }
      return transcript;
    } catch (e) {
      this._recordFailure("TRANSCRIPT_FETCH_FAILED", e.message);
      return null;
    }
  },

  _parseTranscriptResponse(data) {
    const actions = data?.actions;
    if (!Array.isArray(actions)) return null;

    for (const action of actions) {
      const segments = action?.updateEngagementPanelAction?.content?.transcriptRenderer
        ?.content?.transcriptSearchPanelRenderer?.body
        ?.transcriptSegmentListRenderer?.initialSegments;
      if (!Array.isArray(segments)) continue;

      const lines = [];
      for (const segment of segments) {
        const runs = segment?.transcriptSegmentRenderer?.snippet?.runs;
        if (!Array.isArray(runs)) continue;

        const line = runs.map(run => run.text || "").join("").trim();
        if (line) lines.push(line);
      }

      const transcript = this._normalizeTranscript(lines);
      if (transcript) return transcript;
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
  async _getCaptionTracks(videoId, playerData) {
    let tracks = null;

    // Layer 1: read live player state through the main-world bridge.
    playerData = playerData || await this._requestMainWorldPlayerData(videoId);
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
