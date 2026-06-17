package com.example.aisummary.service;

import com.example.aisummary.entity.AsrJob;
import com.example.aisummary.mapper.AsrJobMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AsrJobServiceTest {

    @Mock
    private AsrJobMapper asrJobMapper;

    @Mock
    private OssStorageService ossStorageService;

    @Mock
    private AsrJobQueue asrJobQueue;

    private AsrJobService asrJobService;

    @BeforeEach
    void setUp() {
        asrJobService = new AsrJobService(asrJobMapper, ossStorageService, asrJobQueue, new ObjectMapper());
    }

    @Test
    void createUploadJob_rejectsOversizedFileBeforeUpload() {
        MultipartFile file = mock(MultipartFile.class);
        when(file.isEmpty()).thenReturn(false);
        when(file.getSize()).thenReturn(AsrJobService.MAX_FILE_SIZE_BYTES + 1);

        assertThatThrownBy(() -> asrJobService.createUploadJob(1L, file))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("ASR_FILE_TOO_LARGE");

        verifyNoInteractions(ossStorageService, asrJobQueue);
    }

    @Test
    void createUploadJob_rejectsUnsupportedExtensionBeforeUpload() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "audio.exe", "audio/mpeg", "x".getBytes());

        assertThatThrownBy(() -> asrJobService.createUploadJob(1L, file))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("ASR_UNSUPPORTED_EXTENSION");

        verifyNoInteractions(ossStorageService, asrJobQueue);
    }

    @Test
    void createUploadJob_rejectsUnsupportedMimeBeforeUpload() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "audio.mp3", "application/octet-stream", "x".getBytes());

        assertThatThrownBy(() -> asrJobService.createUploadJob(1L, file))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("ASR_UNSUPPORTED_MIME");

        verifyNoInteractions(ossStorageService, asrJobQueue);
    }

    @Test
    void createUploadJob_queueFullDeletesJobAndOssObject() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "audio.mp3", "audio/mpeg", "x".getBytes());
        when(asrJobMapper.countActiveByUserId(7L)).thenReturn(0);
        when(ossStorageService.uploadAsrSource(eq(7L), eq("audio.mp3"), eq("audio/mpeg"), eq(1L), any()))
                .thenReturn("asr/test/audio.mp3");
        doAnswer(invocation -> {
            AsrJob job = invocation.getArgument(0);
            job.setId(99L);
            return 1;
        }).when(asrJobMapper).insert(any(AsrJob.class));
        when(asrJobQueue.submit(99L)).thenReturn(false);

        assertThatThrownBy(() -> asrJobService.createUploadJob(7L, file))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("ASR_QUEUE_FULL");

        verify(asrJobMapper).deleteById(99L);
        verify(ossStorageService).deleteObject("asr/test/audio.mp3");
    }

    @Test
    void getJobStatus_otherUser_throwsForbidden() {
        AsrJob job = new AsrJob();
        job.setId(10L);
        job.setUserId(2L);
        job.setStatus("RUNNING");
        when(asrJobMapper.selectById(10L)).thenReturn(job);

        assertThatThrownBy(() -> asrJobService.getJobStatus(1L, 10L))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode().value())
                .isEqualTo(403);
    }
}
