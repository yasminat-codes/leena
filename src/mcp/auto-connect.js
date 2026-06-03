import { withRetry } from "../utils/retry.js";

export const MCP_STATUS_CHANGED_CHANNEL = "mcp:status-changed";

const DEFAULT_RETRY_OPTIONS = Object.freeze({
  maxAttempts: 3,
  baseDelay: 5000,
  maxDelay: 30_000,
});

export function initMCPAutoConnect(options = {}) {
  const deps = normalizeAutoConnectOptions(options);
  const completion = runMCPAutoConnect(deps);

  return {
    completion,
    cleanup: () => cleanupMCPConnections(deps),
  };
}

export function registerMCPAutoConnectCleanup(options = {}) {
  const deps = normalizeCleanupOptions(options);
  let cleanupPromise = null;

  const cleanup = () => {
    cleanupPromise ??= cleanupMCPConnections(deps).finally(() => {
      cleanupPromise = null;
    });
    return cleanupPromise;
  };

  const onBeforeQuit = () => {
    void cleanup();
  };

  deps.app.on("before-quit", onBeforeQuit);

  return {
    cleanup,
    dispose() {
      if (typeof deps.app.off === "function") {
        deps.app.off("before-quit", onBeforeQuit);
        return;
      }
      deps.app.removeListener?.("before-quit", onBeforeQuit);
    },
  };
}

export async function cleanupMCPConnections({ mcpClientManager, logger } = {}) {
  if (!mcpClientManager || typeof mcpClientManager.disconnectAll !== "function") {
    throw new TypeError("mcpClientManager.disconnectAll is required.");
  }

  try {
    await mcpClientManager.disconnectAll();
    await logDiagnostic(logger, "mcp:auto-connect:cleanup:ok");
    return { ok: true };
  } catch (error) {
    await logDiagnostic(logger, "mcp:auto-connect:cleanup:fail", {
      error: getErrorMessage(error),
    });
    return { ok: false, error };
  }
}

async function runMCPAutoConnect(deps) {
  let servers;
  try {
    servers = await deps.serverStore.getAutoConnectServers();
  } catch (error) {
    const summary = { connected: [], failed: [] };
    await logDiagnostic(
      deps.logger,
      `mcp:auto-connect:fail:server-store:${getErrorMessage(error)}`,
    );
    sendStatusChanged(deps.webContents, summary, deps.logger);
    return summary;
  }

  const serverList = Array.isArray(servers) ? servers : [];
  const results = await Promise.allSettled(
    serverList.map((server) => connectAutoConnectServer(server, deps)),
  );
  const summary = await summarizeConnectionResults(results, deps.logger);
  sendStatusChanged(deps.webContents, summary, deps.logger);
  return summary;
}

async function connectAutoConnectServer(server, deps) {
  const metadata = getServerMetadata(server);
  try {
    await withRetry(() => deps.mcpClientManager.connect(server), deps.retryOptions);
    return { ...metadata, connected: true };
  } catch (error) {
    throw createConnectionFailure(metadata, error);
  }
}

async function summarizeConnectionResults(results, logger) {
  const summary = { connected: [], failed: [] };

  for (const result of results) {
    if (result.status === "fulfilled") {
      const serverId = result.value.serverId;
      summary.connected.push(serverId);
      await logDiagnostic(logger, `mcp:auto-connect:ok:${result.value.serverName}`, {
        serverId,
      });
      continue;
    }

    const failure = normalizeConnectionFailure(result.reason);
    summary.failed.push(failure.serverId);
    await logDiagnostic(logger, `mcp:auto-connect:fail:${failure.serverName}:${failure.message}`, {
      serverId: failure.serverId,
      error: failure.message,
    });
  }

  return summary;
}

function sendStatusChanged(webContents, summary, logger) {
  if (!webContents || typeof webContents.send !== "function") {
    return;
  }
  try {
    if (typeof webContents.isDestroyed === "function" && webContents.isDestroyed()) {
      return;
    }
    webContents.send(MCP_STATUS_CHANGED_CHANNEL, summary);
  } catch (error) {
    void logDiagnostic(logger, "mcp:auto-connect:status-emit:fail", {
      error: getErrorMessage(error),
    });
  }
}

function normalizeAutoConnectOptions(options) {
  if (!options?.serverStore || typeof options.serverStore.getAutoConnectServers !== "function") {
    throw new TypeError("serverStore.getAutoConnectServers is required.");
  }
  if (!options?.mcpClientManager || typeof options.mcpClientManager.connect !== "function") {
    throw new TypeError("mcpClientManager.connect is required.");
  }

  return {
    serverStore: options.serverStore,
    mcpClientManager: options.mcpClientManager,
    webContents: options.webContents,
    logger: options.logger,
    retryOptions: {
      ...DEFAULT_RETRY_OPTIONS,
      ...(isRecord(options.retryOptions) ? options.retryOptions : {}),
    },
  };
}

function normalizeCleanupOptions(options) {
  if (!options?.app || typeof options.app.on !== "function") {
    throw new TypeError("Electron app event emitter is required.");
  }
  if (!options?.mcpClientManager || typeof options.mcpClientManager.disconnectAll !== "function") {
    throw new TypeError("mcpClientManager.disconnectAll is required.");
  }

  return {
    app: options.app,
    mcpClientManager: options.mcpClientManager,
    logger: options.logger,
  };
}

function getServerMetadata(server) {
  const serverId = normalizeString(server?.serverId ?? server?.id) || "unknown";
  return {
    serverId,
    serverName: normalizeString(server?.name ?? server?.label) || serverId,
  };
}

function normalizeConnectionFailure(reason) {
  if (isRecord(reason) && "serverId" in reason) {
    return {
      serverId: normalizeString(reason.serverId) || "unknown",
      serverName:
        normalizeString(reason.serverName) || normalizeString(reason.serverId) || "unknown",
      message: getErrorMessage(reason.cause ?? reason),
    };
  }

  return {
    serverId: "unknown",
    serverName: "unknown",
    message: getErrorMessage(reason),
  };
}

function createConnectionFailure(metadata, error) {
  const failure = new Error(getErrorMessage(error));
  failure.serverId = metadata.serverId;
  failure.serverName = metadata.serverName;
  failure.cause = error;
  return failure;
}

async function logDiagnostic(logger, event, details = {}) {
  if (!logger) {
    return;
  }
  try {
    if (typeof logger === "function") {
      await logger(event, details);
      return;
    }
    if (typeof logger.info === "function") {
      await logger.info(event, details);
    }
  } catch {
    /* diagnostics must never break lifecycle cleanup or startup */
  }
}

function getErrorMessage(error) {
  if (error?.lastError) {
    return getErrorMessage(error.lastError);
  }
  if (error?.cause instanceof Error) {
    return getErrorMessage(error.cause);
  }
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" && error.trim() ? error : "unknown error";
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
