package com.example.aisummary.service;

import com.example.aisummary.entity.UsageRecord;
import com.example.aisummary.mapper.UsageRecordMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UsageLimitService {

    public static final int SOFT_REMINDER_THRESHOLD = 3;
    static final int FREE_USAGE_LIMIT = SOFT_REMINDER_THRESHOLD;

    private final UsageRecordMapper usageRecordMapper;

    /**
     * 记录使用次数并返回当前已使用次数。
     * 已登录时按 userId 查，未登录时按 ipAddress 查。
     */
    @Transactional
    public int recordAndGetUsedCount(Long userId, String ipAddress) {
        UsageRecord record = userId != null
                ? usageRecordMapper.selectByUserId(userId)
                : usageRecordMapper.selectByIpAddress(ipAddress);

        if (record == null) {
            UsageRecord newRecord = new UsageRecord();
            newRecord.setUserId(userId);
            newRecord.setIpAddress(userId == null ? ipAddress : null);
            newRecord.setUsedCount(1);
            usageRecordMapper.insert(newRecord);
            return 1;
        }

        usageRecordMapper.increment(record.getId());
        return record.getUsedCount() + 1;
    }

    /**
     * Backward-compatible entry point for existing callers/tests.
     */
    @Transactional
    public void checkAndIncrement(Long userId, String ipAddress) {
        recordAndGetUsedCount(userId, ipAddress);
    }
}
