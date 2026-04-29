package com.example.aisummary.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AiGenerateRequest {

    @NotBlank(message = "sourceType 不能为空")
    private String sourceType;

    @NotBlank(message = "content 不能为空")
    private String content;

    private String language = "zh";
}
