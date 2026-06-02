import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const fontsDir = join(rootDir, "src", "renderer", "assets", "fonts");
const cssPath = join(rootDir, "src", "renderer", "leena.css");
const indexPath = join(rootDir, "src", "renderer", "index.html");
const css = readFileSync(cssPath, "utf8");
const html = readFileSync(indexPath, "utf8");
const fontFaces = [...css.matchAll(/@font-face\s*\{[\s\S]*?\}/g)].map((match) => match[0]);

const expectedFontFiles = [
  "Gellix-Black.woff2",
  "Gellix-BlackItalic.woff2",
  "Gellix-Bold.woff2",
  "Gellix-BoldItalic.woff2",
  "Gellix-ExtraBold.woff2",
  "Gellix-ExtraBoldItalic.woff2",
  "Gellix-Light.woff2",
  "Gellix-LightItalic.woff2",
  "Gellix-Medium.woff2",
  "Gellix-MediumItalic.woff2",
  "Gellix-Regular.woff2",
  "Gellix-RegularItalic.woff2",
  "Gellix-SemiBold.woff2",
  "Gellix-SemiBoldItalic.woff2",
  "Gellix-Thin.woff2",
  "Gellix-ThinItalic.woff2",
  "RobotoMono-Medium.woff2",
  "RobotoMono-Regular.woff2",
  "UlmGrotesk-Bold.ttf",
  "UlmGrotesk-Extrabold.ttf",
  "UlmGrotesk-Regular.ttf",
];

const expectedRuntimeFaces = [
  ["UlmGrotesk", "UlmGrotesk-Regular.ttf", 400, "normal", "truetype"],
  ["UlmGrotesk", "UlmGrotesk-Regular.ttf", 500, "normal", "truetype"],
  ["UlmGrotesk", "UlmGrotesk-Bold.ttf", 700, "normal", "truetype"],
  ["UlmGrotesk", "UlmGrotesk-Extrabold.ttf", 800, "normal", "truetype"],
  ["Gellix", "Gellix-Thin.woff2", 100, "normal", "woff2"],
  ["Gellix", "Gellix-Light.woff2", 300, "normal", "woff2"],
  ["Gellix", "Gellix-Regular.woff2", 400, "normal", "woff2"],
  ["Gellix", "Gellix-Medium.woff2", 500, "normal", "woff2"],
  ["Gellix", "Gellix-SemiBold.woff2", 600, "normal", "woff2"],
  ["Gellix", "Gellix-Bold.woff2", 700, "normal", "woff2"],
  ["Gellix", "Gellix-ExtraBold.woff2", 800, "normal", "woff2"],
  ["Gellix", "Gellix-Black.woff2", 900, "normal", "woff2"],
  ["Gellix", "Gellix-RegularItalic.woff2", 400, "italic", "woff2"],
  ["Gellix", "Gellix-MediumItalic.woff2", 500, "italic", "woff2"],
  ["Gellix", "Gellix-BoldItalic.woff2", 700, "italic", "woff2"],
  ["Roboto Mono", "RobotoMono-Regular.woff2", 400, "normal", "woff2"],
  ["Roboto Mono", "RobotoMono-Medium.woff2", 500, "normal", "woff2"],
];

function assertFontFace({ family, file, weight, style, format }) {
  const block = fontFaces.find((candidate) => {
    return (
      candidate.includes(`font-family: "${family}";`) &&
      candidate.includes(`url("./assets/fonts/${file}") format("${format}")`) &&
      candidate.includes(`font-weight: ${weight};`) &&
      candidate.includes(`font-style: ${style};`)
    );
  });

  assert.ok(block, `Missing @font-face for ${family} ${weight} ${style} using ${file}`);
  assert.ok(block.includes("font-display: swap;"), `${family} ${weight} uses font-display: swap`);
}

test("expected bundled font files exist and are non-empty", () => {
  assert.ok(existsSync(fontsDir), "font asset directory exists");
  assert.deepEqual(readdirSync(fontsDir).sort(), expectedFontFiles);

  for (const file of expectedFontFiles) {
    const fontPath = join(fontsDir, file);
    assert.ok(statSync(fontPath).size > 0, `${file} is non-empty`);
  }
});

test("leena.css registers the local runtime font faces", () => {
  for (const [family, file, weight, style, format] of expectedRuntimeFaces) {
    assertFontFace({ family, file, weight, style, format });
  }

  assert.doesNotMatch(css, /Gellix-ExtraLight/);
  assert.doesNotMatch(css, /font-weight:\s*200\b/);
});

test("index.html uses local font loading only", () => {
  assert.doesNotMatch(html, /fonts\.googleapis\.com/);
  assert.doesNotMatch(html, /fonts\.gstatic\.com/);
  assert.match(html, /style-src 'self';/);
  assert.match(html, /font-src 'self';/);
});
