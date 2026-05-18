package com.example.aisummary.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * 后端 AI 代理服务：使用内置 DeepSeek API Key 生成摘要。
 * Prompt 逻辑与 extension/utils/prompts.js 保持一致。
 */
@Service
public class AiProxyService {

    private static final String DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";
    private static final String MODEL        = "deepseek-v4-flash";
    private static final int    MAX_CONTENT_LENGTH = 50_000;

    @Value("${DEEPSEEK_API_KEY:}")
    private String apiKey;

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    public AiProxyService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofSeconds(30));
        this.restTemplate = new RestTemplate(factory);
    }

    /**
     * 调用 DeepSeek 生成结构化摘要。
     *
     * @param sourceType 内容来源类型（article / bilibili / youtube / github / stackoverflow）
     * @param content    提取的正文内容
     * @return 解析后的摘要 JsonNode（含 title / one_line_summary / key_points / mindmap_markdown）
     */
    public Object generate(String sourceType, String content) {
        if (!StringUtils.hasText(apiKey)) {
            throw new RuntimeException("未配置内置 AI 服务，请联系管理员");
        }

        String truncated = content.length() > MAX_CONTENT_LENGTH
                ? content.substring(0, MAX_CONTENT_LENGTH) : content;

        Map<String, Object> body = Map.of(
                "model", MODEL,
                "messages", List.of(
                        Map.of("role", "system", "content", getSystemPrompt(sourceType)),
                        Map.of("role", "user",   "content", "请总结以下内容：\n\n" + truncated)
                ),
                "temperature", 0.3,
                "max_tokens",  2000
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + apiKey);

        try {
            ResponseEntity<JsonNode> response = restTemplate.exchange(
                    DEEPSEEK_URL, HttpMethod.POST,
                    new HttpEntity<>(body, headers),
                    JsonNode.class
            );
            String raw = response.getBody()
                    .get("choices").get(0).get("message").get("content").asText();
            return parseResponse(raw);

        } catch (HttpClientErrorException | HttpServerErrorException e) {
            throw new RuntimeException(
                    "AI 服务调用失败 (" + e.getStatusCode().value() + "): " + e.getResponseBodyAsString());
        } catch (ResourceAccessException e) {
            throw new RuntimeException("AI 服务超时，请稍后重试");
        }
    }

    // ---- 响应解析（对齐 api.js _parseResponse）----

    private Object parseResponse(String text) {
        String s = text.trim();
        if (s.startsWith("```json")) s = s.substring(7);
        else if (s.startsWith("```")) s = s.substring(3);
        if (s.endsWith("```")) s = s.substring(0, s.length() - 3);
        s = s.trim();

        try {
            JsonNode node = objectMapper.readTree(s);
            if (!node.has("title") || !node.has("one_line_summary") || !node.has("key_points")) {
                throw new RuntimeException("AI 返回的 JSON 缺少必要字段");
            }
            return node;
        } catch (JsonProcessingException e) {
            throw new RuntimeException("AI 返回内容解析失败，请重试");
        }
    }

    // ---- Prompt 路由（对齐 prompts.js getSystemPrompt）----

    private String getSystemPrompt(String sourceType) {
        return switch (sourceType) {
            case "bilibili", "youtube" -> VIDEO_PROMPT;
            case "github"              -> GITHUB_PROMPT;
            case "stackoverflow"       -> STACKOVERFLOW_PROMPT;
            default                    -> ARTICLE_PROMPT;
        };
    }

    // ═══════════════════════════════════════════
    // Prompt 常量（从 extension/utils/prompts.js 移植）
    // ═══════════════════════════════════════════

    private static final String ARTICLE_PROMPT = """
            你是一个专业的内容摘要助手。用户会提供一篇文章的正文内容，请你进行结构化总结。

            请严格按照以下 JSON 格式返回，不要包含任何多余文字或 Markdown 代码块标记：

            {
              "title": "文章标题（如果能从内容中提炼出更准确的标题，使用你提炼的）",
              "one_line_summary": "一句话概括文章核心内容（不超过50字）",
              "key_points": [
                "核心要点1",
                "核心要点2",
                "核心要点3"
              ],
              "mindmap_markdown": "# 主题\\n## 分支1\\n- 细节\\n## 分支2\\n- 细节"
            }

            要求：
            1. key_points 提取 3-5 条最重要的核心要点，每条不超过 80 字
            2. mindmap_markdown 用 Markdown 标题层级表示思维导图结构（#/##/###/-）
            3. 语言与原文保持一致（中文文章用中文总结，英文文章用英文总结）
            4. 只返回 JSON，不要返回其他任何内容""";

    private static final String VIDEO_PROMPT = """
            你是一个专业的视频内容摘要助手。用户会提供一段视频的字幕文本，请你进行结构化总结。

            注意：字幕文本可能存在语音识别错误、断句不准确、口语化表达等问题，请你智能纠正并理解。

            请严格按照以下 JSON 格式返回：

            {
              "title": "视频的核心主题（简洁准确，不超过30字）",
              "one_line_summary": "一句话概括视频核心内容（不超过50字）",
              "key_points": [
                "核心要点1",
                "核心要点2",
                "核心要点3"
              ],
              "mindmap_markdown": "# 视频主题\\n## 要点1\\n- 细节\\n## 要点2\\n- 细节"
            }

            要求：
            1. key_points 提取 3-5 条最重要的内容要点，将口语化表述转为书面语
            2. 忽略视频中的广告、口水话、重复内容
            3. mindmap_markdown 按视频的讲述逻辑组织结构
            4. 语言与字幕保持一致
            5. 只返回 JSON，不要返回其他任何内容""";

    private static final String GITHUB_PROMPT = """
            你是一个专业的开源项目分析助手。用户会提供一个 GitHub 仓库的 README 和基本信息，请你进行结构化总结。

            注意：普通 AI 遇到代码容易混乱。你需要专注于提取项目的核心价值，忽略具体代码实现细节。

            请严格按照以下 JSON 格式返回：

            {
              "title": "项目名称",
              "one_line_summary": "一句话说明这个项目是做什么的、解决什么问题（不超过50字）",
              "key_points": [
                "项目用途与目标用户",
                "核心技术栈",
                "主要功能特性",
                "安装或使用方式概述",
                "项目当前状态（如有）"
              ],
              "mindmap_markdown": "# 项目名\\n## 用途\\n- 解决的问题\\n## 技术栈\\n- 语言/框架\\n## 核心功能\\n- 功能1\\n- 功能2\\n## 快速开始\\n- 安装方式"
            }

            要求：
            1. key_points 重点提取：项目用途、技术栈、核心功能、安装方式、许可证
            2. 不要逐行翻译 README，而是提炼出开发者最关心的信息
            3. 代码示例只描述其功能，不要复制代码本身
            4. mindmap_markdown 按「用途 → 技术栈 → 功能 → 使用方法」的逻辑组织
            5. 只返回 JSON，不要返回其他任何内容""";

    private static final String STACKOVERFLOW_PROMPT = """
            你是一个专业的技术问答摘要助手。用户会提供一个 StackOverflow 的问题和答案，请你进行结构化总结。

            注意：普通 AI 容易把所有答案平等对待。你需要重点关注被采纳答案和高赞答案，忽略低质量回答。

            请严格按照以下 JSON 格式返回：

            {
              "title": "问题的核心描述（精简为一句话）",
              "one_line_summary": "最佳解决方案的一句话概括（不超过50字）",
              "key_points": [
                "问题本质：[描述根本原因]",
                "最佳方案：[核心解决思路]",
                "关键代码：[如果有，用一句话描述关键代码的作用]",
                "注意事项：[常见坑点或易错点]",
                "替代方案：[如果有其他可行方案]"
              ],
              "mindmap_markdown": "# 问题\\n## 问题本质\\n- 原因\\n## 解决方案\\n### 方案1（推荐）\\n- 步骤\\n### 方案2（备选）\\n- 步骤\\n## 注意事项\\n- 坑点"
            }

            要求：
            1. key_points 按照「问题本质 → 最佳方案 → 关键代码 → 注意事项 → 替代方案」的结构
            2. 优先总结被采纳答案和高赞答案
            3. 代码只描述其功能和用法，不要原封不动复制
            4. 标注不同答案之间的差异和适用场景
            5. 只返回 JSON，不要返回其他任何内容""";
}
