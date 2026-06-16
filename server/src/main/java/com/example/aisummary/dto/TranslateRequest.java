package com.example.aisummary.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class TranslateRequest {

    @NotBlank(message = "content 不能为空")
    private String content;

    @NotBlank(message = "targetLang 不能为空")
    private String targetLang;

    private String sourceType;
}
