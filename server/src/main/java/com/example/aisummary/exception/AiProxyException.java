package com.example.aisummary.exception;

import lombok.Getter;

@Getter
public class AiProxyException extends RuntimeException {

    private final int code;

    public AiProxyException(int code, String message) {
        super(message);
        this.code = code;
    }
}
