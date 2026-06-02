const MAX_DESCRIPTION_LENGTH = 1024;
const MAX_SCHEMA_DEPTH = 5;
const MCP_TOOL_PREFIX = "mcp__";
const MCP_TOOL_SEPARATOR = "__";
const ENCODED_SEGMENT_PREFIX = "u_";
const SAFE_TOOL_NAME_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;

const STRIPPED_SCHEMA_KEYS = new Set(["$schema", "$id", "$comment", "examples", "default"]);
const RAW_VALUE_SCHEMA_KEYS = new Set(["const", "enum", "required"]);
const SCHEMA_MAP_KEYS = new Set([
  "$defs",
  "definitions",
  "dependentSchemas",
  "patternProperties",
  "properties",
]);
const SCHEMA_ARRAY_KEYS = new Set(["allOf", "anyOf", "oneOf", "prefixItems"]);
const SCHEMA_VALUE_KEYS = new Set([
  "additionalProperties",
  "contains",
  "else",
  "if",
  "items",
  "not",
  "propertyNames",
  "then",
  "unevaluatedItems",
  "unevaluatedProperties",
]);

export function mcpToolToOpenAI(mcpTool) {
  if (!isRecord(mcpTool)) {
    throw new Error("MCP tool must be an object.");
  }

  const name = normalizeName(mcpTool.name);
  if (!name) {
    throw new Error("MCP tool name is required.");
  }

  return {
    type: "function",
    name,
    description: truncateDescription(mcpTool.description),
    parameters: sanitizeSchema(mcpTool.inputSchema),
  };
}

export function sanitizeSchema(schema) {
  const sanitized = sanitizeSchemaValue(isRecord(schema) ? schema : {}, 0);
  const root = isRecord(sanitized) ? sanitized : {};

  root.type = "object";
  if (!isRecord(root.properties)) {
    root.properties = {};
  }

  return root;
}

export function namespaceMCPTool(serverId, toolName) {
  const normalizedServerId = normalizeName(serverId);
  const normalizedToolName = normalizeName(toolName);

  if (!normalizedServerId) {
    throw new Error("MCP server id is required.");
  }
  if (!normalizedToolName) {
    throw new Error("MCP tool name is required.");
  }

  return `${MCP_TOOL_PREFIX}${encodeNameSegment(normalizedServerId)}${MCP_TOOL_SEPARATOR}${encodeNameSegment(normalizedToolName)}`;
}

export function parseMCPToolName(namespacedName) {
  if (typeof namespacedName !== "string" || !namespacedName.startsWith(MCP_TOOL_PREFIX)) {
    return null;
  }

  const body = namespacedName.slice(MCP_TOOL_PREFIX.length);
  const separatorIndex = body.indexOf(MCP_TOOL_SEPARATOR);
  if (separatorIndex <= 0 || separatorIndex === body.length - MCP_TOOL_SEPARATOR.length) {
    return null;
  }

  const serverId = decodeNameSegment(body.slice(0, separatorIndex));
  const toolName = decodeNameSegment(body.slice(separatorIndex + MCP_TOOL_SEPARATOR.length));
  if (!serverId || !toolName) {
    return null;
  }

  return { serverId, toolName };
}

export async function getMergedToolDefinitions(staticTools, mcpClientManager) {
  const mergedTools = Array.isArray(staticTools) ? staticTools.map(cloneValue) : [];
  const usedNames = new Set(mergedTools.map((tool) => tool?.name).filter(Boolean));
  const statuses = getManagerStatus(mcpClientManager);

  for (const [serverId, status] of Object.entries(statuses)) {
    if (status?.connected === false) {
      continue;
    }

    let mcpTools;
    try {
      mcpTools = await mcpClientManager.listTools(serverId);
    } catch (error) {
      warnSchemaConversion(`Skipping MCP server "${serverId}" after listTools failed.`, error);
      continue;
    }

    if (!Array.isArray(mcpTools)) {
      continue;
    }

    for (const mcpTool of mcpTools) {
      let openAITool;
      try {
        openAITool = mcpToolToOpenAI({
          ...mcpTool,
          name: namespaceMCPTool(serverId, mcpTool?.name),
        });
      } catch (error) {
        warnSchemaConversion(`Skipping invalid MCP tool from server "${serverId}".`, error);
        continue;
      }

      if (usedNames.has(openAITool.name)) {
        warnSchemaConversion(`Skipping duplicate MCP tool name "${openAITool.name}".`);
        continue;
      }

      usedNames.add(openAITool.name);
      mergedTools.push(openAITool);
    }
  }

  return mergedTools;
}

