/**
 * 通用文章提取器
 * 使用 Mozilla Readability.js 提取网页正文
 * 
 * Readability.js 已通过 manifest.json 在此脚本之前注入，
 * 全局变量 Readability 可直接使用
 */

// eslint-disable-next-line no-unused-vars
const ArticleExtractor = {

  /**
   * 提取当前页面的正文内容
   * @returns {{ title: string, content: string, url: string, sourceType: string }}
   */
  extract() {
    // 克隆 document，避免 Readability 修改原始 DOM
    const clonedDoc = document.cloneNode(true);

    // 调用 Readability 解析
    const article = new Readability(clonedDoc).parse();

    if (!article || !article.textContent || article.textContent.trim().length < 50) {
      return null;
    }

    return {
      title: article.title || document.title || "无标题",
      content: this._truncate(article.textContent.trim()),
      url: window.location.href,
      sourceType: "article",
    };
  },

  /**
   * 截断过长的内容，控制 AI API 的 Token 消耗
   * 大约 8000 个中文字符 ≈ 4000 tokens
   */
  _truncate(text, maxLength = 8000) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "\n\n[内容已截断，原文共 " + text.length + " 字]";
  },
};
