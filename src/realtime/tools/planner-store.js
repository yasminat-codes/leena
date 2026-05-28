import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createFallbackPlannerId,
  createPlannerCalendarItem,
  createPlannerTask,
  normalizeCalendarDate,
  normalizeCalendarDescription,
  normalizeCalendarTime,
  normalizeCalendarTitle,
  normalizeTaskDescription,
  normalizeTaskName,
  normalizeTaskPriority,
  normalizeTaskStatus,
} from "./planner-items.js";

const storageVersion = 1;

export function getPlannerStorePath() {
  return path.join(getUserDataPath(), "planner", "items.json");
}

export async function loadPlannerState(storePath = getPlannerStorePath()) {
  try {
    const raw = await fs.readFile(storePath, "utf8");
    if (!raw.trim()) {
      return emptyPlannerState();
    }
    return normalizePlannerState(JSON.parse(raw));
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn("Failed to load planner state", error);
    }
    return emptyPlannerState();
  }
}

export async function savePlannerState(state, storePath = getPlannerStorePath()) {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(
    storePath,
    JSON.stringify(
      {
        version: storageVersion,
        tasks: state.tasks.map(normalizeStoredTask),
        calendarItems: state.calendarItems.map(normalizeStoredCalendarItem),
      },
      null,
      2,
    ),
  );
}

export async function createTask(input, storePath = getPlannerStorePath()) {
  const state = await loadPlannerState(storePath);
  const task = createPlannerTask(input, state.tasks);
  await savePlannerState({ ...state, tasks: [...state.tasks, task] }, storePath);
  return task;
}

export async function listTasks(storePath = getPlannerStorePath()) {
  const state = await loadPlannerState(storePath);
  return state.tasks;
}

export async function deleteTask(query, storePath = getPlannerStorePath()) {
  const state = await loadPlannerState(storePath);
  const match = findPlannerItem(state.tasks, query, (task) => task.name);
  if (!match) {
    return {
      status: "not_found",
      message: "No matching task was found.",
    };
  }
  const tasks = state.tasks.filter((task) => task.id !== match.id);
  await savePlannerState({ ...state, tasks }, storePath);
  return {
    status: "deleted",
    message: "Task deleted.",
    item: match,
  };
}

export async function updateTaskStatus(query, status, storePath = getPlannerStorePath()) {
  const state = await loadPlannerState(storePath);
  const match = findPlannerItem(state.tasks, query, (task) => task.name);
  if (!match) {
    return {
      status: "not_found",
      message: "No matching task was found.",
    };
  }
  const updated = { ...match, status };
  const tasks = state.tasks.map((task) => (task.id === match.id ? updated : task));
  await savePlannerState({ ...state, tasks }, storePath);
  return {
    status: "updated",
    message: "Task status updated.",
    item: updated,
  };
}

export async function createCalendarItem(input, storePath = getPlannerStorePath()) {
  const state = await loadPlannerState(storePath);
  const calendarItem = createPlannerCalendarItem(input, state.calendarItems);
  await savePlannerState(
    { ...state, calendarItems: [...state.calendarItems, calendarItem] },
    storePath,
  );
  return calendarItem;
}

export async function listCalendarItems(storePath = getPlannerStorePath()) {
  const state = await loadPlannerState(storePath);
  return state.calendarItems;
}

export async function deleteCalendarItem(query, storePath = getPlannerStorePath()) {
  const state = await loadPlannerState(storePath);
  const match = findPlannerItem(state.calendarItems, query, (item) => item.title);
  if (!match) {
    return {
      status: "not_found",
      message: "No matching calendar item was found.",
    };
  }
  const calendarItems = state.calendarItems.filter((item) => item.id !== match.id);
  await savePlannerState({ ...state, calendarItems }, storePath);
  return {
    status: "deleted",
    message: "Calendar item deleted.",
    item: match,
  };
}

export function emptyPlannerState() {
  return {
    tasks: [],
    calendarItems: [],
  };
}

function normalizePlannerState(value) {
  if (!isRecord(value)) {
    return emptyPlannerState();
  }
  return {
    tasks: Array.isArray(value.tasks) ? value.tasks.map(normalizeStoredTask) : [],
    calendarItems: Array.isArray(value.calendarItems)
      ? value.calendarItems.map(normalizeStoredCalendarItem)
      : [],
  };
}

function normalizeStoredTask(value) {
  const record = isRecord(value) ? value : {};
  const name = typeof record.name === "string" ? record.name : "";
  return {
    id:
      typeof record.id === "string" && record.id.trim()
        ? record.id.trim()
        : createFallbackPlannerId("task", name),
    name: normalizeTaskName(name),
    description: normalizeTaskDescription(
      typeof record.description === "string" ? record.description : "",
    ),
    priority: normalizeTaskPriority(record.priority),
    status: normalizeTaskStatus(record.status),
  };
}

function normalizeStoredCalendarItem(value) {
  const record = isRecord(value) ? value : {};
  const title = typeof record.title === "string" ? record.title : "";
  return {
    id:
      typeof record.id === "string" && record.id.trim()
        ? record.id.trim()
        : createFallbackPlannerId("calendar", title),
    title: normalizeCalendarTitle(title),
    description: normalizeCalendarDescription(
      typeof record.description === "string" ? record.description : "",
    ),
    date: normalizeCalendarDate(typeof record.date === "string" ? record.date : ""),
    time: normalizeCalendarTime(typeof record.time === "string" ? record.time : ""),
  };
}

function findPlannerItem(items, query, getName) {
  const normalizedQuery = String(query).trim().toLowerCase();
  if (!normalizedQuery) {
    return null;
  }
  return (
    items.find((item) => item.id.toLowerCase() === normalizedQuery) ??
    items.find((item) => getName(item).trim().toLowerCase() === normalizedQuery) ??
    items.find((item) => getName(item).trim().toLowerCase().includes(normalizedQuery)) ??
    null
  );
}

function getUserDataPath() {
  if (globalThis.process?.type) {
    try {
      const electronApp = globalThis.require?.("electron")?.app;
      if (electronApp?.getPath) {
        return electronApp.getPath("userData");
      }
    } catch {
      // Fall through to the deterministic Node test/runtime path.
    }
  }
  return path.join(os.tmpdir(), "brah-user-data");
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
