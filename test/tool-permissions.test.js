import assert from "node:assert/strict";
import test from "node:test";
import {
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
    },
  );
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
