import { executeComputerUseTool } from "./computer-use-tools.js";
import { executePlannerTool } from "./planner-tools.js";
import { executeScreenshotTool } from "./screenshot-tools.js";
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

  const screenshotResult = await executeScreenshotTool(name, args, options.screenshot);
  if (screenshotResult) {
    return screenshotResult;
  }

  const computerResult = await executeComputerUseTool(name, args, options.computerUse);
  if (computerResult) {
    return computerResult;
  }

  return {
    status: "error",
    message: `Unknown realtime tool: ${name}`,
  };
}
