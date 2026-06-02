const CHECK_ICON =
  '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 10.5l3.2 3.2L15 6.8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const CALENDAR_ICON =
  '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="3.5" y="4.5" width="13" height="12" rx="2.4" stroke="currentColor" stroke-width="1.7"/><path d="M6.5 2.8v3.4M13.5 2.8v3.4M4 8h12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';

const EMPTY_TASKS_MESSAGE = "No tasks yet - ask Leena to plan something";

const taskStatusLabels = Object.freeze({
  completed: "Done",
  done: "Done",
  in_progress: "In progress",
  todo: "Pending",
});

function getDefaultBridge() {
  return typeof window === "undefined" ? null : window.brah;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return "";
}

function buildTask(task) {
  const name = firstString(task.name, task.title, "Untitled task");
  return {
    id: firstString(task.id, name),
    name,
    description: firstString(task.description),
    priority: normalizePriority(task.priority),
    status: normalizeStatus(task.status),
    dueDate: firstString(task.dueDate, task.due_date, task.due),
  };
}

function buildCalendarItem(item) {
  const title = firstString(item.title, item.name, "Untitled event");
  return {
    id: firstString(item.id, title),
    title,
    description: firstString(item.description),
    date: firstString(item.date, item.day, "No date"),
    time: firstString(item.time),
  };
}

function normalizePriority(priority) {
  const value = firstString(priority).toLowerCase();
  return ["high", "medium", "low"].includes(value) ? value : "medium";
}

function normalizeStatus(status) {
  const value = firstString(status).toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  if (value === "done" || value === "complete") {
    return "completed";
  }
  if (value === "doing" || value === "active") {
    return "in_progress";
  }
  return ["todo", "in_progress", "completed"].includes(value) ? value : "todo";
}

export function groupCalendarItemsByDate(calendarItems = []) {
  const groups = [];
  const groupByDate = new Map();
  for (const item of calendarItems.map(buildCalendarItem)) {
    const label = item.date || "No date";
    if (!groupByDate.has(label)) {
      const group = { date: label, items: [] };
      groupByDate.set(label, group);
      groups.push(group);
    }
    groupByDate.get(label).items.push(item);
  }
  return groups;
}

export function normalizeTasksData(data = {}) {
  const record = typeof data === "object" && data !== null ? data : {};
  const tasks = Array.isArray(record.tasks) ? record.tasks.map(buildTask) : [];
  const calendarItems = Array.isArray(record.calendarItems)
    ? record.calendarItems.map(buildCalendarItem)
    : [];
  return {
    tasks,
    calendarItems,
    calendarGroups: groupCalendarItemsByDate(calendarItems),
  };
}

export async function loadTasks(bridge = getDefaultBridge()) {
  if (
    !bridge ||
    typeof bridge.getPlannerTasks !== "function" ||
    typeof bridge.getCalendarItems !== "function"
  ) {
    throw new Error("Tasks screen requires the planner bridge.");
  }

  const [tasks, calendarItems] = await Promise.all([
    bridge.getPlannerTasks(),
    bridge.getCalendarItems(),
  ]);

  return normalizeTasksData({ calendarItems, tasks });
}

function renderPriority(task) {
  if (!task.priority) {
    return "";
  }
  const modifier = task.priority === "high" ? " tasks-screen__priority--high" : "";
  return `<span class="chip tasks-screen__priority${modifier}" data-priority="${escapeHtml(
    task.priority,
  )}">${escapeHtml(task.priority)}</span>`;
}

function renderDueDate(task) {
  return task.dueDate ? `<span class="chip">${escapeHtml(task.dueDate)}</span>` : "";
}

