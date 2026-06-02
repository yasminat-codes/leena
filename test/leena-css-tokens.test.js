import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const cssPath = join(rootDir, "src", "renderer", "leena.css");
const indexPath = join(rootDir, "src", "renderer", "index.html");
const css = readFileSync(cssPath, "utf8");
const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");

const rootTokens = [
  "--cream",
  "--peach",
  "--violet",
  "--indigo",
  "--font-display",
  "--font-body",
  "--font-mono",
  "--r-inner",
  "--r-win",
  "--r-card",
  "--r-panel",
  "--r-pill",
  "--ease-standard",
  "--ease-out",
  "--dur-micro",
  "--dur-base",
  "--dur-move",
  "--dur-orb",
];

const treatmentTokens = [
  "--grad-1",
  "--grad-2",
  "--grad-hi",
  "--accent",
  "--accent-soft",
  "--accent-dk",
  "--orb-a",
  "--orb-b",
  "--orb-c",
];

const themeTokens = [
  "--bg",
  "--bg-2",
  "--surface",
  "--surface-2",
  "--side-glass",
  "--glass",
  "--glass-bd",
  "--glass-hi",
  "--glass-sheen",
  "--text",
  "--text-dim",
  "--text-faint",
  "--border",
  "--border-2",
  "--chip",
  "--on-grad",
  "--on-grad-dim",
  "--on-grad-faint",
  "--shadow",
  "--wall",
];

const densityTokens = ["--pad", "--gap", "--row"];

function extractRuleBody(source, selector) {
  const block = collectCssBlocks(source).find((candidate) => {
    return candidate.prelude
      .split(",")
      .map((part) => part.trim())
      .includes(selector);
  });

  assert.ok(block, `Missing selector ${selector}`);
  return source.slice(block.start, block.end);
}

function assertHasProperties(body, properties, context) {
  for (const property of properties) {
    assert.match(body, new RegExp(`${property.replaceAll("-", "\\-")}\\s*:`), context);
  }
}

function assertIncludesAll(body, needles, context) {
  for (const needle of needles) {
    assert.ok(body.includes(needle), `${context} missing ${needle}`);
  }
}

function collectCssBlocks(source) {
  const blocks = [];
  const stack = [];
  let preludeStart = 0;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      const prelude = source.slice(preludeStart, index).trim();
      stack.push({ prelude, start: index + 1 });
      preludeStart = index + 1;
    } else if (char === "}") {
      const block = stack.pop();
      assert.ok(block, "Unbalanced CSS closing brace");
      blocks.push({ ...block, end: index });
      preludeStart = index + 1;
    }
  }

  assert.equal(stack.length, 0, "CSS has unbalanced opening braces");
  return blocks;
}

test("leena.css defines all root design tokens", () => {
  const rootBody = extractRuleBody(cssWithoutComments, ":root");

  assertHasProperties(rootBody, rootTokens, ":root token block");
  assertIncludesAll(
    rootBody,
    [
      '--font-display: "UlmGrotesk", system-ui, sans-serif',
      '--font-body: "Gellix", system-ui, sans-serif',
      '--font-mono: "Roboto Mono", ui-monospace, monospace',
      "--dur-base: 200ms",
    ],
    ":root font tokens",
  );
});

test("leena wrapper cross-fades wallpaper background over 200ms", () => {
  const body = extractRuleBody(cssWithoutComments, ".leena");

  assertIncludesAll(
    body,
    ["background: var(--wall)", "transition: background var(--dur-base) var(--ease-out)"],
    ".leena",
  );
});

test("visible wallpaper surfaces cross-fade background over 200ms", () => {
  for (const selector of [".leena-page", ".win"]) {
    const body = extractRuleBody(cssWithoutComments, selector);

    assertIncludesAll(
      body,
      ["background: var(--wall)", "transition: background var(--dur-base) var(--ease-out)"],
      selector,
    );
  }
});

test("every treatment defines gradient, accent, and orb tokens", () => {
  for (const treatment of ["aurora", "coral", "iris"]) {
    const selector = `.leena[data-treatment="${treatment}"]`;
    const body = extractRuleBody(cssWithoutComments, selector);

    assertHasProperties(body, treatmentTokens, selector);
  }
});

test("every theme defines surface, text, glass, shadow, and wallpaper tokens", () => {
  for (const theme of ["light", "dark", "vercel-dark"]) {
    const selector = `.leena[data-theme="${theme}"]`;
    const body = extractRuleBody(cssWithoutComments, selector);

    assertHasProperties(body, themeTokens, selector);
    assert.match(body, /--wall\s*:[\s\S]*radial-gradient/, `${selector} defines wallpaper`);
  }
});

test("every density defines spacing tokens", () => {
  for (const density of ["compact", "comfortable"]) {
    const selector = `.leena[data-density="${density}"]`;
    const body = extractRuleBody(cssWithoutComments, selector);

    assertHasProperties(body, densityTokens, selector);
  }
});

