import assert from "node:assert/strict";
import test from "node:test";
import {
  createPermissionConfirmationState,
  createPermissionDeniedResult,
  createPermissionPendingResult,
  formatPermissionPrompt,
  getToolPermissionRequest,
  isTrustedWriteAllowed,
  shouldRequireToolConfirmation,
} from "../src/realtime/tool-permissions.js";

test("getToolPermissionRequest classifies every active tool with a summary", () => {
  assert.deepEqual(
    getToolPermissionRequest("computer_use_task", {
      task: "Open example",
      url: "https://example.com",
    }),
    {
      toolName: "computer_use_task",
      label: "Use computer",
      level: "sensitive",
      description:
        "Let OpenAI operate a browser harness or, in OS mode, control the real machine's mouse and keyboard from screenshots.",
      summary: "task: Open example, url: https://example.com",
    },
  );
  assert.equal(
    getToolPermissionRequest("computer_use_task", { task: "Open Settings", target: "computer" })
      .level,
    "destructive",
  );
  assert.deepEqual(getToolPermissionRequest("delete_task", { query: "Old task" }), {
    toolName: "delete_task",
    label: "Delete task",
    level: "destructive",
    description: "Delete a task from your local Tasks list.",
    summary: "query: Old task",
  });
  assert.deepEqual(getToolPermissionRequest("web_search", { query: "weather" }), {
    toolName: "web_search",
    label: "Search web",
    level: "network",
    description: "Send a search query to DuckDuckGo.",
    summary: "query: weather",
  });
  assert.deepEqual(
    getToolPermissionRequest("add_calendar_item", {
      source: "apple",
      title: "Planning Review",
      startDate: "2026-06-05T14:00:00.000Z",
      endDate: "2026-06-05T14:30:00.000Z",
    }),
    {
      toolName: "add_calendar_item",
      label: "Add calendar item",
      level: "write",
      description: "Add an item to your local Calendar list.",
      summary:
        "source: apple, title: Planning Review, startDate: 2026-06-05T14:00:00.000Z, endDate: 2026-06-05T14:30:00.000Z",
      source: "apple-calendar",
    },
  );
  assert.deepEqual(
    getToolPermissionRequest("delete_calendar_item", { source: "apple", query: "Planning" }),
    {
      toolName: "delete_calendar_item",
      label: "Delete calendar item",
      level: "destructive",
      description: "Delete an item from your local Calendar list.",
      summary: "source: apple, query: Planning",
      source: "apple-calendar",
    },
  );
  assert.deepEqual(getToolPermissionRequest("cancel_computer_use", { reason: "Ken stopped it" }), {
    toolName: "cancel_computer_use",
    label: "Stop computer use",
    level: "low",
    description: "Stop the current computer-use task if one is running.",
    summary: "reason: Ken stopped it",
  });
});

test("formatPermissionPrompt includes label, description, details, and risk", () => {
  assert.equal(
    formatPermissionPrompt(getToolPermissionRequest("web_fetch", { url: "https://example.com" })),
    "Read web page?\n\nFetch and read a public web page.\n\nDetails: url: https://example.com\n\nRisk: network",
  );
});

test("createPermissionDeniedResult returns a model-visible denial", () => {
  assert.deepEqual(createPermissionDeniedResult(getToolPermissionRequest("analyze_screen", {})), {
    status: "permission_denied",
    message: "Ken did not approve Analyze screen. Ask before trying this tool again.",
    tool: "analyze_screen",
  });
});

test("createPermissionPendingResult returns a model-visible pending approval", () => {
  assert.deepEqual(createPermissionPendingResult(getToolPermissionRequest("write_file", {})), {
    status: "permission_pending",
    message: "Write file requires Ken's approval before it can run.",
    permission: {
      toolName: "write_file",
      label: "Write file",
      level: "write",
      description: "Create or overwrite a file in your local workspace.",
      summary: "",
    },
    tool: "write_file",
  });
});

test("trusted write mode requires Trusted Mac Access and a current file scope", () => {
  assert.equal(shouldRequireToolConfirmation("write_file", {}, {}), true);
  assert.equal(
    isTrustedWriteAllowed(
      "write_file",
      {},
      { trustedWriteMode: true, fileAccessScope: "workspace" },
    ),
    false,
  );
  assert.equal(
    isTrustedWriteAllowed(
      "write_file",
      {},
      { trustedMacAccess: true, fileAccessScope: "workspace" },
    ),
    false,
  );
  assert.equal(
    isTrustedWriteAllowed(
      "write_file",
      {},
      {
        trustedMacAccess: true,
        trustedWriteMode: true,
        fileAccessScope: "workspace",
      },
    ),
    true,
  );
  assert.equal(
    shouldRequireToolConfirmation(
      "write_file",
      {},
      {
        trustedMacAccess: true,
        trustedWriteMode: true,
        fileAccessScope: "workspace",
      },
    ),
    false,
  );
  assert.equal(
    isTrustedWriteAllowed(
      "write_file",
      {},
      {
        trustedMacAccess: true,
        trustedWriteMode: true,
        fileAccessScope: "full-disk",
        fullDiskAccessStatus: "unknown",
      },
    ),
    false,
  );
  assert.equal(
    isTrustedWriteAllowed(
      "write_file",
      {},
      {
        trustedMacAccess: true,
        trustedWriteMode: true,
        fileAccessScope: "full-disk",
        fullDiskAccessStatus: "granted",
      },
    ),
    true,
  );
});