function renderTaskRow(task) {
  const isDone = task.status === "completed" || task.status === "done";
  const state = isDone ? "done" : "pending";
  const statusLabel = taskStatusLabels[task.status] ?? "Pending";
  const description = task.description
    ? `<div class="lx-sm text-dim">${escapeHtml(task.description)}</div>`
    : "";

  return `
    <article class="row tasks-screen__task-row tasks-screen__task-row--${state}" data-kind="task" data-task-id="${escapeHtml(task.id)}" data-status="${escapeHtml(task.status)}">
      <span class="tooldot tasks-screen__status tasks-screen__status--${state}" data-state="${state}" aria-label="${escapeHtml(statusLabel)}">
        ${isDone ? CHECK_ICON : '<span class="dot" aria-hidden="true"></span>'}
      </span>
      <div class="row__txt">
        <div class="lx-body screen-text-strong">${escapeHtml(task.name)}</div>
        ${description}
      </div>
      ${renderDueDate(task)}
      ${renderPriority(task)}
    </article>`;
}

function renderEmptyTasksState() {
  return `
    <div class="row tasks-screen__empty" data-kind="empty">
      <span class="tooldot" aria-hidden="true"><span class="dot"></span></span>
      <div class="row__txt">
        <div class="lx-body screen-text-strong">${EMPTY_TASKS_MESSAGE}</div>
        <div class="lx-sm text-dim">Planner items will appear here after Leena creates them.</div>
      </div>
    </div>`;
}

function renderCalendarRow(item) {
  const description = item.description
    ? `<span class="lx-sm text-dim">${escapeHtml(item.description)}</span>`
    : "";
  return `
    <article class="row tasks-screen__calendar-row" data-kind="calendar" data-calendar-id="${escapeHtml(item.id)}">
      <span class="tooldot" aria-hidden="true">${CALENDAR_ICON}</span>
      <div class="row__txt">
        <div class="lx-body screen-text-strong">${escapeHtml(item.title)}</div>
        <div class="lx-sm text-dim">${escapeHtml(item.time)}</div>
      </div>
      <span class="chip">${escapeHtml(item.date)}</span>
      ${description}
    </article>`;
}

function renderCalendarGroup(group) {
  return `
    <div class="tasks-screen__calendar-group" data-date="${escapeHtml(group.date)}">
      <div class="lx-sm text-dim tasks-screen__calendar-date">${escapeHtml(group.date)}</div>
      ${group.items.map(renderCalendarRow).join("")}
    </div>`;
}

function renderCalendarGroups(groups) {
  if (groups.length === 0) {
    return `
      <div class="row tasks-screen__empty" data-kind="calendar-empty">
        <span class="tooldot" aria-hidden="true">${CALENDAR_ICON}</span>
        <div class="row__txt">
          <div class="lx-body screen-text-strong">Nothing scheduled</div>
          <div class="lx-sm text-dim">Calendar blocks will appear here once Leena adds them.</div>
        </div>
      </div>`;
  }
  return groups.map(renderCalendarGroup).join("");
}

export function renderTasksData(data = {}) {
  const { calendarGroups, tasks } = normalizeTasksData(data);
  const taskRows = tasks.length > 0 ? tasks.map(renderTaskRow).join("") : renderEmptyTasksState();

  return `
    <section class="tasks-screen" aria-label="Tasks planner">
      <div class="card tasks-screen__card">
        <div class="row__txt">
          <div class="lx-h2">Tasks</div>
          <div class="lx-sm text-dim">Planner priorities and follow-ups</div>
        </div>
        ${taskRows}
      </div>

      <div class="card tasks-screen__card">
        <div class="row__txt">
          <div class="lx-h2">Up Next</div>
          <div class="lx-sm text-dim">Calendar blocks coming up</div>
        </div>
        ${renderCalendarGroups(calendarGroups)}
      </div>
    </section>`;
}

export function renderTasks(data = {}) {
  return renderTasksData(data);
}

export async function refreshTasksScreen(root = document, bridge = getDefaultBridge()) {
  const screen = root?.querySelector?.(".tasks-screen");
  if (!screen) {
    return null;
  }
  const data = await loadTasks(bridge);
  screen.outerHTML = renderTasksData(data);
  return data;
}
