package com.example.aisummary.controller;

import com.example.aisummary.dto.*;
import com.example.aisummary.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * 用户注册
     * POST /api/auth/register
     */
    @PostMapping("/register")
    public Result<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return Result.success(response);
    }

    /**
     * 用户登录
     * POST /api/auth/login
     */
    @PostMapping("/login")
    public Result<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return Result.success(response);
    }

    /**
     * 获取当前用户信息
     * GET /api/auth/me
     */
    @GetMapping("/me")
    public Result<AuthResponse> me(Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        String email = (String) authentication.getCredentials();
        return Result.success(new AuthResponse(null, userId, email));
    }
}
