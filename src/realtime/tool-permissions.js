import { parseMCPToolName } from "../mcp/schema-converter.js";

const AUTO_APPROVED_MCP_LEVELS = new Set(["read", "low"]);
const MCP_PERMISSION_LEVELS = new Set(["auto", "confirm", "trust"]);
const TRUSTED_WRITE_LEVELS = new Set(["write", "destructive", "control"]);
const CONFIRMATION_LEVELS = new Set(["network", "screen", "sensitive", ...TRUSTED_WRITE_LEVELS]);
const FILE_ACCESS_SCOPES = new Set(["workspace", "explicit", "full-disk"]);
const TRUSTED_WRITE_GRANT_BY_TOOL = Object.freeze({
  write_file: "file",
  edit_file: "file",
});
const INTEGRATION_TRUST_SOURCES = new Set(["apple-calendar", "composio", "mcp"]);
const MCP_RISK_PROPERTY_LEVELS = Object.freeze([
  ["command", "destructive"],
  ["delete", "destructive"],
  ["url", "network"],
  ["query", "network"],
  ["path", "write"],
  ["file", "write"],
  ["write", "write"],
]);
const MCP_LEVEL_RANK = Object.freeze({
  low: 0,
  read: 0,
  write: 1,
  network: 2,
  destructive: 3,
  unknown: 4,
});
const KNOWN_PERMISSION_LEVELS = new Set([
  "low",
  "read",
  "write",
  "network",
  "screen",
  "sensitive",
  "destructive",
  "control",
  "unknown",
]);

const toolPermissionMetadata = Object.freeze({
  add_task: {
    level: "low",
    label: "Add task",
    description: "Add a task to your local Tasks list.",
  },
  list_tasks: {
    level: "read",
    label: "Read tasks",
    description: "Read your local Tasks list.",
  },
  delete_task: {
    level: "destructive",
    label: "Delete task",
    description: "Delete a task from your local Tasks list.",
  },
  update_task_status: {
    level: "write",
    label: "Update task",
    description: "Change a task status in your local Tasks list.",
  },
  add_calendar_item: {
    level: "write",
    label: "Add calendar item",
    description: "Add an item to your local Calendar list.",
  },
  list_calendar_items: {
    level: "read",
    label: "Read calendar",
    description: "Read your local Calendar list.",
  },
  delete_calendar_item: {
    level: "destructive",
    label: "Delete calendar item",
    description: "Delete an item from your local Calendar list.",
  },
  web_search: {
    level: "network",
    label: "Search web",
    description: "Send a search query to DuckDuckGo.",
  },
  web_fetch: {
    level: "network",
    label: "Read web page",
    description: "Fetch and read a public web page.",
  },
  read_file: {
    level: "read",
    label: "Read file",
    description: "Read a text file from your local workspace.",
  },
  write_file: {
    level: "write",
    label: "Write file",
    description: "Create or overwrite a file in your local workspace.",
  },
  edit_file: {
    level: "write",
    label: "Edit file",
    description: "Replace text inside a file in your local workspace.",
  },
  list_screenshot_sources: {
    level: "screen",
    label: "List screen sources",
    description: "List visible screens and windows available for capture.",
  },
  take_screenshot: {
    level: "screen",
    label: "Take screenshot",
    description: "Capture and save a screenshot locally.",
  },
  analyze_screen: {
    level: "sensitive",
    label: "Analyze screen",
    description: "Capture a screenshot and send it to OpenAI for vision/OCR analysis.",
  },
  computer_use_task: {
    level: "sensitive",
    label: "Use computer",
    description:
      "Let OpenAI operate a browser harness or, in OS mode, control the real machine's mouse and keyboard from screenshots.",
  },
  cancel_computer_use: {
    level: "low",
    label: "Stop computer use",
    description: "Stop the current computer-use task if one is running.",
  },
  end_call: {
    level: "low",
    label: "End call",
    description: "Hang up and end the current voice call.",
  },
});

export function getToolPermissionRequest(name, args = {}) {
  const metadata = toolPermissionMetadata[name] ?? {
    level: "unknown",
    label: name,
    description: "Run a realtime tool.",
  };
  const source = resolveToolSource(name, args);
  return {
    toolName: name,
    label: metadata.label,
    level: resolveToolLevel(name, metadata.level, args),
    description: metadata.description,
    summary: summarizeToolRequest(name, args),
    ...(source ? { source } : {}),
  };
}

