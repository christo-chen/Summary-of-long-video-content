/**
 * 提取器工厂
 * 根据当前页面 URL 自动选择对应的提取器
 *
 * Phase 1: 通用文章
 * Phase 2: B站 / YouTube / GitHub / StackOverflow
 */

// eslint-disable-next-line no-unused-vars
const ExtractorFactory = {

  /**
   * 根据 URL 判断内容来源类型
   */
  detectSourceType(url) {
    if (url.includes("bilibili.com/video")) return "bilibili";
    if (url.includes("youtube.com/watch")) return "youtube";
    if (url.includes("github.com") && !url.includes("/issues") && !url.includes("/pull")) return "github";
    if (url.includes("stackoverflow.com/questions")) return "stackoverflow";
    return "article";
  },

  /**
   * 同步提取（用于不需要网络请求的提取器）
   */
  extract() {
    const url = window.location.href;
    const sourceType = this.detectSourceType(url);

    switch (sourceType) {
      case "github":
        return GithubExtractor.extract();
      case "stackoverflow":
        return StackOverflowExtractor.extract();
      case "bilibili":
      case "youtube":
        // 视频字幕需要异步获取，返回标记
        return { needAsync: true, sourceType: sourceType };
      case "article":
      default:
        return ArticleExtractor.extract();
    }
  },

  /**
   * 异步提取（用于需要网络请求的提取器，如字幕获取）
   */
  async extractAsync(sourceType) {
    switch (sourceType) {
      case "bilibili":
        return await BilibiliExtractor.extractAsync();
      case "youtube":
        return await YoutubeExtractor.extractAsync();
      default:
        return this.extract();
    }
  },
};
