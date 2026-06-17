package com.example.aisummary.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class AsrJobStatusResponse {

    private Long jobId;

    private String status;

    private Object summary;

    private String errorCode;

    private Integer durationSeconds;
}
