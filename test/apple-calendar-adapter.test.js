import assert from "node:assert/strict";
import test from "node:test";
import {
  appleCalendarAdapterChoice,
  createAppleCalendarAdapter,
} from "../src/apple-calendar-adapter.js";
import { executePlannerTool } from "../src/realtime/tools/planner-tools.js";

const sampleEvent = {
  id: "event-1",
  calendarId: "calendar-home",
  calendarName: "Home",
  title: "Planning Review",
  description: "Review the plan",
  startDate: "2026-06-05T14:00:00.000Z",
  endDate: "2026-06-05T14:30:00.000Z",
  location: "Office",
};

test("adapter choice documents the MVP tradeoffs", () => {
  assert.equal(appleCalendarAdapterChoice.adapter, "osascript-jxa");
  assert.equal(appleCalendarAdapterChoice.accessMode, "full-access");
  assert.ok(appleCalendarAdapterChoice.why.includes("Swift/EventKit"));
  assert.ok(appleCalendarAdapterChoice.tradeoffs.some((entry) => entry.includes("EventKit")));
});

test("Apple Calendar read succeeds through an injected script executor", async () => {
  const calls = [];
  const adapter = createAppleCalendarAdapter({
    platform: "darwin",
    now: new Date("2026-06-03T12:00:00.000Z"),
    executeScript: async (action, input) => {
      calls.push({ action, input });
      return {
        status: "ok",
        events: [sampleEvent],
      };
    },
  });

  const result = await adapter.listEvents(
    { query: "planning", limit: 5 },
    { permissionStatus: "granted" },
  );

  assert.equal(result.status, "listed");
  assert.equal(result.accessMode, "full-access");
  assert.deepEqual(
    result.events.map(({ id, title, source }) => ({ id, title, source })),
    [{ id: "event-1", title: "Planning Review", source: "apple-calendar" }],
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].action, "list");
  assert.equal(calls[0].input.limit, 5);
});

test("Apple Calendar read fails closed when permission is not granted", async () => {
  let called = false;
  const adapter = createAppleCalendarAdapter({
    platform: "darwin",
    executeScript: async () => {
      called = true;
      return { status: "ok", events: [] };
    },
  });

  const result = await adapter.listEvents({}, { permissionStatus: "denied" });

  assert.equal(result.status, "permission_required");
  assert.equal(result.permissionStatus, "denied");
  assert.equal(result.setup.permission, "apple-calendar");
  assert.equal(called, false);
});

test("Apple Calendar script denial maps to a guided permission result", async () => {
  const adapter = createAppleCalendarAdapter({
    platform: "darwin",
    executeScript: async () => {
      throw new Error("Not authorized to send Apple events to Calendar. (-1743)");
    },
  });

  const result = await adapter.listEvents({}, { permissionStatus: "granted" });

  assert.equal(result.status, "permission_denied");
  assert.equal(result.setup.action, "open-settings");
});

test("Apple Calendar create requires host confirmation or trusted write mode", async () => {
  let called = false;
  const adapter = createAppleCalendarAdapter({
    platform: "darwin",
    executeScript: async () => {
      called = true;
      return { status: "ok", event: sampleEvent };
    },
  });

  const result = await adapter.createEvent(
    {
      title: "Planning Review",
      startDate: "2026-06-05T14:00:00.000Z",
      endDate: "2026-06-05T14:30:00.000Z",
    },
    { permissionStatus: "granted" },
  );

  assert.equal(result.status, "confirmation_required");
  assert.equal(result.permission.level, "write");
  assert.equal(called, false);
});

test("Apple Calendar create runs after trusted write mode is supplied by host options", async () => {
  const calls = [];
  const adapter = createAppleCalendarAdapter({
    platform: "darwin",
    executeScript: async (action, input) => {
      calls.push({ action, input });
      return { status: "ok", event: sampleEvent };
    },
  });

  const result = await adapter.createEvent(
    {
      title: "Planning Review",
      startDate: "2026-06-05T14:00:00.000Z",
      endDate: "2026-06-05T14:30:00.000Z",
    },
    { permissionStatus: "granted", trustedWriteMode: true },
  );

  assert.equal(result.status, "created");
  assert.equal(result.event.id, "event-1");
  assert.deepEqual(
    calls.map((call) => call.action),
    ["create"],
  );
});

test("planner calendar tool routes Apple reads through the injected adapter", async () => {
  const adapter = {
    searchEvents: async (args, runtime) => ({
      status: "listed",
      source: "apple-calendar",
      runtime,
      events: [{ id: "event-1", title: args.query }],
    }),
  };

  const result = await executePlannerTool(
    "list_calendar_items",
    { source: "apple", query: "Planning" },
    {
      appleCalendarAdapter: adapter,
      appleCalendar: { permissionStatus: "granted" },
    },
  );

  assert.equal(result.status, "listed");
  assert.equal(result.source, "apple-calendar");
  assert.deepEqual(result.runtime, {
    permissionStatus: "granted",
    confirmed: false,
    trustedWriteMode: false,
  });
});

test("planner Apple write ignores model-provided confirmation fields", async () => {
  let called = false;
  const adapter = {
    createEvent: async (_args, runtime) => {
      called = true;
      return runtime.confirmed || runtime.trustedWriteMode
        ? { status: "created" }
        : { status: "confirmation_required" };
    },
  };

  const result = await executePlannerTool(
    "add_calendar_item",
    {
      source: "apple",
      title: "Planning Review",
      description: "Review the plan",
      date: "Jun 5",
      time: "10 AM",
      confirmed: true,
    },
    {
      appleCalendarAdapter: adapter,
      appleCalendar: { permissionStatus: "granted" },
    },
  );

  assert.equal(called, true);
  assert.equal(result.status, "confirmation_required");
});

test("planner Apple create accepts ISO window fields without local date labels", async () => {
  const adapter = {
    createEvent: async (args, runtime) => ({
      status: "created",
      args,
      runtime,
    }),
  };

  const result = await executePlannerTool(
    "add_calendar_item",
    {
      source: "apple",
      title: "Planning Review",
      startDate: "2026-06-05T14:00:00.000Z",
      endDate: "2026-06-05T14:30:00.000Z",
    },
    {
      appleCalendarAdapter: adapter,
      appleCalendar: { permissionStatus: "granted", trustedWriteMode: true },
    },
  );

  assert.equal(result.status, "created");
  assert.equal(result.args.date, undefined);
  assert.equal(result.args.time, undefined);
  assert.deepEqual(result.runtime, {
    permissionStatus: "granted",
    confirmed: false,
    trustedWriteMode: true,
  });
});

test("Apple Calendar is optional on unsupported platforms", async () => {
  const adapter = createAppleCalendarAdapter({
    platform: "linux",
    executeScript: async () => {
      throw new Error("should not run");
    },
  });

  const result = await adapter.listEvents({}, { permissionStatus: "granted" });

  assert.equal(result.status, "unsupported");
  assert.equal(result.setup.permission, "apple-calendar");
});
