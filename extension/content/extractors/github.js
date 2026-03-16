/**
 * GitHub 仓库提取器
 *
 * 提取思路：
 * 1. 从页面中直接提取渲染后的 README 内容
 * 2. 同时提取仓库的基本信息（描述、语言、Stars 等）
 */

// eslint-disable-next-line no-unused-vars
const GithubExtractor = {

  extract() {
    const url = window.location.href;
    const repoInfo = this._getRepoInfo();
    const readme = this._getReadmeContent();

    if (!readme && !repoInfo.description) {
      return null;
    }

    // 组装提取内容
    let content = "";

    // 仓库基本信息
    if (repoInfo.description) {
      content += "[仓库描述] " + repoInfo.description + "\n\n";
    }
    if (repoInfo.topics.length > 0) {
      content += "[标签] " + repoInfo.topics.join(", ") + "\n\n";
    }
    if (repoInfo.language) {
      content += "[主要语言] " + repoInfo.language + "\n";
    }
    if (repoInfo.stars) {
      content += "[Stars] " + repoInfo.stars + "\n";
    }

    content += "\n---\n\n[README 内容]\n\n" + readme;

    return {
      title: repoInfo.fullName || this._getRepoName(),
      content: this._truncate(content),
      url: url,
      sourceType: "github",
    };
  },

  /**
   * 从页面中提取仓库基本信息
   */
  _getRepoInfo() {
    const info = {
      fullName: "",
      description: "",
      language: "",
      stars: "",
      topics: [],
    };

    // 仓库全名（owner/repo）
    const nameEl = document.querySelector('[itemprop="name"]') ||
                   document.querySelector("strong.mr-2 a");
    if (nameEl) {
      // 尝试拼接 owner/repo
      const pathParts = window.location.pathname.split("/").filter(Boolean);
      if (pathParts.length >= 2) {
        info.fullName = pathParts[0] + "/" + pathParts[1];
      }
    }

    // 描述
    const descEl = document.querySelector("p.f4.my-3") ||
                   document.querySelector('[data-pjax="#repo-content-pjax-container"] .f4') ||
                   document.querySelector(".BorderGrid-cell p.f4");
    if (descEl) info.description = descEl.textContent.trim();

    // 主要语言
    const langEl = document.querySelector('[data-ga-click*="language"]') ||
                   document.querySelector(".BorderGrid-cell .d-inline-flex [itemprop='programmingLanguage']");
    if (langEl) info.language = langEl.textContent.trim();

    // Stars
    const starsEl = document.querySelector("#repo-stars-counter-star") ||
                    document.querySelector("a[href$='/stargazers'] .Counter") ||
                    document.querySelector("[id='repo-stars-counter-star']");
    if (starsEl) info.stars = starsEl.textContent.trim();

    // Topics 标签
    const topicEls = document.querySelectorAll("a.topic-tag");
    topicEls.forEach(el => {
      const topic = el.textContent.trim();
      if (topic) info.topics.push(topic);
    });

    return info;
  },

  /**
   * 提取 README 内容
   */
  _getReadmeContent() {
    // GitHub 渲染的 README 区域
    const readmeEl = document.querySelector("#readme article") ||
                     document.querySelector(".markdown-body") ||
                     document.querySelector('[data-testid="readme-panel"]');

    if (!readmeEl) return "";

    // 提取纯文本，保留基本结构
    return this._extractText(readmeEl);
  },

  /**
   * 从 DOM 元素中提取结构化文本
   */
  _extractText(el) {
    let text = "";
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);

    let node;
    while (node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent.trim();
        if (t) text += t + " ";
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        if (tag === "br" || tag === "p" || tag === "div") text += "\n";
        if (tag === "h1") text += "\n# ";
        if (tag === "h2") text += "\n## ";
        if (tag === "h3") text += "\n### ";
        if (tag === "li") text += "\n- ";
        if (tag === "pre") text += "\n```\n";
      }
    }

    return text.replace(/\n{3,}/g, "\n\n").trim();
  },

  _getRepoName() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) return parts[0] + "/" + parts[1];
    return document.title;
  },

  _truncate(text, maxLength = 8000) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "\n\n[内容已截断，原文共 " + text.length + " 字]";
  },
};
