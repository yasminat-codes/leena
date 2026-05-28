import assert from "node:assert/strict";
import test from "node:test";
import {
  executeComputerActions,
  normalizeDragPath,
  normalizeKey,
} from "../src/realtime/tools/computer-use-actions.js";

test("normalizeKey maps common model key names", () => {
  assert.equal(normalizeKey("ENTER"), "Enter");
  assert.equal(normalizeKey("return"), "Enter");
  assert.equal(normalizeKey("ESCAPE"), "Escape");
  assert.equal(normalizeKey("CTRL"), "Control");
  assert.equal(normalizeKey("cmd"), "Meta");
  assert.equal(normalizeKey("arrow-down"), "ArrowDown");
  assert.equal(normalizeKey("Tab"), "Tab");
});

test("normalizeDragPath accepts tuple and object points", () => {
  assert.deepEqual(normalizeDragPath([[1, 2], { x: 3, y: 4 }]), [
    { x: 1, y: 2 },
    { x: 3, y: 4 },
  ]);
  assert.throws(() => normalizeDragPath([{ x: 1, y: 2 }]), /at least two/);
  assert.throws(
    () =>
      normalizeDragPath([
        [1, "bad"],
        [2, 3],
      ]),
    /finite number/,
  );
});

test("executeComputerActions handles mouse, keyboard, wait, and screenshot actions", async () => {
  const calls = [];
  const target = createFakeTarget(calls);

  await executeComputerActions(target, [
    { type: "click", x: 10, y: 20, button: "right" },
    { type: "double_click", x: 30, y: 40 },
    { type: "scroll", x: 50, y: 60, scroll_x: 0, scroll_y: -400 },
    { type: "keypress", keys: ["ENTER", "CTRL"] },
    { type: "type", text: "hello" },
    { type: "wait", ms: 25 },
    { type: "screenshot" },
  ]);

  assert.deepEqual(calls, [
    ["click", 10, 20, { button: "right" }],
    ["dblclick", 30, 40, { button: "left" }],
    ["move", 50, 60],
    ["wheel", 0, -400],
    ["press", "Enter"],
    ["press", "Control"],
    ["type", "hello"],
    ["wait", 25],
  ]);
});

test("executeComputerActions holds and releases modifiers around clicks", async () => {
  const calls = [];
  const target = createFakeTarget(calls);

  await executeComputerActions(target, [
    { type: "click", x: 1, y: 2, keys: ["CTRL", "SHIFT", "A"] },
  ]);

  assert.deepEqual(calls, [
    ["down", "Control"],
    ["down", "Shift"],
    ["click", 1, 2, { button: "left" }],
    ["up", "Shift"],
    ["up", "Control"],
  ]);
});

test("executeComputerActions drags along the normalized path", async () => {
  const calls = [];
  const target = createFakeTarget(calls);

  await executeComputerActions(target, [{ type: "drag", path: [[1, 2], [3, 4], { x: 5, y: 6 }] }]);

  assert.deepEqual(calls, [
    ["move", 1, 2],
    ["mouseDown", { button: "left" }],
    ["move", 3, 4],
    ["move", 5, 6],
    ["mouseUp", { button: "left" }],
  ]);
});

function createFakeTarget(calls) {
  return {
    mouse: {
      click: async (...args) => calls.push(["click", ...args]),
      dblclick: async (...args) => calls.push(["dblclick", ...args]),
      move: async (...args) => calls.push(["move", ...args]),
      down: async (...args) => calls.push(["mouseDown", ...args]),
      up: async (...args) => calls.push(["mouseUp", ...args]),
      wheel: async (...args) => calls.push(["wheel", ...args]),
    },
    keyboard: {
      press: async (...args) => calls.push(["press", ...args]),
      type: async (...args) => calls.push(["type", ...args]),
      down: async (...args) => calls.push(["down", ...args]),
      up: async (...args) => calls.push(["up", ...args]),
    },
    wait: async (...args) => calls.push(["wait", ...args]),
  };
}
