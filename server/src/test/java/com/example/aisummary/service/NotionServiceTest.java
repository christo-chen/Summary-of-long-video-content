package com.example.aisummary.service;

import com.example.aisummary.entity.User;
import com.example.aisummary.mapper.UserMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * NotionService 是本项目中最接近"外部 API 调用"的 Service，其 RestTemplate 调用
 * 对应业务上通过内置密钥访问第三方平台的场景，与 AI API 调用模式一致。
 *
 * RestTemplate 在 NotionService 中以字段初始化创建，不经过构造器注入，
 * 所以通过 ReflectionTestUtils.setField() 替换为 Mock。
 */
@ExtendWith(MockitoExtension.class)
class NotionServiceTest {

    @Mock
    private UserMapper userMapper;

    @Mock
    private RestTemplate restTemplate;

    private NotionService notionService;

    @BeforeEach
    void setUp() {
        notionService = new NotionService(userMapper, new ObjectMapper());
        // 替换字段初始化的 RestTemplate 实例
        ReflectionTestUtils.setField(notionService, "restTemplate", restTemplate);
        // @Value 字段在纯 Mockito 环境（无 Spring 上下文）下不会被注入，手动设置防止 Map.of() NPE
        ReflectionTestUtils.setField(notionService, "clientId", "test-client-id");
        ReflectionTestUtils.setField(notionService, "clientSecret", "test-secret");
        ReflectionTestUtils.setField(notionService, "redirectUri", "http://localhost/callback");
    }

    // ---- isConnected ----

    @Test
    void isConnected_userHasToken_returnsTrue() {
        User user = new User();
        user.setNotionToken("valid-notion-token");
        when(userMapper.selectById(1L)).thenReturn(user);

        assertThat(notionService.isConnected(1L)).isTrue();
    }

    @Test
    void isConnected_userHasNoToken_returnsFalse() {
        User user = new User();
        user.setNotionToken(null);
        when(userMapper.selectById(1L)).thenReturn(user);

        assertThat(notionService.isConnected(1L)).isFalse();
    }

    @Test
    void isConnected_userNotFound_returnsFalse() {
        when(userMapper.selectById(99L)).thenReturn(null);

        assertThat(notionService.isConnected(99L)).isFalse();
    }

    // ---- handleCallback（模拟外部 OAuth API 调用）----

    @Test
    void handleCallback_externalApiFailure_throwsRuntimeException() {
        when(restTemplate.exchange(
                anyString(),
                any(HttpMethod.class),
                any(HttpEntity.class),
                ArgumentMatchers.<Class<JsonNode>>any()
        )).thenThrow(new RuntimeException("Connection refused"));

        assertThatThrownBy(() -> notionService.handleCallback("bad-code", 1L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Notion 授权失败");
    }

    @Test
    void handleCallback_success_savesAccessTokenToUser() throws Exception {
        // 构造 Notion 返回的真实 JsonNode（不能 Mock，因为代码会调 .get().asText()）
        ObjectMapper mapper = new ObjectMapper();
        JsonNode body = mapper.readTree("{\"access_token\":\"notion-token-xyz\"}");
        ResponseEntity<JsonNode> mockResp = ResponseEntity.ok(body);

        when(restTemplate.exchange(
                anyString(),
                any(HttpMethod.class),
                any(HttpEntity.class),
                ArgumentMatchers.<Class<JsonNode>>any()
        )).thenReturn(mockResp);

        User user = new User();
        user.setId(1L);
        user.setEmail("test@test.com");
        when(userMapper.selectById(1L)).thenReturn(user);

        notionService.handleCallback("valid-code", 1L);

        verify(userMapper).updateById(argThat(u -> "notion-token-xyz".equals(u.getNotionToken())));
    }
}
