package com.example.aisummary.controller;

import com.example.aisummary.dto.Result;
import com.example.aisummary.dto.TranslateRequest;
import com.example.aisummary.dto.TranslateResponse;
import com.example.aisummary.service.AiProxyService;
import com.example.aisummary.service.UsageLimitService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TranslateControllerTest {

    @Mock
    private AiProxyService aiProxyService;

    @Mock
    private UsageLimitService usageLimitService;

    @Test
    void translate_normalRequest_recordsUsageAndReturnsTranslation() {
        TranslateController controller = new TranslateController(aiProxyService, usageLimitService);
        MockHttpServletRequest httpRequest = new MockHttpServletRequest();
        httpRequest.setRemoteAddr("10.0.0.1");
        TranslateRequest request = request("hello", "zh");
        when(usageLimitService.recordAndGetUsedCount(7L, "10.0.0.1")).thenReturn(1);
        when(aiProxyService.translate("hello", "zh")).thenReturn("你好");

        Result<TranslateResponse> result = controller.translate(
                request,
                httpRequest,
                new UsernamePasswordAuthenticationToken(7L, "user@test.com"));

        assertThat(result.getCode()).isEqualTo(200);
        assertThat(result.getData().getTranslated()).isEqualTo("你好");
        assertThat(result.getData().isShowSoftReminder()).isFalse();
        assertThat(result.getData().getUsedCount()).isEqualTo(1);
        verify(usageLimitService).recordAndGetUsedCount(7L, "10.0.0.1");
    }

    @Test
    void translate_reachesSoftReminderThreshold_returnsShowSoftReminder() {
        TranslateController controller = new TranslateController(aiProxyService, usageLimitService);
        MockHttpServletRequest httpRequest = new MockHttpServletRequest();
        httpRequest.addHeader("X-Forwarded-For", "203.0.113.9, 10.0.0.1");
        TranslateRequest request = request("hello", "zh");
        when(usageLimitService.recordAndGetUsedCount(null, "203.0.113.9"))
                .thenReturn(UsageLimitService.SOFT_REMINDER_THRESHOLD);
        when(aiProxyService.translate("hello", "zh")).thenReturn("你好");

        Result<TranslateResponse> result = controller.translate(request, httpRequest, null);

        assertThat(result.getData().isShowSoftReminder()).isTrue();
        assertThat(result.getData().getUsedCount()).isEqualTo(UsageLimitService.SOFT_REMINDER_THRESHOLD);
        verify(usageLimitService).recordAndGetUsedCount(null, "203.0.113.9");
    }

    private TranslateRequest request(String content, String targetLang) {
        TranslateRequest request = new TranslateRequest();
        request.setContent(content);
        request.setTargetLang(targetLang);
        request.setSourceType("article");
        return request;
    }
}
