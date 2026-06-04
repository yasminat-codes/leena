import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const DEFAULT_WINDOW_DAYS = 7;
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_BUFFER = 1024 * 1024;

const permissionStatuses = new Set([
  "not-determined",
  "granted",
  "denied",
  "restricted",
  "stale",
  "unknown",
  "unsupported",
]);

export const appleCalendarAdapterChoice = Object.freeze({
  adapter: "osascript-jxa",
  accessMode: "full-access",
  why: "Leena has no Swift/EventKit helper or Calendar entitlement path yet, so the MVP uses a narrow optional JXA bridge only after the host reports Apple Calendar access as granted.",
  tradeoffs: [
    "EventKit is the stronger future path for signed native builds but needs a native helper and entitlement work.",
    "AppleScript/JXA fits the current Electron/Node runtime and can return JSON, but depends on macOS Automation/Calendar privacy grants.",
    "Composio calendar tools stay separate because they would target remote accounts, not the owner's local Apple Calendar store.",
  ],
});

export function createAppleCalendarAdapter(options = {}) {
  const deps = normalizeAdapterOptions(options);

  return {
    choice: appleCalendarAdapterChoice,
    listEvents: (args = {}, runtime = {}) => listAppleCalendarEvents(args, runtime, deps),
    searchEvents: (args = {}, runtime = {}) =>
      listAppleCalendarEvents({ ...args, query: args.query ?? args.search }, runtime, deps),
    createEvent: (args = {}, runtime = {}) => createAppleCalendarEvent(args, runtime, deps),
    deleteEvent: (args = {}, runtime = {}) => deleteAppleCalendarEvent(args, runtime, deps),
  };
}

export async function listAppleCalendarEvents(
  args = {},
  runtime = {},
  deps = normalizeAdapterOptions(),
) {
  const accessBlock = ensureReadAccess(runtime, deps);
  if (accessBlock) {
    return accessBlock;
  }

  const input = normalizeListInput(args, deps.now);
  const result = await runAppleCalendarScript("list", input, deps);
  if (result.status !== "ok") {
    return result;
  }

  const query = normalizeText(args.query ?? args.search).toLowerCase();
  const events = normalizeEventList(result.events).filter((event) =>
    query ? eventMatchesQuery(event, query) : true,
  );

  return {
    status: "listed",
    source: "apple-calendar",
    accessMode: appleCalendarAdapterChoice.accessMode,
    message:
      events.length > 0
        ? "Apple Calendar events listed."
        : "No Apple Calendar events matched the requested window.",
    events,
  };
}

export async function createAppleCalendarEvent(
  args = {},
  runtime = {},
  deps = normalizeAdapterOptions(),
) {
  const accessBlock = ensureReadAccess(runtime, deps);
  if (accessBlock) {
    return accessBlock;
  }
  const confirmationBlock = ensureWriteConfirmation("create", runtime);
  if (confirmationBlock) {
    return confirmationBlock;
  }

  const validation = normalizeCreateInput(args);
  if (!validation.ok) {
    return invalidArguments(validation.message);
  }

  const result = await runAppleCalendarScript("create", validation.input, deps);
  if (result.status !== "ok") {
    return result;
  }

  return {
    status: "created",
    source: "apple-calendar",
    message: "Apple Calendar event created.",
    event: normalizeEvent(result.event),
  };
}

export async function deleteAppleCalendarEvent(
  args = {},
  runtime = {},
  deps = normalizeAdapterOptions(),
) {
  const accessBlock = ensureReadAccess(runtime, deps);
  if (accessBlock) {
    return accessBlock;
  }
  const confirmationBlock = ensureWriteConfirmation("delete", runtime);
  if (confirmationBlock) {
    return confirmationBlock;
  }

  const query = normalizeText(args.id ?? args.query ?? args.title);
  if (!query) {
    return invalidArguments("query must be a non-empty Apple Calendar event id or title.");
  }

  const result = await runAppleCalendarScript("delete", { query }, deps);
  if (result.status !== "ok") {
    return result;
  }

  return {
    status: "deleted",
    source: "apple-calendar",
    message: "Apple Calendar event deleted.",
    event: normalizeEvent(result.event),
  };
}

function normalizeAdapterOptions(options = {}) {
  return {
    platform: options.platform ?? process.platform,
    executeScript:
      typeof options.executeScript === "function" ? options.executeScript : executeOsascript,
    osascriptPath:
      typeof options.osascriptPath === "string" && options.osascriptPath
        ? options.osascriptPath
        : "/usr/bin/osascript",
    timeoutMs: clampInteger(options.timeoutMs, 1000, 60000, DEFAULT_TIMEOUT_MS),
    maxBuffer: clampInteger(options.maxBuffer, 1024, 5 * DEFAULT_MAX_BUFFER, DEFAULT_MAX_BUFFER),
    now: options.now instanceof Date ? new Date(options.now) : new Date(),
  };
}

