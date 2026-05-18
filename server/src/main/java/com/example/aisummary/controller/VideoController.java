package com.example.aisummary.controller;

import com.example.aisummary.dto.Result;
import com.example.aisummary.dto.VideoTranscriptSummaryRequest;
import com.example.aisummary.dto.VideoTranscriptSummaryResponse;
import com.example.aisummary.service.AiProxyService;
import com.example.aisummary.service.VideoTranscriptService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/video")
@RequiredArgsConstructor
public class VideoController {

    private static final Map<String, Set<String>> ALLOWED_VIDEO_HOSTS = Map.of(
            "youtube", Set.of("youtube.com", "www.youtube.com", "youtu.be"),
            "bilibili", Set.of("bilibili.com", "www.bilibili.com", "m.bilibili.com"),
            "douyin", Set.of("douyin.com", "www.douyin.com"),
            "tiktok", Set.of("tiktok.com", "www.tiktok.com"),
            "vimeo", Set.of("vimeo.com", "www.vimeo.com"),
            "dailymotion", Set.of("dailymotion.com", "www.dailymotion.com")
    );

    private final VideoTranscriptService videoTranscriptService;
    private final AiProxyService aiProxyService;

    @PostMapping("/transcript-summary")
    public Result<VideoTranscriptSummaryResponse> transcriptSummary(
            @Valid @RequestBody VideoTranscriptSummaryRequest request) {

        if (!isAllowedVideoUrl(request.getSourceType(), request.getVideoUrl())) {
            return Result.success(VideoTranscriptSummaryResponse.invalidVideoUrl());
        }

        return videoTranscriptService.fetchTranscript(request.getVideoUrl())
                .map(transcript -> {
                    Object summary = aiProxyService.generate(request.getSourceType(), transcript.getText());
                    return Result.success(VideoTranscriptSummaryResponse.success(
                            summary,
                            transcript.getSource(),
                            transcript.getLanguage()));
                })
                .orElseGet(() -> Result.success(
                        VideoTranscriptSummaryResponse.noTranscript(VideoTranscriptService.NO_TRANSCRIPT_MESSAGE)));
    }

    private boolean isAllowedVideoUrl(String sourceType, String videoUrl) {
        String normalizedSourceType = sourceType == null ? "" : sourceType.trim().toLowerCase(Locale.ROOT);
        Set<String> allowedHosts = ALLOWED_VIDEO_HOSTS.get(normalizedSourceType);
        if (allowedHosts == null) {
            return false;
        }

        try {
            URI uri = URI.create(videoUrl);
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (scheme == null || host == null) {
                return false;
            }

            String normalizedScheme = scheme.toLowerCase(Locale.ROOT);
            if (!normalizedScheme.equals("http") && !normalizedScheme.equals("https")) {
                return false;
            }

            return allowedHosts.contains(host.toLowerCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
}
