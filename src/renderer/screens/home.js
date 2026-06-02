export const MOCK_HOME_DATA = Object.freeze({
  greeting: "Good morning, Yasmine",
  status: "READY",
  askPlaceholder: "Ask Leena anything...",
  recentActions: Object.freeze([
    Object.freeze({
      label: "Summarized inbox priorities",
      detail: "Pulled three client replies into today's focus list",
    }),
    Object.freeze({
      label: "Queued calendar brief",
      detail: "Prepared notes for the 11:30 product sync",
    }),
    Object.freeze({
      label: "Filed research notes",
      detail: "Saved competitor pricing snippets to planner context",
    }),
    Object.freeze({
      label: "Checked desktop permissions",
      detail: "Screen and microphone access are ready",
    }),
    Object.freeze({
      label: "Drafted follow-up tasks",
      detail: "Created two reminders from yesterday's call",
    }),
  ]),
  upNext: Object.freeze([
    Object.freeze({
      time: "09:30",
      title: "Review launch notes",
      detail: "Confirm scope before the design review",
    }),
    Object.freeze({
      time: "11:30",
      title: "Product sync",
      detail: "Bring open decisions and risk register updates",
    }),
    Object.freeze({
      time: "14:00",
      title: "Follow up with ops",
      detail: "Send the deployment checklist and blockers",
    }),
  ]),
  prompt: "Brief me on my day",
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderRecentAction(action) {
  return `
    <article class="row">
      <span class="home-marker" aria-hidden="true"></span>
      <span class="row__txt">
        <strong class="lx-body">${escapeHtml(action.label)}</strong>
        <span class="lx-sm">${escapeHtml(action.detail)}</span>
      </span>
    </article>
  `;
}

function renderTimelineEntry(item) {
  return `
    <article class="row">
      <span class="lx-mono">${escapeHtml(item.time)}</span>
      <span class="row__txt">
        <strong class="lx-body">${escapeHtml(item.title)}</strong>
        <span class="lx-sm">${escapeHtml(item.detail)}</span>
      </span>
    </article>
  `;
}

export function renderHome() {
  return `
    <section class="home-screen" aria-label="Home">
      <section class="home-command" aria-labelledby="home-greeting">
        <div class="home-command__surface">
          <div class="home-command__meta">
            <span class="home-status">
              <span class="home-status__dot" aria-hidden="true"></span>
              ${escapeHtml(MOCK_HOME_DATA.status)}
            </span>
          </div>

          <div class="home-command__center">
            <div class="home-command__copy">
              <h1 id="home-greeting" class="lx-display">${escapeHtml(MOCK_HOME_DATA.greeting)}</h1>
              <p class="lx-body text-dim">Start with voice, type a command, or let Leena prepare the next move.</p>
              <button class="home-command__input" type="button">
                <span class="home-command__input-mark" aria-hidden="true"></span>
                <span class="home-command__input-text">${escapeHtml(MOCK_HOME_DATA.askPlaceholder)}</span>
                <span class="home-command__input-hint">Return</span>
              </button>
            </div>
            <div class="home-command__orb-well" aria-hidden="true">
              <div class="orb home-command__orb">
                <span class="orb__ring" aria-hidden="true"></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="home-context home-context--recent" aria-labelledby="recent-actions-title">
        <div class="home-context__header">
          <h2 id="recent-actions-title" class="lx-h2">Recent actions</h2>
          <span class="lx-mono text-faint">Memory</span>
        </div>
        <div class="home-list">
          ${MOCK_HOME_DATA.recentActions.map(renderRecentAction).join("")}
        </div>
      </section>

      <section class="home-context home-context--next" aria-labelledby="up-next-title">
        <div class="home-context__header">
          <h2 id="up-next-title" class="lx-h2">Up next</h2>
          <span class="lx-mono text-faint">Today</span>
        </div>
          <div class="home-list">
          ${MOCK_HOME_DATA.upNext.map(renderTimelineEntry).join("")}
          </div>
        <button class="home-brief" type="button">
          <span class="lx-h3">${escapeHtml(MOCK_HOME_DATA.prompt)}</span>
        </button>
      </section>
    </section>
  `;
}
