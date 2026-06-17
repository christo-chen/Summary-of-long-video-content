package com.example.aisummary.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.aisummary.entity.AsrJob;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface AsrJobMapper extends BaseMapper<AsrJob> {

    @Select("""
            SELECT COUNT(*)
            FROM asr_job
            WHERE user_id = #{userId}
              AND status IN ('QUEUED', 'RUNNING')
            """)
    int countActiveByUserId(@Param("userId") Long userId);
}
