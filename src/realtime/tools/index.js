import { parseMCPToolName } from "../../mcp/schema-converter.js";
import { MCPError } from "../../utils/errors.js";
import {
  createPermissionDeniedResult,
  getMCPToolPermissionRequest,
  shouldAutoApproveMCPTool,
} from "../tool-permissions.js";
import { executeComputerUseTool } from "./computer-use-tools.js";
import { executeFileSystemTool } from "./filesystem-tools.js";
import { executePlannerTool } from "./planner-tools.js";
import { executeScreenshotTool } from "./screenshot-tools.js";
import { executeSessionTool } from "./session-tools.js";
import { getRealtimeToolDefinitions } from "./tool-schemas.js";
import { executeWebTool } from "./web-tools.js";

export { getRealtimeToolDefinitions };

export async function executeRealtimeTool(name, args = {}, options = {}) {
  const plannerResult = await executePlannerTool(name, args, options.planner);
  if (plannerResult) {
    return plannerResult;
  }

  const webResult = await executeWebTool(name, args);
  if (webResult) {
    return webResult;
  }

  const fileSystemResult = await executeFileSystemTool(name, args, options.fileSystem);
  if (fileSystemResult) {
    return fileSystemResult;
  }

  const screenshotResult = await executeScreenshotTool(name, args, options.screenshot);
  if (screenshotResult) {
    return screenshotResult;
  }

  const computerResult = await executeComputerUseTool(name, args, options.computerUse);
  if (computerResult) {
    return computerResult;
  }

  const sessionResult = await executeSessionTool(name, args, options.session);
  if (sessionResult) {
    return sessionResult;
  }

  const mcpResult = await executeMCPTool(name, args, options);
  if (mcpResult) {
    return mcpResult;
  }

  return {
    status: "error",
    message: `Unknown realtime tool: ${name}`,
  };
}

async function executeMCPTool(name, args, options) {
  const parsed = parseMCPToolName(name);
  if (!parsed) {
    if (typeof name === "string" && name.startsWith("mcp__")) {
      return {
        status: "error",
        message: `Invalid MCP tool name: ${name}`,
      };
    }
    return null;
  }

  const clientManager = options.mcp?.clientManager;
  if (!clientManager || typeof clientManager.callTool !== "function") {
    return {
      status: "error",
      message: "MCP tool unavailable: missing MCP client manager.",
    };
  }

  const serverConfig = await getMCPServerConfig(options.mcp, parsed.serverId);
  const autoApproved = shouldAutoApproveMCPTool(name, args, serverConfig);
  if (!autoApproved) {
    const permissionRequest = getMCPToolPermissionRequest(name, args, serverConfig);
    if (permissionRequest.level === "unknown") {
      return createPermissionDeniedResult(permissionRequest);
    }

    const approved = await requestMCPPermission(options, permissionRequest);
    if (approved === null) {
      return {
        status: "permission_pending",
        message: `${permissionRequest.label} requires Ken's approval before it can run.`,
        permission: permissionRequest,
      };
    }
    if (!approved) {
      return createPermissionDeniedResult(permissionRequest);
    }
  }

  try {
    const content = await clientManager.callTool(parsed.serverId, parsed.toolName, args);
    return {
      status: "ok",
      result: extractMCPContentText(content),
    };
  } catch (error) {
    if (error instanceof MCPError) {
      return {
        status: "error",
        message: `MCP tool failed: ${error.message}`,
      };
    }
    return {
      status: "error",
      message: `MCP tool failed: ${error?.message ?? "Unknown error"}`,
    };
  }
}

async function getMCPServerConfig(mcpOptions, serverId) {
  if (typeof mcpOptions?.getServerConfig !== "function") {
    return {};
  }

  try {
    const serverConfig = await mcpOptions.getServerConfig(serverId);
    return isRecord(serverConfig) ? serverConfig : {};
  } catch {
    return {};
  }
}

async function requestMCPPermission(options, permissionRequest) {
  if (typeof options.requestPermission !== "function") {
    return null;
  }

  try {
    const result = await options.requestPermission(permissionRequest);
    if (isRecord(result) && typeof result.approved === "boolean") {
      return result.approved;
    }
    return result === true;
  } catch {
    return false;
  }
}

function extractMCPContentText(content) {
  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => (part?.type === "text" && typeof part.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n");
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
