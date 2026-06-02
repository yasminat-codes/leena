import assert from "node:assert/strict";
import test from "node:test";
import {
  getMergedToolDefinitions,
  mcpToolToOpenAI,
  namespaceMCPTool,
  parseMCPToolName,
  sanitizeSchema,
} from "../src/mcp/schema-converter.js";

test("mcpToolToOpenAI converts simple MCP schemas without mutating the input", () => {
  const mcpTool = {
    name: "search",
    description: "Search messages",
    inputSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "tool-search",
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query",
          default: "inbox",
          examples: ["mail"],
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  };

  const converted = mcpToolToOpenAI(mcpTool);

  assert.deepEqual(converted, {
    type: "function",
    name: "search",
    description: "Search messages",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  });
  assert.equal(mcpTool.inputSchema.properties.query.default, "inbox");
});

test("sanitizeSchema preserves nested objects, arrays, enums, and composition keywords", () => {
  const schema = sanitizeSchema({
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["fast", "deep"],
      },
      filters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            field: { type: "string" },
            value: {
              anyOf: [{ type: "string" }, { type: "number" }],
              oneOf: [{ const: "open" }, { const: "closed" }],
              allOf: [{ type: "string", minLength: 1 }],
            },
          },
          required: ["field"],
        },
      },
    },
    required: ["mode", "filters"],
  });

  assert.deepEqual(schema.properties.mode.enum, ["fast", "deep"]);
  assert.deepEqual(schema.properties.filters.items.required, ["field"]);
  assert.deepEqual(schema.properties.filters.items.properties.value.anyOf, [
    { type: "string" },
    { type: "number" },
  ]);
  assert.deepEqual(schema.properties.filters.items.properties.value.oneOf, [
    { const: "open" },
    { const: "closed" },
  ]);
  assert.deepEqual(schema.properties.filters.items.properties.value.allOf, [
    { type: "string", minLength: 1 },
  ]);
});

test("sanitizeSchema strips schema metadata recursively but keeps same-named properties", () => {
  const schema = sanitizeSchema({
    $schema: "draft",
    $id: "root",
    $comment: "remove",
    type: "object",
    properties: {
      default: {
        type: "string",
        $id: "property",
        default: "removed",
      },
      details: {
        type: "object",
        properties: {
          item: {
            type: "string",
            $comment: "remove nested",
            examples: ["remove"],
          },
        },
      },
    },
  });

  assert.equal(schema.$schema, undefined);
  assert.equal(schema.$id, undefined);
  assert.equal(schema.$comment, undefined);
  assert.deepEqual(schema.properties.default, { type: "string" });
  assert.deepEqual(schema.properties.details.properties.item, { type: "string" });
});

test("sanitizeSchema defaults root object parameters and truncates deep schemas safely", () => {
  const missingRoot = sanitizeSchema({
    properties: {
      prompt: { type: "string" },
    },
  });
  assert.equal(missingRoot.type, "object");
  assert.deepEqual(missingRoot.properties.prompt, { type: "string" });

  const arrayRoot = sanitizeSchema({
    type: "array",
    items: { type: "string" },
  });
  assert.equal(arrayRoot.type, "object");
  assert.deepEqual(arrayRoot.properties, {});

  const deepSchema = sanitizeSchema({
    type: "object",
    properties: {
      level1: {
        type: "object",
        properties: {
          level2: {
            type: "object",
            properties: {
              level3: {
                type: "object",
                properties: {
                  level4: {
                    type: "object",
                    properties: {
                      level5: {
                        type: "object",
                        description: "deep",
                        properties: {
                          level6: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const truncated =
    deepSchema.properties.level1.properties.level2.properties.level3.properties.level4.properties
      .level5;
  assert.deepEqual(truncated, {
    type: "object",
    description: "deep",
    additionalProperties: true,
  });
});

test("tool names namespace and parse round-trip", () => {
  const namespaced = namespaceMCPTool("calendar", "create_event");

  assert.equal(namespaced, "mcp__calendar__create_event");
  assert.deepEqual(parseMCPToolName(namespaced), {
    serverId: "calendar",
    toolName: "create_event",
  });
  assert.deepEqual(parseMCPToolName("web_search"), null);
  assert.deepEqual(parseMCPToolName("mcp__calendar__"), null);
  assert.throws(() => namespaceMCPTool("calendar", ""), /tool name/);
});

test("tool names encode unsafe segments while staying reversible", () => {
  const namespaced = namespaceMCPTool("my__server/id", "draft email");

  assert.match(namespaced, /^mcp__[A-Za-z0-9_-]+__[A-Za-z0-9_-]+$/);
  assert.deepEqual(parseMCPToolName(namespaced), {
    serverId: "my__server/id",
    toolName: "draft email",
  });
  assert.deepEqual(parseMCPToolName(namespaceMCPTool("u_special", "u_tool")), {
    serverId: "u_special",
    toolName: "u_tool",
  });
});

test("mcpToolToOpenAI rejects empty names and truncates descriptions", () => {
  const longDescription = "a".repeat(1100);

  assert.throws(() => mcpToolToOpenAI({ name: "", inputSchema: {} }), /tool name/);
  assert.equal(
    mcpToolToOpenAI({
      name: "long_description",
      description: longDescription,
      inputSchema: {},
    }).description.length,
    1024,
  );
});

test("getMergedToolDefinitions appends namespaced MCP tools and skips errored servers", async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (message) => warnings.push(message);
  try {
    const staticTools = [
      {
        type: "function",
        name: "web_search",
        description: "Search",
        parameters: { type: "object", properties: {}, required: [] },
      },
    ];
    const listToolsCalls = [];
    const manager = {
      getStatus() {
        return {
          alpha: { connected: true },
          beta: { connected: true },
          offline: { connected: false },
          broken: { connected: true },
        };
      },
      async listTools(serverId) {
        listToolsCalls.push(serverId);
        if (serverId === "broken") {
          throw new Error("server down");
        }
        return {
          alpha: [
            {
              name: "search",
              description: "Search alpha",
              inputSchema: {
                type: "object",
                properties: { query: { type: "string" } },
                required: ["query"],
              },
            },
            {
              name: "draft",
              description: "Draft alpha",
              inputSchema: { properties: { subject: { type: "string" } } },
            },
          ],
          beta: [
            {
              name: "lookup",
              description: "Lookup beta",
              inputSchema: {
                type: "object",
                properties: { id: { type: "string" } },
              },
            },
          ],
        }[serverId];
      },
    };

    const merged = await getMergedToolDefinitions(staticTools, manager);

    assert.deepEqual(listToolsCalls, ["alpha", "beta", "broken"]);
    assert.deepEqual(
      merged.map((tool) => tool.name),
      ["web_search", "mcp__alpha__search", "mcp__alpha__draft", "mcp__beta__lookup"],
    );
    assert.deepEqual(merged[1].parameters.required, ["query"]);
    assert.equal(merged[2].parameters.type, "object");
    assert.deepEqual(merged[2].parameters.properties.subject, { type: "string" });
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /Skipping MCP server "broken"/);
  } finally {
    console.warn = originalWarn;
  }
});
