/**
 * StackOverflow 问答提取器
 *
 * 提取思路：
 * 1. 提取问题标题和内容
 * 2. 提取被采纳答案（如果有）
 * 3. 提取高赞答案（前3个）
 * 4. 保留投票数信息，帮助 AI 判断答案质量
 */

// eslint-disable-next-line no-unused-vars
const StackOverflowExtractor = {

  extract() {
    const url = window.location.href;
    const title = this._getTitle();
    const question = this._getQuestion();
    const answers = this._getAnswers();

    if (!question && answers.length === 0) {
      return null;
    }

    // 组装内容
    let content = "";

    // 问题部分
    content += "[问题] " + title + "\n\n";
    if (question.tags.length > 0) {
      content += "[标签] " + question.tags.join(", ") + "\n\n";
    }
    content += "[问题详情]\n" + question.body + "\n\n";
    content += "---\n\n";

    // 答案部分
    if (answers.length > 0) {
      answers.forEach((answer, i) => {
        const label = answer.isAccepted ? "[已采纳答案]" : "[答案 " + (i + 1) + "]";
        content += label + " (投票: " + answer.votes + ")\n";
        content += answer.body + "\n\n";
      });
    }

    return {
      title: title,
      content: this._truncate(content),
      url: url,
      sourceType: "stackoverflow",
    };
  },

  _getTitle() {
    const titleEl = document.querySelector("#question-header h1 a") ||
                    document.querySelector("h1[itemprop='name'] a") ||
                    document.querySelector("h1");
    if (titleEl) return titleEl.textContent.trim();
    return document.title.replace(/ - Stack Overflow$/, "").trim();
  },

  /**
   * 提取问题内容
   */
  _getQuestion() {
    const result = { body: "", tags: [] };

    // 问题正文
    const bodyEl = document.querySelector("#question .js-post-body") ||
                   document.querySelector("#question .s-prose") ||
                   document.querySelector(".question .post-text");
    if (bodyEl) {
      result.body = this._cleanText(bodyEl);
    }

    // 标签
    const tagEls = document.querySelectorAll("#question .post-tag") ||
                   document.querySelectorAll(".question .post-tag");
    tagEls.forEach(el => {
      const tag = el.textContent.trim();
      if (tag) result.tags.push(tag);
    });

    return result;
  },

  /**
   * 提取答案列表
   */
  _getAnswers() {
    const answers = [];
    const answerEls = document.querySelectorAll("#answers .answer");

    answerEls.forEach(el => {
      // 投票数
      const voteEl = el.querySelector(".js-vote-count") ||
                     el.querySelector('[itemprop="upvoteCount"]');
      const votes = voteEl ? parseInt(voteEl.textContent.trim()) || 0 : 0;

      // 是否被采纳
      const isAccepted = el.classList.contains("accepted-answer") ||
                         el.querySelector(".js-accepted-answer-indicator") !== null;

      // 答案正文
      const bodyEl = el.querySelector(".js-post-body") ||
                     el.querySelector(".s-prose") ||
                     el.querySelector(".post-text");
      const body = bodyEl ? this._cleanText(bodyEl) : "";

      if (body) {
        answers.push({ votes, isAccepted, body });
      }
    });

    // 排序：采纳答案优先，然后按投票数降序
    answers.sort((a, b) => {
      if (a.isAccepted && !b.isAccepted) return -1;
      if (!a.isAccepted && b.isAccepted) return 1;
      return b.votes - a.votes;
    });

    // 只取前 3 个
    return answers.slice(0, 3);
  },

  /**
   * 清理 DOM 元素为纯文本，保留代码块结构
   */
  _cleanText(el) {
    let text = "";
    const children = el.childNodes;

    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();

        if (tag === "pre" || tag === "code") {
          text += "\n```\n" + child.textContent.trim() + "\n```\n";
        } else if (tag === "p") {
          text += "\n" + child.textContent.trim() + "\n";
        } else if (tag === "ul" || tag === "ol") {
          const items = child.querySelectorAll("li");
          items.forEach(li => {
            text += "- " + li.textContent.trim() + "\n";
          });
        } else if (tag === "h1" || tag === "h2" || tag === "h3") {
          text += "\n" + child.textContent.trim() + "\n";
        } else if (tag === "blockquote") {
          text += "\n> " + child.textContent.trim() + "\n";
        } else {
          text += child.textContent;
        }
      }
    }

    return text.replace(/\n{3,}/g, "\n\n").trim();
  },

  _truncate(text, maxLength = 8000) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "\n\n[内容已截断，原文共 " + text.length + " 字]";
  },
};
