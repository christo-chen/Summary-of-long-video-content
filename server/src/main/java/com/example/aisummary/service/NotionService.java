package com.example.aisummary.service;

import com.example.aisummary.entity.User;
import com.example.aisummary.mapper.UserMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * Notion API 服务
 * 负责 OAuth 授权和页面创建
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotionService {

    private final UserMapper userMapper;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${notion.client-id:}")
    private String clientId;

    @Value("${notion.client-secret:}")
    private String clientSecret;

    @Value("${notion.redirect-uri:http://localhost:8080/api/export/notion/callback}")
    private String redirectUri;

    /**
     * 生成 Notion OAuth 授权 URL
     */
    public String getAuthUrl(Long userId) {
        return "https://api.notion.com/v1/oauth/authorize"
                + "?client_id=" + clientId
                + "&response_type=code"
                + "&owner=user"
                + "&redirect_uri=" + redirectUri
                + "&state=user_" + userId.toString();
    }

    /**
     * 处理 OAuth 回调，用授权码换取 access_token
     */
    public void handleCallback(String code, Long userId) {
        String url = "https://api.notion.com/v1/oauth/token";

        // Basic Auth: base64(client_id:client_secret)
        String credentials = Base64.getEncoder().encodeToString(
                (clientId + ":" + clientSecret).getBytes());

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Basic " + credentials);

        Map<String, String> body = Map.of(
                "grant_type", "authorization_code",
                "code", code,
                "redirect_uri", redirectUri
        );

        HttpEntity<Map<String, String>> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<JsonNode> response = restTemplate.exchange(
                    url, HttpMethod.POST, request, JsonNode.class);

            String accessToken = response.getBody().get("access_token").asText();

            // 保存 token 到用户表
            User user = userMapper.selectById(userId);
            if (user != null) {
                user.setNotionToken(accessToken);
                userMapper.updateById(user);
            }
        } catch (Exception e) {
            log.error("Notion OAuth 回调处理失败", e);
            throw new RuntimeException("Notion 授权失败: " + e.getMessage());
        }
    }

    /**
     * 检查用户是否已绑定 Notion
     */
    public boolean isConnected(Long userId) {
        User user = userMapper.selectById(userId);
        return user != null && user.getNotionToken() != null && !user.getNotionToken().isEmpty();
    }

    /**
     * 导出摘要到 Notion
     * 在用户的 Notion 工作区创建一个新页面
     */
    public String exportToNotion(Long userId, String title, String url,
                                  String onLineSummary, List<String> keyPoints,
                                  String sourceType) {
        User user = userMapper.selectById(userId);
        if (user == null || user.getNotionToken() == null) {
            throw new RuntimeException("请先绑定 Notion 账号");
        }

        String token = user.getNotionToken();

        try {
            // 1. 先搜索用户可用的页面作为父页面
            String parentPageId = findFirstAvailablePage(token);
            if (parentPageId == null) {
                throw new RuntimeException("未找到可用的 Notion 页面，请确保已授权页面访问权限");
            }

            // 2. 创建页面
            ObjectNode requestBody = buildNotionPage(parentPageId, title, url,
                    onLineSummary, keyPoints, sourceType);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + token);
            headers.set("Notion-Version", "2022-06-28");

            HttpEntity<String> request = new HttpEntity<>(
                    objectMapper.writeValueAsString(requestBody), headers);

            ResponseEntity<JsonNode> response = restTemplate.exchange(
                    "https://api.notion.com/v1/pages",
                    HttpMethod.POST, request, JsonNode.class);

            String pageId = response.getBody().get("id").asText();
            String pageUrl = response.getBody().get("url").asText();

            log.info("成功创建 Notion 页面: {}", pageUrl);
            return pageUrl;

        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            log.error("导出到 Notion 失败", e);
            throw new RuntimeException("导出失败: " + e.getMessage());
        }
    }

    /**
     * 搜索用户授权的第一个可用页面
     */
    private String findFirstAvailablePage(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + token);
        headers.set("Notion-Version", "2022-06-28");

        // 搜索所有页面
        Map<String, Object> body = Map.of("filter", Map.of("property", "object", "value", "page"));
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<JsonNode> response = restTemplate.exchange(
                    "https://api.notion.com/v1/search",
                    HttpMethod.POST, request, JsonNode.class);

            JsonNode results = response.getBody().get("results");
            if (results != null && results.size() > 0) {
                return results.get(0).get("id").asText();
            }
        } catch (Exception e) {
            log.warn("搜索 Notion 页面失败", e);
        }
        return null;
    }

    /**
     * 构建 Notion 页面的 JSON 结构
     */
    private ObjectNode buildNotionPage(String parentPageId, String title, String url,
                                        String onLineSummary, List<String> keyPoints,
                                        String sourceType) {
        ObjectNode root = objectMapper.createObjectNode();

        // 父页面
        ObjectNode parent = objectMapper.createObjectNode();
        parent.put("page_id", parentPageId);
        root.set("parent", parent);

        // 标题属性
        ObjectNode properties = objectMapper.createObjectNode();
        ObjectNode titleProp = objectMapper.createObjectNode();
        ArrayNode titleArray = objectMapper.createArrayNode();
        ObjectNode titleText = objectMapper.createObjectNode();
        ObjectNode titleContent = objectMapper.createObjectNode();
        titleContent.put("content", title);
        titleText.set("text", titleContent);
        titleArray.add(titleText);
        titleProp.set("title", titleArray);
        properties.set("title", titleProp);
        root.set("properties", properties);

        // 页面内容 (children blocks)
        ArrayNode children = objectMapper.createArrayNode();

        // 来源信息
        children.add(createParagraphBlock("📌 来源类型: " + sourceType + "  |  🔗 " + url));

        // 一句话摘要
        children.add(createHeading2Block("💡 一句话摘要"));
        children.add(createCalloutBlock(onLineSummary));

        // 核心要点
        children.add(createHeading2Block("📋 核心要点"));
        if (keyPoints != null) {
            for (String point : keyPoints) {
                children.add(createBulletBlock(point));
            }
        }

        // 底部信息
        children.add(createDividerBlock());
        children.add(createParagraphBlock("由 AI Summary Assistant 自动生成"));

        root.set("children", children);
        return root;
    }

    // ===== Notion Block 构建辅助方法 =====

    private ObjectNode createParagraphBlock(String text) {
        ObjectNode block = objectMapper.createObjectNode();
        block.put("object", "block");
        block.put("type", "paragraph");
        ObjectNode paragraph = objectMapper.createObjectNode();
        paragraph.set("rich_text", createRichText(text));
        block.set("paragraph", paragraph);
        return block;
    }

    private ObjectNode createHeading2Block(String text) {
        ObjectNode block = objectMapper.createObjectNode();
        block.put("object", "block");
        block.put("type", "heading_2");
        ObjectNode heading = objectMapper.createObjectNode();
        heading.set("rich_text", createRichText(text));
        block.set("heading_2", heading);
        return block;
    }

    private ObjectNode createCalloutBlock(String text) {
        ObjectNode block = objectMapper.createObjectNode();
        block.put("object", "block");
        block.put("type", "callout");
        ObjectNode callout = objectMapper.createObjectNode();
        callout.set("rich_text", createRichText(text));
        ObjectNode icon = objectMapper.createObjectNode();
        icon.put("type", "emoji");
        icon.put("emoji", "💡");
        callout.set("icon", icon);
        block.set("callout", callout);
        return block;
    }

    private ObjectNode createBulletBlock(String text) {
        ObjectNode block = objectMapper.createObjectNode();
        block.put("object", "block");
        block.put("type", "bulleted_list_item");
        ObjectNode bullet = objectMapper.createObjectNode();
        bullet.set("rich_text", createRichText(text));
        block.set("bulleted_list_item", bullet);
        return block;
    }

    private ObjectNode createDividerBlock() {
        ObjectNode block = objectMapper.createObjectNode();
        block.put("object", "block");
        block.put("type", "divider");
        block.set("divider", objectMapper.createObjectNode());
        return block;
    }

    private ArrayNode createRichText(String text) {
        ArrayNode array = objectMapper.createArrayNode();
        ObjectNode richText = objectMapper.createObjectNode();
        richText.put("type", "text");
        ObjectNode content = objectMapper.createObjectNode();
        content.put("content", text);
        richText.set("text", content);
        array.add(richText);
        return array;
    }
}
