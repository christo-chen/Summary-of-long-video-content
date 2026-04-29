package com.example.aisummary.service;

import com.example.aisummary.entity.UsageRecord;
import com.example.aisummary.exception.UsageLimitExceededException;
import com.example.aisummary.mapper.UsageRecordMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UsageLimitService {

    static final int FREE_USAGE_LIMIT = 3;

    private final UsageRecordMapper usageRecordMapper;

    /**
     * 检查并递增使用次数。
     * 已登录时按 userId 查，未登录时按 ipAddress 查。
     * 超限或并发竞争导致无法递增时抛出 UsageLimitExceededException。
     */
    @Transactional
    public void checkAndIncrement(Long userId, String ipAddress) {
        UsageRecord record = userId != null
                ? usageRecordMapper.selectByUserId(userId)
                : usageRecordMapper.selectByIpAddress(ipAddress);

        if (record == null) {
            UsageRecord newRecord = new UsageRecord();
            newRecord.setUserId(userId);
            newRecord.setIpAddress(userId == null ? ipAddress : null);
            newRecord.setUsedCount(1);
            usageRecordMapper.insert(newRecord);
            return;
        }

        if (record.getUsedCount() >= FREE_USAGE_LIMIT) {
            throw new UsageLimitExceededException();
        }

        // WHERE used_count < LIMIT 确保并发场景下不会超限
        int updated = usageRecordMapper.incrementIfBelowLimit(record.getId(), FREE_USAGE_LIMIT);
        if (updated == 0) {
            throw new UsageLimitExceededException();
        }
    }
}
