/**
 * YouTube 视频字幕提取器
 *
 * 提取思路：
 * 1. 从页面的 ytInitialPlayerResponse 中获取字幕轨道信息
 * 2. 请求字幕 XML/JSON，解析为纯文本
 * 3. 如果没有字幕，降级提取视频描述
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
      if (subtitleText) {
        return {
          title: title,
          content: this._truncate(subtitleText),
          url: url,
          sourceType: "youtube",
        };
      }
    } catch (e) {
      console.warn("YouTube 字幕获取失败，降级到描述提取：", e);
    }

    return this._fallbackExtract(title, url);
  },

  _getTitle() {
    const titleEl = document.querySelector("h1.ytd-video-primary-info-renderer yt-formatted-string") ||
                    document.querySelector("h1.ytd-watch-metadata yt-formatted-string") ||
                    document.querySelector("h1");
    if (titleEl) return titleEl.textContent.trim();
    return document.title.replace(/ - YouTube$/, "").trim();
  },

  /**
   * 从页面数据中获取字幕轨道并下载
   */
  async _fetchSubtitle() {
    // 从页面 script 中提取 ytInitialPlayerResponse
    const captionTracks = this._getCaptionTracks();
    if (!captionTracks || captionTracks.length === 0) return null;

    // 优先选中文，其次英文，最后选第一个
    let track = captionTracks.find(t => t.languageCode === "zh-Hans" || t.languageCode === "zh-CN" || t.languageCode === "zh");
    if (!track) track = captionTracks.find(t => t.languageCode === "en");
    if (!track) track = captionTracks[0];

    // 请求字幕（加 fmt=json3 获取 JSON 格式）
    let captionUrl = track.baseUrl;
    if (captionUrl.includes("?")) {
      captionUrl += "&fmt=json3";
    } else {
      captionUrl += "?fmt=json3";
    }

    const resp = await fetch(captionUrl);
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

    return lines.join("\n");
  },

  /**
   * 从页面中提取字幕轨道信息
   */
  _getCaptionTracks() {
    // 方法1：从页面脚本中正则匹配
    const scripts = document.querySelectorAll("script");
    for (const script of scripts) {
      const text = script.textContent;
      if (text.includes("captionTracks")) {
        const match = text.match(/"captionTracks"\s*:\s*(\[.*?\])/);
        if (match) {
          try {
            return JSON.parse(match[1]);
          } catch (e) { /* continue */ }
        }
      }
    }

    // 方法2：从 ytInitialPlayerResponse 全局变量
    try {
      if (window.ytInitialPlayerResponse) {
        const captions = window.ytInitialPlayerResponse.captions;
        if (captions && captions.playerCaptionsTracklistRenderer) {
          return captions.playerCaptionsTracklistRenderer.captionTracks;
        }
      }
    } catch (e) { /* ignore */ }

    return null;
  },

  _fallbackExtract(title, url) {
    let desc = "";
    const descEl = document.querySelector("#description-text") ||
                   document.querySelector("ytd-text-inline-expander") ||
                   document.querySelector('[id="description"]');
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
