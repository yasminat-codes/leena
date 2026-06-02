export const MOCK_ACTIVITY_DATA = Object.freeze([
  {
    id: "morning-brief",
    title: "Morning briefing",
    preview: "Reviewed calendar, open loops, and the top follow-up for today.",
    timestamp: "Today · 2:41 PM",
    icon: "MB",
  },
  {
    id: "site-research",
    title: "Website research",
    preview: "Compared pricing pages and saved three positioning notes.",
    timestamp: "Today · 1:18 PM",
    icon: "WR",
  },
  {
    id: "email-draft",
    title: "Drafted investor email",
    preview: "Prepared a concise update with runway, traction, and asks.",
    timestamp: "Today · 11:07 AM",
    icon: "EM",
  },
  {
    id: "planner-cleanup",
    title: "Planner cleanup",
    preview: "Merged duplicate tasks and moved stale reminders out of today.",
    timestamp: "Yesterday · 5:32 PM",
    icon: "PL",
  },
  {
    id: "screen-help",
    title: "Screen assistance",
    preview: "Read the checkout page and identified the missing account field.",
    timestamp: "Yesterday · 3:09 PM",
    icon: "SC",
  },
  {
    id: "calendar-reschedule",
    title: "Calendar reschedule",
    preview: "Found two open windows and suggested the cleaner meeting slot.",
    timestamp: "Mon · 4:44 PM",
    icon: "CA",
  },
  {
    id: "ops-summary",
    title: "Ops summary",
    preview: "Summarized deployment notes, incidents, and pending reviews.",
    timestamp: "Mon · 9:26 AM",
    icon: "OS",
  },
  {
    id: "browser-session",
    title: "Browser task",
    preview: "Opened the admin panel and checked the latest workspace settings.",
    timestamp: "Fri · 6:10 PM",
    icon: "BR",
  },
  {
    id: "voice-note",
    title: "Voice note captured",
    preview: "Turned a quick idea into a saved task with next action context.",
    timestamp: "Fri · 8:03 AM",
    icon: "VN",
  },
]);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderActivityRow({ id, title, preview, timestamp, icon }) {
  return `
    <article class="row" data-activity-id="${escapeHtml(id)}">
      <span class="tooldot lx-mono" aria-hidden="true">${escapeHtml(icon)}</span>
      <div class="row__txt">
        <div class="lx-body screen-text-strong">${escapeHtml(title)}</div>
        <div class="lx-sm text-dim">${escapeHtml(preview)}</div>
      </div>
      <time class="lx-mono text-faint" datetime="">${escapeHtml(timestamp)}</time>
    </article>`;
}

export function renderActivity() {
  const rows = MOCK_ACTIVITY_DATA.map(renderActivityRow).join("");

  return `
    <section class="activity-screen" aria-labelledby="activity-heading">
      <header class="activity-screen__header">
        <h2 id="activity-heading" class="lx-h2">Activity</h2>
        <label class="btn btn--ghost activity-screen__search">
          <span aria-hidden="true">⌕</span>
          <span class="sr-only">Search conversations</span>
          <input type="search" placeholder="Search conversations..." aria-label="Search conversations" />
        </label>
      </header>
      <div class="card activity-screen__list" role="list">
        ${rows}
      </div>
    </section>`;
}
