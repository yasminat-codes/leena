# Leena — Setup & Unblock Checklist

**Read this once before kicking off the autonomous build.** It lists everything an automated run **cannot** do for itself. The good news: I checked your machine and **almost everything is already in place.** There are no hard blockers.

The build is designed to run start-to-finish on its own with exactly **ONE** pause: after the visual shell is built (end of Wave 6 / Phase 0), it stops and launches `npm start` so you can see how Leena looks before any functional work continues. That is the only human gate.

---

## ✅ Already done (verified on your machine — 2026-06-01)

| Item | Status |
|------|--------|
| `OPENAI_API_KEY` | ✅ Set in `.env` (164 chars) — powers voice, chat, embeddings |
| `OPENROUTER_API_KEY` | ✅ Set in `.env` — alternative chat provider works |
| `COMPOSIO_API_KEY` | ✅ Set — optional MCP/tool bridge available |
| `MEM0_API_KEY` | ✅ Set — optional cloud-memory adapter available |
| Ollama | ✅ Installed on your machine |
| Apple Developer cert | ✅ Not needed — building **unsigned** (by your choice) |
| Node `node:sqlite`, Electron, Playwright, @nut-tree-fork | ✅ Already in the project |

**Bottom line: you can start the run as-is.** The items below are optional polish, not blockers.

---

## 🟡 Optional — do these only if you want the feature (none block the build or the .dmg)

### 1. Ollama offline models (optional — enables fully-offline chat/embeddings)
Ollama is installed but has no models pulled yet. To use Leena fully offline:
```bash
# add to .env (the build defaults to this if you skip it):
echo 'OLLAMA_BASE_URL=http://localhost:11434' >> .env

# pull the models Leena's Ollama provider looks for:
ollama pull llama3.2          # local chat
ollama pull nomic-embed-text  # local embeddings
ollama serve                  # ensure the Ollama server is running
```
If you skip this, Leena simply uses OpenAI/OpenRouter and the Ollama provider reports "not available" gracefully. **Nothing breaks.**

### 2. "Hey Leena" wake-word model (optional — Phase 6, decoupled from the .dmg)
Task **091** trains a custom "Hey Leena" ONNX model in a Colab notebook (openwakeword-trainer). This is the **one task an automated run can't fully self-complete** because it needs a human-run Colab training session with synthetic voice samples.

**This does NOT block your .dmg.** I deliberately wired the deliverable so both the MVP `.dmg` (task 046) and the final `.dmg` (task 111) build **without** the wake-word model. If 091 can't complete unattended, the build skips wake-word and ships everything else. To add wake-word later:
- Run the openwakeword-trainer Colab → export `hey-lena.onnx`
- Drop it at `src/wake/models/hey-lena.onnx`
- Re-run wave 8+ wake tasks

### 3. Apple signing (optional — only if you later want a signed build)
You chose unsigned. Recipients run this once after downloading:
```bash
xattr -cr /Applications/Leena.app
```
This is documented in the generated `INSTALL.md` (task 111). If you ever get a Developer ID cert, set `CSC_LINK` / `CSC_KEY_PASSWORD` / `APPLE_ID` / `APPLE_ID_PASSWORD` / `APPLE_TEAM_ID` in `.env` and rebuild.

---

## ⚠️ The one thing worth confirming manually

**OpenAI Realtime API access.** Your `OPENAI_API_KEY` is set, but voice requires it to have **Realtime API access** (`gpt-realtime`). Task **030** verifies this. If your key/account lacks realtime access:
- Voice won't work, but **text chat, memory, MCP, and the .dmg all still build and run.**
- The app falls back to text-chat mode automatically (no crash).

To confirm ahead of time, you can check your OpenAI account has Realtime API / ChatGPT Plus. If not, everything except live voice still works.

---

## ▶️ How to start the autonomous run

```bash
# from /Users/yasmineseidu/leena
/run-leena-wave            # runs Wave 1 onward, auto-stops after Wave 6 (Phase 0 shell)
```
At the Wave-6 gate it will launch `npm start`. Review the shell. When you're happy:
```bash
/run-leena-wave            # resumes Wave 7 onward, runs to completion (the .dmg)
```

The run will not ask you anything else. Tests run after every task; a wave only advances when its tests pass. If a single task can't be unblocked after 10 tries it's set aside and the run continues around it (your .dmg is never gated on a single fragile task).
