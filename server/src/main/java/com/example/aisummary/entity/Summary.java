package com.example.aisummary.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("summary")
public class Summary {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private String url;

    private String title;

    private String sourceType;

    /**
     * 结构化摘要内容，存储为 JSON 字符串
     * 包含: one_line_summary, key_points, mindmap_markdown
     */
    private String summaryJson;

    private String language;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