export function getMCPToolPermissionRequest(namespacedName, args = {}, serverConfig = {}) {
  const context = getMCPPermissionContext(namespacedName, serverConfig);
  if (!context.valid) {
    return {
      toolName: namespacedName,
      label: "MCP tool",
      level: "unknown",
      description: "MCP tool requires confirmation.",
      summary: summarizeMCPArgs(args),
    };
  }

  const toolDescription = sanitizeMCPText(
    context.tool?.description ?? context.parsed.toolName,
    240,
  );
  return {
    toolName: namespacedName,
    label: sanitizeMCPText(toolDescription || context.parsed.toolName, 60) || "MCP tool",
    level: inferMCPToolLevel(context.tool?.inputSchema),
    description: `MCP tool from ${context.serverName}: ${toolDescription || context.parsed.toolName}`,
    summary: summarizeMCPArgs(args),
  };
}

export function shouldAutoApproveMCPTool(namespacedName, args = {}, serverConfig = {}) {
  const context = getMCPPermissionContext(namespacedName, serverConfig);
  if (!context.valid) {
    return false;
  }

  if (context.permissionLevel === "trust") {
    return true;
  }
  if (context.permissionLevel !== "auto") {
    return false;
  }

  const request = getMCPToolPermissionRequest(namespacedName, args, serverConfig);
  return AUTO_APPROVED_MCP_LEVELS.has(request.level);
}

export function createPermissionDeniedResult(request) {
  if (request?.level === "unknown") {
    return {
      status: "permission_denied",
      message: `Leena blocked ${request.label} because its permission metadata is unknown or stale.`,
      tool: request.toolName,
      permission: request,
    };
  }

  return {
    status: "permission_denied",
    message: `Ken did not approve ${request.label}. Ask before trying this tool again.`,
    tool: request.toolName,
  };
}

export function createPermissionPendingResult(request) {
  return {
    status: "permission_pending",
    message: `${request.label} requires Ken's approval before it can run.`,
    permission: request,
    tool: request.toolName,
  };
}

export function formatPermissionPrompt(request) {
  const parts = [
    `${request.label}?`,
    request.description,
    request.summary ? `Details: ${request.summary}` : "",
    `Risk: ${request.level}`,
  ].filter(Boolean);
  return parts.join("\n\n");
}

export function createPermissionConfirmationState(request, options = {}) {
  const normalized = normalizePermissionRequest(request);
  const source = normalizePermissionSource(
    options.source ?? normalized.source,
    normalized.toolName,
  );
  const blocked =
    normalized.level === "unknown" ||
    ["unknown", "stale"].includes(normalizeString(options.status));
  const confirmationRequired = blocked ? false : CONFIRMATION_LEVELS.has(normalized.level);
  const trustIntegrationAllowed =
    confirmationRequired &&
    options.trustIntegrationAvailable === true &&
    INTEGRATION_TRUST_SOURCES.has(source);
  const trustedWriteAllowed =
    confirmationRequired &&
    options.trustedWriteAvailable === true &&
    TRUSTED_WRITE_LEVELS.has(normalized.level);

  return Object.freeze({
    state: blocked ? "blocked" : confirmationRequired ? "confirmation_required" : "allowed",
    toolName: normalized.toolName,
    label: normalized.label,
    level: normalized.level,
    source,
    title: blocked ? `Blocked ${normalized.label}` : `Confirm ${normalized.label}`,
    message: blocked
      ? "Leena could not verify current, central permission metadata for this tool."
      : confirmationRequired
        ? "Review this action before Leena runs it."
        : "This read or low-risk action can run without another confirmation after its grant is current.",
    description: normalized.description,
    summary: normalized.summary,
    actions: createPermissionActions({
      blocked,
      confirmationRequired,
      trustIntegrationAllowed,
      trustedWriteAllowed,
    }),
    affordances: Object.freeze({
      trustIntegration: trustIntegrationAllowed,
      trustedWriteMode: trustedWriteAllowed,
    }),
  });
}

export function shouldRequireToolConfirmation(name, args = {}, context = {}) {
  const request = getToolPermissionRequest(name, args);
  if (!isKnownRealtimeTool(name) || request.level === "unknown") {
    return true;
  }
  if (!TRUSTED_WRITE_LEVELS.has(request.level)) {
    return false;
  }
  return !isTrustedWriteAllowed(name, args, context);
}

export function isTrustedWriteAllowed(name, args = {}, context = {}) {
  const request = getToolPermissionRequest(name, args);
  if (!isKnownRealtimeTool(name) || !TRUSTED_WRITE_LEVELS.has(request.level)) {
    return false;
  }
  if (context.trustedMacAccess !== true || context.trustedWriteMode !== true) {
    return false;
  }
  return hasRequiredTrustedWriteGrant(name, context);
}

function resolveToolLevel(name, level, args) {
  if (name === "computer_use_task" && isRecord(args) && args.target === "computer") {
    return "destructive";
  }
  return level;
}

function resolveToolSource(name, args) {
  if (
    ["add_calendar_item", "list_calendar_items", "delete_calendar_item"].includes(name) &&
    isRecord(args) &&
    normalizeString(args.source).toLowerCase() === "apple"
  ) {
    return "apple-calendar";
  }
  return "";
}

