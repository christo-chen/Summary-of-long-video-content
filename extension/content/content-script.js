/**
 * Content Script 入口
 *
 * 注入到每个网页中，监听来自 Service Worker 的提取指令，
 * 调用 ExtractorFactory 提取内容后返回结果。
 *
 * 支持同步提取（文章/GitHub/SO）和异步提取（B站/YouTube 字幕）
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === "DO_EXTRACT") {
    try {
      const result = ExtractorFactory.extract();

      // 如果需要异步提取（B站/YouTube 字幕）
      if (result && result.needAsync) {
        ExtractorFactory.extractAsync(result.sourceType).then(asyncResult => {
          if (asyncResult && asyncResult.content) {
            sendResponse({ success: true, data: asyncResult });
          } else if (asyncResult && asyncResult.transcriptUnavailable) {
            sendResponse({ success: true, data: asyncResult });
          } else {
            sendResponse({
              success: false,
              errorCode: "VIDEO_CONTENT_EXTRACTION_FAILED",
            });
          }
        }).catch(() => {
          sendResponse({
            success: false,
            errorCode: "CONTENT_EXTRACTION_ERROR",
          });
        });
        // 返回 true 表示异步发送响应
        return true;
      }

      // 同步提取的结果
      if (result) {
        sendResponse({ success: true, data: result });
      } else {
        sendResponse({
          success: false,
          errorCode: "CONTENT_EXTRACTION_FAILED",
        });
      }
    } catch {
      sendResponse({
        success: false,
        errorCode: "CONTENT_EXTRACTION_ERROR",
      });
    }
  }

  // 对于同步情况不需要 return true
});
