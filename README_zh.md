[English](README.md) | [中文](README_zh.md)

<div align="center">

# AI 摘要助手

**基于 AI 的 Chrome 扩展，可提取网页内容并生成结构化摘要、思维导图和翻译。**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Java](https://img.shields.io/badge/Java-21-orange.svg)](https://www.oracle.com/java/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3-green.svg)](https://spring.io/projects/spring-boot)
[![Chrome Extension](https://img.shields.io/badge/Chrome-MV3-yellow.svg)](https://developer.chrome.com/docs/extensions/mv3/)

</div>

## ✨ 功能特性

- 📄 提取任意网页的主要内容（Readability.js）
- 🎬 提取哔哩哔哩视频字幕
- 🧠 通过 DeepSeek API 生成 AI 结构化摘要
- 🗺️ 基于 Markmap 的交互式思维导图
- 🌐 中英双语输出
- 📒 通过 OAuth 同步至 Notion / 导出至 Obsidian 和 Logseq
- 🔐 JWT + BCrypt 用户认证
- 🎁 免费试用：每位用户 3 次 AI 摘要（无需 API 密钥）

## 📸 截图展示

> 即将推出 — GIF 演示和截图将在此处添加。

<!-- 
![Demo GIF](docs/images/demo.gif)
-->

## 🏗️ 系统架构

```mermaid
graph LR
    A[Chrome 扩展<br/>MV3] -->|REST API| B[Spring Boot 3<br/>后端]
    B -->|AI 代理| C[DeepSeek API]
    B -->|CRUD| D[(MySQL)]
    B -->|OAuth| E[Notion API]
    A -->|Readability.js| F[网页]
    A -->|字幕提取| G[哔哩哔哩]
```

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Chrome 扩展（Manifest V3）、HTML/CSS/JS、Markmap |
| 后端 | Java 21、Spring Boot 3、MyBatis-Plus、MySQL |
| AI | DeepSeek API（通过后端代理） |
| 认证 | JWT + BCrypt、Notion OAuth 2.0 |
| 部署 | 阿里云 ECS（Ubuntu 24.04） |
| 测试 | JUnit 5 + Mockito（24 个单元测试） |

## 🚀 快速开始

### 前置条件

- JDK 21+
- MySQL 8.0+
- Node.js（用于扩展开发，可选）
- Chrome 浏览器

### 后端启动

```bash
cd server
cp .env.example .env
# 编辑 .env 文件，填入数据库凭据和 DeepSeek API 密钥
./mvnw spring-boot:run
```

### 扩展安装

1. 打开 `chrome://extensions/`
2. 启用**开发者模式**
3. 点击**"加载已解压的扩展程序"** → 选择 `extension/` 文件夹

## 📁 项目结构

```
Summary-of-long-video-content/
├── extension/          # Chrome MV3 扩展（弹窗、内容脚本、后台服务）
├── server/             # Spring Boot 3 后端
│   └── src/
├── sql/                # 数据库建表和迁移脚本
├── docs/               # 技术规格文档
├── .env.example        # 环境变量模板
└── README.md
```

## 🗺️ 开发路线图

- [x] 网页内容提取（Readability.js）
- [x] 哔哩哔哩字幕提取
- [x] AI 驱动的摘要生成
- [x] 思维导图可视化（Markmap）
- [x] 用户认证（JWT + BCrypt）
- [x] Notion OAuth 集成
- [x] Obsidian 和 Logseq 导出
- [x] 免费试用配额系统（每用户 3 次）
- [x] 后端单元测试（24 个测试）
- [x] 生产环境部署（阿里云）
- [ ] YouTube 字幕提取
- [ ] Chrome 网上应用店发布
- [ ] 更多 AI 模型选项

## 📄 许可证

本项目基于 MIT 许可证开源 - 详情请参阅 [LICENSE](LICENSE) 文件。
