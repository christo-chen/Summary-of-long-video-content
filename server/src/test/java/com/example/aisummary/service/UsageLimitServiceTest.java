package com.example.aisummary.service;

import com.example.aisummary.entity.UsageRecord;
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
    void loggedIn_secondUse_incrementsAndReturnsCount() {
        when(usageRecordMapper.selectByUserId(USER_ID)).thenReturn(userRecord(1));
        when(usageRecordMapper.increment(1L)).thenReturn(1);

        int usedCount = usageLimitService.recordAndGetUsedCount(USER_ID, IP);

        assertThat(usedCount).isEqualTo(2);
        verify(usageRecordMapper).increment(1L);
    }

    @Test
    void loggedIn_thirdUse_incrementsAndReturnsReminderThreshold() {
        when(usageRecordMapper.selectByUserId(USER_ID)).thenReturn(userRecord(2));
        when(usageRecordMapper.increment(1L)).thenReturn(1);

        int usedCount = usageLimitService.recordAndGetUsedCount(USER_ID, IP);

        assertThat(usedCount).isEqualTo(UsageLimitService.SOFT_REMINDER_THRESHOLD);
    }

    @Test
    void loggedIn_fourthUse_continuesAndReturnsCount() {
        when(usageRecordMapper.selectByUserId(USER_ID)).thenReturn(userRecord(3));
        when(usageRecordMapper.increment(1L)).thenReturn(1);

        int usedCount = usageLimitService.recordAndGetUsedCount(USER_ID, IP);

        assertThat(usedCount).isEqualTo(4);
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
    void anonymous_hitLimit_continuesAndReturnsCount() {
        when(usageRecordMapper.selectByIpAddress(IP)).thenReturn(ipRecord(3));
        when(usageRecordMapper.increment(2L)).thenReturn(1);

        int usedCount = usageLimitService.recordAndGetUsedCount(null, IP);

        assertThat(usedCount).isEqualTo(4);
    }
}
