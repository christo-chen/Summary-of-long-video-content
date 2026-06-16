package com.example.aisummary.service;

import com.example.aisummary.exception.AiProxyException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AiProxyServiceTest {

    @Mock
    private RestTemplate translateRestTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private AiProxyService aiProxyService;

    @BeforeEach
    void setUp() {
        aiProxyService = new AiProxyService(objectMapper);
        ReflectionTestUtils.setField(aiProxyService, "apiKey", "test-deepseek-key");
        ReflectionTestUtils.setField(aiProxyService, "translateChunkSize", 3000);
        ReflectionTestUtils.setField(aiProxyService, "translateRestTemplate", translateRestTemplate);
    }

    @Test
    void translate_normalText_callsDeepSeekAndReturnsTranslatedText() {
        when(translateRestTemplate.exchange(
                anyString(),
                eq(HttpMethod.POST),
                ArgumentMatchers.<HttpEntity<?>>any(),
                eq(JsonNode.class)
        )).thenReturn(ResponseEntity.ok(deepSeekResponse("Hello **world**")));

        String result = aiProxyService.translate("你好 **世界**", "en");

        assertThat(result).isEqualTo("Hello **world**");
        verify(translateRestTemplate).exchange(
                eq("https://api.deepseek.com/v1/chat/completions"),
                eq(HttpMethod.POST),
                ArgumentMatchers.<HttpEntity<?>>any(),
                eq(JsonNode.class));
    }

    @Test
    void translate_longText_splitsByParagraphAndConcatenatesInOrder() {
        ReflectionTestUtils.setField(aiProxyService, "translateChunkSize", 12);
        when(translateRestTemplate.exchange(
                anyString(),
                eq(HttpMethod.POST),
                ArgumentMatchers.<HttpEntity<?>>any(),
                eq(JsonNode.class)
        )).thenReturn(
                ResponseEntity.ok(deepSeekResponse("T1\n\n")),
                ResponseEntity.ok(deepSeekResponse("T2\n\n")),
                ResponseEntity.ok(deepSeekResponse("T3"))
        );

        String content = "first\n\nsecond\n\nthird";
        String result = aiProxyService.translate(content, "zh");

        assertThat(result).isEqualTo("T1\n\nT2\n\nT3");
        verify(translateRestTemplate, times(3)).exchange(
                anyString(),
                eq(HttpMethod.POST),
                ArgumentMatchers.<HttpEntity<?>>any(),
                eq(JsonNode.class));
    }

    @Test
    void translate_upstreamFailure_throwsAiProxyExceptionWithClearCode() {
        HttpServerErrorException upstream = HttpServerErrorException.create(
                HttpStatus.BAD_GATEWAY,
                "Bad Gateway",
                null,
                "upstream down".getBytes(StandardCharsets.UTF_8),
                StandardCharsets.UTF_8);
        when(translateRestTemplate.exchange(
                anyString(),
                eq(HttpMethod.POST),
                ArgumentMatchers.<HttpEntity<?>>any(),
                eq(JsonNode.class)
        )).thenThrow(upstream);

        assertThatThrownBy(() -> aiProxyService.translate("hello", "zh"))
                .isInstanceOf(AiProxyException.class)
                .hasMessageContaining("AI 翻译服务调用失败");
    }

    private JsonNode deepSeekResponse(String content) {
        ObjectNode root = objectMapper.createObjectNode();
        ObjectNode choice = objectMapper.createObjectNode();
        ObjectNode message = objectMapper.createObjectNode();
        message.put("content", content);
        choice.set("message", message);
        root.putArray("choices").add(choice);
        return root;
    }
}
