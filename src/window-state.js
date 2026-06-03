import { getSetting, setSetting } from "./settings-store.js";

export const PANEL_WINDOW_STATE_KEY = "window:panel:bounds";
export const PANEL_WINDOW_SAVE_DEBOUNCE_MS = 500;
export const PANEL_WINDOW_VISIBLE_MARGIN = 80;

export const PANEL_WINDOW_CONSTRAINTS = Object.freeze({
  minWidth: 380,
  maxWidth: 1280,
  minHeight: 500,
  maxHeight: 1200,
});

const defaultSettingsStore = Object.freeze({
  getSetting,
  setSetting,
});

export function getWindowModeOptions(mode, modeConfig, constraints = PANEL_WINDOW_CONSTRAINTS) {
  if (mode === "panel") {
    const size = normalizeWindowSize(modeConfig, constraints);
    if (!size) {
      return null;
    }
    return {
      width: size.width,
      height: size.height,
      minWidth: constraints.minWidth,
      maxWidth: constraints.maxWidth,
      minHeight: constraints.minHeight,
      maxHeight: constraints.maxHeight,
      resizable: true,
    };
  }
  const size = normalizeFixedWindowSize(modeConfig);
  if (!size) {
    return null;
  }
  return {
    width: size.width,
    height: size.height,
    minWidth: size.width,
    maxWidth: size.width,
    minHeight: size.height,
    maxHeight: size.height,
    resizable: false,
  };
}

export function loadPanelWindowBounds({
  key = PANEL_WINDOW_STATE_KEY,
  settingsStore = defaultSettingsStore,
  constraints = PANEL_WINDOW_CONSTRAINTS,
} = {}) {
  return normalizeWindowBounds(settingsStore.getSetting(key, null), constraints);
}

export function savePanelWindowBounds(
  bounds,
  {
    key = PANEL_WINDOW_STATE_KEY,
    settingsStore = defaultSettingsStore,
    constraints = PANEL_WINDOW_CONSTRAINTS,
  } = {},
) {
  const normalized = normalizeWindowBounds(bounds, constraints);
  if (!normalized) {
    return null;
  }
  settingsStore.setSetting(key, normalized);
  return normalized;
}

export function resolvePanelWindowBounds({
  savedBounds,
  defaultBounds,
  displays,
  constraints = PANEL_WINDOW_CONSTRAINTS,
  minimumVisiblePixels = PANEL_WINDOW_VISIBLE_MARGIN,
} = {}) {
  const displayList = normalizeDisplays(displays);
  const resolvedDefault = resolveDefaultBounds(defaultBounds, displayList, constraints);
  const normalizedSaved = normalizeWindowBounds(savedBounds, constraints);
  if (
    normalizedSaved &&
    isBoundsVisibleOnAnyDisplay(normalizedSaved, displayList, minimumVisiblePixels)
  ) {
    return normalizedSaved;
  }
  if (normalizedSaved) {
    return centerBoundsInDisplay(resolvedDefault, getPrimaryDisplay(displayList), constraints);
  }
  return resolvedDefault;
}

export function normalizeWindowBounds(value, constraints = PANEL_WINDOW_CONSTRAINTS) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const size = normalizeWindowSize(value, constraints);
  if (!size || !Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    return null;
  }
  return {
    x: Math.round(value.x),
    y: Math.round(value.y),
    ...size,
  };
}

export function isBoundsVisibleOnAnyDisplay(
  bounds,
  displays,
  minimumVisiblePixels = PANEL_WINDOW_VISIBLE_MARGIN,
) {
  const normalizedBounds = normalizeWindowBounds(bounds);
  if (!normalizedBounds) {
    return false;
  }
  return normalizeDisplays(displays).some((display) =>
    hasEnoughIntersection(normalizedBounds, getDisplayWorkArea(display), minimumVisiblePixels),
  );
}

export function centerBoundsInDisplay(bounds, display, constraints = PANEL_WINDOW_CONSTRAINTS) {
  const size = normalizeWindowSize(bounds, constraints) ?? {
    width: constraints.maxWidth,
    height: constraints.minHeight,
  };
  const area = getDisplayWorkArea(display);
  return {
    x: Math.round(area.x + (area.width - size.width) / 2),
    y: Math.round(area.y + (area.height - size.height) / 2),
    ...size,
  };
}

