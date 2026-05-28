import assert from "node:assert/strict";
import test from "node:test";
import {
  createRealtimeToolHandler,
  formatToolStatus,
  getRealtimeToolCall,
  parseToolArguments,
} from "../src/renderer/realtime-tool-handler.js";

test("extracts tool calls from argument-done events", () => {
  assert.deepEqual(
    getRealtimeToolCall({
      type: "response.function_call_arguments.done",
      call_id: "call-1",
      name: "web_fetch",
      arguments: '{"url":"https://example.com"}',
    }),
    {
      callId: "call-1",
      name: "web_fetch",
      arguments: { url: "https://example.com" },
    },
  );
});

test("extracts tool calls from output item done events", () => {
  assert.deepEqual(
    getRealtimeToolCall({
      type: "response.output_item.done",
      item: {
        type: "function_call",
        call_id: "call-2",
        name: "add_task",
        arguments:
          '{"name":"Ship tests","description":"Cover the realtime tool flow","priority":"high"}',
      },
    }),
    {
      callId: "call-2",
      name: "add_task",
      arguments: {
        name: "Ship tests",
        description: "Cover the realtime tool flow",
        priority: "high",
      },
    },
  );
});

test("invalid tool argument JSON falls back to an empty object", () => {
  assert.deepEqual(parseToolArguments("not json"), {});
  assert.deepEqual(parseToolArguments("[]"), {});
  assert.deepEqual(parseToolArguments(""), {});
});

test("tool handler executes calls once per call id and sends Realtime output events", async () => {
  const sentEvents = [];
  const statuses = [];
  const modes = [];
  const executedCalls = [];
  const handler = createRealtimeToolHandler({
    executeTool: async (name, args) => {
      executedCalls.push({ name, args });
      return { status: "ok", echoed: args };
    },
    sendEvent: (event) => sentEvents.push(event),
    setMode: (mode) => modes.push(mode),
    setStatus: (status) => statuses.push(status),
  });

  const event = {
    type: "response.function_call_arguments.done",
    call_id: "call-1",
    name: "web_search",
    arguments: '{"query":"openai realtime"}',
  };

  assert.equal(await handler.handleEvent(event), true);
  assert.equal(await handler.handleEvent(event), true);

  assert.deepEqual(executedCalls, [{ name: "web_search", args: { query: "openai realtime" } }]);
  assert.deepEqual(statuses, ["Searching…"]);
  assert.deepEqual(modes, ["thinking"]);
  assert.deepEqual(sentEvents, [
    {
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: "call-1",
        output: JSON.stringify({ status: "ok", echoed: { query: "openai realtime" } }),
      },
    },
    { type: "response.create" },
  ]);
});

test("tool handler sends screenshot image as explicit response input", async () => {
  const sentEvents = [];
  const realtimeInput = {
    type: "message",
    role: "user",
    content: [
      { type: "input_text", text: "read this" },
      { type: "input_image", image_url: "data:image/jpeg;base64,abc" },
    ],
  };
  const handler = createRealtimeToolHandler({
    executeTool: async () => ({
      status: "captured_for_realtime_analysis",
      message: "captured",
      realtimeInput,
    }),
    sendEvent: (event) => sentEvents.push(event),
    setMode: () => {},
    setStatus: () => {},
  });

  assert.equal(
    await handler.handleEvent({
      type: "response.function_call_arguments.done",
      call_id: "call-screen",
      name: "analyze_screen",
      arguments: "{}",
    }),
    true,
  );

  assert.equal(sentEvents[0].item.type, "function_call_output");
  assert.equal(JSON.parse(sentEvents[0].item.output).realtimeInput, undefined);
  assert.deepEqual(sentEvents[1], {
    type: "response.create",
    response: {
      output_modalities: ["audio"],
      input: [realtimeInput],
      instructions:
        "Analyze the attached screenshot now and answer Ken directly. Do not say you are waiting for a screen read; the image is attached to this response input.",
    },
  });
});

test("tool handler wraps execution failures into function outputs", async () => {
  const sentEvents = [];
  const handler = createRealtimeToolHandler({
    executeTool: async () => {
      throw new Error("boom");
    },
    sendEvent: (event) => sentEvents.push(event),
    setMode: () => {},
    setStatus: () => {},
  });

  assert.equal(
    await handler.handleEvent({
      type: "response.function_call_arguments.done",
      call_id: "call-fail",
      name: "web_fetch",
      arguments: "{}",
    }),
    true,
  );

  assert.deepEqual(JSON.parse(sentEvents[0].item.output), {
    status: "error",
    message: "boom",
  });
});

test("tool status labels cover active tools", () => {
  assert.equal(formatToolStatus("web_fetch"), "Reading…");
  assert.equal(formatToolStatus("take_screenshot"), "Taking screenshot…");
  assert.equal(formatToolStatus("analyze_screen"), "Reading screen…");
  assert.equal(formatToolStatus("computer_use_task"), "Using computer…");
  assert.equal(formatToolStatus("add_calendar_item"), "Using calendar…");
  assert.equal(formatToolStatus("unknown"), "Using tool…");
});
