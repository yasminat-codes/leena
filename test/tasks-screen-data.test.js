import assert from "node:assert/strict";
import test from "node:test";

import {
  groupCalendarItemsByDate,
  loadTasks,
  normalizeTasksData,
  renderTasksData,
} from "../src/renderer/screens/tasks.js";

function createBridge({ calendarItems = [], tasks = [] } = {}) {
  const calls = [];
  return {
    calls,
    getCalendarItems: async () => {
      calls.push("getCalendarItems");
      return calendarItems;
    },
    getPlannerTasks: async () => {
      calls.push("getPlannerTasks");
      return tasks;
    },
  };
}

test("loadTasks uses the existing planner bridge methods and normalizes task rows", async () => {
  const bridge = createBridge({
    tasks: [
      {
        id: "task-1",
        name: "Ship live tasks",
        description: "Replace static fixtures",
        priority: "urgent",
        status: "doing",
        due_date: "Today",
      },
      {
        id: "task-2",
        title: "Review empty state",
        status: "done",
      },
    ],
  });

  const data = await loadTasks(bridge);

  assert.deepEqual(bridge.calls.sort(), ["getCalendarItems", "getPlannerTasks"]);
  assert.deepEqual(data.tasks, [
    {
      id: "task-1",
      name: "Ship live tasks",
      description: "Replace static fixtures",
      priority: "medium",
      status: "in_progress",
      dueDate: "Today",
    },
    {
      id: "task-2",
      name: "Review empty state",
      description: "",
      priority: "medium",
      status: "completed",
      dueDate: "",
    },
  ]);
});

test("loadTasks groups calendar items by date in bridge order", async () => {
  const bridge = createBridge({
    calendarItems: [
      {
        id: "event-1",
        title: "Morning standup",
        description: "Zoom",
        date: "Today",
        time: "9:30 AM",
      },
      {
        id: "event-2",
        title: "Design review",
        description: "Studio",
        date: "Today",
        time: "11:00 AM",
      },
      {
        id: "event-3",
        title: "Planning",
        description: "Focus",
        date: "Tomorrow",
        time: "2:00 PM",
      },
    ],
  });

  const data = await loadTasks(bridge);

  assert.deepEqual(
    data.calendarGroups.map((group) => ({
      date: group.date,
      ids: group.items.map((item) => item.id),
    })),
    [
      { date: "Today", ids: ["event-1", "event-2"] },
      { date: "Tomorrow", ids: ["event-3"] },
    ],
  );
});

test("groupCalendarItemsByDate falls back to No date for missing dates", () => {
  assert.deepEqual(
    groupCalendarItemsByDate([
      { id: "event-1", title: "Loose block", time: "10:00 AM" },
      { id: "event-2", title: "Another loose block", date: "", time: "11:00 AM" },
    ]).map((group) => ({
      date: group.date,
      titles: group.items.map((item) => item.title),
    })),
    [
      {
        date: "No date",
        titles: ["Loose block", "Another loose block"],
      },
    ],
  );
});

test("renderTasksData shows mapped tasks, grouped calendar dates, and no fixtures", () => {
  const html = renderTasksData(
    normalizeTasksData({
      calendarItems: [
        {
          id: "event-1",
          title: "Team sync",
          description: "Meet",
          date: "Today",
          time: "10:00 AM",
        },
      ],
      tasks: [
        {
          id: "task-1",
          name: "Wire planner rows",
          description: "Use the preload bridge",
          priority: "high",
          status: "completed",
          dueDate: "Today",
        },
      ],
    }),
  );

  assert.match(html, /Wire planner rows/);
  assert.match(html, /Use the preload bridge/);
  assert.match(html, /data-priority="high"/);
  assert.match(html, /tasks-screen__priority--high/);
  assert.match(html, /data-status="completed"/);
  assert.match(html, /tasks-screen__status--done/);
  assert.match(html, /data-date="Today"/);
  assert.match(html, /Team sync/);
  assert.doesNotMatch(html, /Review priority PR queue/);
});

test("renderTasksData escapes live data and renders the tasks empty state", () => {
  const html = renderTasksData({
    calendarItems: [
      {
        id: "event-1",
        title: "<script>",
        description: "Design & QA",
        date: "Today",
        time: "10:00 AM",
      },
    ],
    tasks: [],
  });

  assert.match(html, /No tasks yet - ask Leena to plan something/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Design &amp; QA/);
  assert.doesNotMatch(html, /<script>/);
});

test("loadTasks fails clearly when the renderer bridge is unavailable", async () => {
  await assert.rejects(() => loadTasks(null), /planner bridge/);
  await assert.rejects(() => loadTasks({ getPlannerTasks: async () => [] }), /planner bridge/);
});
