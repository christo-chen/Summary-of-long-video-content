package com.example.aisummary.service;

import com.alibaba.dashscope.audio.qwen_asr.QwenTranscription;
import com.alibaba.dashscope.audio.qwen_asr.QwenTranscriptionParam;
import com.alibaba.dashscope.audio.qwen_asr.QwenTranscriptionQueryParam;
import com.alibaba.dashscope.audio.qwen_asr.QwenTranscriptionResult;
import com.alibaba.dashscope.audio.qwen_asr.QwenTranscriptionTaskResult;
import com.alibaba.dashscope.common.Status;
import com.alibaba.dashscope.exception.ApiException;
import com.alibaba.dashscope.utils.Constants;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class DashScopeQwenAsrClient implements QwenAsrClient {

    private static final String ENABLE_WORDS = "enable_words";
    private static final String ENABLE_ITN = "enable_itn";

    @Value("${dashscope.api-key:${DASHSCOPE_API_KEY:}}")
    private String apiKey;

    @Value("${dashscope.base-url:https://dashscope.aliyuncs.com/api/v1}")
    private String baseUrl;

    @Value("${dashscope.model:qwen3-asr-flash-filetrans}")
    private String model;

    private final ObjectMapper objectMapper;

    @PostConstruct
    void configureBaseUrl() {
        Constants.baseHttpApiUrl = baseUrl;
    }

    @Override
    public QwenAsrTask submit(String fileUrl) {
        ensureConfigured();
        QwenTranscriptionParam param = QwenTranscriptionParam.builder()
                .apiKey(apiKey)
                .model(model)
                .fileUrl(fileUrl)
                .parameter(ENABLE_WORDS, false)
                .parameter(ENABLE_ITN, false)
                .build();
        try {
            QwenTranscriptionResult result = new QwenTranscription().asyncCall(param);
            logDashScopeResult("SUBMIT", result);
            return toTask(result);
        } catch (ApiException e) {
            logDashScopeApiException("SUBMIT", e);
            throw e;
        } catch (Exception e) {
            log.error("DashScope ASR SDK call failed: operation=SUBMIT exceptionType={} exceptionMessage={}",
                    e.getClass().getName(), e.getMessage(), e);
            throw e;
        }
    }

    @Override
    public QwenAsrTask fetch(String taskId) {
        ensureConfigured();
        QwenTranscriptionQueryParam param = QwenTranscriptionQueryParam.builder()
                .apiKey(apiKey)
                .taskId(taskId)
                .headers(Map.of())
                .build();
        try {
            QwenTranscriptionResult result = new QwenTranscription().fetch(param);
            logDashScopeResult("POLL", result);
            return toTask(result);
        } catch (ApiException e) {
            logDashScopeApiException("POLL", e);
            throw e;
        } catch (Exception e) {
            log.error("DashScope ASR SDK call failed: operation=POLL taskId={} exceptionType={} exceptionMessage={}",
                    taskId, e.getClass().getName(), e.getMessage(), e);
            throw e;
        }
    }

    private QwenAsrTask toTask(QwenTranscriptionResult result) {
        String status = result.getTaskStatus() == null ? "UNKNOWN" : result.getTaskStatus().name();
        String transcriptionUrl = null;
        QwenTranscriptionTaskResult taskResult = result.getResult();
        if (taskResult != null) {
            transcriptionUrl = taskResult.getTranscriptionUrl();
        }
        return new QwenAsrTask(result.getTaskId(), status, transcriptionUrl, toJsonNode(result.getUsage()));
    }

    private JsonNode toJsonNode(JsonObject jsonObject) {
        if (jsonObject == null) {
            return null;
        }
        try {
            return objectMapper.readTree(jsonObject.toString());
        } catch (Exception e) {
            return null;
        }
    }

    private void ensureConfigured() {
        if (!StringUtils.hasText(apiKey)) {
            throw new RuntimeException("ASR_DASHSCOPE_NOT_CONFIGURED");
        }
    }

    private void logDashScopeResult(String operation, QwenTranscriptionResult result) {
        if (result == null) {
            log.error("DashScope ASR returned null result: operation={}", operation);
            return;
        }

        QwenTranscriptionTaskResult taskResult = result.getResult();
        JsonObject output = result.getOutput();
        String code = firstNonBlank(getString(output, "code"), getNestedString(output, "error", "code"));
        String message = firstNonBlank(getString(output, "message"), getNestedString(output, "error", "message"));
        String requestId = firstNonBlank(result.getRequestId(),
                firstNonBlank(getString(output, "request_id"), getString(output, "requestId")));
        String subTaskStatus = taskResult == null || taskResult.getSubTaskStatus() == null
                ? null : taskResult.getSubTaskStatus().name();
        String taskMessage = taskResult == null ? null : taskResult.getMessage();

        boolean hasErrorFields = StringUtils.hasText(code) || StringUtils.hasText(message)
                || StringUtils.hasText(taskMessage);
        boolean failedStatus = result.getTaskStatus() != null
                && ("FAILED".equals(result.getTaskStatus().name())
                || "CANCELED".equals(result.getTaskStatus().name()));

        if (hasErrorFields || failedStatus) {
            log.error("DashScope ASR result: operation={} requestId={} taskId={} taskStatus={} subTaskStatus={} code={} message={} taskMessage={}",
                    operation, requestId, result.getTaskId(), result.getTaskStatus(), subTaskStatus,
                    code, message, taskMessage);
        } else {
            log.info("DashScope ASR result: operation={} requestId={} taskId={} taskStatus={} subTaskStatus={}",
                    operation, requestId, result.getTaskId(), result.getTaskStatus(), subTaskStatus);
        }
    }

    private void logDashScopeApiException(String operation, ApiException e) {
        Status status = e.getStatus();
        if (status == null) {
            log.error("DashScope ASR ApiException: operation={} exceptionMessage={}",
                    operation, e.getMessage(), e);
            return;
        }
        log.error("DashScope ASR ApiException: operation={} statusCode={} code={} message={} requestId={}",
                operation, status.getStatusCode(), status.getCode(), status.getMessage(),
                status.getRequestId(), e);
    }

    private String getString(JsonObject object, String fieldName) {
        if (object == null || !object.has(fieldName)) {
            return null;
        }
        JsonElement element = object.get(fieldName);
        if (element == null || element.isJsonNull()) {
            return null;
        }
        try {
            return element.getAsString();
        } catch (Exception e) {
            return element.toString();
        }
    }

    private String firstNonBlank(String first, String second) {
        return StringUtils.hasText(first) ? first : second;
    }

    private String getNestedString(JsonObject object, String objectFieldName, String fieldName) {
        if (object == null || !object.has(objectFieldName)) {
            return null;
        }
        JsonElement nested = object.get(objectFieldName);
        if (nested == null || !nested.isJsonObject()) {
            return null;
        }
        return getString(nested.getAsJsonObject(), fieldName);
    }
}