export function createPanelWindowStatePersistence({
  key = PANEL_WINDOW_STATE_KEY,
  settingsStore = defaultSettingsStore,
  constraints = PANEL_WINDOW_CONSTRAINTS,
  debounceMs = PANEL_WINDOW_SAVE_DEBOUNCE_MS,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  let pendingBounds = null;
  let timer = null;

  const savePending = () => {
    if (!pendingBounds) {
      return null;
    }
    const bounds = pendingBounds;
    pendingBounds = null;
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
    return savePanelWindowBounds(bounds, { key, settingsStore, constraints });
  };

  return {
    load() {
      return loadPanelWindowBounds({ key, settingsStore, constraints });
    },
    saveNow(bounds) {
      pendingBounds = null;
      if (timer !== null) {
        clearTimer(timer);
        timer = null;
      }
      return savePanelWindowBounds(bounds, { key, settingsStore, constraints });
    },
    scheduleSave(bounds) {
      const normalized = normalizeWindowBounds(bounds, constraints);
      if (!normalized) {
        return null;
      }
      pendingBounds = normalized;
      if (timer !== null) {
        clearTimer(timer);
      }
      timer = setTimer(() => {
        timer = null;
        savePending();
      }, debounceMs);
      return normalized;
    },
    flush() {
      return savePending();
    },
    cancel() {
      pendingBounds = null;
      if (timer !== null) {
        clearTimer(timer);
        timer = null;
      }
    },
    hasPending() {
      return pendingBounds !== null;
    },
  };
}

function normalizeWindowSize(value, constraints) {
  if (!value || typeof value !== "object") {
    return null;
  }
  if (!Number.isFinite(value.width) || !Number.isFinite(value.height)) {
    return null;
  }
  if (value.width <= 0 || value.height <= 0) {
    return null;
  }
  return {
    width: clampInteger(value.width, constraints.minWidth, constraints.maxWidth),
    height: clampInteger(value.height, constraints.minHeight, constraints.maxHeight),
  };
}

function normalizeFixedWindowSize(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  if (!Number.isFinite(value.width) || !Number.isFinite(value.height)) {
    return null;
  }
  if (value.width <= 0 || value.height <= 0) {
    return null;
  }
  return {
    width: Math.round(value.width),
    height: Math.round(value.height),
  };
}

function resolveDefaultBounds(defaultBounds, displays, constraints) {
  const normalizedDefault = normalizeWindowBounds(defaultBounds, constraints);
  if (normalizedDefault) {
    return normalizedDefault;
  }
  return centerBoundsInDisplay(defaultBounds, getPrimaryDisplay(displays), constraints);
}

function normalizeDisplays(displays) {
  if (!Array.isArray(displays)) {
    return [];
  }
  return displays.filter((display) => getDisplayWorkArea(display));
}

function getPrimaryDisplay(displays) {
  return (
    displays[0] ?? {
      workArea: { x: 0, y: 0, width: 1440, height: 900 },
    }
  );
}

function getDisplayWorkArea(display) {
  const area = display?.workArea ?? display?.bounds;
  if (!area || typeof area !== "object") {
    return null;
  }
  if (
    !Number.isFinite(area.x) ||
    !Number.isFinite(area.y) ||
    !Number.isFinite(area.width) ||
    !Number.isFinite(area.height) ||
    area.width <= 0 ||
    area.height <= 0
  ) {
    return null;
  }
  return area;
}

function hasEnoughIntersection(bounds, area, minimumVisiblePixels) {
  if (!area) {
    return false;
  }
  const overlapWidth =
    Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x);
  const overlapHeight =
    Math.min(bounds.y + bounds.height, area.y + area.height) - Math.max(bounds.y, area.y);
  const requiredWidth = Math.min(minimumVisiblePixels, bounds.width);
  const requiredHeight = Math.min(minimumVisiblePixels, bounds.height);
  return overlapWidth >= requiredWidth && overlapHeight >= requiredHeight;
}

function clampInteger(value, minimum, maximum) {
  return Math.min(Math.max(Math.round(value), minimum), maximum);
}
