/**
 * Service Worker - 插件后台服务
 * 
 * 职责：
 * 1. 点击插件图标时打开 SidePanel
 * 2. 中转 SidePanel 和 Content Script 之间的消息
 */

// 点击插件图标时，打开侧边栏
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// 监听来自 SidePanel 的消息，转发给 Content Script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === "EXTRACT_CONTENT") {
    // SidePanel 请求提取当前页面内容
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        sendResponse({ success: false, error: "没有找到当前标签页" });
        return;
      }

      const tabId = tabs[0].id;

      chrome.tabs.sendMessage(tabId, { type: "DO_EXTRACT" }, (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({
            success: false,
            error: "无法连接到页面，请刷新后重试：" + chrome.runtime.lastError.message,
          });
          return;
        }
        sendResponse(response);
      });
    });

    // 返回 true 表示异步发送响应
    return true;
  }
});
