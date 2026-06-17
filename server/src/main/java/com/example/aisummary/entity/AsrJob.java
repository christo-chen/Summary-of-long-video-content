package com.example.aisummary.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("asr_job")
public class AsrJob {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private String ossKey;

    private String status;

    private String taskId;

    private String summary;

    private String errorCode;

    private Long fileSize;

    private Integer durationSeconds;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
