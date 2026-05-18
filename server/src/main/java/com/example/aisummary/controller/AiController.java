package com.example.aisummary.controller;

import com.example.aisummary.dto.AiGenerateResponse;
import com.example.aisummary.dto.AiGenerateRequest;
import com.example.aisummary.dto.Result;
import com.example.aisummary.service.AiProxyService;
import com.example.aisummary.service.UsageLimitService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiProxyService aiProxyService;
    private final UsageLimitService usageLimitService;

    /**
     * POST /api/ai/generate
     * 使用内置 DeepSeek Key 生成摘要，并记录默认代理使用次数。
     * permitAll：已登录用户按 userId 计数，未登录用户按 IP 计数。
     */
    @PostMapping("/generate")
    public Result<AiGenerateResponse> generate(@Valid @RequestBody AiGenerateRequest request,
                                                HttpServletRequest httpRequest,
                                                Authentication authentication) {
        Long userId = authentication != null ? (Long) authentication.getPrincipal() : null;
        String ip = getClientIp(httpRequest);
        long start = System.currentTimeMillis();

        int usedCount = usageLimitService.recordAndGetUsedCount(userId, ip);

        Object result = aiProxyService.generate(request.getSourceType(), request.getContent());
        boolean showSoftReminder = usedCount >= UsageLimitService.SOFT_REMINDER_THRESHOLD;

        log.info("AI generate: sourceType={} contentLen={} ip={} loggedIn={} elapsed={}ms",
                request.getSourceType(),
                request.getContent() == null ? 0 : request.getContent().length(),
                ip,
                userId != null,
                System.currentTimeMillis() - start);

        return Result.success(new AiGenerateResponse(result, showSoftReminder, usedCount));
    }

    private String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (StringUtils.hasText(forwarded)) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
