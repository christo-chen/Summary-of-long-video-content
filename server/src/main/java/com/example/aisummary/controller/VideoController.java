package com.example.aisummary.controller;

import com.example.aisummary.dto.Result;
import com.example.aisummary.dto.VideoTranscriptSummaryRequest;
import com.example.aisummary.dto.VideoTranscriptSummaryResponse;
import com.example.aisummary.service.AiProxyService;
import com.example.aisummary.service.VideoTranscriptService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/video")
@RequiredArgsConstructor
public class VideoController {

    private final VideoTranscriptService videoTranscriptService;
    private final AiProxyService aiProxyService;

    @PostMapping("/transcript-summary")
    public Result<VideoTranscriptSummaryResponse> transcriptSummary(
            @Valid @RequestBody VideoTranscriptSummaryRequest request) {

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
}
