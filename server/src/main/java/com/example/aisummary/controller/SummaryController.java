package com.example.aisummary.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.example.aisummary.dto.*;
import com.example.aisummary.entity.Summary;
import com.example.aisummary.service.SummaryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/summaries")
@RequiredArgsConstructor
public class SummaryController {

    private final SummaryService summaryService;

    /**
     * 保存摘要
     * POST /api/summaries
     */
    @PostMapping
    public Result<Summary> save(@Valid @RequestBody SummaryRequest request,
                                Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        Summary summary = summaryService.saveSummary(userId, request);
        return Result.success(summary);
    }

    /**
     * 分页查询摘要列表
     * GET /api/summaries?page=1&size=10&keyword=xxx&sourceType=article&tagId=1
     */
    @GetMapping
    public Result<IPage<SummaryResponse>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String sourceType,
            @RequestParam(required = false) Long tagId,
            Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        IPage<SummaryResponse> result = summaryService.getSummaryList(userId, page, size, keyword, sourceType, tagId);
        return Result.success(result);
    }

    /**
     * 查询单条摘要详情
     * GET /api/summaries/{id}
     */
    @GetMapping("/{id}")
    public Result<SummaryResponse> detail(@PathVariable Long id,
                                          Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        SummaryResponse response = summaryService.getSummaryDetail(id, userId);
        return Result.success(response);
    }

    /**
     * 删除摘要
     * DELETE /api/summaries/{id}
     */
    @DeleteMapping("/{id}")
    public Result<?> delete(@PathVariable Long id,
                            Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        summaryService.deleteSummary(id, userId);
        return Result.success();
    }

    /**
     * 为摘要添加标签
     * POST /api/summaries/{id}/tags
     */
    @PostMapping("/{id}/tags")
    public Result<?> addTag(@PathVariable Long id,
                            @RequestBody TagRequest request,
                            Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        summaryService.addTag(id, request.getTagId(), userId);
        return Result.success();
    }

    /**
     * 移除摘要的标签
     * DELETE /api/summaries/{id}/tags/{tagId}
     */
    @DeleteMapping("/{id}/tags/{tagId}")
    public Result<?> removeTag(@PathVariable Long id,
                               @PathVariable Long tagId,
                               Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        summaryService.removeTag(id, tagId, userId);
        return Result.success();
    }
}
