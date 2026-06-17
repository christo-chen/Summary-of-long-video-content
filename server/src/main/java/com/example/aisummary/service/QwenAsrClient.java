package com.example.aisummary.service;

import com.fasterxml.jackson.databind.JsonNode;

public interface QwenAsrClient {

    QwenAsrTask submit(String fileUrl);

    QwenAsrTask fetch(String taskId);

    record QwenAsrTask(String taskId, String status, String transcriptionUrl, JsonNode usage) {
    }
}
