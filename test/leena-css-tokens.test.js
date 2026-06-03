import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const cssPath = join(rootDir, "src", "renderer", "leena.css");
const commandCenterCssPath = join(rootDir, "src", "renderer", "components", "command-center.css");
const indexPath = join(rootDir, "src", "renderer", "index.html");
const css = readFileSync(cssPath, "utf8");
const commandCenterCss = readFileSync(commandCenterCssPath, "utf8");
const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
const commandCenterCssWithoutComments = commandCenterCss.replace(/\/\*[\s\S]*?\*\//g, "");

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
  "--r-sculpt",
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
  "--command-shadow",
  "--home-command-shadow",
  "--orb-signal",
  "--orb-shadow",
  "--orb-inner-highlight",
  "--orb-inner-shade",
  "--orb-ring-color",
  "--orb-ring-opacity",
  "--orb-well-background",
  "--orb-well-shadow",
  "--traffic-light-rail",
  "--traffic-light-border",
  "--traffic-light-glint",
  "--traffic-close-shadow",
  "--traffic-minimize-shadow",
  "--traffic-zoom-shadow",
  "--wall",
];

const densityTokens = ["--pad", "--gap", "--row"];
const themeValues = ["workspace", "light", "dark", "vercel-dark"];
const treatmentValues = ["workspace", "aurora", "coral", "iris"];

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

function extractExactRuleBody(source, selector) {
  const block = collectCssBlocks(source).find((candidate) => candidate.prelude.trim() === selector);

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

function extractDeclarationValue(body, property) {
  const escapedProperty = property.replaceAll("-", "\\-");
  const match = body.match(new RegExp(`${escapedProperty}\\s*:\\s*([\\s\\S]*?);`));

  assert.ok(match, `Missing declaration ${property}`);
  return match[1].trim();
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
      '--font-display: "Gellix", system-ui, sans-serif',
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
  for (const treatment of treatmentValues) {
    const selector = `.leena[data-treatment="${treatment}"]`;
    const body = extractRuleBody(cssWithoutComments, selector);

    assertHasProperties(body, treatmentTokens, selector);
  }
});

