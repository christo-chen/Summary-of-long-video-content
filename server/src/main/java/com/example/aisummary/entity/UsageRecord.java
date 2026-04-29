package com.example.aisummary.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("usage_record")
public class UsageRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private String ipAddress;

    private Integer usedCount;

    // 由 MySQL DEFAULT CURRENT_TIMESTAMP 自动维护，无需 MyBatis-Plus 填充
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
