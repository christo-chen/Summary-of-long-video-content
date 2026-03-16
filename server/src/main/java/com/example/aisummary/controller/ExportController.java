package com.example.aisummary.controller;

import com.example.aisummary.dto.Result;
import com.example.aisummary.dto.SummaryResponse;
import com.example.aisummary.service.NotionService;
import com.example.aisummary.service.SummaryService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/export")
@RequiredArgsConstructor
public class ExportController {

    private final NotionService notionService;
    private final SummaryService summaryService;
    private final ObjectMapper objectMapper;

    // ===== Notion OAuth =====

    /**
     * 获取 Notion 授权状态
     * GET /api/export/notion/status
     */
    @GetMapping("/notion/status")
    public Result<Map<String, Boolean>> notionStatus(Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        boolean connected = notionService.isConnected(userId);
        return Result.success(Map.of("connected", connected));
    }

    /**
     * 发起 Notion OAuth 授权
     * GET /api/export/notion/auth
     */
    @GetMapping("/notion/auth")
    public Result<Map<String, String>> notionAuth(Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        String authUrl = notionService.getAuthUrl(userId);
        return Result.success(Map.of("authUrl", authUrl));
    }

    /**
     * Notion OAuth 回调
     * GET /api/export/notion/callback?code=xxx&state=userId
     */
    @GetMapping("/notion/callback")
    public ResponseEntity<String> notionCallback(@RequestParam String code,
                                                  @RequestParam String state) {
        try {
            Long userId = Long.parseLong(state.replace("user_", ""));
            notionService.handleCallback(code, userId);
            // 返回成功页面，提示用户关闭窗口
            String html = "<!DOCTYPE html><html><body style='font-family:sans-serif;text-align:center;padding:60px'>"
                    + "<h2>✅ Notion 授权成功！</h2>"
                    + "<p>你可以关闭此窗口，回到插件继续使用。</p>"
                    + "<script>setTimeout(()=>window.close(),3000)</script>"
                    + "</body></html>";
            return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(html);
        } catch (Exception e) {
            String html = "<!DOCTYPE html><html><body style='font-family:sans-serif;text-align:center;padding:60px'>"
                    + "<h2>❌ 授权失败</h2><p>" + e.getMessage() + "</p></body></html>";
            return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(html);
        }
    }

    /**
     * 导出摘要到 Notion
     * POST /api/export/notion/{summaryId}
     */
    @PostMapping("/notion/{summaryId}")
    public Result<Map<String, String>> exportToNotion(@PathVariable Long summaryId,
                                                       Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        SummaryResponse summary = summaryService.getSummaryDetail(summaryId, userId);

        // 解析 summaryJson
        String onLineSummary = "";
        List<String> keyPoints = new ArrayList<>();
        try {
            JsonNode json = objectMapper.readTree(summary.getSummaryJson());
            onLineSummary = json.has("one_line_summary") ? json.get("one_line_summary").asText() : "";
            if (json.has("key_points")) {
                for (JsonNode point : json.get("key_points")) {
                    keyPoints.add(point.asText());
                }
            }
        } catch (Exception e) { /* ignore */ }

        String pageUrl = notionService.exportToNotion(
                userId, summary.getTitle(), summary.getUrl(),
                onLineSummary, keyPoints, summary.getSourceType());

        return Result.success(Map.of("notionUrl", pageUrl));
    }

    // ===== Obsidian Markdown 导出 =====

