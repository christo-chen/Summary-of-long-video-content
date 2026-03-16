/**
 * 后端 API 调用封装
 *
 * 负责与 Spring Boot 后端通信：
 * - 用户认证（注册/登录）
 * - 摘要 CRUD（保存/查询/删除）
 * - 标签管理
 */

// eslint-disable-next-line no-unused-vars
const BackendApi = {

  BASE_URL: "http://localhost:8080/api",

  // ===== Token 管理 =====

  async getToken() {
    return new Promise((resolve) => {
      chrome.storage.local.get("authToken", (result) => {
        resolve(result.authToken || null);
      });
    });
  },

  async saveToken(token) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ authToken: token }, resolve);
    });
  },

  async saveUserInfo(userInfo) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ userInfo: userInfo }, resolve);
    });
  },

  async getUserInfo() {
    return new Promise((resolve) => {
      chrome.storage.local.get("userInfo", (result) => {
        resolve(result.userInfo || null);
      });
    });
  },

  async clearAuth() {
    return new Promise((resolve) => {
      chrome.storage.local.remove(["authToken", "userInfo"], resolve);
    });
  },

  async isLoggedIn() {
    const token = await this.getToken();
    return token !== null;
  },

  // ===== HTTP 请求封装 =====

  async request(method, path, body) {
    const token = await this.getToken();
    const headers = { "Content-Type": "application/json" };

    if (token) {
      headers["Authorization"] = "Bearer " + token;
    }

    const options = { method, headers };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(this.BASE_URL + path, options);
    const data = await response.json();

    if (data.code !== 200) {
      throw new Error(data.message || "请求失败");
    }

    return data.data;
  },

  // ===== 认证接口 =====

  async register(email, password) {
    const data = await this.request("POST", "/auth/register", { email, password });
    await this.saveToken(data.token);
    await this.saveUserInfo({ userId: data.userId, email: data.email });
    return data;
  },

  async login(email, password) {
    const data = await this.request("POST", "/auth/login", { email, password });
    await this.saveToken(data.token);
    await this.saveUserInfo({ userId: data.userId, email: data.email });
    return data;
  },

  async logout() {
    await this.clearAuth();
  },

  // ===== 摘要接口 =====

  async saveSummary(summaryData) {
    return await this.request("POST", "/summaries", {
      url: summaryData.url,
      title: summaryData.title,
      sourceType: summaryData.sourceType,
      summaryJson: JSON.stringify(summaryData.summaryJson),
      language: summaryData.language || "zh",
    });
  },

  async getSummaryList(page, size, keyword, sourceType, tagId) {
    let path = "/summaries?page=" + page + "&size=" + size;
    if (keyword) path += "&keyword=" + encodeURIComponent(keyword);
    if (sourceType) path += "&sourceType=" + encodeURIComponent(sourceType);
    if (tagId) path += "&tagId=" + tagId;
    return await this.request("GET", path);
  },

  async getSummaryDetail(id) {
    return await this.request("GET", "/summaries/" + id);
  },

  async deleteSummary(id) {
    return await this.request("DELETE", "/summaries/" + id);
  },

  // ===== 标签接口 =====

  async getTags() {
    return await this.request("GET", "/tags");
  },

  async createTag(name) {
    return await this.request("POST", "/tags", { name });
  },

  async deleteTag(id) {
    return await this.request("DELETE", "/tags/" + id);
  },

  async addTagToSummary(summaryId, tagId) {
    return await this.request("POST", "/summaries/" + summaryId + "/tags", { tagId });
  },

  async removeTagFromSummary(summaryId, tagId) {
    return await this.request("DELETE", "/summaries/" + summaryId + "/tags/" + tagId);
  },

  // ===== 导出接口 =====

  async getNotionStatus() {
    return await this.request("GET", "/export/notion/status");
  },

  async getNotionAuthUrl() {
    return await this.request("GET", "/export/notion/auth");
  },

  async exportToNotion(summaryId) {
    return await this.request("POST", "/export/notion/" + summaryId);
  },

  getObsidianDownloadUrl(summaryId) {
    return this.BASE_URL + "/export/obsidian/" + summaryId;
  },

  getLogseqDownloadUrl(summaryId) {
    return this.BASE_URL + "/export/logseq/" + summaryId;
  },

  /**
   * 下载文件（需要带 Token 的认证下载）
   */
  async downloadFile(url, filename) {
    const token = await this.getToken();
    const response = await fetch(url, {
      headers: { "Authorization": "Bearer " + token },
    });
    const blob = await response.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  },
};