function ensureReadAccess(runtime, deps) {
  if (deps.platform !== "darwin") {
    return {
      status: "unsupported",
      source: "apple-calendar",
      message: "Apple Calendar is only available on macOS.",
      setup: createSetupGuide("unsupported"),
    };
  }

  const permissionStatus = normalizePermissionStatus(runtime.permissionStatus);
  if (permissionStatus !== "granted") {
    return {
      status: "permission_required",
      source: "apple-calendar",
      permissionStatus,
      message: "Grant Apple Calendar access before reading events.",
      setup: createSetupGuide(permissionStatus),
    };
  }

  return null;
}

function ensureWriteConfirmation(action, runtime) {
  if (runtime.trustedWriteMode === true || runtime.confirmed === true) {
    return null;
  }

  return {
    status: "confirmation_required",
    source: "apple-calendar",
    message:
      action === "delete"
        ? "Apple Calendar delete requires Ken confirmation or Allow trusted write actions."
        : "Apple Calendar create requires Ken confirmation or Allow trusted write actions.",
    permission: {
      integration: "apple-calendar",
      action,
      level: action === "delete" ? "destructive" : "write",
    },
  };
}

function normalizeListInput(args, now) {
  const startDate = normalizeDate(args.startDate ?? args.start ?? now, now);
  const fallbackEnd = new Date(startDate.getTime());
  fallbackEnd.setDate(fallbackEnd.getDate() + DEFAULT_WINDOW_DAYS);
  const endDate = normalizeDate(args.endDate ?? args.end ?? fallbackEnd, fallbackEnd);
  const limit = clampInteger(args.limit, 1, MAX_LIMIT, DEFAULT_LIMIT);

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    limit,
    calendarName: normalizeText(args.calendarName),
  };
}

