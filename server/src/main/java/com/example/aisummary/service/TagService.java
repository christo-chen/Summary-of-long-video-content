package com.example.aisummary.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.example.aisummary.entity.SummaryTag;
import com.example.aisummary.entity.Tag;
import com.example.aisummary.mapper.SummaryTagMapper;
import com.example.aisummary.mapper.TagMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TagService {

    private final TagMapper tagMapper;
    private final SummaryTagMapper summaryTagMapper;

    /**
     * 获取用户的所有标签
     */
    public List<Tag> getUserTags(Long userId) {
        LambdaQueryWrapper<Tag> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Tag::getUserId, userId)
               .orderByAsc(Tag::getName);
        return tagMapper.selectList(wrapper);
    }

    /**
     * 创建标签
     */
    public Tag createTag(Long userId, String name) {
        // 检查是否已存在同名标签
        LambdaQueryWrapper<Tag> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Tag::getUserId, userId)
               .eq(Tag::getName, name);
        Tag existing = tagMapper.selectOne(wrapper);
        if (existing != null) {
            return existing; // 已存在则直接返回
        }

        Tag tag = new Tag();
        tag.setUserId(userId);
        tag.setName(name);
        tagMapper.insert(tag);
        return tag;
    }

    /**
     * 删除标签（同时删除关联关系）
     */
    @Transactional
    public void deleteTag(Long tagId, Long userId) {
        Tag tag = tagMapper.selectById(tagId);
        if (tag == null || !tag.getUserId().equals(userId)) {
            throw new RuntimeException("标签不存在或无权删除");
        }

        // 删除关联关系
        LambdaQueryWrapper<SummaryTag> stWrapper = new LambdaQueryWrapper<>();
        stWrapper.eq(SummaryTag::getTagId, tagId);
        summaryTagMapper.delete(stWrapper);

        // 删除标签
        tagMapper.deleteById(tagId);
    }
}
