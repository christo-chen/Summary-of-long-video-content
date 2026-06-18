package com.example.aisummary.service;

import com.example.aisummary.entity.AsrJob;
import com.example.aisummary.mapper.AsrJobMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.net.URL;
import java.time.Duration;
import java.time.Instant;

@Slf4j
@Service
@RequiredArgsConstructor
public class AsrWorkerService {

    private static final Duration SIGNED_URL_TTL = Duration.ofHours(2);
    private static final String SUMMARY_SOURCE_TYPE = "youtube";

    private final AsrJobMapper asrJobMapper;
    private final OssStorageService ossStorageService;
    private final QwenAsrClient qwenAsrClient;
    private final TranscriptionDownloader transcriptionDownloader;
    private final AsrTranscriptParser transcriptParser;
    private final AiProxyService aiProxyService;
    private final ObjectMapper objectMapper;

    @Value("${asr.worker.timeout-minutes:40}")
    private long timeoutMinutes;

    @Value("${asr.worker.poll-interval-millis:3000}")
    private long pollIntervalMillis;

    public void process(Long jobId) {
        String step = "INIT";
        AsrJob job = asrJobMapper.selectById(jobId);
        if (job == null) {
            log.warn("ASR job missing: jobId={}", jobId);
            return;
        }

        try {
            markRunning(job);
            step = "SIGNED_URL";
            URL signedUrl = ossStorageService.generateSignedUrl(job.getOssKey(), SIGNED_URL_TTL);
            log.info("ASR signed URL generated: jobId={} userId={} fileSize={} step={} signedUrl={}",
                    job.getId(), job.getUserId(), job.getFileSize(), step, sanitizeUrl(signedUrl));

            step = "SUBMIT";
            QwenAsrClient.QwenAsrTask submitted = qwenAsrClient.submit(signedUrl.toString());
            if (!StringUtils.hasText(submitted.taskId())) {
                throw new AsrWorkerException("ASR_SUBMIT_FAILED");
            }
            job.setTaskId(submitted.taskId());
            updateJob(job);

            step = "POLL";
            QwenAsrClient.QwenAsrTask completed = pollUntilFinished(job, submitted.taskId());
            step = "DOWNLOAD_TRANSCRIPTION";
            JsonNode transcription = transcriptionDownloader.download(completed.transcriptionUrl());
            step = "PARSE";
            String transcriptText = transcriptParser.extractText(transcription);
            if (!StringUtils.hasText(transcriptText)) {
                throw new AsrWorkerException("ASR_EMPTY_TRANSCRIPT");
            }
            Integer durationSeconds = transcriptParser.extractDurationSeconds(transcription, completed.usage());
            step = "SUMMARIZE";
            Object summary = aiProxyService.generate(SUMMARY_SOURCE_TYPE, transcriptText);

            job.setStatus("SUCCEEDED");
            job.setSummary(objectMapper.writeValueAsString(summary));
            job.setErrorCode(null);
            job.setDurationSeconds(durationSeconds);
            updateJob(job);
            log.info("ASR job succeeded: jobId={} userId={} fileSize={} durationSeconds={} status={}",
                    job.getId(), job.getUserId(), job.getFileSize(), durationSeconds, job.getStatus());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("ASR job failed, jobId={}, step={}", jobId, step, e);
            failJob(job, "ASR_INTERRUPTED");
        } catch (AsrWorkerException e) {
            log.error("ASR job failed: jobId={} userId={} phase={} status=FAILED errorCode={}",
                    jobId, job.getUserId(), step, e.getMessage(), e);
            failJob(job, e.getMessage());
        } catch (Exception e) {
            log.error("ASR job failed, jobId={}, step={}", jobId, step, e);
            failJob(job, "ASR_FAILED");
        } finally {
            cleanupOss(job);
        }
    }

    private QwenAsrClient.QwenAsrTask pollUntilFinished(AsrJob job, String taskId) throws InterruptedException {
        Instant deadline = Instant.now().plus(Duration.ofMinutes(timeoutMinutes));
        while (Instant.now().isBefore(deadline)) {
            Thread.sleep(pollIntervalMillis);
            QwenAsrClient.QwenAsrTask task = qwenAsrClient.fetch(taskId);
            String status = task.status();
            if ("SUCCEEDED".equals(status)) {
                if (!StringUtils.hasText(task.transcriptionUrl())) {
                    throw new AsrWorkerException("ASR_TRANSCRIPTION_URL_MISSING");
                }
                return task;
            }
            if ("FAILED".equals(status) || "CANCELED".equals(status)) {
                throw new AsrWorkerException("ASR_TASK_" + status);
            }
            log.info("ASR job polling: jobId={} userId={} fileSize={} status={}",
                    job.getId(), job.getUserId(), job.getFileSize(), status);
        }
        throw new AsrWorkerException("ASR_TIMEOUT");
    }

    private void markRunning(AsrJob job) {
        job.setStatus("RUNNING");
        job.setErrorCode(null);
        updateJob(job);
        log.info("ASR job running: jobId={} userId={} fileSize={} status={}",
                job.getId(), job.getUserId(), job.getFileSize(), job.getStatus());
    }

    private void failJob(AsrJob job, String errorCode) {
        job.setStatus("FAILED");
        job.setErrorCode(errorCode);
        updateJob(job);
        log.warn("ASR job failed: jobId={} userId={} fileSize={} durationSeconds={} status={} errorCode={}",
                job.getId(), job.getUserId(), job.getFileSize(), job.getDurationSeconds(),
                job.getStatus(), errorCode);
    }

    private void updateJob(AsrJob job) {
        asrJobMapper.updateById(job);
    }

    private void cleanupOss(AsrJob job) {
        try {
            ossStorageService.deleteObject(job.getOssKey());
        } catch (Exception e) {
            log.warn("ASR OSS cleanup failed: jobId={} userId={} fileSize={} status={} errorCode={}",
                    job.getId(), job.getUserId(), job.getFileSize(), job.getStatus(), job.getErrorCode(), e);
        }
    }

    private String sanitizeUrl(URL url) {
        if (url == null) {
            return "";
        }
        String path = url.getPath();
        return url.getProtocol() + "://" + url.getHost() + (path == null ? "" : path);
    }

    private static class AsrWorkerException extends RuntimeException {
        AsrWorkerException(String message) {
            super(message);
        }
    }
}
