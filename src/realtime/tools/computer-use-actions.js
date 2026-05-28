const keyAliases = Object.freeze({
  ENTER: "Enter",
  RETURN: "Enter",
  ESC: "Escape",
  ESCAPE: "Escape",
  CTRL: "Control",
  CONTROL: "Control",
  CMD: "Meta",
  COMMAND: "Meta",
  META: "Meta",
  OPTION: "Alt",
  ALT: "Alt",
  SHIFT: "Shift",
  TAB: "Tab",
  SPACE: "Space",
  SPACEBAR: "Space",
  BACKSPACE: "Backspace",
  DELETE: "Delete",
  DEL: "Delete",
  ARROWUP: "ArrowUp",
  UP: "ArrowUp",
  ARROWDOWN: "ArrowDown",
  DOWN: "ArrowDown",
  ARROWLEFT: "ArrowLeft",
  LEFT: "ArrowLeft",
  ARROWRIGHT: "ArrowRight",
  RIGHT: "ArrowRight",
  PAGEUP: "PageUp",
  PAGEDOWN: "PageDown",
  HOME: "Home",
  END: "End",
});

const modifierKeys = new Set(["Alt", "Control", "Meta", "Shift"]);

export function normalizeKey(key) {
  if (typeof key !== "string") {
    throw new Error("Computer key must be a string.");
  }
  const trimmed = key.trim();
  if (!trimmed) {
    throw new Error("Computer key must not be empty.");
  }
  const compact = trimmed.replace(/[\s_-]+/g, "").toUpperCase();
  return keyAliases[compact] ?? trimmed;
}

export function normalizeDragPath(path) {
  if (!Array.isArray(path) || path.length < 2) {
    throw new Error("Drag path must contain at least two points.");
  }
  return path.map((point) => {
    if (Array.isArray(point) && point.length >= 2) {
      return normalizePoint({ x: point[0], y: point[1] });
    }
    return normalizePoint(point);
  });
}

export async function executeComputerActions(target, actions = []) {
  if (!target || typeof target !== "object") {
    throw new Error("Computer action target is unavailable.");
  }
  if (!Array.isArray(actions)) {
    throw new Error("Computer actions must be an array.");
  }

  for (const action of actions) {
    await executeComputerAction(target, action);
  }
}

export async function withModifiers(target, keys = [], callback) {
  const modifiers = normalizeModifierKeys(keys);
  for (const key of modifiers) {
    await target.keyboard.down(key);
  }
  try {
    return await callback();
  } finally {
    for (const key of [...modifiers].reverse()) {
      await target.keyboard.up(key);
    }
  }
}

async function executeComputerAction(target, action) {
  if (!isRecord(action)) {
    throw new Error("Computer action must be an object.");
  }
  const type = typeof action.type === "string" ? action.type : "";
  switch (type) {
    case "click":
      await withModifiers(target, action.keys, async () => {
        await target.mouse.click(getNumber(action.x, "click.x"), getNumber(action.y, "click.y"), {
          button: normalizeMouseButton(action.button),
        });
      });
      break;
    case "double_click":
      await withModifiers(target, action.keys, async () => {
        await target.mouse.dblclick(
          getNumber(action.x, "double_click.x"),
          getNumber(action.y, "double_click.y"),
          {
            button: normalizeMouseButton(action.button),
          },
        );
      });
      break;
    case "drag": {
      const path = normalizeDragPath(action.path);
      await target.mouse.move(path[0].x, path[0].y);
      await target.mouse.down({ button: normalizeMouseButton(action.button) });
      for (const point of path.slice(1)) {
        await target.mouse.move(point.x, point.y);
      }
      await target.mouse.up({ button: normalizeMouseButton(action.button) });
      break;
    }
    case "move":
      await target.mouse.move(getNumber(action.x, "move.x"), getNumber(action.y, "move.y"));
      break;
    case "scroll":
      await target.mouse.move(getNumber(action.x, "scroll.x"), getNumber(action.y, "scroll.y"));
      await target.mouse.wheel(
        getNumber(action.scroll_x ?? 0, "scroll.scroll_x"),
        getNumber(action.scroll_y ?? 0, "scroll.scroll_y"),
      );
      break;
    case "keypress": {
      const keys = Array.isArray(action.keys) ? action.keys : [action.key];
      for (const key of keys) {
        await target.keyboard.press(normalizeKey(key));
      }
      break;
    }
    case "type":
      await target.keyboard.type(typeof action.text === "string" ? action.text : "");
      break;
    case "wait":
      await target.wait(getWaitMs(action));
      break;
    case "screenshot":
      break;
    default:
      throw new Error(`Unsupported computer action type: ${type || "unknown"}`);
  }
}

function normalizePoint(point) {
  if (!isRecord(point)) {
    throw new Error("Drag path point must be [x, y] or { x, y }.");
  }
  return {
    x: getNumber(point.x, "point.x"),
    y: getNumber(point.y, "point.y"),
  };
}

function normalizeModifierKeys(keys) {
  if (!Array.isArray(keys)) {
    return [];
  }
  return keys.map(normalizeKey).filter((key) => modifierKeys.has(key));
}

function normalizeMouseButton(button) {
  return ["left", "right", "middle"].includes(button) ? button : "left";
}

function getWaitMs(action) {
  const value = action.ms ?? action.duration ?? action.duration_ms ?? action.time_ms ?? 1000;
  return Math.max(0, Math.min(30_000, getNumber(value, "wait.ms")));
}

function getNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
