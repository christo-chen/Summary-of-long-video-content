package com.example.aisummary.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.aisummary.entity.UsageRecord;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface UsageRecordMapper extends BaseMapper<UsageRecord> {

    @Select("SELECT * FROM usage_record WHERE user_id = #{userId}")
    UsageRecord selectByUserId(@Param("userId") Long userId);

    @Select("SELECT * FROM usage_record WHERE ip_address = #{ipAddress}")
    UsageRecord selectByIpAddress(@Param("ipAddress") String ipAddress);

    /**
     * 原子递增：仅当 used_count < limit 时才更新，返回受影响行数。
     * 受影响行数为 0 表示已达上限（并发安全兜底）。
     */
    @Update("UPDATE usage_record SET used_count = used_count + 1 WHERE id = #{id} AND used_count < #{limit}")
    int incrementIfBelowLimit(@Param("id") Long id, @Param("limit") int limit);
}
