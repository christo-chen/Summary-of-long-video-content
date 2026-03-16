# AI Summary Assistant - Chrome 插件

一键提取网页正文/视频字幕，调用 AI 生成结构化摘要与可交互思维导图。

## 功能特性

- **网页正文提取**：使用 Readability.js 智能提取，去除广告和噪音
- **B站视频字幕**：自动获取 CC 字幕，无字幕时降级到视频简介
- **YouTube 字幕**：自动获取字幕轨道，支持中英文
- **GitHub README**：提取仓库信息和 README 内容
- **StackOverflow**：提取问题 + 采纳答案 + 高赞答案
- **专用 Prompt**：根据内容来源自动切换 AI 提示词模板（亮点 B）
- **可视化思维导图**：使用 Markmap 渲染可交互的 SVG 思维导图
- **多 AI 支持**：支持 DeepSeek 和 OpenAI，可切换

## 快速开始

### 1. 获取 API Key

- **DeepSeek（推荐）**：https://platform.deepseek.com
- **OpenAI**：https://platform.openai.com

### 2. 安装插件

1. 打开 `chrome://extensions/`
2. 开启 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择 `extension` 文件夹

### 3. 使用

1. 打开任意文章/视频/GitHub/StackOverflow 页面
2. 点击工具栏插件图标，打开侧边栏
3. 首次使用设置 API Key
4. 点击 **生成摘要**

## 项目结构

```
extension/
├── manifest.json                 # MV3 插件配置
├── background/
│   └── service-worker.js         # 消息中转
├── content/
│   ├── Readability.js            # Mozilla 正文提取库
│   ├── extractors/
│   │   ├── article.js            # 通用文章提取器
│   │   ├── bilibili.js           # B站字幕提取器
│   │   ├── youtube.js            # YouTube 字幕提取器
│   │   ├── github.js             # GitHub README 提取器
│   │   ├── stackoverflow.js      # StackOverflow 提取器
│   │   └── index.js              # 提取器工厂（URL 路由）
│   └── content-script.js         # Content Script 入口
├── sidepanel/
│   ├── sidepanel.html            # 侧边栏 HTML
│   ├── sidepanel.css             # 侧边栏样式
│   ├── sidepanel.js              # 侧边栏主逻辑
│   └── markmap-bundle.js         # Markmap 打包文件
└── utils/
    ├── api.js                    # AI API 调用封装
    └── prompts.js                # 多场景 Prompt 模板
```

## 开发进度

- [x] Phase 1：MVP（通用文章提取 + AI 摘要 + SidePanel）
- [x] Phase 2：B站/YouTube 字幕 + GitHub/SO 提取器 + 专用 Prompt + Markmap 思维导图
- [ ] Phase 3：Java 后端（Spring Boot + MySQL + 历史记录）
- [ ] Phase 4：Notion 导出 + 部署上线
