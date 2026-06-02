import assert from "node:assert/strict";
import test from "node:test";

import { setActiveScreen, shellScreens } from "../src/renderer/shell.js";

test("setActiveScreen returns the normalized screen name", () => {
  assert.equal(setActiveScreen("home"), "Home");
});

test("setActiveScreen accepts each shell nav item name without a DOM", () => {
  for (const screen of shellScreens) {
    assert.equal(setActiveScreen(screen), screen);
  }
});
