CREATE TABLE usage_record (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id     BIGINT      NULL,
    ip_address  VARCHAR(64) NULL,
    used_count  INT         NOT NULL DEFAULT 0,
    created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_id (user_id),
    UNIQUE KEY uk_ip_address (ip_address)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
