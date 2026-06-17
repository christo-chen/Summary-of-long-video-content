package com.example.aisummary.service;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.time.Duration;

@Service
public class TranscriptionDownloader {

    private final RestTemplate restTemplate;

    public TranscriptionDownloader(RestTemplateBuilder restTemplateBuilder) {
        this.restTemplate = restTemplateBuilder
                .setConnectTimeout(Duration.ofSeconds(10))
                .setReadTimeout(Duration.ofSeconds(60))
                .build();
    }

    public JsonNode download(String transcriptionUrl) {
        return restTemplate.getForObject(URI.create(transcriptionUrl), JsonNode.class);
    }
}
