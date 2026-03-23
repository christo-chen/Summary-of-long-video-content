# Privacy Policy — AI Summary Assistant

**Last updated: March 2026**

## Overview

AI Summary Assistant is a Chrome browser extension that extracts webpage content and video subtitles, then generates AI-powered summaries, mind maps, and translations. We are committed to protecting your privacy.

## Data Collection

### What we collect
- **Nothing.** This extension does not collect, store, or transmit any personal data to our servers.

### What stays on your device
- **API Keys**: Your AI service API keys (DeepSeek / OpenAI) are stored locally in your browser's `chrome.storage.local` and are never sent to any server other than the AI provider you selected.
- **Settings**: Your language preference and UI settings are stored locally.
- **Login credentials** (optional): If you choose to register an account for cloud history sync, your email and encrypted password are stored on our backend server. This feature is optional and the extension works fully without it.

## Third-Party Services

This extension communicates with the following third-party services **only when you initiate an action**:

- **DeepSeek API** or **OpenAI API** — to generate summaries (using your own API key)
- **YouTube** — to fetch video subtitle data from the current page
- **Bilibili** — to fetch video subtitle data from the current page
- **Notion API** (optional) — if you choose to export summaries to Notion

No data is sent to these services automatically or in the background.

## Permissions

- `activeTab` — to extract content from the current webpage
- `sidePanel` — to display the summary sidebar
- `storage` — to save your settings locally
- `host_permissions` for `youtube.com` and `bilibili.com` — to fetch video subtitle data

## Data Security

All data processing happens locally in your browser. API keys are never exposed to any server other than the AI provider. We do not use analytics, tracking, or advertising.

## Changes

We may update this privacy policy from time to time. Changes will be posted on this page.

## Contact

If you have questions about this privacy policy, please open an issue at:
https://github.com/christo-chen/Summary-of-long-video-content/issues