function summarizeToolRequest(name, args) {
  switch (name) {
    case "add_task":
      return summarizeFields(args, ["name", "priority"]);
    case "delete_task":
    case "update_task_status":
      return summarizeFields(args, ["query", "status"]);
    case "add_calendar_item":
      return summarizeFields(args, ["source", "title", "date", "time", "startDate", "endDate"]);
    case "list_calendar_items":
      return summarizeFields(args, ["source", "query", "startDate", "endDate"]);
    case "delete_calendar_item":
      return summarizeFields(args, ["source", "query"]);
    case "web_search":
      return summarizeFields(args, ["query"]);
    case "web_fetch":
      return summarizeFields(args, ["url"]);
    case "read_file":
      return summarizeFields(args, ["path"]);
    case "write_file":
      return summarizeFields(args, ["path"]);
    case "edit_file":
      return summarizeFields(args, ["path", "replaceAll"]);
    case "take_screenshot":
    case "analyze_screen":
      return summarizeFields(args, ["target", "source_id", "reason", "question"]);
    case "computer_use_task":
      return summarizeFields(args, ["task", "target", "url", "autonomy", "maxSteps"]);
    case "cancel_computer_use":
      return summarizeFields(args, ["reason"]);
    case "end_call":
      return summarizeFields(args, ["reason"]);
    default:
      return "";
  }
}

function summarizeMCPArgs(args) {
  if (!isRecord(args)) {
    return "";
  }
  return Object.entries(args)
    .slice(0, 3)
    .map(([field, value]) => formatField(field, value))
    .filter(Boolean)
    .join(", ");
}

function getMCPPermissionContext(namespacedName, serverConfig) {
  const parsed = parseMCPToolName(namespacedName);
  if (!parsed || !isRecord(serverConfig)) {
    return { valid: false };
  }

  const configuredServerId = normalizeString(serverConfig.serverId ?? serverConfig.id);
  if (configuredServerId !== parsed.serverId) {
    return { valid: false };
  }
  const tool = findMCPToolConfig(parsed.toolName, namespacedName, serverConfig);
  if (!tool) {
    return { valid: false };
  }

  return {
    valid: true,
    parsed,
    serverName: sanitizeMCPText(
      normalizeString(serverConfig.name ?? serverConfig.label) || parsed.serverId,
      80,
    ),
    permissionLevel: normalizeMCPPermissionLevel(serverConfig.permission_level),
    tool,
  };
}

function normalizeMCPPermissionLevel(value) {
  const normalized = normalizeString(value).toLowerCase();
  return MCP_PERMISSION_LEVELS.has(normalized) ? normalized : "confirm";
}

function findMCPToolConfig(toolName, namespacedName, serverConfig) {
  if (Array.isArray(serverConfig.tools)) {
    const tool = serverConfig.tools.find(
      (entry) => isRecord(entry) && (entry.name === toolName || entry.name === namespacedName),
    );
    return isValidMCPToolConfig(tool, toolName, namespacedName) ? tool : null;
  }

  if (isRecord(serverConfig.tools)) {
    const tool = serverConfig.tools[toolName] ?? serverConfig.tools[namespacedName];
    return isValidMCPToolConfig(tool, toolName, namespacedName) ? tool : null;
  }

  if (isRecord(serverConfig.tool)) {
    return isValidMCPToolConfig(serverConfig.tool, toolName, namespacedName)
      ? serverConfig.tool
      : null;
  }

  return null;
}

function isValidMCPToolConfig(tool, toolName, namespacedName) {
  if (!isRecord(tool) || !isRecord(tool.inputSchema)) {
    return false;
  }

  const name = normalizeString(tool.name);
  return name === toolName || name === namespacedName;
}

function inferMCPToolLevel(inputSchema) {
  const propertyNames = getMCPPropertyNames(inputSchema);
  let level = "low";

  for (const propertyName of propertyNames) {
    const normalizedPropertyName = propertyName.toLowerCase();
    for (const [riskName, riskLevel] of MCP_RISK_PROPERTY_LEVELS) {
      if (
        normalizedPropertyName.includes(riskName) &&
        MCP_LEVEL_RANK[riskLevel] > MCP_LEVEL_RANK[level]
      ) {
        level = riskLevel;
      }
    }
  }

  return level;
}

function getMCPPropertyNames(schema) {
  const names = new Set();
  const seen = new WeakSet();
  const stack = [{ value: schema, depth: 0 }];

  while (stack.length > 0) {
    const { value, depth } = stack.pop();
    if (!isRecord(value) || seen.has(value) || depth > 6) {
      continue;
    }

    seen.add(value);
    if (isRecord(value.properties)) {
      for (const [name, childSchema] of Object.entries(value.properties)) {
        names.add(name);
        stack.push({ value: childSchema, depth: depth + 1 });
      }
    }

    for (const child of Object.values(value)) {
      if (isRecord(child)) {
        stack.push({ value: child, depth: depth + 1 });
      } else if (Array.isArray(child)) {
        for (const item of child) {
          stack.push({ value: item, depth: depth + 1 });
        }
      }
    }
  }

  return names;
}