test("trusted write helper fails closed for unknown tools and sanitizes absolute paths", () => {
  assert.equal(
    isTrustedWriteAllowed(
      "unmapped_tool",
      {},
      {
        trustedMacAccess: true,
        trustedWriteMode: true,
        fileAccessScope: "workspace",
      },
    ),
    false,
  );
  assert.equal(
    isTrustedWriteAllowed(
      "add_calendar_item",
      {},
      {
        trustedMacAccess: true,
        trustedWriteMode: true,
        fileAccessScope: "workspace",
      },
    ),
    false,
  );
  const request = getToolPermissionRequest("read_file", {
    path: "/Users/example/Private/passwords.txt",
  });
  assert.equal(request.summary, "path: [absolute path]/passwords.txt");
  assert.doesNotMatch(request.summary, /Users\/example\/Private/);
});

test("read tools do not require confirmation after grant while write and destructive tools do", () => {
  assert.equal(shouldRequireToolConfirmation("read_file", { path: "notes.txt" }), false);
  assert.equal(shouldRequireToolConfirmation("list_calendar_items", { source: "apple" }), false);
  assert.equal(shouldRequireToolConfirmation("write_file", { path: "notes.txt" }), true);
  assert.equal(shouldRequireToolConfirmation("delete_task", { query: "Old task" }), true);
  assert.equal(
    shouldRequireToolConfirmation("computer_use_task", {
      task: "Open System Settings",
      target: "computer",
    }),
    true,
  );
});

test("confirmation state exposes trusted write affordance only for eligible write actions", () => {
  const state = createPermissionConfirmationState(
    getToolPermissionRequest("write_file", { path: "/Users/example/Private/notes.txt" }),
    { trustedWriteAvailable: true },
  );

  assert.equal(state.state, "confirmation_required");
  assert.equal(state.level, "write");
  assert.equal(state.affordances.trustedWriteMode, true);
  assert.equal(state.affordances.trustIntegration, false);
  assert.deepEqual(
    state.actions.map((action) => action.label),
    ["Allow once", "Deny", "Allow trusted write actions"],
  );
  assert.equal(state.summary, "path: [absolute path]/notes.txt");
});

test("confirmation state exposes integration trust only for eligible integrations", () => {
  const state = createPermissionConfirmationState(
    {
      toolName: "mcp__calendar__create_event",
      label: "Create calendar event",
      level: "write",
      description: "MCP tool from Calendar.",
      summary: "title: Planning",
    },
    { trustIntegrationAvailable: true, trustedWriteAvailable: true },
  );

  assert.equal(state.source, "mcp");
  assert.equal(state.affordances.trustIntegration, true);
  assert.equal(state.affordances.trustedWriteMode, true);
  assert.deepEqual(
    state.actions.map((action) => action.label),
    ["Allow once", "Deny", "Trust this integration", "Allow trusted write actions"],
  );
});

test("confirmation state exposes Apple Calendar trust for Apple write actions", () => {
  const state = createPermissionConfirmationState(
    getToolPermissionRequest("add_calendar_item", {
      source: "apple",
      title: "Planning Review",
    }),
    { trustIntegrationAvailable: true, trustedWriteAvailable: true },
  );

  assert.equal(state.source, "apple-calendar");
  assert.equal(state.affordances.trustIntegration, true);
  assert.equal(state.affordances.trustedWriteMode, true);
  assert.deepEqual(
    state.actions.map((action) => action.label),
    ["Allow once", "Deny", "Trust this integration", "Allow trusted write actions"],
  );
});

test("unknown or stale metadata is blocked instead of presented as confirmable", () => {
  const request = getToolPermissionRequest("unmapped_tool", {});
  const denied = createPermissionDeniedResult(request);
  const state = createPermissionConfirmationState(request, {
    trustIntegrationAvailable: true,
    trustedWriteAvailable: true,
  });
  const staleState = createPermissionConfirmationState(getToolPermissionRequest("write_file", {}), {
    status: "stale",
    trustedWriteAvailable: true,
  });

  assert.equal(request.level, "unknown");
  assert.equal(denied.status, "permission_denied");
  assert.match(denied.message, /blocked .*unknown or stale/);
  assert.equal(denied.permission.level, "unknown");
  assert.equal(state.state, "blocked");
  assert.equal(state.affordances.trustIntegration, false);
  assert.equal(state.affordances.trustedWriteMode, false);
  assert.deepEqual(
    state.actions.map((action) => action.label),
    ["Refresh permissions"],
  );
  assert.equal(staleState.state, "blocked");
  assert.equal(staleState.affordances.trustedWriteMode, false);
});
