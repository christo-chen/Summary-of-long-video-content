package com.example.aisummary.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("summary_tag")
public class SummaryTag {

    private Long summaryId;

    private Long tagId;
}
