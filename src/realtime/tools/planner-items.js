export const taskPriorities = Object.freeze(["high", "medium", "low"]);
export const taskStatuses = Object.freeze(["todo", "in_progress", "completed"]);

export function createPlannerTask(input, items) {
  return {
    ...input,
    id: createStablePlannerItemId("task", input.name, items),
  };
}

export function createPlannerCalendarItem(input, items) {
  return {
    ...input,
    id: createStablePlannerItemId("calendar", input.title, items),
  };
}

export function normalizeTaskName(name) {
  return normalizeBriefText(name, 2, 5, 34);
}

export function normalizeTaskDescription(description) {
  return normalizeBriefText(description, 6, 12, 86);
}

export function normalizeCalendarTitle(title) {
  return normalizeBriefText(title, 2, 4, 28);
}

export function normalizeCalendarDescription(description) {
  return normalizeBriefText(description, 7, 12, 88);
}

export function normalizeCalendarDate(date) {
  return normalizeBriefText(date, 1, 3, 20);
}

export function normalizeCalendarTime(time) {
  return normalizeBriefText(time, 1, 3, 16);
}

export function normalizeTaskPriority(value) {
  return taskPriorities.includes(value) ? value : "medium";
}

export function normalizeTaskStatus(value) {
  const normalized = String(value)
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .trim();
  if (normalized === "done" || normalized === "complete") {
    return "completed";
  }
  if (normalized === "doing" || normalized === "active") {
    return "in_progress";
  }
  return taskStatuses.includes(normalized) ? normalized : "todo";
}

export function createFallbackPlannerId(prefix, value) {
  const slug = slugify(value);
  return `${prefix}-${slug || "item"}`;
}

function createStablePlannerItemId(prefix, name, items) {
  const usedIds = new Set(items.map((item) => item.id));
  const slug = slugify(name) || "item";
  let nextId = `${prefix}-${slug}`;
  let suffix = 2;
  while (usedIds.has(nextId)) {
    nextId = `${prefix}-${slug}-${suffix}`;
    suffix += 1;
  }
  return nextId;
}

function normalizeBriefText(value, minimumWords, maximumWords, maximumLength) {
  const compact = String(value).replace(/\s+/g, " ").trim();
  const limitedWords = compact.split(" ").slice(0, maximumWords).join(" ");
  const limitedLength = trimTrailingPunctuation(
    limitedWords.length > maximumLength
      ? limitedWords.slice(0, maximumLength).trim()
      : limitedWords,
  );
  if (wordCount(limitedLength) >= minimumWords || wordCount(compact) === 0) {
    return limitedLength;
  }
  return trimTrailingPunctuation(compact);
}

function trimTrailingPunctuation(value) {
  return value.replace(/[\s,;:.-]+$/g, "");
}

function wordCount(value) {
  return value.split(" ").filter((word) => word.length > 0).length;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
