package com.example.aisummary.service;

import com.example.aisummary.entity.UsageRecord;
import com.example.aisummary.exception.UsageLimitExceededException;
import com.example.aisummary.mapper.UsageRecordMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 纯单元测试（无 Spring 上下文），Mockito 驱动。
 *
 * 注意：apiKey 跳过计数的逻辑在 Controller 层，不在此 Service 中。
 */
@ExtendWith(MockitoExtension.class)
class UsageLimitServiceTest {

    @Mock
    private UsageRecordMapper usageRecordMapper;

    @InjectMocks
    private UsageLimitService usageLimitService;

    private static final Long USER_ID = 42L;
    private static final String IP    = "192.168.0.1";

    // ---- helpers ----

    private UsageRecord userRecord(int count) {
        UsageRecord r = new UsageRecord();
        r.setId(1L);
        r.setUserId(USER_ID);
        r.setUsedCount(count);
        return r;
    }

    private UsageRecord ipRecord(int count) {
        UsageRecord r = new UsageRecord();
        r.setId(2L);
        r.setIpAddress(IP);
        r.setUsedCount(count);
        return r;
    }

    // ---- 已登录用户（按 userId 计数）----

    @Test
    void loggedIn_firstUse_insertsRecordAndAllows() {
        when(usageRecordMapper.selectByUserId(USER_ID)).thenReturn(null);

        assertThatCode(() -> usageLimitService.checkAndIncrement(USER_ID, IP))
                .doesNotThrowAnyException();

        verify(usageRecordMapper).insert(argThat(r ->
                USER_ID.equals(r.getUserId()) && r.getUsedCount() == 1));
    }

    @Test
    void loggedIn_secondUse_incrementsAndAllows() {
        when(usageRecordMapper.selectByUserId(USER_ID)).thenReturn(userRecord(1));
        when(usageRecordMapper.incrementIfBelowLimit(1L, UsageLimitService.FREE_USAGE_LIMIT)).thenReturn(1);

        assertThatCode(() -> usageLimitService.checkAndIncrement(USER_ID, IP))
                .doesNotThrowAnyException();

        verify(usageRecordMapper).incrementIfBelowLimit(1L, UsageLimitService.FREE_USAGE_LIMIT);
    }

    @Test
    void loggedIn_thirdUse_incrementsAndAllows() {
        when(usageRecordMapper.selectByUserId(USER_ID)).thenReturn(userRecord(2));
        when(usageRecordMapper.incrementIfBelowLimit(1L, UsageLimitService.FREE_USAGE_LIMIT)).thenReturn(1);

        assertThatCode(() -> usageLimitService.checkAndIncrement(USER_ID, IP))
                .doesNotThrowAnyException();
    }

    @Test
    void loggedIn_fourthUse_throwsUsageLimitExceeded() {
        when(usageRecordMapper.selectByUserId(USER_ID)).thenReturn(userRecord(3));

        assertThatThrownBy(() -> usageLimitService.checkAndIncrement(USER_ID, IP))
                .isInstanceOf(UsageLimitExceededException.class)
                .hasMessageContaining("API Key");
    }

    @Test
    void loggedIn_concurrentRace_incrementReturnsZero_throwsUsageLimitExceeded() {
        // 读到 count=2（还没超限），但 UPDATE 被并发抢先，实际影响行数为 0
        when(usageRecordMapper.selectByUserId(USER_ID)).thenReturn(userRecord(2));
        when(usageRecordMapper.incrementIfBelowLimit(1L, UsageLimitService.FREE_USAGE_LIMIT)).thenReturn(0);

        assertThatThrownBy(() -> usageLimitService.checkAndIncrement(USER_ID, IP))
                .isInstanceOf(UsageLimitExceededException.class);
    }

    // ---- 未登录用户（按 IP 计数）----

    @Test
    void anonymous_firstUse_insertsIpRecordAndAllows() {
        when(usageRecordMapper.selectByIpAddress(IP)).thenReturn(null);

        assertThatCode(() -> usageLimitService.checkAndIncrement(null, IP))
                .doesNotThrowAnyException();

        verify(usageRecordMapper).insert(argThat(r ->
                IP.equals(r.getIpAddress()) && r.getUserId() == null && r.getUsedCount() == 1));
    }

    @Test
    void anonymous_hitLimit_throwsUsageLimitExceeded() {
        when(usageRecordMapper.selectByIpAddress(IP)).thenReturn(ipRecord(3));

        assertThatThrownBy(() -> usageLimitService.checkAndIncrement(null, IP))
                .isInstanceOf(UsageLimitExceededException.class);
    }
}