test("default aurora treatment uses neutral premium tokens instead of purple AI glow", () => {
  const body = extractRuleBody(cssWithoutComments, '.leena[data-treatment="aurora"]');

  assertIncludesAll(
    body,
    ["--grad-1: #d8dee9", "--grad-2: #0a0d12", "--accent: #1d9bf0", "--orb-c: #111723"],
    "aurora premium neutral treatment",
  );
  assert.doesNotMatch(body, /#9a7bff|#1a0578|#6b3df5|#2a0a9c/i);
});

test("workspace treatment matches the teal and paper reference palette", () => {
  const body = extractRuleBody(cssWithoutComments, '.leena[data-treatment="workspace"]');

  assertIncludesAll(
    body,
    ["--grad-1: #f7f5ed", "--grad-2: #0b3432", "--accent: #0b3432", "--orb-c: #0b3432"],
    "workspace treatment",
  );
});

test("every theme defines surface, text, glass, shadow, and wallpaper tokens", () => {
  for (const theme of themeValues) {
    const selector = `.leena[data-theme="${theme}"]`;
    const body = extractRuleBody(cssWithoutComments, selector);

    assertHasProperties(body, themeTokens, selector);
    assert.match(body, /--wall\s*:[\s\S]*radial-gradient/, `${selector} defines wallpaper`);
  }
});

test("appearance theme and treatment selector values stay stable", () => {
  const blocks = collectCssBlocks(cssWithoutComments);
  const themes = blocks
    .map((block) => block.prelude.match(/^\.leena\[data-theme="([^"]+)"\]$/)?.[1])
    .filter(Boolean);
  const treatments = blocks
    .map((block) => block.prelude.match(/^\.leena\[data-treatment="([^"]+)"\]$/)?.[1])
    .filter(Boolean);

  assert.deepEqual(themes, ["light", "workspace", "dark", "vercel-dark"]);
  assert.deepEqual(treatments, ["aurora", "workspace", "coral", "iris"]);
});

test("default dark theme is graphite neutral, not lavender purple", () => {
  const body = extractRuleBody(cssWithoutComments, '.leena[data-theme="dark"]');

  assertIncludesAll(
    body,
    ["--bg: #050505", "--text: #f4f4f5", "rgba(108, 166, 255, 0.12)"],
    "dark premium neutral theme",
  );
  assert.doesNotMatch(body, /#0a0912|#f1ecff|24,\s*3,\s*127|20,\s*4,\s*80/i);
});

test("workspace theme uses off-white as the dominant shell color with teal accents", () => {
  const body = extractRuleBody(cssWithoutComments, '.leena[data-theme="workspace"]');

  assertIncludesAll(
    body,
    ["--bg: #fbf8ef", "--surface: #fffdfa", "--surface-2: #f0f5f0", "--text: #0b2624"],
    "workspace theme",
  );
  assert.match(body, /linear-gradient\(135deg,\s*#fbf8ef,\s*#f2eee4\)/);
});

test("workspace orb and home command use restrained theme-aware shadow tokens", () => {
  const workspaceTheme = extractRuleBody(cssWithoutComments, '.leena[data-theme="workspace"]');
  const orbBody = extractRuleBody(cssWithoutComments, ".orb");
  const workspaceOrbBody = extractRuleBody(
    cssWithoutComments,
    '.leena[data-theme="workspace"] .orb',
  );
  const homeSurfaceBody = extractRuleBody(cssWithoutComments, ".home-command__surface");
  const homeSurfaceWorkspaceBody = extractRuleBody(
    cssWithoutComments,
    '.leena[data-theme="workspace"] .home-command__surface',
  );
  const orbWellBody = extractRuleBody(cssWithoutComments, ".home-command__orb-well");
  const workspaceOrbShadow = extractDeclarationValue(workspaceTheme, "--orb-shadow");
  const workspaceHomeShadow = extractDeclarationValue(workspaceTheme, "--home-command-shadow");

  assertIncludesAll(
    orbBody,
    [
      "var(--orb-signal)",
      "linear-gradient(145deg, var(--orb-b), var(--orb-c))",
      "box-shadow: var(--orb-shadow)",
    ],
    ".orb tokenized material",
  );
  assertIncludesAll(workspaceOrbBody, ["box-shadow: var(--orb-shadow)"], "workspace orb");
  assertIncludesAll(homeSurfaceBody, ["box-shadow: var(--home-command-shadow)"], "home surface");
  assertIncludesAll(
    homeSurfaceWorkspaceBody,
    ["box-shadow: var(--home-command-shadow)"],
    "workspace home surface",
  );
  assertIncludesAll(
    orbWellBody,
    ["background: var(--orb-well-background)", "box-shadow: var(--orb-well-shadow)"],
    "orb well",
  );
  assertIncludesAll(
    workspaceTheme,
    [
      "--orb-signal: rgba(7, 91, 85, 0.16)",
      "0 10px 28px -24px rgba(8, 42, 39, 0.26)",
      "0 20px 48px -38px rgba(8, 42, 39, 0.22)",
    ],
    "workspace restrained orb shadows",
  );
  assert.doesNotMatch(workspaceOrbShadow, /rgba\(8,\s*42,\s*39,\s*0\.(?:3[1-9]|[4-9]\d)\)/);
  assert.doesNotMatch(
    workspaceHomeShadow,
    /0\s+28px\s+64px\s+-42px\s+rgba\(8,\s*42,\s*39,\s*0\.52\)/,
  );
});

test("traffic lights use aligned tokenized materials", () => {
  const railBody = extractRuleBody(cssWithoutComments, ".win__lights");
  const lightBody = extractRuleBody(cssWithoutComments, ".win__lights i");
  const glintBody = extractRuleBody(cssWithoutComments, ".win__lights i::after");

  assertIncludesAll(
    railBody,
    [
      "align-items: center",
      "gap: 7px",
      "min-height: 18px",
      "border-radius: var(--r-pill)",
      "background: var(--traffic-light-rail)",
    ],
    "traffic light rail",
  );
  assertIncludesAll(
    lightBody,
    [
      "width: 11px",
      "height: 11px",
      "border: 1px solid var(--traffic-light-border)",
      "border-radius: var(--r-round)",
    ],
    "traffic light dot",
  );
  assertIncludesAll(
    glintBody,
    ["width: 3px", "height: 3px", "background: var(--traffic-light-glint)"],
    "traffic light glint",
  );

  for (const [selector, shadowToken] of [
    [".win__lights i:nth-child(1)", "--traffic-close-shadow"],
    [".win__lights i:nth-child(2)", "--traffic-minimize-shadow"],
    [".win__lights i:nth-child(3)", "--traffic-zoom-shadow"],
  ]) {
    const body = extractRuleBody(cssWithoutComments, selector);

    assertIncludesAll(
      body,
      [
        "radial-gradient(circle at 32% 28%, var(--traffic-light-glint)",
        `box-shadow: var(${shadowToken})`,
      ],
      selector,
    );
  }
});

test("home suggested slot reserves its own grid row", () => {
  const homeScreenBody = extractExactRuleBody(cssWithoutComments, ".home-screen");
  const suggestedSlotBody = extractRuleBody(cssWithoutComments, "[data-home-suggested-slot]");
  const recentBody = extractRuleBody(cssWithoutComments, ".home-context--recent");
  const nextBody = extractRuleBody(cssWithoutComments, ".home-context--next");

  assertIncludesAll(
    homeScreenBody,
    ["grid-template-rows: auto auto minmax(0, 1fr)"],
    "home grid rows",
  );
  assertIncludesAll(suggestedSlotBody, ["grid-column: 1", "grid-row: 2"], "home suggested slot");
  assertIncludesAll(recentBody, ["grid-column: 1", "grid-row: 3"], "recent column");
  assertIncludesAll(nextBody, ["grid-column: 2", "grid-row: 2 / span 2"], "up next column");
});

test("command center consumes the shared theme shadow token", () => {
  const body = extractRuleBody(commandCenterCssWithoutComments, ".cc");

  assertIncludesAll(
    body,
    [
      "0 0 0 1px var(--glass-bd, var(--hairline))",
      "var(--command-shadow)",
      "inset 0 1px 0 var(--glass-hi, var(--raised-hover))",
    ],
    ".cc shadow contract",
  );
  assert.doesNotMatch(body, /legacy-command-shadow\)\s+18%/);
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
    [".card", ["background:", "border: 0", "border-radius: var(--r-card)", "box-shadow:"]],
    [
      ".panel-glass",
      ["overflow: hidden", "backdrop-filter:", "border-radius: var(--r-panel)", "box-shadow:"],
    ],
    [".btn", ["display: inline-flex", "height: 30px", "border-radius: var(--r-pill)"]],
    [".btn--primary", ["background: var(--accent)", "color: var(--white)"]],
    [".btn--ghost", ["background: var(--surface-2)", "border-color: var(--border)"]],
    [".btn--grad", ["linear-gradient(", "145deg", "var(--grad-2)"]],
    [".chip", ["font-family: var(--font-mono)", "text-transform: uppercase"]],
    [".dot", ["width: 6px", "border-radius: var(--r-round)"]],
    [".nav-item", ["height: 44px", "width: 44px", "color: var(--text-dim)"]],
    [".nav-item--active", ["background: var(--glass)", "color: var(--text)"]],
    [".badge", ["margin-left: auto", "font-family: var(--font-mono)"]],
    [".kbd", ["font-family: var(--font-mono)", "box-shadow: 0 1px 0 var(--border)"]],
    [".tooldot", ["width: 28px", "display: grid", "place-items: center"]],
    [".row", ["gap: 9px", "border-radius: var(--r-inner)", "background: var(--surface-2)"]],
    [".row__txt", ["min-width: 0"]],
    [
      ".orb",
      [
        "border-radius: var(--r-round)",
        "var(--orb-a)",
        "var(--orb-b)",
        "var(--orb-c)",
        "var(--orb-signal)",
        "box-shadow: var(--orb-shadow)",
      ],
    ],
    [".orb__ring", ["inset: -10px", "border: 1px solid var(--orb-ring-color)"]],
    [".wave", ["display: flex", "color: var(--accent)"]],
    [".grad", ["linear-gradient(", "157deg", "var(--grad-2) 86%"]],
    [".icon-btn", ["width: 28px", "height: 28px", "background: var(--surface-2)"]],
  ]);

  for (const [selector, needles] of expected) {
    const body = extractRuleBody(cssWithoutComments, selector);
    assertIncludesAll(body, needles, selector);
  }
});

test("type scale classes are present with their font contracts", () => {
  const expected = new Map([
    [".lx-display", ["font-family: var(--font-display)", "font-size: 25px"]],
    [".lx-h1", ["font-family: var(--font-display)", "font-size: 22px"]],
    [".lx-h2", ["font-family: var(--font-display)", "font-size: 16.5px"]],
    [".lx-h3", ["font-family: var(--font-display)", "font-size: 13.5px"]],
    [".lx-body", ["font-family: var(--font-body)", "font-size: 13px"]],
    [".lx-sm", ["font-family: var(--font-body)", "font-size: 11.5px"]],
    [
      ".lx-mono",
      ["font-family: var(--font-mono)", "font-size: 9.5px", "text-transform: uppercase"],
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
  assert.match(html, /data-theme="(?:workspace|light|dark|vercel-dark)"/);
  assert.match(html, /data-treatment="(?:workspace|aurora|coral|iris)"/);
  assert.match(html, /data-density="(?:compact|comfortable)"/);
});