function summarizeFields(args, fields) {
  if (!isRecord(args)) {
    return "";
  }
  return fields
    .map((field) => formatField(field, args[field]))
    .filter(Boolean)
    .join(", ");
}

function formatField(field, value) {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const formattedText = shouldSanitizePathField(field) ? summarizePathForPermission(text) : text;
  return `${field}: ${formattedText.slice(0, 140)}`;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isKnownRealtimeTool(name) {
  return Object.hasOwn(toolPermissionMetadata, name);
}

function normalizePermissionRequest(request) {
  if (!isRecord(request)) {
    return {
      toolName: "unknown",
      label: "Unknown tool",
      level: "unknown",
      description: "Tool metadata is unavailable.",
      summary: "",
      source: "",
    };
  }

  const toolName = normalizeString(request.toolName ?? request.name) || "unknown";
  const level = normalizeString(request.level).toLowerCase();

  return {
    toolName,
    label: normalizeString(request.label) || toolName,
    level: KNOWN_PERMISSION_LEVELS.has(level) ? level : "unknown",
    description: normalizeString(request.description),
    summary: normalizeString(request.summary),
    source: normalizeString(request.source ?? request.integration),
  };
}

function normalizePermissionSource(source, toolName) {
  const normalized = normalizeString(source).toLowerCase();
  if (normalized === "apple") {
    return "apple-calendar";
  }
  if (normalized) {
    return normalized;
  }
  if (toolName.startsWith("mcp__")) {
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

function createPermissionActions({
  blocked,
  confirmationRequired,
  trustIntegrationAllowed,
  trustedWriteAllowed,
}) {
  if (blocked) {
    return Object.freeze([
      Object.freeze({
        id: "refresh_permissions",
        label: "Refresh permissions",
        kind: "secondary",
      }),
    ]);
  }

  if (!confirmationRequired) {
    return Object.freeze([]);
  }

  const actions = [
    Object.freeze({ id: "allow_once", label: "Allow once", kind: "primary" }),
    Object.freeze({ id: "deny", label: "Deny", kind: "secondary" }),
  ];

  if (trustIntegrationAllowed) {
    actions.push(
      Object.freeze({
        id: "trust_integration",
        label: "Trust this integration",
        kind: "secondary",
      }),
    );
  }

  if (trustedWriteAllowed) {
    actions.push(
      Object.freeze({
        id: "allow_trusted_write_actions",
        label: "Allow trusted write actions",
        kind: "secondary",
      }),
    );
  }

  return Object.freeze(actions);
}

function hasRequiredFileGrant(context) {
  const scope = normalizeFileAccessScope(context.fileAccessScope ?? context.scope);
  if (scope === "workspace" || scope === "explicit") {
    return true;
  }
  return scope === "full-disk" && normalizeString(context.fullDiskAccessStatus) === "granted";
}

function hasRequiredTrustedWriteGrant(name, context) {
  const requiredGrant = TRUSTED_WRITE_GRANT_BY_TOOL[name];
  if (requiredGrant === "file") {
    return hasRequiredFileGrant(context);
  }
  return false;
}

function normalizeFileAccessScope(value) {
  const normalized = normalizeString(value).toLowerCase();
  return FILE_ACCESS_SCOPES.has(normalized) ? normalized : "workspace";
}

function shouldSanitizePathField(field) {
  return normalizeString(field).toLowerCase().includes("path");
}

function summarizePathForPermission(value) {
  const trimmed = normalizeString(value);
  if (!isPrivateAbsolutePath(trimmed)) {
    return trimmed;
  }
  const withoutTrailingSeparators = trimmed.replace(/[\\/]+$/g, "");
  const basename = withoutTrailingSeparators.split(/[\\/]/).filter(Boolean).at(-1);
  return basename ? `[absolute path]/${basename}` : "[absolute path]";
}

function isPrivateAbsolutePath(value) {
  return (
    value.startsWith("/") ||
    value.startsWith("~/") ||
    value.startsWith("~\\") ||
    /^[A-Za-z]:[\\/]/.test(value)
  );
}

function sanitizeMCPText(value, maxLength) {
  return stripMCPControlCharacters(normalizeString(value))
    .replace(/\s+/g, " ")
    .slice(0, maxLength)
    .trim();
}

function stripMCPControlCharacters(value) {
  let text = "";
  for (const character of value) {
    const code = character.charCodeAt(0);
    text += code < 32 || code === 127 ? " " : character;
  }
  return text;
}
