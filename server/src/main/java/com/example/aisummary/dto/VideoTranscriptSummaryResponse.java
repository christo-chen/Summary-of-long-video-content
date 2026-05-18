package com.example.aisummary.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class VideoTranscriptSummaryResponse {

    private boolean success;

    private Object summary;

    private String transcriptSource;

    private String language;

    private String error;

    private String message;

    public static VideoTranscriptSummaryResponse success(Object summary, String transcriptSource, String language) {
        return new VideoTranscriptSummaryResponse(true, summary, transcriptSource, language, null, null);
    }

    public static VideoTranscriptSummaryResponse noTranscript(String message) {
        return new VideoTranscriptSummaryResponse(false, null, null, null, "NO_TRANSCRIPT_AVAILABLE", message);
    }

    public static VideoTranscriptSummaryResponse invalidVideoUrl() {
        return new VideoTranscriptSummaryResponse(false, null, null, null,
                "INVALID_VIDEO_URL", "Unsupported or invalid video URL.");
    }
}
