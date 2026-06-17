package com.example.aisummary.service;

import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class AsrJobQueue {

    private static final int WORKER_THREADS = 1;
    private static final int QUEUE_CAPACITY = 5;

    private final AsrWorkerService asrWorkerService;
    private final ThreadPoolExecutor executor;

    public AsrJobQueue(AsrWorkerService asrWorkerService) {
        this.asrWorkerService = asrWorkerService;
        this.executor = new ThreadPoolExecutor(
                WORKER_THREADS,
                WORKER_THREADS,
                0L,
                TimeUnit.MILLISECONDS,
                new ArrayBlockingQueue<>(QUEUE_CAPACITY),
                runnable -> {
                    Thread thread = new Thread(runnable, "asr-worker");
                    thread.setDaemon(true);
                    return thread;
                },
                new ThreadPoolExecutor.AbortPolicy());
    }

    public boolean submit(Long jobId) {
        try {
            executor.execute(() -> asrWorkerService.process(jobId));
            return true;
        } catch (RejectedExecutionException e) {
            log.warn("ASR queue full: jobId={}", jobId);
            return false;
        }
    }

    @PreDestroy
    public void shutdown() {
        executor.shutdownNow();
    }
}
