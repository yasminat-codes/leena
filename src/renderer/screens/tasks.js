export const MOCK_TASKS_DATA = Object.freeze([
  {
    id: "task-review-pr-queue",
    name: "Review priority PR queue",
    description: "Triage open desktop changes before the afternoon sync.",
    priority: "high",
    status: "todo",
    dueDate: "Today",
  },
  {
    id: "task-draft-client-recap",
    name: "Draft client recap",
    description: "Summarize decisions and next actions from the launch call.",
    priority: "medium",
    status: "todo",
    dueDate: "Today",
  },
  {
    id: "task-send-invoice-followup",
    name: "Send invoice follow-up",
    description: "Nudge accounting with the final PO attachment.",
    priority: "low",
    status: "completed",
    dueDate: "Yesterday",
  },
  {
    id: "task-plan-provider-testing",
    name: "Plan provider testing",
    description: "Map coverage for OpenAI, OpenRouter, and local model paths.",
    priority: "high",
    status: "todo",
    dueDate: "Tomorrow",
  },
  {
    id: "task-clean-planner-capture",
    name: "Clean planner capture",
    description: "Merge duplicate tasks created during realtime notes.",
    priority: "medium",
    status: "todo",
    dueDate: "Fri",
  },
  {
    id: "task-confirm-demo-window",
    name: "Confirm demo window",
    description: "Lock the final review slot with design and engineering.",
    priority: "medium",
    status: "completed",
    dueDate: "Mon",
  },
]);

export const MOCK_CALENDAR_DATA = Object.freeze([
  {
    id: "calendar-product-standup",
    title: "Product standup",
    description: "Zoom",
    date: "Today",
    time: "9:30 AM - 9:50 AM",
  },
  {
    id: "calendar-design-review",
    title: "Design review",
    description: "Studio room",
    date: "Today",
    time: "11:00 AM - 11:45 AM",
  },
  {
    id: "calendar-customer-call",
    title: "Customer call",
    description: "Meet link",
    date: "Tomorrow",
    time: "1:00 PM - 1:30 PM",
  },
  {
    id: "calendar-planning-block",
    title: "Planning block",
    description: "Focus",
    date: "Friday",
    time: "3:00 PM - 4:00 PM",
  },
]);

const CHECK_ICON =
  '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 10.5l3.2 3.2L15 6.8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const CALENDAR_ICON =
  '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="3.5" y="4.5" width="13" height="12" rx="2.4" stroke="currentColor" stroke-width="1.7"/><path d="M6.5 2.8v3.4M13.5 2.8v3.4M4 8h12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderTaskRow(task) {
  const isDone = task.status === "completed" || task.status === "done";
  const statusLabel = isDone ? "Done" : "Pending";
  const priority =
    task.priority === "high"
      ? '<span class="chip tasks-screen__priority tasks-screen__priority--high" data-priority="high">High</span>'
      : task.priority
        ? `<span class="chip tasks-screen__priority" data-priority="${escapeHtml(task.priority)}">${escapeHtml(task.priority)}</span>`
        : "";

  return `
    <article class="row tasks-screen__task-row tasks-screen__task-row--${isDone ? "done" : "pending"}" data-kind="task" data-task-id="${escapeHtml(task.id)}" data-status="${escapeHtml(task.status)}">
      <span class="tooldot tasks-screen__status tasks-screen__status--${isDone ? "done" : "pending"}" data-state="${isDone ? "done" : "pending"}" aria-label="${statusLabel}">
        ${isDone ? CHECK_ICON : '<span class="dot" aria-hidden="true"></span>'}
      </span>
      <div class="row__txt">
        <div class="lx-body screen-text-strong">${escapeHtml(task.name)}</div>
        <div class="lx-sm text-dim">${escapeHtml(task.description)}</div>
      </div>
      <span class="chip">${escapeHtml(task.dueDate)}</span>
      ${priority}
    </article>`;
}

function renderCalendarRow(item) {
  return `
    <article class="row tasks-screen__calendar-row" data-kind="calendar" data-calendar-id="${escapeHtml(item.id)}">
      <span class="tooldot" aria-hidden="true">${CALENDAR_ICON}</span>
      <div class="row__txt">
        <div class="lx-body screen-text-strong">${escapeHtml(item.title)}</div>
        <div class="lx-sm text-dim">${escapeHtml(item.time)}</div>
      </div>
      <span class="chip">${escapeHtml(item.date)}</span>
      <span class="lx-sm text-dim">${escapeHtml(item.description)}</span>
    </article>`;
}

export function renderTasks() {
  return `
    <section class="tasks-screen" aria-label="Tasks planner">
      <div class="card tasks-screen__card">
        <div class="row__txt">
          <div class="lx-h2">Tasks</div>
          <div class="lx-sm text-dim">Planner priorities and follow-ups</div>
        </div>
        ${MOCK_TASKS_DATA.map(renderTaskRow).join("")}
      </div>

      <div class="card tasks-screen__card">
        <div class="row__txt">
          <div class="lx-h2">Up Next</div>
          <div class="lx-sm text-dim">Calendar blocks coming up</div>
        </div>
        ${MOCK_CALENDAR_DATA.map(renderCalendarRow).join("")}
      </div>
    </section>`;
}
