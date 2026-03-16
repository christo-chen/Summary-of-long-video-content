package com.example.aisummary.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.aisummary.entity.User;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserMapper extends BaseMapper<User> {
}
