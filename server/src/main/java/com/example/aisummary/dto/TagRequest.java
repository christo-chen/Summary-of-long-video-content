package com.example.aisummary.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class TagRequest {

    @NotNull(message = "标签ID不能为空")
    private Long tagId;
}
