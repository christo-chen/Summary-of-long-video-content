package com.example.aisummary.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SummaryRequest {

    @NotBlank(message = "URL不能为空")
    private String url;

    @NotBlank(message = "标题不能为空")
    private String title;

    @NotBlank(message = "来源类型不能为空")
    private String sourceType;

    @NotBlank(message = "摘要内容不能为空")
    private String summaryJson;

    private String language = "zh";
}
