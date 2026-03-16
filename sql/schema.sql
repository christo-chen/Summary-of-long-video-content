-- =============================================
-- AI Summary Assistant 数据库建表脚本
-- MySQL 8.x
-- =============================================

CREATE DATABASE IF NOT EXISTS ai_summary DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE ai_summary;

-- 用户表
CREATE TABLE IF NOT EXISTS `user` (
    `id`            BIGINT          NOT NULL AUTO_INCREMENT  COMMENT '主键',
    `email`         VARCHAR(255)    NOT NULL                 COMMENT '登录邮箱',
    `password`      VARCHAR(255)    NOT NULL                 COMMENT 'BCrypt加密密码',
    `notion_token`  TEXT            DEFAULT NULL             COMMENT 'Notion OAuth Token',
    `create_time`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
    `update_time`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 摘要记录表
CREATE TABLE IF NOT EXISTS `summary` (
    `id`            BIGINT          NOT NULL AUTO_INCREMENT  COMMENT '主键',
    `user_id`       BIGINT          NOT NULL                 COMMENT '所属用户ID',
    `url`           TEXT            NOT NULL                 COMMENT '原始网页URL',
    `title`         VARCHAR(500)    NOT NULL                 COMMENT '标题',
    `source_type`   VARCHAR(20)     NOT NULL                 COMMENT '来源类型: article/bilibili/youtube/github/stackoverflow',
    `summary_json`  JSON            NOT NULL                 COMMENT '结构化摘要内容(JSON)',
    `language`      VARCHAR(10)     NOT NULL DEFAULT 'zh'    COMMENT '摘要语言',
    `create_time`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_create_time` (`create_time`),
    CONSTRAINT `fk_summary_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='摘要记录表';

-- 标签表
CREATE TABLE IF NOT EXISTS `tag` (
    `id`            BIGINT          NOT NULL AUTO_INCREMENT  COMMENT '主键',
    `user_id`       BIGINT          NOT NULL                 COMMENT '所属用户ID',
    `name`          VARCHAR(50)     NOT NULL                 COMMENT '标签名称',
    `create_time`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_tag` (`user_id`, `name`),
    CONSTRAINT `fk_tag_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='标签表';

-- 摘要-标签关联表（多对多）
CREATE TABLE IF NOT EXISTS `summary_tag` (
    `summary_id`    BIGINT          NOT NULL COMMENT '摘要ID',
    `tag_id`        BIGINT          NOT NULL COMMENT '标签ID',
    PRIMARY KEY (`summary_id`, `tag_id`),
    CONSTRAINT `fk_st_summary` FOREIGN KEY (`summary_id`) REFERENCES `summary` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_st_tag` FOREIGN KEY (`tag_id`) REFERENCES `tag` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='摘要-标签关联表';
