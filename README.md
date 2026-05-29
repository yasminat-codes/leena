# Pocket Agent

**Your AI that actually knows you.**

A desktop voice assistant that lives in your menu bar. It listens, sees your screen, controls your computer, and gets things done — all through the OpenAI Realtime API.

- **Repo:** https://github.com/KenKaiii/brah
- **YouTube:** [@kenkaidoesai](https://www.youtube.com/kenkaidoesai) — tutorials and demos
- **Community:** [Skool](https://www.skool.com/kenkai) — come hang out

## ✨ What it actually does

**Realtime voice**
Talk to it naturally. Low-latency voice in, voice out, powered by the OpenAI Realtime API with live transcription and barge-in.

**Sees your screen**
Take screenshots of any window or display and have the model analyze what's on screen — visible text, UI elements, errors, and the obvious next action.

**Computer use**
Two modes: a sandboxed Chromium browser (via Playwright) for web tasks, or full OS control (via nut.js) to drive the real mouse and keyboard.

**Planner**
Built-in tasks and calendar the agent can create, update, and remind you about.

**Web search & fetch**
Pull live information and read pages on demand.

## 🚀 Getting started

```bash
git clone https://github.com/KenKaiii/brah.git
cd brah
npm install
npm start
```

Sign in to OpenAI from inside the app to start a Realtime session. That's it.

## 🔒 Privacy

- Data (planner, activity, screenshots) is stored locally on your machine
- Credentials are encrypted via your system keychain (Electron `safeStorage`)
- No analytics, no telemetry

## 🛠️ For developers

```bash
npm run check   # format + lint (Biome)
npm test        # check + Node test suite
npm run build:mac
```

Stack: Electron + OpenAI Realtime API + Playwright + nut.js.

Code signing is auto-discovered from your keychain (or `CSC_*` env vars); with no certificate the macOS build falls back to ad-hoc / unsigned.

## 👥 Community

- **YouTube** [@kenkaidoesai](https://www.youtube.com/kenkaidoesai) — tutorials and demos
- **Skool** [skool.com/kenkai](https://www.skool.com/kenkai) — come hang out

## 📄 License

ISC