    /**
     * 下载 Obsidian 格式的 Markdown
     * GET /api/export/obsidian/{summaryId}
     */
    @GetMapping("/obsidian/{summaryId}")
    public ResponseEntity<byte[]> exportObsidian(@PathVariable Long summaryId,
                                                  Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        SummaryResponse summary = summaryService.getSummaryDetail(summaryId, userId);
        String markdown = buildObsidianMarkdown(summary);
        String filename = sanitizeFilename(summary.getTitle()) + ".md";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.TEXT_PLAIN)
                .body(markdown.getBytes(StandardCharsets.UTF_8));
    }

    // ===== Logseq Markdown 导出 =====

    /**
     * 下载 Logseq 格式的 Markdown
     * GET /api/export/logseq/{summaryId}
     */
    @GetMapping("/logseq/{summaryId}")
    public ResponseEntity<byte[]> exportLogseq(@PathVariable Long summaryId,
                                                Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        SummaryResponse summary = summaryService.getSummaryDetail(summaryId, userId);
        String markdown = buildLogseqMarkdown(summary);
        String filename = sanitizeFilename(summary.getTitle()) + ".md";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.TEXT_PLAIN)
                .body(markdown.getBytes(StandardCharsets.UTF_8));
    }

    // ===== Markdown 生成 =====

    private String buildObsidianMarkdown(SummaryResponse summary) {
        StringBuilder sb = new StringBuilder();

        // YAML Front Matter
        sb.append("---\n");
        sb.append("title: \"").append(summary.getTitle().replace("\"", "\\\"")).append("\"\n");
        sb.append("source: ").append(summary.getUrl()).append("\n");
        sb.append("type: ").append(summary.getSourceType()).append("\n");
        sb.append("created: ").append(formatTime(summary.getCreateTime())).append("\n");
        if (summary.getTags() != null && !summary.getTags().isEmpty()) {
            sb.append("tags:\n");
            for (SummaryResponse.TagInfo tag : summary.getTags()) {
                sb.append("  - ").append(tag.getName()).append("\n");
            }
        }
        sb.append("---\n\n");

        // 正文
        sb.append("# ").append(summary.getTitle()).append("\n\n");
        sb.append("> 来源: [原文链接](").append(summary.getUrl()).append(")\n\n");

        try {
            JsonNode json = objectMapper.readTree(summary.getSummaryJson());

            if (json.has("one_line_summary")) {
                sb.append("## 💡 一句话摘要\n\n");
                sb.append("> ").append(json.get("one_line_summary").asText()).append("\n\n");
            }

            if (json.has("key_points")) {
                sb.append("## 📌 核心要点\n\n");
                for (JsonNode point : json.get("key_points")) {
                    sb.append("- ").append(point.asText()).append("\n");
                }
                sb.append("\n");
            }

            if (json.has("mindmap_markdown")) {
                sb.append("## 🗺️ 思维导图\n\n");
                sb.append("```\n").append(json.get("mindmap_markdown").asText()).append("\n```\n\n");
            }
        } catch (Exception e) { /* ignore */ }

        sb.append("---\n*由 AI Summary Assistant 自动生成*\n");
        return sb.toString();
    }

    private String buildLogseqMarkdown(SummaryResponse summary) {
        StringBuilder sb = new StringBuilder();

        // Logseq 大纲格式（用 - 前缀）
        sb.append("- ").append(summary.getTitle()).append("\n");
        sb.append("  - 来源:: [原文链接](").append(summary.getUrl()).append(")\n");
        sb.append("  - 类型:: ").append(summary.getSourceType()).append("\n");
        sb.append("  - 时间:: ").append(formatTime(summary.getCreateTime())).append("\n");

        try {
            JsonNode json = objectMapper.readTree(summary.getSummaryJson());

            if (json.has("one_line_summary")) {
                sb.append("  - **一句话摘要**\n");
                sb.append("    - ").append(json.get("one_line_summary").asText()).append("\n");
            }

            if (json.has("key_points")) {
                sb.append("  - **核心要点**\n");
                for (JsonNode point : json.get("key_points")) {
                    sb.append("    - ").append(point.asText()).append("\n");
                }
            }
        } catch (Exception e) { /* ignore */ }

        return sb.toString();
    }

    private String sanitizeFilename(String name) {
        return name.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
    }

    private String formatTime(LocalDateTime time) {
        if (time == null) return "";
        return time.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
    }
}
