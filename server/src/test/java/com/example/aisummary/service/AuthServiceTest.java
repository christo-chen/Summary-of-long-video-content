package com.example.aisummary.service;

import com.example.aisummary.dto.AuthResponse;
import com.example.aisummary.dto.LoginRequest;
import com.example.aisummary.dto.RegisterRequest;
import com.example.aisummary.entity.User;
import com.example.aisummary.mapper.UserMapper;
import com.example.aisummary.util.JwtUtil;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserMapper userMapper;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtUtil jwtUtil;

    @InjectMocks
    private AuthService authService;

    // ---- register ----

    @Test
    void register_duplicateEmail_throwsRuntimeException() {
        when(userMapper.selectCount(any())).thenReturn(1L);

        RegisterRequest req = new RegisterRequest();
        req.setEmail("dup@test.com");
        req.setPassword("password123");

        assertThatThrownBy(() -> authService.register(req))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("已被注册");
    }

    @Test
    void register_newEmail_encodesPasswordAndReturnsToken() {
        when(userMapper.selectCount(any())).thenReturn(0L);
        when(passwordEncoder.encode("password123")).thenReturn("encoded-pw");
        when(jwtUtil.generateToken(any(), eq("new@test.com"))).thenReturn("jwt-token");

        RegisterRequest req = new RegisterRequest();
        req.setEmail("new@test.com");
        req.setPassword("password123");

        AuthResponse resp = authService.register(req);

        verify(passwordEncoder).encode("password123");
        verify(userMapper).insert(any(User.class));
        assertThat(resp.getToken()).isEqualTo("jwt-token");
        assertThat(resp.getEmail()).isEqualTo("new@test.com");
    }

    // ---- login ----

    @Test
    void login_userNotFound_throwsRuntimeException() {
        when(userMapper.selectOne(any())).thenReturn(null);

        LoginRequest req = new LoginRequest();
        req.setEmail("ghost@test.com");
        req.setPassword("any");

        assertThatThrownBy(() -> authService.login(req))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("用户不存在");
    }

    @Test
    void login_wrongPassword_throwsRuntimeException() {
        User user = new User();
        user.setId(1L);
        user.setEmail("user@test.com");
        user.setPassword("encoded-pw");
        when(userMapper.selectOne(any())).thenReturn(user);
        when(passwordEncoder.matches("wrong-pw", "encoded-pw")).thenReturn(false);

        LoginRequest req = new LoginRequest();
        req.setEmail("user@test.com");
        req.setPassword("wrong-pw");

        assertThatThrownBy(() -> authService.login(req))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("密码错误");
    }

    @Test
    void login_correctCredentials_returnsTokenAndEmail() {
        User user = new User();
        user.setId(5L);
        user.setEmail("user@test.com");
        user.setPassword("encoded-pw");
        when(userMapper.selectOne(any())).thenReturn(user);
        when(passwordEncoder.matches("correct-pw", "encoded-pw")).thenReturn(true);
        when(jwtUtil.generateToken(5L, "user@test.com")).thenReturn("valid-jwt");

        LoginRequest req = new LoginRequest();
        req.setEmail("user@test.com");
        req.setPassword("correct-pw");

        AuthResponse resp = authService.login(req);

        assertThat(resp.getToken()).isEqualTo("valid-jwt");
        assertThat(resp.getEmail()).isEqualTo("user@test.com");
        assertThat(resp.getUserId()).isEqualTo(5L);
    }
}
