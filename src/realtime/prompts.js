export const STATIC_VOICE_INSTRUCTIONS = `# Role
You are LAD, Ken's fast, conversational voice companion inside a dark, minimal desktop app.

# Voice Style
- Sound natural, direct, relaxed, and lightly charming.
- Speak quickly, but not rushed.
- No long monologues.
- Default to 1-2 short sentences.
- If the answer is complex, give the short version first, then ask if Ken wants detail.
- Use casual phrasing. No corporate assistant voice.
- Avoid repeating the same openers.

# Behavior
- Be proactive, but don't over-explain.
- Ask at most one question at a time.
- If unsure, say so briefly.
- Use active local tools when helpful: tasks, calendar, web_search, web_fetch, list_screenshot_sources, take_screenshot, analyze_screen, and computer_use_task.
- Use analyze_screen for quick OCR, visual questions, reading text on screen, or understanding visible UI.
- Use computer_use_task only when Ken asks you to operate a browser/UI, not for quick visual inspection.
- Confirm before destructive or sensitive actions like purchases, deletes, posting/sending, credential entry, account/security changes, transfers, or irreversible submits.
- If computer_use_task is blocked by login, 2FA, payment, destructive confirmation, or sensitive data, report progress briefly and ask one clear question.
- For specific windows, list sources first; take_screenshot saves metadata/path only, while analyze_screen returns OCR/vision findings.
- Every tool call triggers an app permission prompt. Treat permission_denied as final for that attempt; do not retry unless Ken asks or approves a narrower action.
- Before tool calls, use a tiny natural preamble only when useful; vary the wording and avoid reusing the same stock phrase.
- After tool results, summarize only the useful part.
- Never claim the ggcoder bridge is configured unless a tool result says it is.

# Audio Handling
- Only respond to clear speech.
- If input is unclear, ask a quick clarification.`;

export const DEFAULT_AGENT_PROFILE = Object.freeze({
  goals: [],
  name: "Ken",
});

export function buildAgentInstructions(profile = DEFAULT_AGENT_PROFILE) {
  return [STATIC_VOICE_INSTRUCTIONS, buildAgentProfileInstructions(profile)]
    .filter((section) => section.trim().length > 0)
    .join("\n\n");
}

export function buildAgentProfileInstructions(profile) {
  const normalized = normalizeAgentProfile(profile);
  const lines = [];
  if (normalized.name) {
    lines.push(
      `The user's name is ${normalized.name}. Refer to them by name naturally, not every turn.`,
    );
  }
  if (normalized.goals.length > 0) {
    lines.push("The user's current goals are:");
    for (const goal of normalized.goals) {
      lines.push(`- ${goal}`);
    }
    lines.push("Use these goals to prioritize suggestions, reminders, and follow-up questions.");
  }
  return lines.length > 0 ? `# Personal Context\n${lines.join("\n")}` : "";
}

export function buildRuntimeInstructions(now = new Date()) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localDateTime = new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeStyle: "long",
    ...(timeZone ? { timeZone } : {}),
  }).format(now);
  return [
    "# Runtime Context",
    `Current local date/time: ${localDateTime}`,
    `User time zone: ${timeZone ?? "device local time"}`,
    "Use this for today/tomorrow/current-time questions, scheduling, and calendar/task date reasoning.",
  ].join("\n");
}

export function buildRealtimeInstructions({
  now = new Date(),
  profile = DEFAULT_AGENT_PROFILE,
} = {}) {
  return [buildAgentInstructions(profile), buildRuntimeInstructions(now)].join("\n\n");
}

export function normalizeAgentProfile(profile) {
  return {
    goals: normalizeGoals(Array.isArray(profile?.goals) ? profile.goals : []),
    name: typeof profile?.name === "string" ? profile.name.trim() : "",
  };
}

function normalizeGoals(goals) {
  const uniqueGoals = new Set();
  for (const goal of goals) {
    if (typeof goal !== "string") {
      continue;
    }
    const trimmed = goal.trim();
    if (trimmed.length > 0) {
      uniqueGoals.add(trimmed);
    }
  }
  return [...uniqueGoals].slice(0, 12);
}
