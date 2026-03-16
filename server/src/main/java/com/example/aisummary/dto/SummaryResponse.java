package com.example.aisummary.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class SummaryResponse {

    private Long id;
    private String url;
    private String title;
    private String sourceType;
    private String summaryJson;
    private String language;
    private LocalDateTime createTime;

    /** 该摘要关联的标签列表 */
    private List<TagInfo> tags;

    @Data
    public static class TagInfo {
        private Long id;
        private String name;
    }
}
