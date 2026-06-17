package com.example.aisummary.controller;

import com.example.aisummary.dto.AsrJobCreateResponse;
import com.example.aisummary.dto.AsrJobStatusResponse;
import com.example.aisummary.dto.Result;
import com.example.aisummary.entity.AsrJob;
import com.example.aisummary.service.AsrJobService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AsrController {

    private final AsrJobService asrJobService;

    @PostMapping("/audio/transcribe-summary")
    public Result<AsrJobCreateResponse> transcribeSummary(@RequestParam("file") MultipartFile file,
                                                          Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        AsrJob job = asrJobService.createUploadJob(userId, file);
        return Result.success(new AsrJobCreateResponse(job.getId(), job.getStatus()));
    }

    @GetMapping("/asr/jobs/{jobId}")
    public Result<AsrJobStatusResponse> getJob(@PathVariable Long jobId,
                                               Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        AsrJobService.AsrJobStatus status = asrJobService.getJobStatus(userId, jobId);
        return Result.success(new AsrJobStatusResponse(
                status.jobId(),
                status.status(),
                status.summary(),
                status.errorCode(),
                status.durationSeconds()));
    }
}
