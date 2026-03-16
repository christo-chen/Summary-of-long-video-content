package com.example.aisummary.controller;

import com.example.aisummary.dto.Result;
import com.example.aisummary.entity.Tag;
import com.example.aisummary.service.TagService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tags")
@RequiredArgsConstructor
public class TagController {

    private final TagService tagService;

    /**
     * 获取当前用户的所有标签
     * GET /api/tags
     */
    @GetMapping
    public Result<List<Tag>> list(Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        List<Tag> tags = tagService.getUserTags(userId);
        return Result.success(tags);
    }

    /**
     * 创建标签
     * POST /api/tags
     */
    @PostMapping
    public Result<Tag> create(@RequestBody Map<String, String> body,
                              Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        String name = body.get("name");
        if (name == null || name.trim().isEmpty()) {
            return Result.error("标签名称不能为空");
        }
        Tag tag = tagService.createTag(userId, name.trim());
        return Result.success(tag);
    }

    /**
     * 删除标签
     * DELETE /api/tags/{id}
     */
    @DeleteMapping("/{id}")
    public Result<?> delete(@PathVariable Long id,
                            Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        tagService.deleteTag(id, userId);
        return Result.success();
    }
}
