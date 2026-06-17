package com.example.aisummary.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class AsrTranscriptParser {

    public String extractText(JsonNode root) {
        List<String> texts = new ArrayList<>();
        JsonNode transcripts = root == null ? null : root.path("transcripts");
        if (transcripts != null && transcripts.isArray()) {
            for (JsonNode transcript : transcripts) {
                String text = transcript.path("text").asText("");
                if (!text.isBlank()) {
                    texts.add(text);
                }
            }
        }
        if (texts.isEmpty()) {
            throw new RuntimeException("ASR_TRANSCRIPT_EMPTY");
        }
        return String.join("\n", texts);
    }

    public Integer extractDurationSeconds(JsonNode root, JsonNode usage) {
        Integer usageSeconds = findSeconds(usage);
        if (usageSeconds != null) {
            return usageSeconds;
        }
        usageSeconds = findSeconds(root == null ? null : root.path("usage"));
        if (usageSeconds != null) {
            return usageSeconds;
        }

        long maxEndTimeMs = 0;
        JsonNode transcripts = root == null ? null : root.path("transcripts");
        if (transcripts != null && transcripts.isArray()) {
            for (JsonNode transcript : transcripts) {
                JsonNode sentences = transcript.path("sentences");
                if (sentences.isArray()) {
                    for (JsonNode sentence : sentences) {
                        maxEndTimeMs = Math.max(maxEndTimeMs, readLong(sentence, "end_time"));
                        maxEndTimeMs = Math.max(maxEndTimeMs, readLong(sentence, "endTime"));
                    }
                }
            }
        }
        if (maxEndTimeMs <= 0) {
            return null;
        }
        return (int) ((maxEndTimeMs + 999) / 1000);
    }

    private Integer findSeconds(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        JsonNode seconds = node.path("seconds");
        if (seconds.isNumber()) {
            return seconds.asInt();
        }
        return null;
    }

    private long readLong(JsonNode node, String fieldName) {
        JsonNode value = node.path(fieldName);
        return value.isNumber() ? value.asLong() : 0L;
    }
}
