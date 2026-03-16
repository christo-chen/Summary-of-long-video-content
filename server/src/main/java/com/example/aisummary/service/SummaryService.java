package com.example.aisummary.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.example.aisummary.dto.SummaryRequest;
import com.example.aisummary.dto.SummaryResponse;
import com.example.aisummary.entity.Summary;
import com.example.aisummary.entity.SummaryTag;
import com.example.aisummary.mapper.SummaryMapper;
import com.example.aisummary.mapper.SummaryTagMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SummaryService {

    private final SummaryMapper summaryMapper;
    private final SummaryTagMapper summaryTagMapper;

    /**
     * 保存摘要
     */
    public Summary saveSummary(Long userId, SummaryRequest request) {
        Summary summary = new Summary();
        summary.setUserId(userId);
        summary.setUrl(request.getUrl());
        summary.setTitle(request.getTitle());
        summary.setSourceType(request.getSourceType());
        summary.setSummaryJson(request.getSummaryJson());
        summary.setLanguage(request.getLanguage());
        summaryMapper.insert(summary);
        return summary;
    }

    /**
     * 分页查询摘要列表（支持关键词搜索、来源类型筛选、标签筛选）
     */
    public IPage<SummaryResponse> getSummaryList(Long userId, int page, int size,
                                                  String keyword, String sourceType, Long tagId) {
        Page<?> pageParam = new Page<>(page, size);
        return summaryMapper.selectSummaryPage(pageParam, userId, keyword, sourceType, tagId);
    }

    /**
     * 查询单条摘要详情
     */
    public SummaryResponse getSummaryDetail(Long id, Long userId) {
        SummaryResponse response = summaryMapper.selectSummaryDetail(id, userId);
        if (response == null) {
            throw new RuntimeException("摘要不存在或无权访问");
        }
        return response;
    }

    /**
     * 删除摘要（同时删除关联的标签关系）
     */
    @Transactional
    public void deleteSummary(Long id, Long userId) {
        // 验证归属
        Summary summary = summaryMapper.selectById(id);
        if (summary == null || !summary.getUserId().equals(userId)) {
            throw new RuntimeException("摘要不存在或无权删除");
        }

        // 删除关联标签
        LambdaQueryWrapper<SummaryTag> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SummaryTag::getSummaryId, id);
        summaryTagMapper.delete(wrapper);

        // 删除摘要
        summaryMapper.deleteById(id);
    }

    /**
     * 为摘要添加标签
     */
    public void addTag(Long summaryId, Long tagId, Long userId) {
        // 验证摘要归属
        Summary summary = summaryMapper.selectById(summaryId);
        if (summary == null || !summary.getUserId().equals(userId)) {
            throw new RuntimeException("摘要不存在或无权操作");
        }

        // 检查是否已关联
        LambdaQueryWrapper<SummaryTag> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SummaryTag::getSummaryId, summaryId)
               .eq(SummaryTag::getTagId, tagId);
        if (summaryTagMapper.selectCount(wrapper) > 0) {
            return; // 已存在，不重复添加
        }

        SummaryTag st = new SummaryTag();
        st.setSummaryId(summaryId);
        st.setTagId(tagId);
        summaryTagMapper.insert(st);
    }

    /**
     * 移除摘要的标签
     */
    public void removeTag(Long summaryId, Long tagId, Long userId) {
        // 验证摘要归属
        Summary summary = summaryMapper.selectById(summaryId);
        if (summary == null || !summary.getUserId().equals(userId)) {
            throw new RuntimeException("摘要不存在或无权操作");
        }

        LambdaQueryWrapper<SummaryTag> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SummaryTag::getSummaryId, summaryId)
               .eq(SummaryTag::getTagId, tagId);
        summaryTagMapper.delete(wrapper);
    }
}
