# Lena — Self-Annealing Contract

Signals to watch during execution, where to capture them, and what they change in the next plan. Read `plans/.wal/learnings.jsonl` before the next planning session and inject as "Known Planning Pitfalls."

| Signal | What to watch | Where to capture | What changes next plan |
|---|---|---|---|
| Plan executed without deviation | Phase complexity (S/M/L) matched actual effort | `plans/.wal/post-*.json` + confidence +0.1 | Reuse this 6-phase desktop-agent decomposition as a template |
| Scope crept during execution | Memory "types" expand into 4 parallel stores instead of episodic+semantic+procedural-layer (ADR-3) | WAL error + `learnings.jsonl` | Restate the v1 memory boundary at readiness gate; refuse 4-store designs |
| Assumption wrong (R-1) | ChatGPT-OAuth realtime flow fails for a second user | WAL error, confidence -0.15 | Default future "share-with-others" builds to OpenAI API-key auth from the start |
| Unproven dependency underdelivers | Mem0 (R-2) or openWakeWord (R-3) behaves worse than research suggested | `learnings.jsonl`, confidence -0.15 | Always spike centerpiece third-party deps before planning around them; keep them behind interfaces |
| Interface paid off | Swapping a `WakeEngine`/`MemoryStore` impl required no caller changes | WAL post + `times_prevented_mistake`++ | Apply the "interface + swappable impl" pattern to any at-risk dependency by default |
| Permission surface incident | An MCP tool acted without confirmation, or a tool definition drifted undetected | WAL error + `learnings.jsonl` | Tighten default-deny + definition hashing earlier in the MCP phase |

**Confidence scoring:** +0.1 when a planning pattern applied and execution matched; -0.15 when a planned-for error recurred anyway. Track `times_prevented_mistake` to prove the loop works.
