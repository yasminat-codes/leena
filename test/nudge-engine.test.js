import assert from "node:assert/strict";
import test from "node:test";

import {
  dismissNudge,
  generateNudges,
  NUDGE_SETTINGS,
  NUDGE_TYPES,
} from "../src/nudges/nudge-engine.js";

const fixedNow = new Date("2026-06-03T14:30:00.000Z");

function createSettings(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getBool(key, fallback) {
      const value = values.has(key) ? values.get(key) : fallback;
      return typeof value === "boolean" ? value : fallback;
    },
    getSetting(key, fallback) {
      return values.has(key) ? values.get(key) : fallback;
    },
    setSetting(key, value) {
      values.set(key, value);
      return value;
    },
  };
}

test("generateNudges respects opt-in gate and skips planner and memory work when disabled", async () => {
  const settings = createSettings({ proactiveNudges: false });
  let plannerCalled = false;
  let memoryCalled = false;

  const payload = await generateNudges({
    memory: {
      recall() {
        memoryCalled = true;
        return [];
      },
    },
    now: fixedNow,
    planner: {
      listTasks() {
        plannerCalled = true;
        return [];
      },
    },
    settings,
  });

  assert.equal(payload.enabled, false);
  assert.deepEqual(payload.nudges, []);
  assert.equal(plannerCalled, false);
  assert.equal(memoryCalled, false);
});

test("generateNudges lets the visible Settings toggle override legacy nudge state", async () => {
  const settings = createSettings({ nudgesEnabled: true, proactiveNudges: false });

  const payload = await generateNudges({
    memory: {
      recall() {
        throw new Error("disabled settings toggle must not read memory");
      },
    },
    now: fixedNow,
    planner: {
      listTasks() {
        throw new Error("disabled settings toggle must not read planner");
      },
    },
    settings,
  });

  assert.equal(payload.enabled, false);
  assert.deepEqual(payload.nudges, []);
});

test("generateNudges observes a disabled setting on each refresh instead of reusing enabled work", async () => {
  const settings = createSettings({ proactiveNudges: true });
  const planner = {
    listCalendarItems: () => [],
    listTasks: () => [
      {
        id: "task-1",
        name: "Send proposal",
        dueAt: "2026-06-03T15:30:00.000Z",
        status: "todo",
      },
    ],
  };

  const enabled = await generateNudges({
    memory: { recall: () => [] },
    now: fixedNow,
    planner,
    settings,
  });
  settings.setSetting(NUDGE_SETTINGS.settingsToggle, false);
  const disabled = await generateNudges({
    memory: {
      recall() {
        throw new Error("disabled refresh must not read memory");
      },
    },
    now: fixedNow,
    planner: {
      listTasks() {
        throw new Error("disabled refresh must not read planner");
      },
    },
    settings,
  });

  assert.equal(enabled.enabled, true);
  assert.equal(enabled.nudges.length, 1);
  assert.deepEqual(disabled, {
    enabled: false,
    generatedAt: fixedNow.toISOString(),
    hiddenCount: 0,
    nudges: [],
    visibleLimit: 3,
  });
});

test("generateNudges emits planner task and calendar nudges within 24 hours", async () => {
  const payload = await generateNudges({
    memory: { recall: () => [] },
    now: fixedNow,
    planner: {
      listCalendarItems: () => [
        {
          id: "event-1",
          title: "Customer call",
          description: "Prep renewal notes",
          startsAt: "2026-06-03T16:30:00.000Z",
        },
        {
          id: "event-later",
          title: "Outside window",
          startsAt: "2026-06-05T16:30:00.000Z",
        },
      ],
      listTasks: () => [
        {
          id: "task-1",
          name: "Send proposal",
          description: "Follow the pricing checklist",
          dueAt: "2026-06-03T15:30:00.000Z",
          status: "todo",
        },
        {
          id: "task-done",
          name: "Completed task",
          dueAt: "2026-06-03T15:30:00.000Z",
          status: "completed",
        },
      ],
    },
    settings: createSettings({ proactiveNudges: true }),
  });

  assert.equal(payload.enabled, true);
  assert.deepEqual(
    payload.nudges.map((nudge) => nudge.type),
    [NUDGE_TYPES.upcomingTask, NUDGE_TYPES.upcomingEvent],
  );
  assert.match(payload.nudges[0].title, /Send proposal/);
  assert.match(payload.nudges[1].title, /Customer call/);
  assert.doesNotMatch(JSON.stringify(payload), /Outside window/);
  assert.doesNotMatch(JSON.stringify(payload), /Completed task/);
});

