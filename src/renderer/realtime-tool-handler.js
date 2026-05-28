export function getRealtimeToolCall(event) {
  if (event.type === "response.function_call_arguments.done") {
    return normalizeToolCall({
      callId: event.call_id,
      name: event.name,
      rawArguments: event.arguments,
    });
  }
  if (event.type === "response.output_item.done" && event.item?.type === "function_call") {
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

export function createRealtimeToolHandler({ executeTool, sendEvent, setMode, setStatus }) {
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

      const result = await executeToolSafely(executeTool, toolCall.name, toolCall.arguments);
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
