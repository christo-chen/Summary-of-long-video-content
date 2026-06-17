package com.example.aisummary.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class AsrJobCreateResponse {

    private Long jobId;

    private String status;
}
