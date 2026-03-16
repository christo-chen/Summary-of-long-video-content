/**
 * AI API 调用封装
 * 
 * 支持 OpenAI 和 DeepSeek（两者 API 格式兼容）
 * API Key 和模型配置存储在 chrome.storage.local 中
 */

// eslint-disable-next-line no-unused-vars
const AiClient = {

  /**
   * 默认配置
   */
  DEFAULT_CONFIG: {
    provider: "deepseek",  // "openai" 或 "deepseek"
    apiKey: "",
    // OpenAI
    openaiModel: "gpt-4o-mini",
    openaiBaseUrl: "https://api.openai.com/v1",
    // DeepSeek
    deepseekModel: "deepseek-chat",
    deepseekBaseUrl: "https://api.deepseek.com/v1",
  },

  /**
   * 从 chrome.storage 读取配置
   */
  async getConfig() {
    return new Promise((resolve) => {
      chrome.storage.local.get("aiConfig", (result) => {
        resolve({ ...this.DEFAULT_CONFIG, ...result.aiConfig });
      });
    });
  },

  /**
   * 保存配置到 chrome.storage
   */
  async saveConfig(config) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ aiConfig: config }, resolve);
    });
  },

  /**
   * 调用 AI API 生成摘要
   * @param {string} sourceType - 内容来源类型
   * @param {string} content - 提取的正文内容
   * @returns {Promise<object>} - 解析后的 JSON 摘要
   */
  async generateSummary(sourceType, content) {
    const config = await this.getConfig();

    if (!config.apiKey) {
      throw new Error("请先在设置中填写 API Key");
    }

    // 根据 provider 选择 baseUrl 和 model
    let baseUrl, model;
    if (config.provider === "openai") {
      baseUrl = config.openaiBaseUrl;
      model = config.openaiModel;
    } else {
      baseUrl = config.deepseekBaseUrl;
      model = config.deepseekModel;
    }

    // 构建请求
    const messages = Prompts.buildMessages(sourceType, content);

    const response = await fetch(baseUrl + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + config.apiKey,
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.3,       // 低温度，输出更稳定
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error("AI API 请求失败 (" + response.status + "): " + errorText);
    }

    const data = await response.json();
    const text = data.choices[0].message.content.trim();

    // 解析 AI 返回的 JSON
    return this._parseResponse(text);
  },

  /**
   * 解析 AI 返回的内容，提取 JSON
   */
  _parseResponse(text) {
    // 去掉可能的 Markdown 代码块标记
    let cleaned = text;
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    try {
      const result = JSON.parse(cleaned);

      // 校验必要字段
      if (!result.title || !result.one_line_summary || !result.key_points) {
        throw new Error("AI 返回的 JSON 缺少必要字段");
      }

      return result;
    } catch (e) {
      throw new Error("AI 返回内容解析失败，请重试。原始内容：" + text.substring(0, 200));
    }
  },
};
