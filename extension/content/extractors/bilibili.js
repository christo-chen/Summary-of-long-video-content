/**
 * B站视频字幕提取器
 *
 * 提取思路：
 * 1. 从页面中获取 bvid 和 cid
 * 2. 通过 B站 player API 获取字幕列表
 * 3. 下载字幕 JSON，拼接为纯文本
 *
 * 如果没有 CC 字幕（很多视频没有），则降级提取视频简介作为内容
 */

// eslint-disable-next-line no-unused-vars
const BilibiliExtractor = {

  extract() {
    const url = window.location.href;
    const title = this._getTitle();
    const { bvid, cid } = this._getVideoIds();

    return {
      title: title,
      content: null,           // 先占位，字幕需要异步获取
      url: url,
      sourceType: "bilibili",
      bvid: bvid,
      cid: cid,
      needAsync: true,         // 标记需要异步获取
    };
  },

  /**
   * 异步获取字幕内容
   */
  async extractAsync() {
    const title = this._getTitle();
    const url = window.location.href;
    const { bvid, cid } = this._getVideoIds();

    if (!bvid || !cid) {
      // 降级：提取视频简介
      return this._fallbackExtract(title, url);
    }

    try {
      // 获取字幕列表
      const subtitleText = await this._fetchSubtitle(bvid, cid);
      if (subtitleText) {
        return {
          title: title,
          content: this._truncate(subtitleText),
          url: url,
          sourceType: "bilibili",
        };
      }
    } catch (e) {
      console.warn("B站字幕获取失败，降级到简介提取：", e);
    }

    // 没有字幕，降级到简介
    return this._fallbackExtract(title, url);
  },

  /**
   * 获取视频标题
   */
  _getTitle() {
    // 优先从 meta 标签获取
    const metaTitle = document.querySelector('meta[name="title"]');
    if (metaTitle) return metaTitle.content;

    // 从 h1 获取
    const h1 = document.querySelector("h1.video-title") ||
               document.querySelector("h1[data-title]") ||
               document.querySelector("h1");
    if (h1) return h1.textContent.trim() || h1.getAttribute("data-title") || "";

    return document.title.replace(/_哔哩哔哩.*$/, "").trim();
  },

  /**
   * 从页面中提取 bvid 和 cid
   */
  _getVideoIds() {
    let bvid = null;
    let cid = null;

    // 从 URL 中提取 bvid
    const bvidMatch = window.location.pathname.match(/\/(BV[\w]+)/);
    if (bvidMatch) bvid = bvidMatch[1];

    // 从 window.__INITIAL_STATE__ 或页面脚本中获取 cid
    try {
      const initialState = window.__INITIAL_STATE__;
      if (initialState && initialState.videoData) {
        cid = initialState.videoData.cid;
        if (!bvid) bvid = initialState.videoData.bvid;
      }
    } catch (e) { /* ignore */ }

    // 尝试从页面中的 script 标签获取
    if (!cid) {
      const scripts = document.querySelectorAll("script");
      for (const script of scripts) {
        const text = script.textContent;
        const cidMatch = text.match(/"cid"\s*[:=]\s*(\d+)/);
        if (cidMatch) {
          cid = cidMatch[1];
          break;
        }
      }
    }

    return { bvid, cid };
  },

  /**
   * 通过 B站 API 获取字幕
   */
  async _fetchSubtitle(bvid, cid) {
    // 获取字幕列表
    const playerUrl = `https://api.bilibili.com/x/player/v2?bvid=${bvid}&cid=${cid}`;
    const playerResp = await fetch(playerUrl, { credentials: "include" });
    const playerData = await playerResp.json();

    const subtitles = playerData?.data?.subtitle?.subtitles;
    if (!subtitles || subtitles.length === 0) {
      return null;
    }

    // 优先选中文字幕
    let subtitleInfo = subtitles.find(s => s.lan === "zh-CN" || s.lan === "ai-zh");
    if (!subtitleInfo) subtitleInfo = subtitles[0];

    // 下载字幕 JSON
    let subtitleUrl = subtitleInfo.subtitle_url;
    if (subtitleUrl.startsWith("//")) subtitleUrl = "https:" + subtitleUrl;

    const subResp = await fetch(subtitleUrl);
    const subData = await subResp.json();

    if (!subData.body || subData.body.length === 0) return null;

    // 拼接字幕文本
    const text = subData.body.map(item => item.content).join("\n");
    return text;
  },

  /**
   * 降级方案：提取视频简介
   */
  _fallbackExtract(title, url) {
    let desc = "";

    // 尝试获取视频简介
    const descEl = document.querySelector(".basic-desc-info") ||
                   document.querySelector('[class*="desc"]') ||
                   document.querySelector(".video-desc");
    if (descEl) desc = descEl.textContent.trim();

    // 如果简介也没有，尝试获取评论区热评
    if (!desc || desc.length < 20) {
      desc = "（该视频无字幕且简介过短，请手动复制视频内容后粘贴）";
    }

    return {
      title: title,
      content: "[B站视频简介]\n\n" + desc,
      url: url,
      sourceType: "bilibili",
    };
  },

  _truncate(text, maxLength = 8000) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "\n\n[字幕已截断，原文共 " + text.length + " 字]";
  },
};
