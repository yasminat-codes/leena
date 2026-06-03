import assert from "node:assert/strict";
import test from "node:test";

import {
  loadHomeData,
  normalizeHomeData,
  refreshHomeScreen,
  renderHomeData,
} from "../src/renderer/screens/home.js";

const fixedNow = new Date("2026-06-03T14:30:00.000Z");

function createBridge({
  activity = [],
  calendarItems = [],
  invokeChannels = null,
  memory = [],
  settings = {},
} = {}) {
  const calls = [];
  return {
    calls,
    async getActivity(kind) {
      calls.push(["getActivity", kind]);
      return activity;
    },
    async getCalendarItems() {
      calls.push(["getCalendarItems"]);
      return calendarItems;
    },
    async getSetting(key, fallback) {
      calls.push(["getSetting", key, fallback]);
      return Object.hasOwn(settings, key) ? settings[key] : fallback;
    },
    invoke: invokeChannels
      ? async (channel, payload) => {
          calls.push(["invoke", channel, payload]);
          if (!Object.hasOwn(invokeChannels, channel)) {
            throw new Error(`No handler registered for ${channel}`);
          }
          return invokeChannels[channel];
        }
      : undefined,
    memory: {
      async recall(query, limit) {
        calls.push(["memory.recall", query, limit]);
        return memory;
      },
    },
  };
}

test("loadHomeData prefers live IPC channels and normalizes memory, activity, and up-next rows", async () => {
  const bridge = createBridge({
    invokeChannels: {
      "activity:get-recent": {
        entries: [
          {
            id: "activity-1",
            kind: "web_search",
            query: "launch notes",
            resultCount: 4,
            time: "2026-06-03T13:45:00.000Z",
          },
        ],
      },
      "planner:get-upcoming": {
        items: [
          {
            id: "calendar-1",
            title: "Design review",
            description: "Bring decisions",
            date: "Today",
            time: "11:30 AM",
            type: "Meeting",
          },
        ],
      },
    },
    memory: [
      {
        entry: {
          id: "memory-1",
          content: "Yasmine asked Leena to keep home screen data live.",
          createdAt: "2026-06-03T14:00:00.000Z",
          type: "episodic",
        },
        score: 0.91,
      },
    ],
    settings: {
      "home:brief-prompt": "Brief my live day",
      "home:user-name": "Yasmine",
    },
  });

  const data = await loadHomeData(bridge, { now: fixedNow });

  assert.deepEqual(
    bridge.calls.filter((call) => call[0] === "invoke").map((call) => call[1]),
    ["activity:get-recent", "planner:get-upcoming"],
  );
  assert.deepEqual(bridge.calls.find((call) => call[0] === "memory.recall").slice(2), [5]);
  assert.equal(data.prompt, "Brief my live day");
  assert.equal(data.recentActions.length, 2);
  assert.equal(data.recentActions[0].source, "memory");
  assert.match(data.recentActions[0].label, /home screen data live/);
  assert.equal(data.recentActions[1].source, "activity");
  assert.equal(data.recentActions[1].icon, "WS");
  assert.deepEqual(data.upNext, [
    {
      id: "calendar-1",
      title: "Design review",
      detail: "Bring decisions",
      time: "11:30 AM",
      type: "Meeting",
      datetime: "",
    },
  ]);
});

test("loadHomeData falls back to existing preload adapters when new channels are unavailable", async () => {
  const bridge = createBridge({
    activity: [
      {
        id: "activity-2",
        kind: "computer_use",
        task: "Check browser state",
        statusText: "Completed",
        time: "2026-06-03T12:00:00.000Z",
      },
    ],
    calendarItems: [
      {
        id: "calendar-2",
        title: "Ops review",
        description: "Checklist",
        date: "Today",
        time: "4:00 PM",
      },
    ],
    invokeChannels: {},
  });

  const data = await loadHomeData(bridge, { now: fixedNow });

  assert.deepEqual(
    bridge.calls.map((call) => (call[0] === "invoke" ? `${call[0]}:${call[1]}` : call[0])),
    [
      "invoke:activity:get-recent",
      "memory.recall",
      "invoke:planner:get-upcoming",
      "getSetting",
      "getSetting",
      "getActivity",
      "getCalendarItems",
    ],
  );
  assert.equal(data.recentActions[0].label, "Check browser state");
  assert.equal(data.recentActions[0].detail, "Completed");
  assert.equal(data.upNext[0].title, "Ops review");
});

