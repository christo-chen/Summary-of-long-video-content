package com.example.aisummary.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class AiGenerateResponse {

    private Object summary;

    private boolean showSoftReminder;

    private int usedCount;
}
