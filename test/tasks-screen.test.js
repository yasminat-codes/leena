import assert from "node:assert/strict";
import test from "node:test";

import { renderTasks, renderTasksData } from "../src/renderer/screens/tasks.js";

const taskSchemaKeys = ["id", "name", "description", "priority", "status"];
const calendarSchemaKeys = ["id", "title", "description", "date", "time"];
const sampleTasks = Object.freeze([
  Object.freeze({
    id: "task-review-pr-queue",
    name: "Review priority PR queue",
    description: "Triage open desktop changes before the afternoon sync.",
    priority: "high",
    status: "todo",
    dueDate: "Today",
  }),
  Object.freeze({
    id: "task-send-invoice-followup",
    name: "Send invoice follow-up",
    description: "Nudge accounting with the final PO attachment.",
    priority: "low",
    status: "completed",
    dueDate: "Yesterday",
  }),
]);
const sampleCalendarItems = Object.freeze([
  Object.freeze({
    id: "calendar-product-standup",
    title: "Product standup",
    description: "Zoom",
    date: "Today",
    time: "9:30 AM - 9:50 AM",
  }),
  Object.freeze({
    id: "calendar-customer-call",
    title: "Customer call",
    description: "Meet link",
    date: "Tomorrow",
    time: "1:00 PM - 1:30 PM",
  }),
]);

function countMatches(source, pattern) {
  return source.match(pattern)?.length ?? 0;
}

test("renderTasks returns mountable task and calendar rows", () => {
  const html = renderTasksData({
    calendarItems: sampleCalendarItems,
    tasks: sampleTasks,
  });

  assert.match(html, /^\s*<section class="tasks-screen"/);
  assert.equal(
    countMatches(html, /class="row tasks-screen__task-row tasks-screen__task-row--/g),
    sampleTasks.length,
  );
  assert.equal(
    countMatches(html, /class="row tasks-screen__calendar-row"/g),
    sampleCalendarItems.length,
  );
  assert.equal(countMatches(html, /data-kind="task"/g), sampleTasks.length);
  assert.equal(countMatches(html, /data-kind="calendar"/g), sampleCalendarItems.length);
});

test("renderTasks uses design system classes for cards, rows, chips, icons, and type", () => {
  const html = renderTasksData({
    calendarItems: sampleCalendarItems,
    tasks: sampleTasks,
  });

  assert.ok(countMatches(html, /class="card tasks-screen__card"/g) >= 2);
  assert.ok(countMatches(html, /\bclass="chip"/g) >= sampleTasks.length);
  assert.ok(countMatches(html, /\btooldot\b/g) >= sampleTasks.length);
  assert.match(html, /class="lx-body screen-text-strong"/);
  assert.match(html, /class="lx-sm text-dim"/);
  assert.match(html, /data-priority="high"/);
  assert.match(html, /tasks-screen__priority--high/);
  assert.match(html, /data-status="completed"/);
  assert.match(html, /tasks-screen__status--done/);
  assert.match(html, /tasks-screen__status--pending/);
  assert.match(html, /data-state="done"/);
  assert.match(html, /data-state="pending"/);
});

test("sample task data carries planner task schema fields", () => {
  assert.ok(sampleTasks.length >= 2);

  for (const task of sampleTasks) {
    for (const key of taskSchemaKeys) {
      assert.equal(typeof task[key], "string", `task ${task.id} has string ${key}`);
      assert.ok(task[key], `task ${task.id} has non-empty ${key}`);
    }
    assert.ok(["high", "medium", "low"].includes(task.priority));
    assert.ok(["todo", "completed"].includes(task.status));
    assert.equal(typeof task.dueDate, "string", `task ${task.id} has display dueDate`);
    assert.ok(task.dueDate, `task ${task.id} has non-empty dueDate`);
  }
});

test("sample calendar data matches planner calendar_items schema", () => {
  assert.ok(sampleCalendarItems.length >= 2);

  for (const item of sampleCalendarItems) {
    for (const key of calendarSchemaKeys) {
      assert.equal(typeof item[key], "string", `calendar item ${item.id} has string ${key}`);
      assert.ok(item[key], `calendar item ${item.id} has non-empty ${key}`);
    }
  }
});

test("renderTasks defaults to empty live-data state without production fixtures", () => {
  const html = renderTasks();

  assert.match(html, /No tasks yet - ask Leena to plan something/);
  assert.doesNotMatch(html, /Review priority PR queue/);
});
