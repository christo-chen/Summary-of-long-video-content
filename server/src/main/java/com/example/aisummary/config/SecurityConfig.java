package com.example.aisummary.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // 关闭 CSRF（前后端分离不需要）
            .csrf(csrf -> csrf.disable())

            // 关闭 Session（使用 JWT 无状态认证）
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

            // 配置接口权限
            .authorizeHttpRequests(auth -> auth
                // 认证接口不需要登录
                .requestMatchers("/api/auth/**").permitAll()
                // Notion OAuth 回调不需要登录（通过 state 参数识别用户）
                .requestMatchers("/api/export/notion/callback").permitAll()
                // 其他所有接口需要登录
                .anyRequest().authenticated()
            )

            // 在 UsernamePasswordAuthenticationFilter 之前加入 JWT 过滤器
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