function sanitizeSchemaValue(value, depth) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSchemaValue(item, depth));
  }
  if (!isRecord(value)) {
    return value;
  }
  if (depth >= MAX_SCHEMA_DEPTH) {
    return truncateDeepSchema(value);
  }

  const result = {};
  for (const [key, childValue] of Object.entries(value)) {
    if (STRIPPED_SCHEMA_KEYS.has(key)) {
      continue;
    }
    if (key === "description") {
      result[key] = truncateDescription(childValue);
      continue;
    }
    if (RAW_VALUE_SCHEMA_KEYS.has(key)) {
      result[key] = cloneValue(childValue);
      continue;
    }
    if (SCHEMA_MAP_KEYS.has(key) && isRecord(childValue)) {
      result[key] = sanitizeSchemaMap(childValue, depth + 1);
      continue;
    }
    if (SCHEMA_ARRAY_KEYS.has(key) && Array.isArray(childValue)) {
      result[key] = childValue.map((schema) => sanitizeSchemaValue(schema, depth + 1));
      continue;
    }
    if (SCHEMA_VALUE_KEYS.has(key)) {
      result[key] = sanitizeSchemaValue(childValue, depth + 1);
      continue;
    }

    result[key] = sanitizeSchemaValue(childValue, depth + 1);
  }

  return result;
}

function sanitizeSchemaMap(schemaMap, depth) {
  return Object.fromEntries(
    Object.entries(schemaMap).map(([propertyName, propertySchema]) => [
      propertyName,
      sanitizeSchemaValue(propertySchema, depth),
    ]),
  );
}

function truncateDeepSchema(schema) {
  const truncated = {};

  if ("type" in schema) {
    truncated.type = cloneValue(schema.type);
  }
  if (typeof schema.description === "string") {
    truncated.description = truncateDescription(schema.description);
  }
  if (Array.isArray(schema.enum)) {
    truncated.enum = cloneValue(schema.enum);
  }
  if (Array.isArray(schema.required)) {
    truncated.required = cloneValue(schema.required);
  }

  truncated.additionalProperties = true;
  return truncated;
}

function getManagerStatus(mcpClientManager) {
  if (!mcpClientManager || typeof mcpClientManager.getStatus !== "function") {
    return {};
  }

  try {
    const status = mcpClientManager.getStatus();
    return isRecord(status) ? status : {};
  } catch (error) {
    warnSchemaConversion("Skipping MCP tool merge after getStatus failed.", error);
    return {};
  }
}

function normalizeName(value) {
  return typeof value === "string" ? value.trim() : "";
}

function encodeNameSegment(value) {
  if (isSafeNameSegment(value)) {
    return value;
  }
  return `${ENCODED_SEGMENT_PREFIX}${Buffer.from(value, "utf8").toString("hex")}`;
}

function decodeNameSegment(value) {
  if (!value.startsWith(ENCODED_SEGMENT_PREFIX)) {
    return value;
  }
  const hex = value.slice(ENCODED_SEGMENT_PREFIX.length);
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    return "";
  }
  return Buffer.from(hex, "hex").toString("utf8");
}

function isSafeNameSegment(value) {
  return (
    SAFE_TOOL_NAME_SEGMENT_PATTERN.test(value) &&
    !value.includes(MCP_TOOL_SEPARATOR) &&
    !value.startsWith(ENCODED_SEGMENT_PREFIX)
  );
}

function truncateDescription(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.slice(0, MAX_DESCRIPTION_LENGTH);
}

function cloneValue(value) {
  return structuredClone(value);
}

function warnSchemaConversion(message, error) {
  const suffix = error?.message ? ` ${error.message}` : "";
  console.warn(`${message}${suffix}`);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
