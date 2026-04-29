package com.example.aisummary.exception;

public class UsageLimitExceededException extends RuntimeException {
    public UsageLimitExceededException() {
        super("免费额度已用完，请配置自己的 API Key");
    }
}
