import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  emptyPlannerState,
  loadPlannerState,
  savePlannerState,
} from "../src/realtime/tools/planner-store.js";

async function withPlannerFile(callback) {
  const directory = await mkdtemp(path.join(tmpdir(), "brah-planner-"));
  const filePath = path.join(directory, "planner", "items.json");
  try {
    await callback(filePath);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

test("empty and missing planner state loads safely", async () => {
  await withPlannerFile(async (filePath) => {
    assert.deepEqual(await loadPlannerState(filePath), emptyPlannerState());
  });
});

test("planner state normalizes saved tasks and calendar items", async () => {
  await withPlannerFile(async (filePath) => {
    await savePlannerState(
      {
        tasks: [
          {
            id: "",
            name: "  Ship realtime functional tests now please ",
            description: "  Cover the realtime tool call flow in a deterministic harness. ",
            priority: "urgent",
            status: "done",
          },
        ],
        calendarItems: [
          {
            id: "",
            title: "  Test review sync today ",
            description: " Review the new realtime tool tests before shipping. ",
            date: " Tomorrow morning ",
            time: " 10:30 AM PST ",
          },
        ],
      },
      filePath,
    );

    const saved = JSON.parse(await readFile(filePath, "utf8"));
    assert.equal(saved.version, 1);

    const loaded = await loadPlannerState(filePath);
    assert.deepEqual(loaded.tasks, [
      {
        id: "task-ship-realtime-functional-tests-now-please",
        name: "Ship realtime functional tests now",
        description: "Cover the realtime tool call flow in a deterministic harness",
        priority: "medium",
        status: "completed",
      },
    ]);
    assert.deepEqual(loaded.calendarItems, [
      {
        id: "calendar-test-review-sync-today",
        title: "Test review sync today",
        description: "Review the new realtime tool tests before shipping",
        date: "Tomorrow morning",
        time: "10:30 AM PST",
      },
    ]);
  });
});

test("invalid planner JSON returns an empty state", async () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    await withPlannerFile(async (filePath) => {
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, "not json");
      assert.deepEqual(await loadPlannerState(filePath), emptyPlannerState());
    });
  } finally {
    console.warn = originalWarn;
  }
});
