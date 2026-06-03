# 🎙️ Leena

<p align="center">
  <strong>Your AI that actually sees and does.</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
  <a href="https://youtube.com/@kenkaidoesai"><img src="https://img.shields.io/badge/YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white" alt="YouTube"></a>
  <a href="https://skool.com/kenkai"><img src="https://img.shields.io/badge/Skool-Community-7C3AED?style=for-the-badge" alt="Skool"></a>
</p>

**Leena** is a desktop voice assistant that lives in the corner of your screen. Talk to it and it listens, looks at your screen, controls your computer, and gets things done, all in realtime through the OpenAI Realtime API.

It's not just a chatbot. It takes screenshots and reasons about what's on screen, drives your mouse and keyboard, automates the browser, and manages your tasks and calendar, hands-free.

---

## 🧠 Why this exists

Most voice assistants can talk but can't *do*. Leena closes that gap: it sees your actual screen, controls your actual computer, and runs real tools, so a conversation turns into action instead of just suggestions.

---

## ✨ What it actually does

### Realtime voice
Low-latency voice in, voice out, powered by the OpenAI Realtime API. Live transcription and natural barge-in so you can interrupt and steer mid-sentence.

### Sees your screen
Take screenshots of any window or display and have the model analyze what's there: visible text, UI elements, errors, and the obvious next action.

### Computer use
Two modes:
- **Browser mode:** A sandboxed Chromium browser (via Playwright) for web tasks
- **OS mode:** Full OS-level control (via nut.js) to drive the real mouse and keyboard

### Planner
Built-in tasks and calendar the agent can create, update, and remind you about.

### Web search & fetch
Pulls live information and reads pages on demand.

---

## 🚀 Getting started

```bash
git clone https://github.com/KenKaiii/leena.git
cd leena
npm install
npm start
```

Sign in to OpenAI from inside the app to start a Realtime session. That's it.

---

## 🔒 Privacy

- Data (planner, activity, screenshots) is stored locally on your machine
- Credentials are encrypted via your system keychain (Electron `safeStorage`)
- No analytics, no telemetry

---

## 🛠️ For developers

```bash
npm run check   # format + lint (Biome)
npm test        # check + Node test suite
npm run build:mac
```

Stack: Electron + OpenAI Realtime API + Playwright + nut.js

Code signing is auto-discovered from your keychain (or `CSC_*` env vars); with no certificate the macOS build falls back to ad-hoc / unsigned.

---

## 👥 Community

- [YouTube @kenkaidoesai](https://youtube.com/@kenkaidoesai) - tutorials and demos
- [Skool community](https://skool.com/kenkai) - come hang out

---

## 📄 License

MIT

---

<p align="center">
  <strong>An AI that sees your screen, runs your computer, and gets things done, hands-free.</strong>
</p>