test("component class bodies include the expected design-system properties", () => {
  const expected = new Map([
    [".card", ["background:", "backdrop-filter:", "border-radius: var(--r-card)", "box-shadow:"]],
    [
      ".panel-glass",
      ["overflow: hidden", "backdrop-filter:", "border-radius: var(--r-panel)", "box-shadow:"],
    ],
    [".btn", ["display: inline-flex", "height: 38px", "border-radius: var(--r-pill)"]],
    [".btn--primary", ["background: var(--accent)", "color: var(--white)"]],
    [".btn--ghost", ["background: var(--surface-2)", "border-color: var(--border)"]],
    [".btn--grad", ["linear-gradient(120deg, var(--grad-1), var(--grad-2))"]],
    [".chip", ["font-family: var(--font-mono)", "text-transform: uppercase"]],
    [".dot", ["width: 6px", "border-radius: 50%"]],
    [".nav-item", ["height: 34px", "gap: 11px", "color: var(--text-dim)"]],
    [".nav-item--active", ["background: var(--accent-soft)", "color: var(--accent)"]],
    [".badge", ["margin-left: auto", "font-family: var(--font-mono)"]],
    [".kbd", ["font-family: var(--font-mono)", "box-shadow: 0 1px 0 var(--border)"]],
    [".tooldot", ["width: 34px", "display: grid", "place-items: center"]],
    [".row", ["gap: 12px", "border-radius: var(--r-inner)", "background: var(--surface-2)"]],
    [".row__txt", ["min-width: 0"]],
    [".orb", ["border-radius: 50%", "var(--orb-a)", "var(--orb-b)", "var(--orb-c)"]],
    [".orb__ring", ["inset: -10px", "border: 1.5px solid var(--orb-b)"]],
    [".wave", ["display: flex", "color: var(--accent)"]],
    [".grad", ["linear-gradient(157deg, var(--grad-1) -8%, var(--grad-2) 86%)"]],
    [".icon-btn", ["width: 32px", "height: 32px", "background: var(--surface-2)"]],
  ]);

  for (const [selector, needles] of expected) {
    const body = extractRuleBody(cssWithoutComments, selector);
    assertIncludesAll(body, needles, selector);
  }
});

test("type scale classes are present with their font contracts", () => {
  const expected = new Map([
    [".lx-display", ["font-family: var(--font-display)", "font-size: 48px"]],
    [".lx-h1", ["font-family: var(--font-display)", "font-size: 30px"]],
    [".lx-h2", ["font-family: var(--font-display)", "font-size: 21px"]],
    [".lx-h3", ["font-family: var(--font-display)", "font-size: 16px"]],
    [".lx-body", ["font-family: var(--font-body)", "font-size: 14px"]],
    [".lx-sm", ["font-family: var(--font-body)", "font-size: 12.5px"]],
    [
      ".lx-mono",
      ["font-family: var(--font-mono)", "font-size: 10.5px", "text-transform: uppercase"],
    ],
  ]);

  for (const [selector, needles] of expected) {
    const body = extractRuleBody(cssWithoutComments, selector);
    assertIncludesAll(body, needles, selector);
  }
});

test("hardcoded hex values only appear in root or data-token selector blocks", () => {
  const blocks = collectCssBlocks(cssWithoutComments);
  const allowedBlocks = blocks.filter((block) => {
    return block.prelude.includes(":root") || /\[data-[^\]]+\]/.test(block.prelude);
  });
  const hexPattern = /#[0-9a-fA-F]{3,8}\b/g;
  const matches = [...cssWithoutComments.matchAll(hexPattern)];

  assert.ok(matches.length > 0, "Expected token hex values to be present");

  for (const match of matches) {
    const index = match.index ?? 0;
    const allowed = allowedBlocks.some((block) => block.start <= index && index < block.end);
    assert.ok(allowed, `${match[0]} is outside a token block`);
  }
});

test("reduced motion media query disables animation and transition timing", () => {
  assert.match(cssWithoutComments, /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/);
  assert.match(cssWithoutComments, /transition-duration:\s*0\.001ms/);
  assert.match(cssWithoutComments, /animation:\s*none/);
});

test("index.html imports leena.css before styles.css and mounts the leena wrapper", () => {
  const html = readFileSync(indexPath, "utf8");
  const leenaImport = html.indexOf('href="./leena.css"');
  const stylesImport = html.indexOf('href="./styles.css"');

  assert.ok(leenaImport > -1, "index.html imports leena.css");
  assert.ok(stylesImport > -1, "index.html imports styles.css");
  assert.ok(leenaImport < stylesImport, "leena.css is imported before styles.css");
  assert.match(html, /class="leena app-shell"/);
  assert.match(html, /data-theme="(?:light|dark|vercel-dark)"/);
  assert.match(html, /data-treatment="(?:aurora|coral|iris)"/);
  assert.match(html, /data-density="(?:compact|comfortable)"/);
});
