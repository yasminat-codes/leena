import assert from "node:assert/strict";
import test from "node:test";
import { WakeError } from "../src/utils/errors.js";
import { createWakeEngine, WakeEngine } from "../src/wake/index.js";

test("factory throws WakeError for unknown engines", async () => {
  await assert.rejects(
    () => createWakeEngine({ engine: "porcupine" }),
    (error) => error instanceof WakeError && error.code === "ENGINE_NOT_FOUND",
  );
});

test("factory returns the default openwakeword engine interface", async () => {
  const engine = await createWakeEngine();

  assert.ok(engine instanceof WakeEngine);
  assert.equal(engine.engine, "openwakeword");
});

test("WakeEngine exposes the expected interface shape", async () => {
  const engine = await createWakeEngine({ engine: "openwakeword" });

  assert.equal(typeof engine.start, "function");
  assert.equal(typeof engine.stop, "function");
  assert.equal(typeof engine.setThreshold, "function");
  assert.equal(typeof engine.onDetection, "function");
  assert.equal(typeof engine.getStatus, "function");
});

test("default status fields are false before start", async () => {
  const engine = await createWakeEngine();

  assert.deepEqual(engine.getStatus(), {
    enabled: false,
    muted: false,
    listening: false,
    engineReady: false,
  });
});

test("onDetection accepts callbacks before start", async () => {
  const engine = await createWakeEngine();

  assert.doesNotThrow(() => engine.onDetection(() => {}));
});
