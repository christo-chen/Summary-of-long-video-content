[English](README.md) | [中文](README_zh.md)

<div align="center">

# AI Summary Assistant

**AI-powered Chrome extension that extracts web content and generates structured summaries, mind maps, and translations.**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Java](https://img.shields.io/badge/Java-21-orange.svg)](https://www.oracle.com/java/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3-green.svg)](https://spring.io/projects/spring-boot)
[![Chrome Extension](https://img.shields.io/badge/Chrome-MV3-yellow.svg)](https://developer.chrome.com/docs/extensions/mv3/)

</div>

## ✨ Features

- 📄 Extract main content from any webpage (Readability.js)
- 📦 Summarize GitHub repositories and technical pages
- 🧠 AI-generated structured summaries, mind maps, and translations via DeepSeek API
- 🎬 Subtitle-based video summary for YouTube/Bilibili, with backend yt-dlp fallback
- 🚫 Prevent fake video summaries when no real transcript is available
- 🔓 Free default AI proxy with soft reminder after 3 uses (no hard block)
- 📒 Sync to Notion via OAuth / Export to Obsidian & Logseq
- 🔐 JWT + BCrypt authentication
- 💾 MySQL-backed summary history, tags, and usage records

## 📸 Screenshots

> Coming soon — GIF demo and screenshots will be added here.

<!-- 
![Demo GIF](docs/images/demo.gif)
-->

## 🏗️ Architecture

```mermaid
graph LR
    A[Chrome Extension<br/>MV3] -->|REST API| B[Spring Boot 3<br/>Backend]
    B -->|AI Proxy| C[DeepSeek API]
    B -->|CRUD| D[(MySQL)]
    B -->|OAuth| E[Notion API]
    A -->|Readability.js| F[Web Page]
    A -->|Subtitle Extract| G[YouTube / Bilibili]
    G -->|Fallback| H[Backend yt-dlp]
    H --> B
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Chrome Extension (Manifest V3), HTML/CSS/JS, Markmap |
| Backend | Java 21, Spring Boot 3, MyBatis-Plus, MySQL |
| AI | DeepSeek API (via backend proxy) |
| Auth | JWT + BCrypt, Notion OAuth 2.0 |
| Deployment | Alibaba Cloud ECS (Ubuntu 24.04) |
| Testing | JUnit 5 + Mockito |

## 🚀 Getting Started

### Prerequisites

- JDK 21+
- MySQL 8.0+
- Node.js (for extension development, optional)
- Chrome browser
- yt-dlp (required for backend video transcript fallback)

### Backend Setup

```bash
cd server
cp .env.example .env
# Edit .env with your database credentials and DeepSeek API key
./mvnw spring-boot:run
```

### Extension Setup

1. Open `chrome://extensions/`
2. Enable **Developer Mode**
3. Click **"Load unpacked"** → select the `extension/` folder

## 📁 Project Structure

```
Summary-of-long-video-content/
├── extension/          # Chrome MV3 extension (popup, content scripts, background)
├── server/             # Spring Boot 3 backend
│   └── src/
├── sql/                # Database schema and migrations
├── docs/               # Technical specifications
├── .env.example        # Environment variable template
└── README.md
```

## 🗺️ Roadmap

- [x] Web page content extraction (Readability.js)
- [x] GitHub repository summary
- [x] AI-powered summary generation
- [x] Mind map visualization (Markmap)
- [x] User authentication (JWT + BCrypt)
- [x] Notion OAuth integration
- [x] Obsidian & Logseq export
- [x] Free AI proxy with soft usage reminder
- [x] Subtitle-based YouTube/Bilibili video summary implementation
- [x] Video URL whitelist validation
- [x] Backend unit tests with JUnit 5 + Mockito
- [x] Production deployment (Alibaba Cloud)
- [ ] Deploy latest backend with yt-dlp support
- [ ] Production validation for video transcript fallback
- [ ] Chrome Web Store publication
- [ ] More AI model options

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
