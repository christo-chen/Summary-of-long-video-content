package com.example.aisummary.service;

import com.example.aisummary.entity.AsrJob;
import com.example.aisummary.mapper.AsrJobMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.io.IOException;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AsrJobService {

    public static final String STATUS_QUEUED = "QUEUED";
    public static final long MAX_FILE_SIZE_BYTES = 50L * 1024 * 1024;

    private static final Set<String> ALLOWED_EXTENSIONS =
            Set.of(".mp3", ".m4a", ".wav", ".aac", ".flac", ".mp4");
    private static final Map<String, Set<String>> ALLOWED_MIME_TYPES = Map.of(
            ".mp3", Set.of("audio/mpeg", "audio/mp3"),
            ".m4a", Set.of("audio/mp4", "audio/x-m4a"),
            ".wav", Set.of("audio/wav", "audio/x-wav", "audio/wave"),
            ".aac", Set.of("audio/aac", "audio/x-aac"),
            ".flac", Set.of("audio/flac", "audio/x-flac"),
            ".mp4", Set.of("video/mp4", "audio/mp4")
    );

    private final AsrJobMapper asrJobMapper;
    private final OssStorageService ossStorageService;
    private final AsrJobQueue asrJobQueue;
    private final ObjectMapper objectMapper;

    public AsrJob createUploadJob(Long userId, MultipartFile file) {
        validateFile(file);
        if (asrJobMapper.countActiveByUserId(userId) > 0) {
            throw new RuntimeException("ASR_JOB_ALREADY_RUNNING");
        }

        String originalFilename = file.getOriginalFilename();
        String contentType = normalize(file.getContentType());
        long fileSize = file.getSize();

        String ossKey;
        try (InputStream inputStream = file.getInputStream()) {
            ossKey = ossStorageService.uploadAsrSource(
                    userId, originalFilename, contentType, fileSize, inputStream);
        } catch (IOException e) {
            throw new RuntimeException("ASR_UPLOAD_FAILED");
        }

        AsrJob job = new AsrJob();
        job.setUserId(userId);
        job.setOssKey(ossKey);
        job.setStatus(STATUS_QUEUED);
        job.setFileSize(fileSize);
        asrJobMapper.insert(job);

        if (!asrJobQueue.submit(job.getId())) {
            asrJobMapper.deleteById(job.getId());
            ossStorageService.deleteObject(ossKey);
            throw new RuntimeException("ASR_QUEUE_FULL");
        }
        return job;
    }

    public AsrJobStatus getJobStatus(Long userId, Long jobId) {
        AsrJob job = asrJobMapper.selectById(jobId);
        if (job == null) {
            throw new RuntimeException("ASR_JOB_NOT_FOUND");
        }
        if (!job.getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "ASR_JOB_FORBIDDEN");
        }

        Object summary = null;
        if (job.getSummary() != null) {
            try {
                summary = objectMapper.readTree(job.getSummary());
            } catch (IOException e) {
                summary = job.getSummary();
            }
        }
        return new AsrJobStatus(job.getId(), job.getStatus(), summary,
                job.getErrorCode(), job.getDurationSeconds());
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new RuntimeException("ASR_FILE_EMPTY");
        }
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new RuntimeException("ASR_FILE_TOO_LARGE");
        }

        String extension = getExtension(file.getOriginalFilename());
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new RuntimeException("ASR_UNSUPPORTED_EXTENSION");
        }

        String contentType = normalize(file.getContentType());
        if (!ALLOWED_MIME_TYPES.getOrDefault(extension, Set.of()).contains(contentType)) {
            throw new RuntimeException("ASR_UNSUPPORTED_MIME");
        }
    }

    private String getExtension(String filename) {
        if (filename == null) {
            return "";
        }
        int dot = filename.lastIndexOf('.');
        if (dot < 0) {
            return "";
        }
        return filename.substring(dot).toLowerCase(Locale.ROOT);
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    public record AsrJobStatus(Long jobId, String status, Object summary,
                               String errorCode, Integer durationSeconds) {
    }
}