test("normalizeHomeData and renderHomeData show clean empty states", () => {
  const data = normalizeHomeData(
    {
      activity: [],
      memory: [],
      planner: [],
      preferences: { prompt: "Brief empty state", userName: "Yasmine" },
    },
    { now: fixedNow },
  );

  assert.equal(data.recentActions.length, 0);
  assert.equal(data.upNext.length, 0);

  const html = renderHomeData(data);

  assert.match(html, /No recent activity yet/);
  assert.match(html, /Nothing planned next/);
  assert.match(html, /Brief empty state/);
  assert.doesNotMatch(html, /Loading recent activity/);
});

test("renderHomeData exposes a loading state without fixture user content", () => {
  const html = renderHomeData({ loading: true });

  assert.match(html, /aria-busy="true"/);
  assert.match(html, /data-home-loading="true"/);
  assert.match(html, /Loading recent activity/);
  assert.match(html, /Loading planner item/);
  assert.doesNotMatch(html, /Summarized inbox priorities/);
  assert.doesNotMatch(html, /Queued calendar brief/);
  assert.doesNotMatch(html, /Review launch notes/);
});

test("live render path escapes data and does not render legacy fixture rows", () => {
  const html = renderHomeData({
    activity: {
      entries: [
        {
          id: "unsafe",
          kind: "web_fetch",
          text: "Fetched & saved",
          time: "2026-06-03T12:00:00.000Z",
          title: "<script>alert(1)</script>",
        },
      ],
    },
    memory: [],
    planner: {
      items: [
        {
          id: "up-next",
          title: "Real customer call",
          description: "Discuss renewal & risk",
          time: "2:00 PM",
          type: "Call",
        },
      ],
    },
  });

  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /Fetched &amp; saved/);
  assert.match(html, /Real customer call/);
  assert.match(html, /Discuss renewal &amp; risk/);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /Drafted follow-up tasks/);
  assert.doesNotMatch(html, /Product sync/);
});

test("refreshHomeScreen ignores stale results from older refreshes", async () => {
  const pendingNudges = [];
  const suggestedSlot = {
    innerHTML: "",
  };
  const screen = {
    querySelector(selector) {
      if (selector === "[data-home-suggested-slot]") {
        return suggestedSlot;
      }
      return {
        removeAttribute() {},
        textContent: "",
        innerHTML: "",
      };
    },
    querySelectorAll() {
      return [];
    },
  };
  const root = {
    querySelector(selector) {
      return selector === ".home-screen" ? screen : null;
    },
  };
  const bridge = {
    async getActivity() {
      return [];
    },
    async getCalendarItems() {
      return [];
    },
    async getSetting(_key, fallback) {
      return fallback;
    },
    memory: {
      async recall() {
        return [];
      },
    },
    nudges: {
      list() {
        return new Promise((resolve) => pendingNudges.push(resolve));
      },
    },
  };

  const oldRefresh = refreshHomeScreen(root, bridge);
  const latestRefresh = refreshHomeScreen(root, bridge);
  assert.equal(pendingNudges.length, 2);

  pendingNudges[1]({
    enabled: true,
    nudges: [{ id: "new", title: "New nudge", detail: "Latest state", type: "suggested" }],
  });
  assert.equal((await latestRefresh).nudges.nudges[0].title, "New nudge");
  assert.match(suggestedSlot.innerHTML, /New nudge/);

  pendingNudges[0]({
    enabled: true,
    nudges: [{ id: "old", title: "Old nudge", detail: "Stale state", type: "suggested" }],
  });
  assert.equal(await oldRefresh, null);
  assert.match(suggestedSlot.innerHTML, /New nudge/);
  assert.doesNotMatch(suggestedSlot.innerHTML, /Old nudge/);
});
