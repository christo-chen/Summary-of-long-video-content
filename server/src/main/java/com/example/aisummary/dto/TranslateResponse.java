package com.example.aisummary.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class TranslateResponse {

    private String translated;

    private boolean showSoftReminder;

    private int usedCount;
}
