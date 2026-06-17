package com.example.aisummary.service;

import com.example.aisummary.entity.AsrJob;
import com.example.aisummary.mapper.AsrJobMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.net.URL;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AsrWorkerServiceTest {

    @Mock
    private AsrJobMapper asrJobMapper;

    @Mock
    private OssStorageService ossStorageService;

    @Mock
    private QwenAsrClient qwenAsrClient;

    @Mock
    private TranscriptionDownloader transcriptionDownloader;

    @Mock
    private AiProxyService aiProxyService;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private AsrWorkerService asrWorkerService;

    @BeforeEach
    void setUp() {
        asrWorkerService = new AsrWorkerService(
                asrJobMapper,
                ossStorageService,
                qwenAsrClient,
                transcriptionDownloader,
                new AsrTranscriptParser(),
                aiProxyService,
                objectMapper);
        ReflectionTestUtils.setField(asrWorkerService, "timeoutMinutes", 1L);
        ReflectionTestUtils.setField(asrWorkerService, "pollIntervalMillis", 1L);
    }

    @Test
    void process_success_submitsPollsDownloadsParsesAndHandsOffToSummary() throws Exception {
        AsrJob job = job();
        when(asrJobMapper.selectById(42L)).thenReturn(job);
        when(ossStorageService.generateSignedUrl(eq("asr/object.mp3"), any()))
                .thenReturn(new URL("https://signed.example/object.mp3"));
        when(qwenAsrClient.submit("https://signed.example/object.mp3"))
                .thenReturn(new QwenAsrClient.QwenAsrTask("task-1", "RUNNING", null, null));

        JsonNode usage = objectMapper.readTree("{\"seconds\":3}");
        when(qwenAsrClient.fetch("task-1"))
                .thenReturn(new QwenAsrClient.QwenAsrTask(
                        "task-1", "SUCCEEDED", "https://result.example/transcription.json", usage));
        when(transcriptionDownloader.download("https://result.example/transcription.json"))
                .thenReturn(objectMapper.readTree("""
                        {
                          "transcripts": [
                            {"text": "hello", "sentences": [{"end_time": 1200}]},
                            {"text": "world", "sentences": [{"end_time": 2500}]}
                          ]
                        }
                        """));
        ObjectNode summary = objectMapper.createObjectNode();
        summary.put("title", "Summary");
        summary.put("one_line_summary", "Short summary");
        summary.putArray("key_points").add("Point");
        when(aiProxyService.generate("youtube", "hello\nworld")).thenReturn(summary);

        asrWorkerService.process(42L);

        verify(qwenAsrClient).submit("https://signed.example/object.mp3");
        verify(qwenAsrClient).fetch("task-1");
        verify(transcriptionDownloader).download("https://result.example/transcription.json");
        verify(aiProxyService).generate("youtube", "hello\nworld");
        verify(ossStorageService).deleteObject("asr/object.mp3");

        ArgumentCaptor<AsrJob> captor = ArgumentCaptor.forClass(AsrJob.class);
        verify(asrJobMapper, atLeastOnce()).updateById(captor.capture());
        AsrJob finalUpdate = captor.getAllValues().get(captor.getAllValues().size() - 1);
        assertThat(finalUpdate.getStatus()).isEqualTo("SUCCEEDED");
        assertThat(finalUpdate.getDurationSeconds()).isEqualTo(3);
        assertThat(finalUpdate.getErrorCode()).isNull();
        assertThat(finalUpdate.getSummary()).contains("\"title\":\"Summary\"");
    }

    @Test
    void process_timeoutMarksFailedAndCleansOss() throws Exception {
        ReflectionTestUtils.setField(asrWorkerService, "timeoutMinutes", 0L);
        AsrJob job = job();
        when(asrJobMapper.selectById(42L)).thenReturn(job);
        when(ossStorageService.generateSignedUrl(eq("asr/object.mp3"), any()))
                .thenReturn(new URL("https://signed.example/object.mp3"));
        when(qwenAsrClient.submit("https://signed.example/object.mp3"))
                .thenReturn(new QwenAsrClient.QwenAsrTask("task-1", "RUNNING", null, null));

        asrWorkerService.process(42L);

        verify(qwenAsrClient, never()).fetch(anyString());
        verify(ossStorageService).deleteObject("asr/object.mp3");

        ArgumentCaptor<AsrJob> captor = ArgumentCaptor.forClass(AsrJob.class);
        verify(asrJobMapper, atLeastOnce()).updateById(captor.capture());
        AsrJob finalUpdate = captor.getAllValues().get(captor.getAllValues().size() - 1);
        assertThat(finalUpdate.getStatus()).isEqualTo("FAILED");
        assertThat(finalUpdate.getErrorCode()).isEqualTo("ASR_TIMEOUT");
    }

    private AsrJob job() {
        AsrJob job = new AsrJob();
        job.setId(42L);
        job.setUserId(7L);
        job.setOssKey("asr/object.mp3");
        job.setStatus("QUEUED");
        job.setFileSize(123L);
        return job;
    }
}
