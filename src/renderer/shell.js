import { renderActivity } from "./screens/activity.js";
import { renderChat } from "./screens/chat.js";
import { renderHome } from "./screens/home.js";
import { renderIntegrations } from "./screens/integrations.js";
import {
  bindSettingsControls,
  loadAppearancePreferences,
  renderSettings,
} from "./screens/settings.js";
import { refreshTasksScreen, renderTasks } from "./screens/tasks.js";

const screens = Object.freeze(["Home", "Chat", "Activity", "Tasks", "Integrations", "Settings"]);

const screenRenderers = Object.freeze({
  Activity: renderActivity,
  Chat: renderChat,
  Home: renderHome,
  Integrations: renderIntegrations,
  Settings: renderSettings,
  Tasks: renderTasks,
});

function getRoot(root) {
  if (root) {
    return root;
  }
  return typeof document === "undefined" ? null : document;
}

function normalizeScreenName(name) {
  const candidate = String(name ?? "")
    .trim()
    .toLowerCase();
  const screen = screens.find((item) => item.toLowerCase() === candidate);
  if (!screen) {
    throw new Error(`Unknown screen: ${name}`);
  }
  return screen;
}

function formatShellDate(date = new Date()) {
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
  const monthDay = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
  return `${weekday} · ${monthDay}`;
}

export function setActiveScreen(name, root) {
  const screen = normalizeScreenName(name);
  const doc = getRoot(root);

  if (!doc?.querySelectorAll) {
    return screen;
  }

  for (const node of doc.querySelectorAll(".nav-item")) {
    const isActive = node.dataset.screen === screen;
    node.classList.toggle("nav-item--active", isActive);
    if (isActive) {
      node.setAttribute("aria-current", "page");
    } else {
      node.removeAttribute("aria-current");
    }
  }

  const title = doc.querySelector("#shell-title");
  if (title) {
    title.textContent = screen;
  }

  const content = doc.querySelector("#shell-content");
  if (content) {
    content.innerHTML = screenRenderers[screen]();
    if (screen === "Tasks") {
      void refreshTasksScreen(doc).catch(() => {
        /* Initial render remains usable if the planner bridge is unavailable. */
      });
    }
    if (screen === "Settings") {
      bindSettingsControls(doc);
    }
  }

  return screen;
}

export function initShell(root) {
  const doc = getRoot(root);
  if (!doc?.querySelectorAll) {
    return null;
  }

  loadAppearancePreferences(doc);

  for (const node of doc.querySelectorAll(".nav-item")) {
    node.addEventListener("click", () => setActiveScreen(node.dataset.screen, doc));
  }

  const dateLabel = doc.querySelector("#shell-date");
  if (dateLabel) {
    dateLabel.textContent = formatShellDate();
  }

  setActiveScreen("Home", doc);
  return { setActiveScreen: (name) => setActiveScreen(name, doc) };
}

export const shellScreens = screens;
