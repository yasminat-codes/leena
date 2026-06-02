import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { MCPError, RetryExhaustedError } from "../utils/errors.js";
import { withRetry } from "../utils/retry.js";

const DEFAULT_CLIENT_INFO = Object.freeze({
  name: "leena-mcp-client",
  version: "0.1.0",
});

const DEFAULT_RETRY_OPTIONS = Object.freeze({
  connect: Object.freeze({ maxAttempts: 3, baseDelay: 100, maxDelay: 1000 }),
  callTool: Object.freeze({ maxAttempts: 1, baseDelay: 100, maxDelay: 1000 }),
});

export class MCPClientManager {
  constructor(options = {}) {
    this.connections = new Map();
    this.Client = options.Client ?? Client;
    this.StreamableHTTPClientTransport =
      options.StreamableHTTPClientTransport ?? StreamableHTTPClientTransport;
    this.StdioClientTransport = options.StdioClientTransport ?? StdioClientTransport;
    this.clientInfo = options.clientInfo ?? DEFAULT_CLIENT_INFO;
    this.retryOptions = mergeRetryOptions(options.retryOptions);
  }

  async connect(serverConfig) {
    const config = normalizeServerConfig(serverConfig);

    if (this.connections.has(config.serverId)) {
      await this.disconnect(config.serverId);
    }

    try {
      const entry = await withRetry(() => this.createConnectedEntry(config), {
        ...this.retryOptions.connect,
      });
      this.connections.set(config.serverId, entry);
      return this.getServerStatus(config.serverId, entry);
    } catch (error) {
      throw createMCPError(`Failed to connect MCP server "${config.serverId}"`, config, error);
    }
  }

  async disconnect(serverId) {
    const entry = this.connections.get(serverId);
    if (!entry) {
      return false;
    }

    this.connections.delete(serverId);
    try {
      await closeEntry(entry);
      entry.status = "disconnected";
      return true;
    } catch (error) {
      throw createMCPError(`Failed to disconnect MCP server "${serverId}"`, entry.config, error);
    }
  }

  async listTools(serverId) {
    const entry = this.getConnectionOrThrow(serverId);

    try {
      const result = await entry.client.listTools();
      const tools = normalizeTools(result);
      entry.tools = tools;
      return tools;
    } catch (error) {
      throw createMCPError(
        `Failed to list tools for MCP server "${serverId}"`,
        entry.config,
        error,
      );
    }
  }

  async callTool(serverId, toolName, args = {}) {
    const entry = this.getConnectionOrThrow(serverId);

    try {
      const result = await withRetry(
        () =>
          entry.client.callTool({
            name: toolName,
            arguments: args ?? {},
          }),
        { ...this.retryOptions.callTool },
      );
      return Array.isArray(result?.content) ? result.content : [];
    } catch (error) {
      throw createMCPError(
        `Failed to call MCP tool "${toolName}" on server "${serverId}"`,
        entry.config,
        error,
      );
    }
  }

  getStatus() {
    return Object.fromEntries(
      Array.from(this.connections.entries()).map(([serverId, entry]) => [
        serverId,
        this.getServerStatus(serverId, entry),
      ]),
    );
  }

  async disconnectAll() {
    const serverIds = Array.from(this.connections.keys());
    const results = await Promise.allSettled(
      serverIds.map((serverId) => this.disconnect(serverId)),
    );
    const rejected = results.find((result) => result.status === "rejected");
    if (rejected) {
      throw rejected.reason;
    }
  }

  async createConnectedEntry(config) {
    const transport = this.createTransport(config);
    const client = new this.Client(this.clientInfo);

    try {
      await client.connect(transport);
      return {
        client,
        transport,
        config,
        status: "connected",
        tools: [],
      };
    } catch (error) {
      await closeQuietly(client, transport, config.transport);
      throw error;
    }
  }

  createTransport(config) {
    if (config.transport === "http") {
      const options = config.headers ? { requestInit: { headers: config.headers } } : undefined;
      return new this.StreamableHTTPClientTransport(new URL(config.url), options);
    }

    return new this.StdioClientTransport({
      command: config.command,
      args: config.args,
    });
  }

  getConnectionOrThrow(serverId) {
    const entry = this.connections.get(serverId);
    if (!entry) {
      throw new MCPError(`MCP server "${serverId}" is not connected.`, { serverName: serverId });
    }
    return entry;
  }

  getServerStatus(serverId, entry) {
    return {
      name: entry.config.name,
      transport: entry.config.transport,
      connected: entry.status === "connected",
      toolCount: entry.tools.length,
      serverId,
    };
  }
}

function normalizeServerConfig(serverConfig) {
  if (!isRecord(serverConfig)) {
    throw new MCPError("MCP server config must be an object.");
  }

  const serverId = normalizeString(serverConfig.serverId ?? serverConfig.id);
  const transport = normalizeString(serverConfig.transport);
  if (!serverId) {
    throw new MCPError("MCP server config must include serverId or id.");
  }
  if (transport !== "http" && transport !== "stdio") {
    throw new MCPError(`Unsupported MCP transport "${transport || "unknown"}".`, {
      serverName: serverId,
      transport,
    });
  }

  const normalized = {
    ...serverConfig,
    serverId,
    name: normalizeString(serverConfig.name ?? serverConfig.label) || serverId,
    transport,
    args: Array.isArray(serverConfig.args) ? serverConfig.args : [],
  };

  if (transport === "http") {
    normalized.url = normalizeString(serverConfig.url);
    if (!normalized.url) {
      throw new MCPError(`MCP HTTP server "${serverId}" requires a url.`, {
        serverName: serverId,
        transport,
      });
    }
  }

  if (transport === "stdio") {
    normalized.command = normalizeString(serverConfig.command);
    if (!normalized.command) {
      throw new MCPError(`MCP stdio server "${serverId}" requires a command.`, {
        serverName: serverId,
        transport,
      });
    }
  }

  return normalized;
}

function normalizeTools(result) {
  const tools = Array.isArray(result?.tools) ? result.tools : [];
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? "",
    inputSchema: tool.inputSchema ?? {},
  }));
}

async function closeEntry(entry) {
  await entry.client.close?.();
  if (entry.config.transport === "stdio") {
    await entry.transport.close?.();
  }
}

async function closeQuietly(client, transport, transportType) {
  try {
    await client.close?.();
  } catch {
    /* cleanup best effort */
  }
  if (transportType !== "stdio") {
    return;
  }
  try {
    await transport.close?.();
  } catch {
    /* cleanup best effort */
  }
}

function createMCPError(message, config, error) {
  const cause = unwrapRetryCause(error);
  const suffix = cause?.message ? `: ${cause.message}` : "";
  return new MCPError(`${message}${suffix}`, {
    serverName: config?.serverId ?? config?.name,
    transport: config?.transport,
    cause: error,
  });
}

function unwrapRetryCause(error) {
  if (error instanceof RetryExhaustedError) {
    return error.lastError ?? error.cause ?? error;
  }
  return error;
}

function mergeRetryOptions(retryOptions) {
  return {
    connect: {
      ...DEFAULT_RETRY_OPTIONS.connect,
      ...(isRecord(retryOptions?.connect) ? retryOptions.connect : {}),
    },
    callTool: {
      ...DEFAULT_RETRY_OPTIONS.callTool,
      ...(isRecord(retryOptions?.callTool) ? retryOptions.callTool : {}),
    },
  };
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
