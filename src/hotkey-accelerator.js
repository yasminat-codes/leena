export const DEFAULT_HOTKEY_ACCELERATOR = "CommandOrControl+Shift+L";
export const HOTKEY_SETTING_KEY = "hotkey";

const MODIFIER_ALIASES = new Map([
  ["cmd", "CommandOrControl"],
  ["command", "CommandOrControl"],
  ["commandorcontrol", "CommandOrControl"],
  ["cmdorctrl", "CommandOrControl"],
  ["cmdorcontrol", "CommandOrControl"],
  ["ctrlorcommand", "CommandOrControl"],
  ["meta", "CommandOrControl"],
  ["control", "Control"],
  ["ctrl", "Control"],
  ["option", "Alt"],
  ["alt", "Alt"],
  ["shift", "Shift"],
]);

const KEY_ALIASES = new Map([
  ["escape", "Escape"],
  ["esc", "Escape"],
  ["enter", "Enter"],
  ["return", "Enter"],
  ["space", "Space"],
  ["spacebar", "Space"],
  ["tab", "Tab"],
  ["backspace", "Backspace"],
  ["delete", "Delete"],
  ["del", "Delete"],
  ["up", "Up"],
  ["down", "Down"],
  ["left", "Left"],
  ["right", "Right"],
]);

const DISPLAY_ALIASES = new Map([
  ["CommandOrControl", "Cmd"],
  ["Command", "Cmd"],
  ["Control", "Ctrl"],
  ["Alt", "Option"],
]);

const MODIFIERS = new Set([
  "CommandOrControl",
  "Command",
  "Control",
  "Alt",
  "Shift",
  "Super",
  "Meta",
]);

const REQUIRED_GLOBAL_MODIFIERS = new Set([
  "CommandOrControl",
  "Command",
  "Control",
  "Alt",
  "Super",
  "Meta",
]);

export function normalizeHotkeyAccelerator(accelerator) {
  if (typeof accelerator !== "string") {
    throw new Error("Hotkey accelerator must be a string.");
  }

  const parts = accelerator
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(normalizeAcceleratorPart);

  if (parts.length === 0) {
    throw new Error("Hotkey accelerator is required.");
  }

  if (!parts.some((part) => !MODIFIERS.has(part))) {
    throw new Error("Hotkey must include a key.");
  }

  if (!parts.some((part) => REQUIRED_GLOBAL_MODIFIERS.has(part))) {
    throw new Error("Hotkey must include Command, Control, or Option.");
  }

  return parts.join("+");
}

export function formatHotkeyAccelerator(accelerator = DEFAULT_HOTKEY_ACCELERATOR) {
  try {
    return normalizeHotkeyAccelerator(accelerator)
      .split("+")
      .map((part) => DISPLAY_ALIASES.get(part) ?? part)
      .join("+");
  } catch {
    return String(accelerator ?? "");
  }
}

function normalizeAcceleratorPart(part) {
  const lowerPart = part.toLowerCase();
  const modifier = MODIFIER_ALIASES.get(lowerPart);

  if (modifier) {
    return modifier;
  }

  const keyAlias = KEY_ALIASES.get(lowerPart);

  if (keyAlias) {
    return keyAlias;
  }

  if (/^[a-z0-9]$/i.test(part)) {
    return part.toUpperCase();
  }

  if (/^f\d{1,2}$/i.test(part)) {
    return part.toUpperCase();
  }

  return part;
}
