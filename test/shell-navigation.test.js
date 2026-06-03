import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { setActiveScreen, shellScreens } from "../src/renderer/shell.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sidebarOrder = Object.freeze([
  "Home",
  "Chat",
  "Activity",
  "Tasks",
  "Integrations",
  "Settings",
]);

test("shell screens preserve the approved sidebar order", () => {
  assert.deepEqual(shellScreens, sidebarOrder);
});

test("static sidebar markup preserves the approved sidebar order", () => {
  const indexHtml = readFileSync(join(__dirname, "../src/renderer/index.html"), "utf8");
  const navScreens = [
    ...indexHtml.matchAll(
      /<button\b[^>]*class="[^"]*\bnav-item\b[^"]*"[^>]*data-screen="([^"]+)"/gms,
    ),
  ].map((match) => match[1]);

  assert.deepEqual(navScreens, sidebarOrder);
});

test("setActiveScreen returns the normalized screen name", () => {
  assert.equal(setActiveScreen("home"), "Home");
  assert.equal(setActiveScreen("chat"), "Chat");
});

test("setActiveScreen accepts each shell nav item name without a DOM", () => {
  for (const screen of shellScreens) {
    assert.equal(setActiveScreen(screen), screen);
  }
});
