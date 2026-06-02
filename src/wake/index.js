import { fileURLToPath } from "node:url";
import { WakeError } from "../utils/errors.js";

const DEFAULT_ENGINE = "openwakeword";
const OPENWAKEWORD_MODULE_URL = new URL("./openwakeword-engine.js", import.meta.url);

const ENGINE_IMPORTERS = Object.freeze({
  openwakeword: () => import("./openwakeword-engine.js"),
});

/**
 * @typedef {object} WakeStatus
 * @property {boolean} enabled
 * @property {boolean} muted
 * @property {boolean} listening
 * @property {boolean} engineReady
 */

/**
 * @typedef {object} DetectionEvent
 * @property {number} confidence
 * @property {number} timestamp
 * @property {string} model
 */

export class WakeEngine {
  constructor(settings = {}) {
    this.engine = normalizeEngineName(settings.engine ?? DEFAULT_ENGINE);
    this.model = typeof settings.model === "string" ? settings.model : this.engine;
    this.threshold = settings.threshold;
    this.detectionCallbacks = new Set();
    this.status = {
      enabled: false,
      muted: false,
      listening: false,
      engineReady: false,
    };
  }

  async start() {
    throw new WakeError(`${this.engine} wake engine is not implemented yet`, {
      code: "NOT_IMPLEMENTED",
    });
  }

  async stop() {
    this.status.listening = false;
  }

  setThreshold(n) {
    this.threshold = n;
  }

  onDetection(callback) {
    if (typeof callback !== "function") {
      throw new WakeError("Wake detection callback must be a function", {
        code: "INVALID_DETECTION_CALLBACK",
      });
    }
    this.detectionCallbacks.add(callback);
  }

  getStatus() {
    return { ...this.status };
  }
}

export async function createWakeEngine(settings = {}) {
  const engine = normalizeEngineName(settings.engine ?? DEFAULT_ENGINE);
  const importEngine = ENGINE_IMPORTERS[engine];

  if (!importEngine) {
    throwEngineNotFound(engine);
  }

  try {
    const module = await importEngine();
    const EngineClass = module.default ?? module.OpenWakeWordEngine ?? module.WakeEngine;
    if (typeof EngineClass !== "function") {
      throwEngineNotFound(engine);
    }
    return new EngineClass({ ...settings, engine });
  } catch (error) {
    if (engine === DEFAULT_ENGINE && isMissingModule(error, OPENWAKEWORD_MODULE_URL)) {
      return new WakeEngine({ ...settings, engine });
    }
    throw error;
  }
}

function normalizeEngineName(engine) {
  return typeof engine === "string" ? engine.trim().toLowerCase() : "";
}

function throwEngineNotFound(engine) {
  throw new WakeError(`Wake engine not found: ${engine || "(empty)"}`, {
    code: "ENGINE_NOT_FOUND",
  });
}

function isMissingModule(error, moduleUrl) {
  if (!error || typeof error !== "object") {
    return false;
  }
  if (error.code !== "ERR_MODULE_NOT_FOUND" && error.code !== "MODULE_NOT_FOUND") {
    return false;
  }
  const expectedUrl = moduleUrl.href;
  const expectedPath = fileURLToPath(moduleUrl);
  return error.url === expectedUrl || String(error.message).includes(expectedPath);
}
