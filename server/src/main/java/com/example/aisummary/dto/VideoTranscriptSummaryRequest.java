package com.example.aisummary.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class VideoTranscriptSummaryRequest {

    @NotBlank(message = "videoUrl 不能为空")
    private String videoUrl;

    @NotBlank(message = "sourceType 不能为空")
    private String sourceType;
}
