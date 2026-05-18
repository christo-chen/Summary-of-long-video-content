package com.example.aisummary.service;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

@Slf4j
@Service
public class VideoTranscriptService {

    public static final String NO_TRANSCRIPT_MESSAGE =
            "当前视频没有检测到可用字幕/转录文本，因此无法准确总结视频内容。为了避免生成不准确内容，本次不会仅根据标题或简介生成总结。";

    private static final int MIN_TRANSCRIPT_LENGTH = 80;
    private static final long YT_DLP_TIMEOUT_SECONDS = 45;
    private static final Pattern TIMESTAMP_LINE = Pattern.compile(
            "^(\\d{1,2}:)?\\d{1,2}:\\d{2}[,.]\\d{1,3}\\s*-->\\s*(\\d{1,2}:)?\\d{1,2}:\\d{2}[,.]\\d{1,3}.*$");
    private static final Pattern SRT_INDEX_LINE = Pattern.compile("^\\d+$");
    private static final Pattern HTML_TAG = Pattern.compile("<[^>]+>");

    public Optional<TranscriptResult> fetchTranscript(String videoUrl) {
        Path tempDir = null;
        try {
            tempDir = Files.createTempDirectory("ai-summary-video-");

            List<YtDlpAttempt> attempts = List.of(
                    new YtDlpAttempt("yt-dlp-subtitle", "--write-sub", "zh.*,en.*"),
                    new YtDlpAttempt("yt-dlp-subtitle", "--write-sub", "all"),
                    new YtDlpAttempt("yt-dlp-auto-subtitle", "--write-auto-sub", "zh.*,en.*"),
                    new YtDlpAttempt("yt-dlp-auto-subtitle", "--write-auto-sub", "all")
            );

            for (YtDlpAttempt attempt : attempts) {
                deleteSubtitleFiles(tempDir);
                if (!runYtDlp(videoUrl, tempDir, attempt)) {
                    continue;
                }

                Optional<Path> subtitleFile = findBestSubtitleFile(tempDir);
                if (subtitleFile.isEmpty()) {
                    continue;
                }

                String transcript = cleanSubtitleFile(subtitleFile.get());
                if (transcript.length() >= MIN_TRANSCRIPT_LENGTH) {
                    TranscriptResult result = new TranscriptResult();
                    result.setText(transcript);
                    result.setSource(attempt.source());
                    result.setLanguage(detectLanguage(subtitleFile.get()));
                    return Optional.of(result);
                }
            }
        } catch (IOException e) {
            log.warn("Failed to prepare yt-dlp temp directory", e);
        } finally {
            if (tempDir != null) {
                deleteDirectory(tempDir);
            }
        }

        return Optional.empty();
    }

    private boolean runYtDlp(String videoUrl, Path tempDir, YtDlpAttempt attempt) {
        List<String> command = new ArrayList<>();
        command.add("yt-dlp");
        command.add("--skip-download");
        command.add(attempt.writeFlag());
        command.add("--sub-langs");
        command.add(attempt.languages());
        command.add("--sub-format");
        command.add("vtt/srt/json3/best");
        command.add("--output");
        command.add(tempDir.resolve("subtitle.%(ext)s").toString());
        command.add(videoUrl);

        Process process = null;
        try {
            Path logFile = tempDir.resolve("yt-dlp.log");
            process = new ProcessBuilder(command)
                    .redirectErrorStream(true)
                    .redirectOutput(logFile.toFile())
                    .directory(tempDir.toFile())
                    .start();
            boolean finished = process.waitFor(YT_DLP_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                log.warn("yt-dlp timed out for video subtitles");
                return false;
            }

            if (process.exitValue() != 0) {
                String output = Files.exists(logFile)
                        ? Files.readString(logFile, StandardCharsets.UTF_8)
                        : "";
                log.warn("yt-dlp subtitle attempt failed: {}", firstLine(output));
                return false;
            }
            return true;
        } catch (IOException e) {
            log.warn("yt-dlp is unavailable or failed to start: {}", e.getMessage());
            return false;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            if (process != null) {
                process.destroyForcibly();
            }
            return false;
        }
    }

