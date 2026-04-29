package com.example.aisummary.controller;

import com.example.aisummary.dto.AiGenerateRequest;
import com.example.aisummary.dto.Result;
import com.example.aisummary.service.AiProxyService;
import com.example.aisummary.service.UsageLimitService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiProxyService aiProxyService;
    private final UsageLimitService usageLimitService;

    /**
     * POST /api/ai/generate
     * 使用内置 DeepSeek Key 生成摘要，调用前先检查免费次数限制。
     * permitAll：已登录用户按 userId 计数，未登录用户按 IP 计数。
     */
    @PostMapping("/generate")
    public Result<Object> generate(@Valid @RequestBody AiGenerateRequest request,
                                   HttpServletRequest httpRequest,
                                   Authentication authentication) {
        Long userId = authentication != null ? (Long) authentication.getPrincipal() : null;

        usageLimitService.checkAndIncrement(userId, getClientIp(httpRequest));

        Object result = aiProxyService.generate(request.getSourceType(), request.getContent());
        return Result.success(result);
    }

    private String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (StringUtils.hasText(forwarded)) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
