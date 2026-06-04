export function getRealtimeToolCall(event) {
  if (event.type === "response.output_item.done" && event.item?.type === "function_call") {
    // A barge-in (turn_detected) cancels the response mid-stream and the
    // function call comes back `incomplete` with truncated/empty arguments.
    // Executing it would run a tool with garbage args, so skip it. The
    // authoritative finalized item (with status) is on output_item.done, so we
    // dispatch from here rather than response.function_call_arguments.done.
    if (event.item.status === "incomplete") {
      return null;
    }
    return normalizeToolCall({
      callId: event.item.call_id,
      name: event.item.name,
      rawArguments: event.item.arguments,
    });
  }
  return null;
}

export function parseToolArguments(rawArguments) {
  if (typeof rawArguments !== "string" || !rawArguments.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(rawArguments);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

const PERMISSION_RESULT_STATUSES = new Set([
  "permission_pending",
  "confirmation_required",
  "permission_required",
  "permission_denied",
]);

export function createRealtimeToolHandler({
  executeTool,
  sendEvent,
  setMode,
  setStatus,
  onEndCall,
  onPermissionState,
  onToolStart,
  onToolEnd,
}) {
  const handledToolCallIds = new Set();

  return {
    reset() {
      handledToolCallIds.clear();
    },
    async handleEvent(event) {
      const toolCall = getRealtimeToolCall(event);
      if (!toolCall) {
        return false;
      }
      if (handledToolCallIds.has(toolCall.callId)) {
        return true;
      }
      handledToolCallIds.add(toolCall.callId);
      setStatus(formatToolStatus(toolCall.name));
      setMode("thinking");

      if (toolCall.name === "end_call") {
        // Ending the call is a renderer-side action (it owns the WebRTC peer).
        // Acknowledge the tool call without requesting a new response so the
        // model's goodbye finishes, then signal the host to hang up.
        sendRealtimeToolOutput(
          sendEvent,
          toolCall.callId,
          { status: "call_ended", message: "Ending the call." },
          { createResponse: false },
        );
        await onEndCall?.(toolCall.arguments);
        return true;
      }

      onToolStart?.(toolCall.name, toolCall.arguments);
      let result;
      try {
        result = await executeToolSafely(executeTool, toolCall.name, toolCall.arguments);
      } finally {
        onToolEnd?.(toolCall.name, result);
      }
      const permissionState = getRealtimePermissionState(toolCall.name, toolCall.arguments, result);
      if (permissionState) {
        setStatus(permissionState.statusText);
        onPermissionState?.(permissionState);
      }
      if (isRecord(result?.realtimeInput)) {
        sendRealtimeToolOutput(sendEvent, toolCall.callId, createRealtimeImageToolOutput(result), {
          createResponse: false,
        });
        sendRealtimeImageResponse(sendEvent, result);
      } else {
        sendRealtimeToolOutput(sendEvent, toolCall.callId, result);
      }
      return true;
    },
  };
}

export function getRealtimePermissionState(name, args = {}, result = {}) {
  if (!isRecord(result) || !PERMISSION_RESULT_STATUSES.has(result.status)) {
    return null;
  }

  const permission = normalizePermissionPayload(name, args, result);
  const kind =
    result.status === "permission_pending" || result.status === "confirmation_required"
      ? "confirmation_required"
      : result.status === "permission_required"
        ? "setup_required"
        : permission.level === "unknown"
          ? "blocked"
          : "denied";
  const statusText =
    kind === "confirmation_required"
      ? "Approval needed…"
      : kind === "setup_required"
        ? "Permission setup needed…"
        : "Permission blocked…";

  return {
    kind,
    statusText,
    toolName: permission.toolName,
    label: permission.label,
    level: permission.level,
    message: permission.message,
    summary: permission.summary,
    source: permission.source,
    actions: permission.actions,
  };
}

export function sendRealtimeToolOutput(sendEvent, callId, result, options = {}) {
  sendEvent({
    type: "conversation.item.create",
    item: {
      type: "function_call_output",
      call_id: callId,
      output: JSON.stringify(result),
    },
  });
  if (options.createResponse !== false) {
    sendEvent({ type: "response.create" });
  }
}

export function sendRealtimeImageResponse(sendEvent, result) {
  sendEvent({
    type: "response.create",
    response: {
      output_modalities: ["audio"],
      input: [result.realtimeInput],
      instructions:
        "Analyze the attached screenshot now and answer Ken directly. Do not say you are waiting for a screen read; the image is attached to this response input.",
    },
  });
}

export function createRealtimeImageToolOutput(result) {
  const { realtimeInput: _realtimeInput, ...safeResult } = result;
  return {
    ...safeResult,
    message:
      "Screenshot captured and attached to the Realtime conversation. Use the attached image to answer Ken's screen question.",
  };
}

export function formatToolStatus(name) {
  switch (name) {
    case "web_search":
      return "Searching…";
    case "web_fetch":
      return "Reading…";
    case "list_screenshot_sources":
      return "Listing sources…";
    case "take_screenshot":
      return "Taking screenshot…";
    case "analyze_screen":
      return "Reading screen…";
    case "computer_use_task":
      return "Using computer…";
    case "end_call":
      return "Ending call…";
    case "add_task":
    case "list_tasks":
    case "delete_task":
    case "update_task_status":
      return "Using tasks…";
    case "add_calendar_item":
    case "list_calendar_items":
    case "delete_calendar_item":
      return "Using calendar…";
    default:
      return "Using tool…";
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePermissionPayload(name, args, result) {
  const rawPermission = isRecord(result.permission) ? result.permission : {};
  const toolName = normalizeString(rawPermission.toolName ?? rawPermission.tool ?? name) || "tool";
  const level =
    normalizeString(rawPermission.level).toLowerCase() || inferToolLevel(toolName, args);
  const label =
    normalizeString(rawPermission.label) ||
    normalizeString(rawPermission.action) ||
    formatToolName(toolName);
  const summary =
    normalizeString(rawPermission.summary) ||
    normalizeString(result.setup?.message) ||
    summarizeToolArgs(args);

  return {
    toolName,
    label,
    level,
    message: normalizeString(result.message) || "Tool permission is required.",
    summary,
    source:
      normalizeString(rawPermission.source ?? rawPermission.integration ?? result.source) ||
      inferPermissionSource(toolName),
    actions: normalizePermissionActions(rawPermission, result.status),
  };
}

function normalizePermissionActions(permission, status) {
  if (status === "permission_denied" || permission?.level === "unknown") {
    return ["Refresh permissions"];
  }

  const actions = ["Allow once", "Deny"];
  if (isIntegrationSource(permission?.integration ?? permission?.source)) {
    actions.push("Trust this integration");
  }
  if (["write", "destructive", "control"].includes(permission?.level)) {
    actions.push("Allow trusted write actions");
  }
  return actions;
}

function inferToolLevel(toolName, args) {
  if (["write_file", "edit_file", "update_task_status", "add_calendar_item"].includes(toolName)) {
    return "write";
  }
  if (["delete_task", "delete_calendar_item"].includes(toolName)) {
    return "destructive";
  }
  if (toolName === "computer_use_task" && args?.target === "computer") {
    return "control";
  }
  if (toolName?.startsWith?.("mcp__")) {
    return "unknown";
  }
  return "unknown";
}

function inferPermissionSource(toolName) {
  if (toolName?.startsWith?.("mcp__")) {
    return "mcp";
  }
  if (["read_file", "write_file", "edit_file"].includes(toolName)) {
    return "file";
  }
  if (["add_calendar_item", "list_calendar_items", "delete_calendar_item"].includes(toolName)) {
    return "calendar";
  }
  if (toolName === "computer_use_task") {
    return "computer";
  }
  return "leena";
}

function isIntegrationSource(source) {
  return ["apple-calendar", "composio", "mcp"].includes(normalizeString(source).toLowerCase());
}

function summarizeToolArgs(args) {
  if (!isRecord(args)) {
    return "";
  }
  return Object.entries(args)
    .slice(0, 3)
    .map(([field, value]) => `${field}: ${summarizeValue(value)}`)
    .join(", ");
}

function summarizeValue(value) {
  if (typeof value === "string") {
    return value.replace(/\s+/g, " ").trim().slice(0, 80);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.length} items]`;
  }
  if (isRecord(value)) {
    return "{...}";
  }
  return "";
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function formatToolName(name) {
  return String(name || "tool").replace(/[_-]+/g, " ");
}

function normalizeToolCall({ callId, name, rawArguments }) {
  if (typeof callId !== "string" || !callId || typeof name !== "string" || !name) {
    return null;
  }
  return {
    callId,
    name,
    arguments: parseToolArguments(rawArguments),
  };
}

async function executeToolSafely(executeTool, name, args) {
  try {
    return await executeTool(name, args);
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Tool execution failed.",
    };
  }
}
