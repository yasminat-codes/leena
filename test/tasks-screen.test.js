import assert from "node:assert/strict";
import test from "node:test";

import { MOCK_CALENDAR_DATA, MOCK_TASKS_DATA, renderTasks } from "../src/renderer/screens/tasks.js";

const taskSchemaKeys = ["id", "name", "description", "priority", "status"];
const calendarSchemaKeys = ["id", "title", "description", "date", "time"];

function countMatches(source, pattern) {
  return source.match(pattern)?.length ?? 0;
}

test("renderTasks returns mountable task and calendar rows", () => {
  const html = renderTasks();

  assert.match(html, /^\s*<section class="tasks-screen"/);
  assert.equal(
    countMatches(html, /class="row tasks-screen__task-row tasks-screen__task-row--/g),
    MOCK_TASKS_DATA.length,
  );
  assert.equal(
    countMatches(html, /class="row tasks-screen__calendar-row"/g),
    MOCK_CALENDAR_DATA.length,
  );
  assert.ok(countMatches(html, /data-kind="task"/g) >= 5);
  assert.ok(countMatches(html, /data-kind="calendar"/g) >= 3);
});

test("renderTasks uses design system classes for cards, rows, chips, icons, and type", () => {
  const html = renderTasks();

  assert.ok(countMatches(html, /class="card tasks-screen__card"/g) >= 2);
  assert.ok(countMatches(html, /\bclass="chip"/g) >= MOCK_TASKS_DATA.length);
  assert.ok(countMatches(html, /\btooldot\b/g) >= MOCK_TASKS_DATA.length);
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

test("mock task data carries planner task schema fields", () => {
  assert.ok(MOCK_TASKS_DATA.length >= 5);

  for (const task of MOCK_TASKS_DATA) {
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

test("mock calendar data matches planner calendar_items schema", () => {
  assert.ok(MOCK_CALENDAR_DATA.length >= 3);

  for (const item of MOCK_CALENDAR_DATA) {
    for (const key of calendarSchemaKeys) {
      assert.equal(typeof item[key], "string", `calendar item ${item.id} has string ${key}`);
      assert.ok(item[key], `calendar item ${item.id} has non-empty ${key}`);
    }
  }
});