function normalizeCreateInput(args) {
  const title = normalizeText(args.title ?? args.summary);
  if (!title) {
    return { ok: false, message: "title must be a non-empty string." };
  }

  const startDate = parseDate(args.startDate);
  if (!startDate) {
    return { ok: false, message: "startDate must be an ISO date-time string." };
  }

  const endDate = parseDate(args.endDate);
  if (!endDate || endDate <= startDate) {
    return { ok: false, message: "endDate must be after startDate." };
  }

  return {
    ok: true,
    input: {
      title: title.slice(0, 160),
      description: normalizeText(args.description ?? args.notes).slice(0, 1000),
      location: normalizeText(args.location).slice(0, 240),
      calendarName: normalizeText(args.calendarName).slice(0, 160),
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  };
}

async function runAppleCalendarScript(action, input, deps) {
  try {
    const raw = await deps.executeScript(action, { action, ...input }, deps);
    const parsed = typeof raw === "string" ? parseScriptOutput(raw) : raw;
    if (!isRecord(parsed)) {
      return {
        status: "error",
        source: "apple-calendar",
        message: "Apple Calendar returned an invalid response.",
      };
    }
    if (parsed.status && parsed.status !== "ok") {
      return normalizeScriptFailure(parsed);
    }
    return { status: "ok", ...parsed };
  } catch (error) {
    return mapScriptError(error);
  }
}

async function executeOsascript(_action, input, deps) {
  const { stdout } = await execFileAsync(
    deps.osascriptPath,
    ["-l", "JavaScript", "-e", APPLE_CALENDAR_JXA, JSON.stringify(input)],
    {
      timeout: deps.timeoutMs,
      maxBuffer: deps.maxBuffer,
      windowsHide: true,
    },
  );
  return stdout;
}

function parseScriptOutput(stdout) {
  const trimmed = String(stdout ?? "").trim();
  if (!trimmed) {
    return {};
  }
  return JSON.parse(trimmed);
}

function normalizeScriptFailure(result) {
  const message = normalizeText(result.message) || "Apple Calendar request failed.";
  if (isPermissionDeniedMessage(message)) {
    return {
      status: "permission_denied",
      source: "apple-calendar",
      message: "Apple Calendar denied access. Open System Settings and grant Calendar access.",
      setup: createSetupGuide("denied"),
    };
  }
  return {
    status: normalizeText(result.status) || "error",
    source: "apple-calendar",
    message,
  };
}

function mapScriptError(error) {
  const message = normalizeText(error?.stderr ?? error?.message ?? error);
  if (isPermissionDeniedMessage(message)) {
    return {
      status: "permission_denied",
      source: "apple-calendar",
      message: "Apple Calendar denied access. Open System Settings and grant Calendar access.",
      setup: createSetupGuide("denied"),
    };
  }
  if (/ENOENT|not found|no such file/i.test(message)) {
    return {
      status: "unavailable",
      source: "apple-calendar",
      message: "The osascript Apple Calendar bridge is unavailable on this Mac.",
      setup: createSetupGuide("unknown"),
    };
  }
  return {
    status: "error",
    source: "apple-calendar",
    message: message || "Apple Calendar request failed.",
  };
}

function isPermissionDeniedMessage(message) {
  return /not authorized|not authorised|denied|privacy|tcc|-1743|automation/i.test(message);
}

function normalizeEventList(events) {
  return Array.isArray(events) ? events.map(normalizeEvent).filter(Boolean) : [];
}

function normalizeEvent(event) {
  if (!isRecord(event)) {
    return null;
  }
  const id = normalizeText(event.id ?? event.uid);
  const title = normalizeText(event.title ?? event.summary);
  if (!id || !title) {
    return null;
  }

  return {
    id,
    calendarId: normalizeText(event.calendarId),
    calendarName: normalizeText(event.calendarName),
    title,
    description: normalizeText(event.description).slice(0, 1000),
    startDate: normalizeText(event.startDate),
    endDate: normalizeText(event.endDate),
    location: normalizeText(event.location),
    url: normalizeText(event.url),
    isAllDay: event.isAllDay === true,
    source: "apple-calendar",
  };
}

function eventMatchesQuery(event, query) {
  return [event.title, event.description, event.calendarName, event.location]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function createSetupGuide(permissionStatus) {
  return {
    permission: "apple-calendar",
    permissionStatus: normalizePermissionStatus(permissionStatus),
    action: "open-settings",
    settingsUrl: "x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars",
  };
}

function invalidArguments(message) {
  return {
    status: "invalid_arguments",
    source: "apple-calendar",
    message,
  };
}

function normalizePermissionStatus(status) {
  return permissionStatuses.has(status) ? status : "unknown";
}

function normalizeDate(value, fallback) {
  return parseDate(value) ?? new Date(fallback);
}

function parseDate(value) {
  const date = value instanceof Date ? new Date(value) : new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? null : date;
}

function clampInteger(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const APPLE_CALENDAR_JXA = `
function run(argv) {
  var input = JSON.parse(argv[0] || "{}");
  var Calendar = Application("Calendar");

  function text(value) {
    try {
      return value === undefined || value === null ? "" : String(value);
    } catch (_error) {
      return "";
    }
  }

  function iso(value) {
    try {
      var date = value instanceof Date ? value : new Date(value);
      return isNaN(date.getTime()) ? "" : date.toISOString();
    } catch (_error) {
      return "";
    }
  }

  function readEvent(event, calendar) {
    return {
      id: text(event.id()),
      calendarId: text(calendar.id()),
      calendarName: text(calendar.name()),
      title: text(event.summary()),
      description: text(event.description()),
      startDate: iso(event.startDate()),
      endDate: iso(event.endDate()),
      location: text(event.location()),
      url: text(event.url()),
      isAllDay: event.alldayEvent() === true
    };
  }

  function readEvents() {
    var start = new Date(input.startDate);
    var end = new Date(input.endDate);
    var limit = input.limit || 20;
    var output = [];
    var calendars = Calendar.calendars();
    for (var calendarIndex = 0; calendarIndex < calendars.length && output.length < limit; calendarIndex += 1) {
      var calendar = calendars[calendarIndex];
      if (input.calendarName && text(calendar.name()) !== input.calendarName) {
        continue;
      }
      var events = calendar.events();
      for (var eventIndex = 0; eventIndex < events.length && output.length < limit; eventIndex += 1) {
        var event = events[eventIndex];
        var eventStart = event.startDate();
        var eventEnd = event.endDate();
        if (eventStart < end && eventEnd > start) {
          output.push(readEvent(event, calendar));
        }
      }
    }
    return { status: "ok", events: output };
  }

  function firstWritableCalendar() {
    var calendars = Calendar.calendars();
    if (input.calendarName) {
      for (var index = 0; index < calendars.length; index += 1) {
        if (text(calendars[index].name()) === input.calendarName) {
          return calendars[index];
        }
      }
    }
    return calendars[0];
  }

  function createEvent() {
    var calendar = firstWritableCalendar();
    if (!calendar) {
      return { status: "unavailable", message: "No Apple Calendar calendars are available." };
    }
    var event = Calendar.Event({
      summary: input.title,
      description: input.description || "",
      location: input.location || "",
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate)
    });
    calendar.events.push(event);
    return { status: "ok", event: readEvent(event, calendar) };
  }

  function deleteEvent() {
    var calendars = Calendar.calendars();
    var query = text(input.query).toLowerCase();
    for (var calendarIndex = 0; calendarIndex < calendars.length; calendarIndex += 1) {
      var calendar = calendars[calendarIndex];
      var events = calendar.events();
      for (var eventIndex = 0; eventIndex < events.length; eventIndex += 1) {
        var event = events[eventIndex];
        var id = text(event.id()).toLowerCase();
        var title = text(event.summary()).toLowerCase();
        if (id === query || title === query || title.indexOf(query) !== -1) {
          var snapshot = readEvent(event, calendar);
          event.delete();
          return { status: "ok", event: snapshot };
        }
      }
    }
    return { status: "not_found", message: "No matching Apple Calendar event was found." };
  }

  if (input.action === "create") {
    return JSON.stringify(createEvent());
  }
  if (input.action === "delete") {
    return JSON.stringify(deleteEvent());
  }
  return JSON.stringify(readEvents());
}
`;
