package com.example.aisummary.service;

import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import com.aliyun.oss.model.ObjectMetadata;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.time.Duration;
import java.time.LocalDate;
import java.util.Date;
import java.util.UUID;

@Slf4j
@Service
public class OssStorageService {

    @Value("${oss.endpoint:${OSS_ENDPOINT:}}")
    private String endpoint;

    @Value("${oss.bucket:${OSS_BUCKET:}}")
    private String bucket;

    @Value("${oss.access-key-id:${OSS_ACCESS_KEY_ID:}}")
    private String accessKeyId;

    @Value("${oss.access-key-secret:${OSS_ACCESS_KEY_SECRET:}}")
    private String accessKeySecret;

    public String uploadAsrSource(Long userId, String originalFilename, String contentType,
                                  long fileSize, InputStream inputStream) throws IOException {
        ensureConfigured();
        String key = buildObjectKey(userId, originalFilename);

        ObjectMetadata metadata = new ObjectMetadata();
        metadata.setContentLength(fileSize);
        if (StringUtils.hasText(contentType)) {
            metadata.setContentType(contentType);
        }

        OSS client = new OSSClientBuilder().build(endpoint, accessKeyId, accessKeySecret);
        try {
            client.putObject(bucket, key, inputStream, metadata);
            log.info("ASR source uploaded: userId={} fileSize={}", userId, fileSize);
            return key;
        } finally {
            client.shutdown();
        }
    }

    public URL generateSignedUrl(String key, Duration ttl) {
        ensureConfigured();
        OSS client = new OSSClientBuilder().build(endpoint, accessKeyId, accessKeySecret);
        try {
            Date expiration = new Date(System.currentTimeMillis() + ttl.toMillis());
            return client.generatePresignedUrl(bucket, key, expiration);
        } finally {
            client.shutdown();
        }
    }

    public void deleteObject(String key) {
        if (!StringUtils.hasText(key)) {
            return;
        }
        ensureConfigured();
        OSS client = new OSSClientBuilder().build(endpoint, accessKeyId, accessKeySecret);
        try {
            client.deleteObject(bucket, key);
        } finally {
            client.shutdown();
        }
    }

    private void ensureConfigured() {
        if (!StringUtils.hasText(endpoint)
                || !StringUtils.hasText(bucket)
                || !StringUtils.hasText(accessKeyId)
                || !StringUtils.hasText(accessKeySecret)) {
            throw new RuntimeException("ASR_OSS_NOT_CONFIGURED");
        }
    }

    private String buildObjectKey(Long userId, String originalFilename) {
        String extension = "";
        if (StringUtils.hasText(originalFilename)) {
            int dot = originalFilename.lastIndexOf('.');
            if (dot >= 0) {
                extension = originalFilename.substring(dot).toLowerCase();
            }
        }
        return "asr/" + LocalDate.now() + "/u" + userId + "/" + UUID.randomUUID() + extension;
    }
}
