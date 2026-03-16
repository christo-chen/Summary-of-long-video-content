package com.example.aisummary.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.example.aisummary.dto.SummaryResponse;
import com.example.aisummary.entity.Summary;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface SummaryMapper extends BaseMapper<Summary> {

    /**
     * 分页查询摘要列表（带标签信息）
     */
    IPage<SummaryResponse> selectSummaryPage(
            Page<?> page,
            @Param("userId") Long userId,
            @Param("keyword") String keyword,
            @Param("sourceType") String sourceType,
            @Param("tagId") Long tagId
    );

    /**
     * 查询单条摘要详情（带标签信息）
     */
    SummaryResponse selectSummaryDetail(
            @Param("id") Long id,
            @Param("userId") Long userId
    );
}