test("generateNudges emits stale semantic follow-ups and due memory reminders", async () => {
  const payload = await generateNudges({
    memory: {
      recall(query, limit) {
        assert.match(query, /follow up/);
        assert.equal(limit, 24);
        return [
          {
            entry: {
              id: "memory-1",
              type: "semantic",
              content: "Follow up with Alex about the launch plan.",
              lastSeen: "2026-05-29T14:00:00.000Z",
            },
          },
          {
            entry: {
              id: "memory-2",
              type: "semantic",
              content: "Remind me to email Priya about the vendor quote.",
              lastSeen: "2026-06-02T14:00:00.000Z",
              metadata: {
                remindAt: "2026-06-03T17:00:00.000Z",
              },
            },
          },
          {
            entry: {
              id: "memory-3",
              type: "semantic",
              content: "Follow up with Sam later.",
              lastSeen: "2026-06-02T14:00:00.000Z",
            },
          },
          {
            entry: {
              id: "memory-4",
              type: "episodic",
              content: "Follow up with episodic entry.",
              lastSeen: "2026-05-29T14:00:00.000Z",
            },
          },
        ];
      },
    },
    now: fixedNow,
    planner: { listCalendarItems: () => [], listTasks: () => [] },
    settings: createSettings({ proactiveNudges: true }),
  });

  assert.deepEqual(
    payload.nudges.map((nudge) => nudge.type),
    [NUDGE_TYPES.reminder, NUDGE_TYPES.followUp],
  );
  assert.match(payload.nudges[0].detail, /email Priya/);
  assert.match(payload.nudges[1].detail, /Alex/);
  assert.doesNotMatch(JSON.stringify(payload), /Sam/);
  assert.doesNotMatch(JSON.stringify(payload), /episodic/);
});

test("dismissNudge persists ids and generateNudges suppresses them for seven days", async () => {
  const settings = createSettings({ proactiveNudges: true });
  const planner = {
    listCalendarItems: () => [],
    listTasks: () => [
      {
        id: "task-1",
        name: "Send proposal",
        dueDate: "today",
        status: "todo",
      },
    ],
  };

  const first = await generateNudges({
    memory: { recall: () => [] },
    now: fixedNow,
    planner,
    settings,
  });
  assert.equal(first.nudges.length, 1);

  const dismissed = await dismissNudge(first.nudges[0].id, { now: fixedNow, settings });
  assert.equal(dismissed.id, first.nudges[0].id);
  assert.deepEqual(settings.values.get(NUDGE_SETTINGS.dismissed), {
    [first.nudges[0].id]: fixedNow.toISOString(),
  });

  const nextDay = await generateNudges({
    memory: { recall: () => [] },
    now: new Date("2026-06-04T14:30:00.000Z"),
    planner,
    settings,
  });
  assert.deepEqual(nextDay.nudges, []);

  const eighthDay = await generateNudges({
    memory: { recall: () => [] },
    now: new Date("2026-06-11T14:31:00.000Z"),
    planner,
    settings,
  });
  assert.equal(eighthDay.nudges.length, 1);
});

test("generateNudges dedupes stable ids, bounds text, and reports hidden count above three", async () => {
  const longDetail = `${"Follow up ".repeat(30)}with bounded text.`;
  const payload = await generateNudges({
    memory: {
      recall: () => [
        {
          entry: {
            id: "memory-1",
            type: "semantic",
            content: longDetail,
            lastSeen: "2026-05-29T14:00:00.000Z",
          },
        },
        {
          entry: {
            id: "memory-2",
            type: "semantic",
            content: "Follow up with Morgan.",
            lastSeen: "2026-05-29T14:00:00.000Z",
          },
        },
      ],
    },
    now: fixedNow,
    planner: {
      listCalendarItems: () => [
        { id: "event-1", title: "Event one", startsAt: "2026-06-03T16:00:00.000Z" },
        { id: "event-1", title: "Event one duplicate", startsAt: "2026-06-03T16:00:00.000Z" },
      ],
      listTasks: () => [
        { id: "task-1", name: "Task one", dueAt: "2026-06-03T15:00:00.000Z" },
        { id: "task-2", name: "Task two", dueAt: "2026-06-03T15:30:00.000Z" },
      ],
    },
    settings: createSettings({ proactiveNudges: true }),
  });

  assert.equal(payload.enabled, true);
  assert.equal(payload.nudges.length, 5);
  assert.equal(payload.hiddenCount, 2);
  assert.equal(payload.visibleLimit, 3);
  assert.ok(payload.nudges.every((nudge) => nudge.detail.length <= 160));
  assert.equal(payload.nudges.filter((nudge) => nudge.id === "upcoming-event:event-1").length, 1);
});