    private Optional<Path> findBestSubtitleFile(Path tempDir) throws IOException {
        try (var files = Files.list(tempDir)) {
            return files
                    .filter(Files::isRegularFile)
                    .filter(this::isSubtitleFile)
                    .sorted(Comparator.comparingInt(this::languagePriority))
                    .findFirst();
        }
    }

    private boolean isSubtitleFile(Path path) {
        String name = path.getFileName().toString().toLowerCase(Locale.ROOT);
        return name.endsWith(".vtt") || name.endsWith(".srt") || name.endsWith(".json3") || name.endsWith(".json");
    }

    private int languagePriority(Path path) {
        String name = path.getFileName().toString().toLowerCase(Locale.ROOT);
        if (name.contains(".zh") || name.contains("zh-") || name.contains("zh_")) return 0;
        if (name.contains(".en") || name.contains("en-") || name.contains("en_")) return 1;
        return 2;
    }

    private String detectLanguage(Path path) {
        String name = path.getFileName().toString().toLowerCase(Locale.ROOT);
        if (name.contains(".zh") || name.contains("zh-") || name.contains("zh_")) return "zh";
        if (name.contains(".en") || name.contains("en-") || name.contains("en_")) return "en";
        return "unknown";
    }

    private String cleanSubtitleFile(Path file) throws IOException {
        String name = file.getFileName().toString().toLowerCase(Locale.ROOT);
        String raw = Files.readString(file, StandardCharsets.UTF_8);
        if (name.endsWith(".json3") || name.endsWith(".json")) {
            return cleanJson3(raw);
        }
        return cleanTimedText(raw);
    }

    private String cleanTimedText(String raw) {
        Set<String> seen = new LinkedHashSet<>();
        for (String line : raw.split("\\R")) {
            String cleaned = line.trim();
            if (!StringUtils.hasText(cleaned)) continue;
            if (cleaned.equalsIgnoreCase("WEBVTT")) continue;
            if (cleaned.startsWith("Kind:") || cleaned.startsWith("Language:")) continue;
            if (TIMESTAMP_LINE.matcher(cleaned).matches()) continue;
            if (SRT_INDEX_LINE.matcher(cleaned).matches()) continue;

            cleaned = HTML_TAG.matcher(cleaned).replaceAll("");
            cleaned = decodeHtmlEntities(cleaned).trim();
            if (StringUtils.hasText(cleaned)) {
                seen.add(cleaned);
            }
        }
        return String.join("\n", seen);
    }

    private String cleanJson3(String raw) {
        Set<String> seen = new LinkedHashSet<>();
        var matcher = Pattern.compile("\"utf8\"\\s*:\\s*\"((?:\\\\.|[^\"\\\\])*)\"").matcher(raw);
        while (matcher.find()) {
            String line = unescapeJsonString(matcher.group(1)).trim();
            if (StringUtils.hasText(line) && !line.equals("\\n")) {
                seen.add(line);
            }
        }
        return String.join("\n", seen);
    }

    private String unescapeJsonString(String value) {
        return value
                .replace("\\n", "\n")
                .replace("\\\"", "\"")
                .replace("\\/", "/")
                .replace("\\\\", "\\")
                .replace("\\u0026", "&");
    }

    private String decodeHtmlEntities(String value) {
        return value
                .replace("&amp;", "&")
                .replace("&#39;", "'")
                .replace("&quot;", "\"")
                .replace("&lt;", "<")
                .replace("&gt;", ">");
    }

    private void deleteSubtitleFiles(Path tempDir) throws IOException {
        try (var files = Files.list(tempDir)) {
            for (Path file : files.toList()) {
                Files.deleteIfExists(file);
            }
        }
    }

    private void deleteDirectory(Path dir) {
        try (var paths = Files.walk(dir)) {
            paths.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException e) {
                    log.warn("Failed to delete temp file {}", path, e);
                }
            });
        } catch (IOException e) {
            log.warn("Failed to cleanup temp directory {}", dir, e);
        }
    }

    private String firstLine(String output) {
        if (!StringUtils.hasText(output)) return "";
        String[] lines = output.split("\\R", 2);
        return lines[0];
    }

    private record YtDlpAttempt(String source, String writeFlag, String languages) {}

    @Data
    public static class TranscriptResult {
        private String text;
        private String source;
        private String language;
    }
}
