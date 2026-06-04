import {
  AGENT_PERSONAS,
  buildWelcomeInstructions,
  normalizeAgentProfile,
  REALTIME_VOICES,
} from "../realtime/prompts.js";
import { initClickSound } from "./click-sound.js";
import { createCommandCenter, demoAllStates } from "./components/command-center.js";
import { normalizeOrbState } from "./components/orb.js";
import { mountOnboarding, shouldShowOnboarding } from "./onboarding.js";
import { createPanelController } from "./panel.js";
import { createRealtimePlaybackTracker, isBenignCancelError } from "./realtime-playback.js";
import {
  createRealtimeResponseCoordinator,
  isActiveResponseConflictError,
} from "./realtime-response-queue.js";
import { createRealtimeToolHandler } from "./realtime-tool-handler.js";
import { SESSION_STATE_EVENTS, SessionStateManager } from "./session-state.js";
import { initShell } from "./shell.js";
import {
  classifyVoiceStartupError,
  runVoiceStartupPreflight,
  VOICE_STARTUP_ACTIONS,
  VOICE_STARTUP_STAGES,
  voiceStartupStageLabel,
} from "./voice-startup-preflight.js";
import { createWaitingSound } from "./waiting-sound.js";

const appShellElement = document.querySelector("#app-shell");
const leenaShellElement = document.querySelector("#leena-shell");
const statusElement = document.querySelector("#status");
const connectOpenAIButton = document.querySelector("#connect-openai");
const menuToggleButton = document.querySelector("#menu-toggle");
const appMenuElement = document.querySelector("#app-menu");
const openAIIndicatorElement = document.querySelector("#openai-indicator");
const micSelectElement = document.querySelector("#mic-select");
const permissionsToggleButton = document.querySelector("#permissions-toggle");
const windowMinimizeButton = document.querySelector("#window-minimize");
const appQuitButton = document.querySelector("#app-quit");
const permissionsPanelElement = document.querySelector("#permissions-panel");
const permissionsBackButton = document.querySelector("#permissions-back");
const permissionsRefreshButton = document.querySelector("#permissions-refresh");
const diagnosticsOpenButton = document.querySelector("#diagnostics-open");
const permissionsListElement = document.querySelector("#permissions-list");
const agentToggleButton = document.querySelector("#agent-toggle");
const agentPanelElement = document.querySelector("#agent-panel");
const agentBackButton = document.querySelector("#agent-back");
const agentFormElement = document.querySelector("#agent-form");
const agentNameInput = document.querySelector("#agent-name");
const agentAboutInput = document.querySelector("#agent-about");
const agentGoalsInput = document.querySelector("#agent-goals");
const agentVoiceSelect = document.querySelector("#agent-voice");
const agentPersonaSelect = document.querySelector("#agent-persona");
const agentStatusElement = document.querySelector("#agent-status");
const callToggleButton = document.querySelector("#call-toggle");
const headerCallButton = document.querySelector("#header-call");
const headerCallLabelElement = document.querySelector("#header-call-label");
const callLabelElement = document.querySelector("#call-label");
const callStageOrbButton = document.querySelector("#call-stage-toggle");
const callEndButton = document.querySelector("#call-end");
const callEndLabelElement = callEndButton.querySelector("span:not(.call-end-glyph)");
const callTimerElement = document.querySelector("#call-timer");
const callWaveCanvas = document.querySelector("#call-wave");
const remoteAudioElement = document.querySelector("#remote-audio");
const toolActivityElement = document.querySelector("#tool-activity");
const toolActivityLabelElement = document.querySelector("#tool-activity-label");

const stoppableTools = new Set(["computer_use_task"]);
const toolActivityLabels = {
  computer_use_task: "Computer use running",
};

let isOpenAIConnected = false;
let peerConnection = null;
let dataChannel = null;
let localStream = null;
// Ephemeral realtime secrets are short-lived; we prefetch one as soon as OpenAI
// connects (and re-prime after each call) so call-start never blocks on the
// client_secret round-trip. The cache holds the last resolved secret, while
// `secretPrefetchPromise` tracks an in-flight request so concurrent callers
// share it instead of minting duplicates.
let prefetchedSecret = null;
let secretPrefetchPromise = null;
let secretPrefetchGeneration = 0;
// Timestamp of the last background prefetch failure; used to back off automatic
// re-prime attempts so a failing endpoint isn't hammered by repeated triggers.
let lastSecretPrefetchFailureAt = 0;
const SECRET_EXPIRY_MARGIN_MS = 10_000;
const SECRET_PREFETCH_COOLDOWN_MS = 5_000;
let audioLevelMonitor = null;
let pendingHangup = false;
let hangupFallbackTimer = null;
const playbackTracker = createRealtimePlaybackTracker();
const responseCoordinator = createRealtimeResponseCoordinator();
const sessionStateManager = new SessionStateManager({ eventSource: window });
const waitingSound = createWaitingSound();
let callTimerInterval = null;
let callStartedAt = 0;
let isCallActive = false;
let agentProfile = normalizeAgentProfile(null);
// Preferred microphone deviceId, or null to follow the system default.
let selectedMicId = null;
// While the welcome greeting plays we mute the mic so laptop speakers can't
// echo it back and trigger a self-reply; this holds the safety-unmute timer.
let welcomeMicGuardTimer = null;
let realtimeConversationId = "";
let realtimeMemoryKeys = new Set();
const realtimeToolHandler = createRealtimeToolHandler({
  executeTool: (name, args) => window.leena.executeRealtimeTool(name, args),
  sendEvent: sendRealtimeDataChannelEvent,
  setMode,
  setStatus,
  onEndCall: requestHangup,
  onToolStart: handleToolStart,
  onToolEnd: handleToolEnd,
});

let commandCenterDemo = null;
let liveCommandCenter = null;
let liveCommandCenterMount = null;
let appRuntimeStarted = false;
let onboardingMount = null;
let shellController = null;
let voiceStartupFailure = null;
let voiceStartupGeneration = 0;
let voiceStartupStage = VOICE_STARTUP_STAGES.starting;
const voiceDockOrbTokenBindings = Object.freeze([
  Object.freeze(["--legacy-nebula-1", "var(--orb-a)"]),
  Object.freeze(["--legacy-nebula-2", "var(--orb-b)"]),
  Object.freeze(["--legacy-nebula-3", "var(--orb-c)"]),
  Object.freeze(["--nebula-1", "var(--orb-a)"]),
  Object.freeze(["--nebula-2", "var(--orb-b)"]),
  Object.freeze(["--nebula-3", "var(--orb-c)"]),
  Object.freeze(["--legacy-accent-bright", "var(--accent)"]),
  Object.freeze(["--accent-bright", "var(--accent)"]),
  Object.freeze(["--legacy-orb-core", "var(--orb-signal)"]),
]);
const voiceDockOrbStateTokens = Object.freeze({
  idle: Object.freeze({
    scale: "0.88",
    levelScale: "0.16",
    brightness: "0.98",
    saturation: "1.35",
  }),
  starting: Object.freeze({
    scale: "0.91",
    levelScale: "0.16",
    brightness: "1.02",
    saturation: "1.42",
  }),
  listening: Object.freeze({
    scale: "0.94",
    levelScale: "0.18",
    brightness: "1.05",
    saturation: "1.52",
  }),
  speaking: Object.freeze({
    scale: "0.98",
    levelScale: "0.2",
    brightness: "1.1",
    saturation: "1.7",
  }),
  tool: Object.freeze({
    scale: "0.92",
    levelScale: "0.14",
    brightness: "1",
    saturation: "1.45",
  }),
  error: Object.freeze({
    scale: "0.9",
    levelScale: "0.08",
    brightness: "0.96",
    saturation: "1.18",
  }),
});

function emitSessionEvent(eventName, payload = {}) {
  window.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
}

function emitSessionState(state, payload = {}) {
  emitSessionEvent(SESSION_STATE_EVENTS.stateChanged, { ...payload, state });
  syncTrayStateForMode(state);
}

function mountLiveCommandCenter() {
  if (liveCommandCenter) {
    return;
  }

  liveCommandCenterMount = document.createElement("div");
  liveCommandCenterMount.className = "command-center-mount";
  appShellElement.append(liveCommandCenterMount);
  liveCommandCenter = createCommandCenter({
    variant: "compact",
    sessionStateManager,
    chat: { bridge: window.leena, eventSource: window.leena },
  });
  liveCommandCenter.mount(liveCommandCenterMount);
  appShellElement.dataset.commandCenter = "live";
}

function destroyLiveCommandCenter() {
  liveCommandCenter?.destroy();
  liveCommandCenter = null;
  liveCommandCenterMount?.remove();
  liveCommandCenterMount = null;
}

function toggleCommandCenterDemo() {
  if (commandCenterDemo) {
    commandCenterDemo.destroy();
    commandCenterDemo.mount?.remove();
    commandCenterDemo = null;
    mountLiveCommandCenter();
    return;
  }

  destroyLiveCommandCenter();
  const mount = document.createElement("div");
  mount.className = "command-center-mount";
  appShellElement.append(mount);
  commandCenterDemo = { ...demoAllStates(mount, { interval: 900 }), mount };
  appShellElement.dataset.commandCenter = "demo";
}

void window.leena.isDevelopment().then((isDevelopment) => {
  if (!isDevelopment) {
    return;
  }

  window.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.key.toLowerCase() === "d") {
      event.preventDefault();
      toggleCommandCenterDemo();
    }
  });
});

// While the agent is busy in a tool call it produces no audio, so fill the
// silence with the looping waiting ambience (fading in/out via waiting-sound).
function handleToolStart(name, args = {}) {
  emitSessionEvent(SESSION_STATE_EVENTS.toolExecuting, { name, args });
  setVoiceOrbState("tool");
  showToolActivity(name);
  // Computer use has its own on-screen indicator (and can run for a long time),
  // so only fill silence with the waiting ambience for normal quick tool calls.
  if (!stoppableTools.has(name)) {
    waitingSound.start();
  }
}

function handleToolEnd(name, result = null) {
  emitSessionEvent(SESSION_STATE_EVENTS.responseComplete, {
    tool: { name, result },
  });
  hideToolActivity(name);
  syncVoiceOrbStateForMode(appShellElement.dataset.mode);
  if (!stoppableTools.has(name)) {
    waitingSound.stop();
  }
}

function showToolActivity(name) {
  setVoiceOrbState("tool");
  if (!stoppableTools.has(name)) {
    return;
  }
  toolActivityLabelElement.textContent = toolActivityLabels[name] ?? "Working…";
  toolActivityElement.hidden = false;
  appShellElement.dataset.toolActivity = "active";
  if (panelController.isOpen()) {
    // Hide the panel synchronously before the window shrinks to the pill so the
    // 440-wide panel content isn't squished into the 226x52 frame mid-resize
    // (which made the computer-use container look deformed).
    void panelController.close({ immediate: true, windowMode: "call" });
  } else {
    void setWindowMode("call");
  }
}

function hideToolActivity(name) {
  if (name && !stoppableTools.has(name)) {
    return;
  }
  toolActivityElement.hidden = true;
  appShellElement.dataset.toolActivity = "idle";
  syncVoiceOrbStateForMode(appShellElement.dataset.mode);
  if (!isCallActive && !panelController.isOpen()) {
    appShellElement.dataset.panel = "open";
    void setWindowMode("panel");
  }
}

async function stopComputerUse() {
  toolActivityLabelElement.textContent = "Stopping…";
  try {
    await window.leena.cancelComputerUse();
  } catch (error) {
    await writeRendererDiagnostic("computer_use.cancel.error", formatRendererError(error));
  }
}

function requestHangup() {
  if (pendingHangup || !peerConnection) {
    return;
  }
  pendingHangup = true;
  setStatus("Ending call…");
  // Prefer to let the model's goodbye response finish (handled on response.done),
  // but guarantee teardown if that event never arrives.
  hangupFallbackTimer = setTimeout(() => {
    void stopCall();
  }, 5000);
}

function setStatus(message) {
  statusElement.textContent = message;
}

function setCallEndLabel(label, ariaLabel = label) {
  callEndLabelElement.textContent = label;
  callEndButton.setAttribute("aria-label", ariaLabel);
}

function resetCallEndLabel() {
  setCallEndLabel("End", "End call");
}

function showVoiceStartupNotice(message) {
  toolActivityLabelElement.textContent = message;
  toolActivityElement.hidden = false;
  appShellElement.dataset.voiceStartup = voiceStartupStage;
}

function hideVoiceStartupNotice() {
  if (appShellElement.dataset.toolActivity !== "active") {
    toolActivityElement.hidden = true;
  }
  delete appShellElement.dataset.voiceStartup;
}

function beginVoiceStartup() {
  voiceStartupGeneration += 1;
  voiceStartupFailure = null;
  voiceStartupStage = VOICE_STARTUP_STAGES.starting;
  resetCallEndLabel();
  showVoiceStartupNotice(voiceStartupStageLabel(voiceStartupStage));
  return voiceStartupGeneration;
}

function isVoiceStartupCurrent(generation) {
  return generation === voiceStartupGeneration && isCallActive;
}

function setVoiceStartupStage(stage, generation) {
  if (!isVoiceStartupCurrent(generation)) {
    return;
  }

  voiceStartupStage = stage;
  const label = voiceStartupStageLabel(stage);
  setStatus(label);
  showVoiceStartupNotice(label);
  emitSessionState("thinking", { connected: true, message: label, phase: stage });
}

function presentVoiceStartupFailure(error, generation) {
  if (!isVoiceStartupCurrent(generation)) {
    return;
  }

  const failure = classifyVoiceStartupError(error, voiceStartupStage);
  voiceStartupFailure = failure;
  voiceStartupStage = failure.stage;
  setStatus(failure.message);
  setMode("failed");
  showVoiceStartupNotice(failure.message);
  setCallEndLabel(failure.actionLabel, `${failure.actionLabel}: ${failure.message}`);
  callEndButton.disabled = false;
  callEndButton.tabIndex = 0;
  emitSessionEvent(SESSION_STATE_EVENTS.error, {
    action: failure.action,
    kind: failure.kind,
    message: failure.message,
    stage: failure.stage,
  });
}

async function handleVoiceStartupFailureAction() {
  if (!voiceStartupFailure) {
    return;
  }

  const failure = voiceStartupFailure;
  if (failure.action === VOICE_STARTUP_ACTIONS.retry) {
    await startCall();
    return;
  }

  if (failure.action === VOICE_STARTUP_ACTIONS.openSettings) {
    await openMicrophoneSettingsForRetry();
    return;
  }

  if (failure.action === VOICE_STARTUP_ACTIONS.configureProvider) {
    await openProviderSettings();
  }
}

async function openMicrophoneSettingsForRetry() {
  const retryFailure = Object.freeze({
    action: VOICE_STARTUP_ACTIONS.retry,
    actionLabel: "Retry",
    kind: voiceStartupFailure?.kind ?? "mic_denied",
    message: "Grant microphone access in macOS settings, then retry voice.",
    stage: VOICE_STARTUP_STAGES.microphone,
  });
  voiceStartupFailure = retryFailure;
  setCallEndLabel(retryFailure.actionLabel, `${retryFailure.actionLabel}: ${retryFailure.message}`);
  showVoiceStartupNotice("Opening microphone settings...");
  setStatus("Opening microphone settings...");

  try {
    await window.leena.openOsPermissionSettings("microphone");
    showVoiceStartupNotice(retryFailure.message);
    setStatus(retryFailure.message);
  } catch (error) {
    const message = `Settings failed: ${error.message}`;
    voiceStartupFailure = Object.freeze({ ...retryFailure, message });
    showVoiceStartupNotice(message);
    setStatus(message);
    await writeRendererDiagnostic("call.microphone.settings_failed", formatRendererError(error));
  }
}

async function openProviderSettings() {
  await stopCall({ prefetchNextSecret: false });
  shellController?.setActiveScreen("Settings");
  setStatus("Configure provider");
}

function setMode(mode) {
  appShellElement.dataset.mode = mode;
  syncVoiceOrbStateForMode(mode);
  syncTrayStateForMode(mode);
}

function setVoiceOrbState(state) {
  const normalized = normalizeOrbState(state);
  const tokens = voiceDockOrbStateTokens[normalized];
  appShellElement.dataset.orbState = normalized;

  for (const element of [callToggleButton, callStageOrbButton, headerCallButton]) {
    if (element) {
      element.dataset.state = normalized;
    }
  }

  for (const surface of getVoiceDockOrbSurfaces()) {
    surface.style.setProperty(
      "--orb-scale",
      `calc(${tokens.scale} + var(--orb-level) * ${tokens.levelScale})`,
    );
    surface.style.setProperty("--orb-brightness", tokens.brightness);
    surface.style.setProperty("--orb-saturation", tokens.saturation);
  }
}

function syncVoiceOrbStateForMode(mode) {
  if (appShellElement.dataset.toolActivity === "active") {
    setVoiceOrbState("tool");
    return;
  }

  setVoiceOrbState(mode);
}

function getVoiceDockOrbSurfaces() {
  return [callToggleButton, callStageOrbButton]
    .map((element) => element?.querySelector?.(".siri-orb") ?? null)
    .filter(Boolean);
}

function bindVoiceDockOrbTokens() {
  for (const surface of getVoiceDockOrbSurfaces()) {
    for (const [property, value] of voiceDockOrbTokenBindings) {
      surface.style.setProperty(property, value);
    }
  }
}

function syncTrayStateForMode(mode) {
  const trayState = trayStateForMode(mode);
  if (!trayState || typeof window.leena.setTrayState !== "function") {
    return;
  }
  void window.leena.setTrayState(trayState).catch((error) => {
    void writeRendererDiagnostic("tray.set_state.error", {
      message: error instanceof Error ? error.message : String(error),
      state: trayState,
    });
  });
}

function trayStateForMode(mode) {
  switch (mode) {
    case "listening":
      return "listening";
    case "speaking":
      return "speaking";
    case "idle":
    case "disconnected":
    case "closed":
    case "failed":
      return "idle";
    default:
      return null;
  }
}

function setMenuOpen(open) {
  appMenuElement.hidden = !open;
  menuToggleButton.setAttribute("aria-expanded", String(open));
}

function toggleMenu() {
  setMenuOpen(appMenuElement.hidden);
}

function setOrbLevel(level) {
  const normalized = Math.max(0, Math.min(level, 1));
  appShellElement.style.setProperty("--orb-level", normalized.toFixed(3));
}

function setOpenAIConnected(connected) {
  isOpenAIConnected = connected;
  connectOpenAIButton.textContent = connected ? "Reconnect OpenAI" : "Connect OpenAI";
  connectOpenAIButton.disabled = false;
  openAIIndicatorElement.textContent = connected ? "Connected" : "Offline";
  openAIIndicatorElement.dataset.connected = String(connected);
  callToggleButton.disabled = !connected;
  headerCallButton.disabled = !connected;
  appShellElement.classList.toggle("is-authorized", connected);
  if (!connected) {
    emitSessionState("idle", { connected: false });
    invalidatePrefetchedSecret();
    setMode("idle");
    setStatus("Connect OpenAI");
  }
}

function setCallActive(active, { inactiveWindowMode = "panel" } = {}) {
  if (isCallActive === active) {
    return;
  }
  isCallActive = active;
  callToggleButton.classList.toggle("is-active", active);
  callToggleButton.setAttribute("aria-pressed", String(active));
  headerCallButton.classList.toggle("is-active", active);
  headerCallButton.setAttribute("aria-pressed", String(active));
  headerCallLabelElement.textContent = active ? "End" : "Call";
  callLabelElement.textContent = active ? "End" : "Call";
  resetCallEndLabel();
  callEndButton.disabled = !active;
  callEndButton.tabIndex = active ? 0 : -1;
  appShellElement.dataset.call = active ? "active" : "idle";
  if (active) {
    startCallTimer();
    void setWindowMode("call");
    void setWindowFocusable(false);
  } else {
    stopCallTimer();
    clearWaveform();
    hideVoiceStartupNotice();
    void setWindowFocusable(true);
    void setWindowMode(inactiveWindowMode);
  }
}

async function setWindowFocusable(focusable) {
  try {
    await window.leena.setWindowFocusable(focusable);
  } catch (error) {
    await writeRendererDiagnostic("window.set_focusable.error", {
      focusable,
      ...formatRendererError(error),
    });
  }
}

async function setWindowMode(mode) {
  try {
    await window.leena.setWindowMode(mode);
  } catch (error) {
    await writeRendererDiagnostic("window.set_mode.error", {
      mode,
      ...formatRendererError(error),
    });
  }
}

function startCallTimer() {
  callStartedAt = Date.now();
  updateCallTimer();
  if (callTimerInterval !== null) {
    clearInterval(callTimerInterval);
  }
  callTimerInterval = setInterval(updateCallTimer, 1000);
}

function stopCallTimer() {
  if (callTimerInterval !== null) {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
  }
  callTimerElement.textContent = "0:00";
}

function updateCallTimer() {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - callStartedAt) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  callTimerElement.textContent = `${minutes}:${String(seconds).padStart(2, "0")}`;
}

async function refreshOpenAIStatus() {
  const status = await window.leena.getOpenAIStatus();
  setOpenAIConnected(status.connected);
  if (status.connected) {
    setStatus("Ready");
    emitSessionState("idle", { connected: true });
    prefetchRealtimeSecret();
  }
}

async function refreshOsPermissions() {
  const permissions = await window.leena.getOsPermissions();
  renderOsPermissions(permissions);
}

async function loadAgentProfile() {
  agentProfile = normalizeAgentProfile(await window.leena.getAgentProfile());
  renderAgentProfile();
}

function populateAgentOptions() {
  agentVoiceSelect.replaceChildren(
    ...REALTIME_VOICES.map((voice) => {
      const option = document.createElement("option");
      option.value = voice;
      option.textContent = voice.charAt(0).toUpperCase() + voice.slice(1);
      return option;
    }),
  );
  agentPersonaSelect.replaceChildren(
    ...Object.entries(AGENT_PERSONAS).map(([key, { label }]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = label;
      return option;
    }),
  );
}

function renderAgentProfile() {
  agentNameInput.value = agentProfile.name;
  agentAboutInput.value = agentProfile.about;
  agentGoalsInput.value = agentProfile.goals.join("\n");
  agentVoiceSelect.value = agentProfile.voice;
  agentPersonaSelect.value = agentProfile.persona;
}

async function saveAgentProfile() {
  const profile = {
    name: agentNameInput.value,
    about: agentAboutInput.value,
    goals: agentGoalsInput.value.split("\n"),
    voice: agentVoiceSelect.value,
    persona: agentPersonaSelect.value,
  };
  agentStatusElement.textContent = "Saving\u2026";
  try {
    agentProfile = normalizeAgentProfile(await window.leena.setAgentProfile(profile));
    agentStatusElement.textContent = "Saved";
    await handleAgentRuntimeConfigChanged(agentProfile);
  } catch (error) {
    agentStatusElement.textContent = `Save failed: ${error.message}`;
  }
}

function renderOsPermissions(permissions) {
  permissionsListElement.replaceChildren(
    ...permissions.map((permission, index) => {
      const item = document.createElement("article");
      item.className = "permission-item";
      item.style.setProperty("--stagger", String(index));

      const title = document.createElement("div");
      title.className = "permission-title";
      const label = document.createElement("span");
      label.textContent = permission.label;
      const status = document.createElement("span");
      status.className = `permission-status${permission.status === "granted" ? " is-granted" : ""}`;
      status.textContent = permission.status;
      title.append(label, status);

      const description = document.createElement("p");
      description.className = "permission-description";
      description.textContent = permission.description;

      const activation = document.createElement("p");
      activation.className = "permission-activation";
      activation.textContent = permission.activation;

      const actions = document.createElement("div");
      actions.className = "permission-actions";
      const requestButton = document.createElement("button");
      requestButton.type = "button";
      requestButton.textContent = "Request";
      requestButton.disabled = permission.status === "unsupported";
      requestButton.addEventListener("click", () => requestOsPermission(permission.id));
      const settingsButton = document.createElement("button");
      settingsButton.type = "button";
      settingsButton.textContent = "Settings";
      settingsButton.addEventListener("click", () => openOsPermissionSettings(permission.id));
      actions.append(requestButton, settingsButton);

      item.append(title, description, activation, actions);
      return item;
    }),
  );
}

async function requestOsPermission(id) {
  setStatus("Requesting permission…");
  try {
    renderOsPermissions(await window.leena.requestOsPermission(id));
    setStatus("Permissions updated");
  } catch (error) {
    setStatus(`Permission failed: ${error.message}`);
  }
}

async function openOsPermissionSettings(id) {
  setStatus("Opening settings…");
  try {
    await window.leena.openOsPermissionSettings(id);
    setStatus("Settings opened");
  } catch (error) {
    setStatus(`Settings failed: ${error.message}`);
  }
}

async function connectOpenAI() {
  connectOpenAIButton.disabled = true;
  callToggleButton.disabled = true;
  headerCallButton.disabled = true;
  setStatus(isOpenAIConnected ? "Reconnecting…" : "Opening browser…");
  setMode("connecting");

  try {
    if (isOpenAIConnected) {
      await stopCall();
      await window.leena.logoutOpenAI();
      setOpenAIConnected(false);
    }
    await window.leena.loginOpenAI();
    setOpenAIConnected(true);
    setMode("idle");
    setStatus("Ready");
    prefetchRealtimeSecret();
  } catch (error) {
    setOpenAIConnected(false);
    setStatus(`Connect failed: ${error.message}`);
  } finally {
    connectOpenAIButton.disabled = false;
    callToggleButton.disabled = !isOpenAIConnected;
    headerCallButton.disabled = !isOpenAIConnected;
  }
}

async function toggleCall() {
  if (peerConnection) {
    await stopCall();
    return;
  }

  await startCall();
}

function secretIsFresh(secret) {
  if (!secret?.value) {
    return false;
  }
  // A secret with no expiry hint is assumed usable; otherwise require it to
  // outlive the margin so we never hand `startCall` an about-to-expire token.
  if (typeof secret.expiresAt !== "number") {
    return true;
  }
  return secret.expiresAt - SECRET_EXPIRY_MARGIN_MS > Date.now();
}

// Best-effort: mint an ephemeral secret ahead of the next call so its network
// round-trip overlaps idle time rather than the call-start critical path.
function prefetchRealtimeSecret() {
  if (!isOpenAIConnected || secretPrefetchPromise || secretIsFresh(prefetchedSecret)) {
    return;
  }
  // Back off automatic re-primes after a recent failure; a user-initiated call
  // still fetches on demand via `consumeRealtimeSecret` (which surfaces errors).
  if (
    lastSecretPrefetchFailureAt &&
    Date.now() - lastSecretPrefetchFailureAt < SECRET_PREFETCH_COOLDOWN_MS
  ) {
    return;
  }
  const startedAt = performance.now();
  const generation = secretPrefetchGeneration;
  secretPrefetchPromise = window.leena
    .createRealtimeSecret()
    .then((secret) => {
      if (generation !== secretPrefetchGeneration) {
        return null;
      }
      prefetchedSecret = secret;
      lastSecretPrefetchFailureAt = 0;
      void writeRendererDiagnostic("call.secret.prefetched", {
        elapsedMs: Math.round(performance.now() - startedAt),
        hasValue: Boolean(secret?.value),
      });
      return secret;
    })
    .catch((error) => {
      // A prefetch failure is non-fatal: `consumeRealtimeSecret` falls back to an
      // on-demand fetch, surfacing any real error there.
      if (generation === secretPrefetchGeneration) {
        prefetchedSecret = null;
        lastSecretPrefetchFailureAt = Date.now();
      }
      void writeRendererDiagnostic("call.secret.prefetch_failed", formatRendererError(error));
      return null;
    })
    .finally(() => {
      if (generation === secretPrefetchGeneration) {
        secretPrefetchPromise = null;
      }
    });
}

// Return a fresh secret for a call, preferring the prefetched one, then any
// in-flight prefetch, and falling back to an on-demand fetch. Ephemeral secrets
// are single-use per call, so the cache is cleared once a secret is taken.
async function consumeRealtimeSecret() {
  const startedAt = performance.now();
  if (secretIsFresh(prefetchedSecret)) {
    const secret = prefetchedSecret;
    prefetchedSecret = null;
    void writeRendererDiagnostic("call.secret.consumed", {
      source: "cache_hit",
      elapsedMs: Math.round(performance.now() - startedAt),
    });
    return secret;
  }
  if (secretPrefetchPromise) {
    const secret = await secretPrefetchPromise;
    if (secretIsFresh(secret)) {
      prefetchedSecret = null;
      void writeRendererDiagnostic("call.secret.consumed", {
        source: "awaited_prefetch",
        elapsedMs: Math.round(performance.now() - startedAt),
      });
      return secret;
    }
  }
  const secret = await window.leena.createRealtimeSecret();
  void writeRendererDiagnostic("call.secret.consumed", {
    source: "on_demand",
    elapsedMs: Math.round(performance.now() - startedAt),
  });
  return secret;
}

// Drop any cached secret when it can no longer be valid (sign-out) or when the
// agent profile that shaped it changed (voice/instructions are baked in).
function invalidatePrefetchedSecret() {
  secretPrefetchGeneration += 1;
  prefetchedSecret = null;
  secretPrefetchPromise = null;
  // Clear the failure cooldown too, so an explicit invalidation (sign-out,
  // profile change) can re-prime immediately rather than waiting it out.
  lastSecretPrefetchFailureAt = 0;
}

async function handleAgentRuntimeConfigChanged(profile = null) {
  if (profile) {
    agentProfile = normalizeAgentProfile(profile);
    renderAgentProfile();
  }
  invalidatePrefetchedSecret();
  const generation = secretPrefetchGeneration;
  prefetchRealtimeSecret();
  await updateActiveRealtimeSession(generation);
}

async function updateActiveRealtimeSession(generation = secretPrefetchGeneration) {
  if (
    dataChannel?.readyState !== "open" ||
    typeof window.leena.createPersonaSessionUpdate !== "function"
  ) {
    return;
  }

  try {
    const update = await window.leena.createPersonaSessionUpdate();
    if (generation !== secretPrefetchGeneration) {
      return;
    }
    if (update?.session) {
      sendRealtimeDataChannelEvent({ session: update.session, type: "session.update" });
    }
  } catch (error) {
    await writeRendererDiagnostic("realtime.session_update.failed", formatRendererError(error));
  }
}

function handleDataChanged(payload = {}) {
  if (payload?.category !== "identity" && payload?.type !== "identity") {
    return;
  }
  void handleAgentRuntimeConfigChanged(null);
}

async function startCall() {
  if (!isOpenAIConnected) {
    setStatus("Connect first");
    return;
  }

  const startupGeneration = beginVoiceStartup();
  callToggleButton.disabled = true;
  headerCallButton.disabled = true;
  // Hide the panel instantly (no fade) before resizing so the UI just
  // disappears rather than morphing through a circle into the call pill.
  if (panelController.isOpen()) {
    await panelController.close({ immediate: true, skipWindowMode: true });
  }
  setCallActive(true);
  setVoiceStartupStage(VOICE_STARTUP_STAGES.starting, startupGeneration);
  setMode("connecting");
  realtimeConversationId = createRealtimeConversationId();
  realtimeMemoryKeys = new Set();
  await writeRendererDiagnostic("call.start", {
    mediaDevicesAvailable: Boolean(navigator.mediaDevices?.getUserMedia),
  });

  try {
    const { secret } = await runVoiceStartupPreflight({
      acquireMicrophone: acquireMicrophoneStream,
      createPeerConnection: () => new RTCPeerConnection(),
      createSecret: consumeRealtimeSecret,
      getProviderStatus: () => window.leena.getOpenAIStatus(),
      onResource: (stage, resource) => {
        if (!isVoiceStartupCurrent(startupGeneration)) {
          disposeVoiceStartupResource(stage, resource);
          return;
        }
        if (stage === VOICE_STARTUP_STAGES.microphone) {
          localStream = resource;
        } else if (stage === VOICE_STARTUP_STAGES.peer) {
          peerConnection = resource;
        }
      },
      onStage: (stage) => setVoiceStartupStage(stage, startupGeneration),
    });
    if (!isVoiceStartupCurrent(startupGeneration)) {
      return;
    }
    await writeRendererDiagnostic("call.secret.created", { hasValue: Boolean(secret?.value) });
    await writeRendererDiagnostic("call.microphone.stream", describeMediaStream(localStream));
    startAudioLevelMonitor(localStream);
    void populateMicDevices();

    dataChannel = peerConnection.createDataChannel("oai-events");
    await writeRendererDiagnostic("call.peer.created", {});

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      remoteAudioElement.srcObject = stream;
      audioLevelMonitor?.setRemoteStream(stream);
    };
    peerConnection.onconnectionstatechange = () => {
      if (!peerConnection) {
        return;
      }
      void writeRendererDiagnostic("call.connection_state", {
        state: peerConnection.connectionState,
      });
      setStatus(formatConnectionState(peerConnection.connectionState));
      if (peerConnection.connectionState === "connected") {
        setMode("listening");
        emitSessionState("listening", { connected: true });
      }
      if (["closed", "disconnected", "failed"].includes(peerConnection.connectionState)) {
        emitSessionState(peerConnection.connectionState, { connected: false });
        void stopCall();
      }
    };
    dataChannel.addEventListener("open", () => {
      void writeRendererDiagnostic("call.data_channel.open", {});
      voiceStartupFailure = null;
      voiceStartupStage = VOICE_STARTUP_STAGES.listening;
      hideVoiceStartupNotice();
      resetCallEndLabel();
      setStatus("Listening");
      setMode("listening");
      emitSessionState("listening", { connected: true });
      sendRealtimeWelcome();
    });
    dataChannel.addEventListener("message", (event) => {
      const realtimeEvent = JSON.parse(event.data);
      // Skip high-frequency streaming deltas so the diagnostic log stays a
      // readable, copy-pasteable record of meaningful events.
      if (!isNoisyRealtimeEvent(realtimeEvent?.type)) {
        void writeRendererDiagnostic("realtime.event", summarizeRealtimeEvent(realtimeEvent));
      }
      void handleRealtimeEvent(realtimeEvent);
    });

    for (const track of localStream.getTracks()) {
      peerConnection.addTrack(track, localStream);
    }
    await writeRendererDiagnostic("call.microphone.tracks_added", describeMediaStream(localStream));

    setVoiceStartupStage(VOICE_STARTUP_STAGES.session, startupGeneration);
    const offer = await peerConnection.createOffer();
    if (!isVoiceStartupCurrent(startupGeneration)) {
      return;
    }
    await peerConnection.setLocalDescription(offer);
    if (!isVoiceStartupCurrent(startupGeneration)) {
      return;
    }

    const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${secret.value}`,
        "Content-Type": "application/sdp",
      },
    });

    if (!sdpResponse.ok) {
      throw new Error(`Realtime call failed (${sdpResponse.status}): ${await sdpResponse.text()}`);
    }

    if (!isVoiceStartupCurrent(startupGeneration)) {
      return;
    }
    await peerConnection.setRemoteDescription({
      type: "answer",
      sdp: await sdpResponse.text(),
    });
    await writeRendererDiagnostic("call.remote_description.set", {
      connectionState: peerConnection.connectionState,
    });

    setStatus("Connecting");
  } catch (error) {
    await writeRendererDiagnostic("call.error", formatRendererError(error));
    await cleanupRealtimeResources({ finalizeMemorySession: true });
    presentVoiceStartupFailure(error, startupGeneration);
  } finally {
    callToggleButton.disabled = !isOpenAIConnected;
    headerCallButton.disabled = !isOpenAIConnected;
  }
}

function disposeVoiceStartupResource(stage, resource) {
  if (stage === VOICE_STARTUP_STAGES.microphone) {
    for (const track of resource?.getTracks?.() ?? []) {
      track.stop();
    }
    return;
  }

  if (stage === VOICE_STARTUP_STAGES.peer && typeof resource?.close === "function") {
    resource.close();
  }
}

async function cleanupRealtimeResources({ finalizeMemorySession = true } = {}) {
  audioLevelMonitor?.stop();
  audioLevelMonitor = null;
  setOrbLevel(0);

  if (dataChannel) {
    dataChannel.close();
    dataChannel = null;
  }

  if (peerConnection) {
    peerConnection.onconnectionstatechange = null;
    peerConnection.ontrack = null;
    peerConnection.close();
    peerConnection = null;
  }

  if (localStream) {
    for (const track of localStream.getTracks()) {
      track.stop();
    }
    localStream = null;
  }

  if (hangupFallbackTimer) {
    clearTimeout(hangupFallbackTimer);
    hangupFallbackTimer = null;
  }
  pendingHangup = false;
  if (welcomeMicGuardTimer !== null) {
    clearTimeout(welcomeMicGuardTimer);
    welcomeMicGuardTimer = null;
  }
  playbackTracker.reset();
  responseCoordinator.reset();
  waitingSound.reset();

  realtimeToolHandler.reset();
  if (finalizeMemorySession) {
    finalizeRealtimeMemorySession();
  }
  hideToolActivity();
  remoteAudioElement.srcObject = null;
}

async function stopCall({ prefetchNextSecret = true } = {}) {
  voiceStartupGeneration += 1;
  voiceStartupFailure = null;
  voiceStartupStage = VOICE_STARTUP_STAGES.starting;
  hideVoiceStartupNotice();
  resetCallEndLabel();
  await cleanupRealtimeResources();
  setCallActive(false, { inactiveWindowMode: "panel" });
  appShellElement.dataset.panel = "open";
  setMode("idle");
  setStatus(isOpenAIConnected ? "Ready" : "Connect OpenAI");
  emitSessionState("idle", { connected: isOpenAIConnected });
  // Re-prime a secret so the next call starts without the client_secret wait.
  if (prefetchNextSecret) {
    prefetchRealtimeSecret();
  }
}

async function handleRealtimeEvent(event) {
  playbackTracker.observe(event);
  void rememberRealtimeExchange(event);
  // The welcome greeting finished playing through the speakers — safe to listen.
  if (welcomeMicGuardTimer !== null && event.type === "output_audio_buffer.stopped") {
    endWelcomeMicGuard();
  }
  const queuedCreate = responseCoordinator.observe(event);
  if (queuedCreate) {
    // The active response just ended; release the create we queued earlier.
    sendRealtimeDataChannelEvent(queuedCreate);
  }
  if (await realtimeToolHandler.handleEvent(event)) {
    return;
  }
  if (event.type === "input_audio_buffer.speech_started") {
    // Ken started talking: cut off any assistant audio immediately rather than
    // waiting for the server VAD round-trip, then return to listening.
    interruptAssistantPlayback();
    setStatus("Listening");
    setMode("listening");
    emitSessionState("listening", { connected: true });
    return;
  }
  if (event.type === "response.created") {
    emitSessionState("thinking", { connected: true });
    return;
  }
  if (event.type === "response.output_audio.delta") {
    setStatus("Speaking");
    setMode("speaking");
    emitSessionState("thinking", { connected: true });
    return;
  }
  if (event.type === "response.done") {
    if (pendingHangup) {
      void stopCall();
      return;
    }
    setStatus("Listening");
    setMode("listening");
    emitSessionEvent(SESSION_STATE_EVENTS.responseComplete, event);
    return;
  }
  if (event.type === "error") {
    // A benign "no active response to cancel" can occur when our manual barge-in
    // races the server VAD's own interrupt; don't surface it as a call error.
    if (isBenignCancelError(event.error)) {
      void writeRendererDiagnostic("realtime.cancel.benign", { code: event.error?.code });
      return;
    }
    // A response.create that raced an already-active response is a recoverable
    // barge-in/VAD race, not a session failure: re-queue it to retry on the
    // next response.done rather than surfacing an error.
    if (isActiveResponseConflictError(event.error)) {
      responseCoordinator.noteActiveResponseConflict();
      void writeRendererDiagnostic("realtime.response_create.conflict", {
        code: event.error?.code,
      });
      return;
    }
    setStatus(event.error?.message ?? "Realtime error");
    setMode("idle");
    emitSessionEvent(SESSION_STATE_EVENTS.error, event);
  }
}

function interruptAssistantPlayback() {
  const events = playbackTracker.interrupt();
  if (events.length === 0) {
    return;
  }
  // Per the OpenAI Realtime WebRTC contract: cancel the in-progress response,
  // then clear the already-buffered output audio so playback stops at once.
  void writeRendererDiagnostic("realtime.barge_in", {
    events: events.map((event) => event.type),
  });
  for (const event of events) {
    sendRealtimeDataChannelEvent(event);
  }
}

function createRealtimeConversationId() {
  return `realtime-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function rememberRealtimeExchange(event) {
  if (!realtimeConversationId || typeof window.leena.memory?.remember !== "function") {
    return;
  }

  const exchange = extractRealtimeExchange(event);
  if (!exchange) {
    return;
  }
  const memoryKey = `${exchange.role}:${exchange.content}`;
  if (realtimeMemoryKeys.has(memoryKey)) {
    return;
  }
  realtimeMemoryKeys.add(memoryKey);

  try {
    await window.leena.memory.remember(exchange.content, {
      conversationId: realtimeConversationId,
      role: exchange.role,
      kind: "realtime_exchange",
      eventType: event.type,
    });
  } catch (error) {
    await writeRendererDiagnostic("memory.realtime.remember_failed", formatRendererError(error));
  }
}

function finalizeRealtimeMemorySession() {
  if (!realtimeConversationId) {
    return;
  }

  const conversationId = realtimeConversationId;
  realtimeConversationId = "";
  realtimeMemoryKeys = new Set();

  if (typeof window.leena.memory?.consolidate !== "function") {
    return;
  }

  void maybeConsolidateRealtimeMemory(conversationId).catch((error) => {
    void writeRendererDiagnostic("memory.realtime.consolidate_failed", formatRendererError(error));
  });
}

async function maybeConsolidateRealtimeMemory(conversationId) {
  if (typeof window.leena.memory?.getConversation === "function") {
    const episodes = await window.leena.memory.getConversation(conversationId);
    if (Array.isArray(episodes) && episodes.length <= 10) {
      return null;
    }
  }

  return window.leena.memory.consolidate();
}

function extractRealtimeExchange(event) {
  const type = event?.type;
  if (typeof type !== "string") {
    return null;
  }

  if (
    type === "conversation.item.input_audio_transcription.completed" ||
    type === "input_audio_transcription.completed"
  ) {
    return buildRealtimeExchange("user", event.transcript ?? event.item?.transcript);
  }

  if (
    type === "response.output_audio_transcript.done" ||
    type === "response.audio_transcript.done" ||
    type === "response.output_text.done" ||
    type === "response.text.done"
  ) {
    return buildRealtimeExchange("assistant", event.transcript ?? event.text ?? event.content);
  }

  if (type === "response.done") {
    return buildRealtimeExchange("assistant", extractResponseDoneText(event.response));
  }

  return null;
}

function buildRealtimeExchange(role, content) {
  const normalized = typeof content === "string" ? content.trim() : "";
  return normalized ? { role, content: normalized } : null;
}

function extractResponseDoneText(response) {
  const output = Array.isArray(response?.output) ? response.output : [];
  const parts = [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.transcript === "string") {
        parts.push(part.transcript);
      } else if (typeof part?.text === "string") {
        parts.push(part.text);
      }
    }
  }

  return parts.join("\n").trim();
}

async function writeRendererDiagnostic(event, details = {}) {
  try {
    await window.leena.writeDiagnosticLog(event, details);
  } catch {
    // Diagnostics must not break the call flow.
  }
}

function describeMediaStream(stream) {
  return {
    id: stream.id,
    active: stream.active,
    tracks: stream.getTracks().map((track) => ({
      id: track.id,
      kind: track.kind,
      label: track.label,
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState,
      settings: track.getSettings?.(),
    })),
  };
}

function formatRendererError(error) {
  return error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { message: String(error) };
}

function buildAudioConstraints() {
  // Echo cancellation is essential on laptop speakers: without it the mic
  // captures the assistant's own audio (e.g. the welcome greeting), the
  // semantic VAD treats it as a user turn, and the model replies to itself.
  // Pinning the chosen input device re-runs this processing for that mic, so
  // switching devices adjusts the capture pipeline dynamically.
  const base = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
  return selectedMicId ? { ...base, deviceId: { exact: selectedMicId } } : base;
}

async function loadMicPreference() {
  try {
    selectedMicId = (await window.leena.getMicrophoneDevice()) ?? null;
  } catch {
    selectedMicId = null;
  }
}

async function populateMicDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return;
  }
  let devices;
  try {
    devices = await navigator.mediaDevices.enumerateDevices();
  } catch {
    return;
  }
  // Windows lists "default"/"communications" pseudo-devices alongside the real
  // ones; drop them (and any unlabeled placeholders) so the list is the same
  // shape on macOS and Windows, with our own "Default microphone" entry on top.
  const inputs = devices.filter(
    (device) => device.kind === "audioinput" && isRealAudioInputId(device.deviceId),
  );
  const activeDeviceId = localStream?.getAudioTracks?.()[0]?.getSettings?.().deviceId ?? null;
  const options = [createMicOption("", "Default microphone")];
  inputs.forEach((device, index) => {
    options.push(createMicOption(device.deviceId, device.label || `Microphone ${index + 1}`));
  });
  micSelectElement.replaceChildren(...options);
  // Reflect the device actually in use during a call, else the saved choice.
  const desired = activeDeviceId ?? selectedMicId ?? "";
  micSelectElement.value = options.some((option) => option.value === desired) ? desired : "";
}

function createMicOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function isRealAudioInputId(deviceId) {
  return (
    typeof deviceId === "string" &&
    deviceId !== "" &&
    deviceId !== "default" &&
    deviceId !== "communications"
  );
}

// Acquires the mic with the chosen device + echo cancellation. If a pinned
// device is missing (unplugged, or saved on a different machine/OS), it falls
// back to the system default so calls still connect cross-platform.
async function acquireMicrophoneStream() {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: buildAudioConstraints() });
  } catch (error) {
    if (!selectedMicId) {
      throw error;
    }
    await writeRendererDiagnostic("audio.mic.fallback_default", {
      deviceId: selectedMicId,
      error: error instanceof Error ? error.name : String(error),
    });
    selectedMicId = null;
    try {
      await window.leena.setMicrophoneDevice(null);
    } catch {
      // Persisting the fallback is best-effort.
    }
    return navigator.mediaDevices.getUserMedia({ audio: buildAudioConstraints() });
  }
}

async function handleMicSelection() {
  selectedMicId = micSelectElement.value || null;
  try {
    await window.leena.setMicrophoneDevice(selectedMicId);
  } catch (error) {
    await writeRendererDiagnostic("audio.mic.persist_failed", formatRendererError(error));
  }
  // Apply live if a call is active; otherwise it takes effect on the next call.
  if (peerConnection && localStream) {
    await switchMicrophone();
  }
}

async function switchMicrophone() {
  try {
    const newStream = await acquireMicrophoneStream();
    const [newTrack] = newStream.getAudioTracks();
    if (!newTrack) {
      return;
    }
    const sender = peerConnection?.getSenders().find((entry) => entry.track?.kind === "audio");
    if (sender) {
      await sender.replaceTrack(newTrack);
    }
    for (const track of localStream.getTracks()) {
      track.stop();
    }
    localStream = newStream;
    startAudioLevelMonitor(localStream);
    await writeRendererDiagnostic("audio.mic.switched", describeMediaStream(localStream));
    void populateMicDevices();
  } catch (error) {
    await writeRendererDiagnostic("audio.mic.switch_failed", formatRendererError(error));
  }
}

function sendRealtimeWelcome() {
  // Laptop speakers echo the greeting into the mic and (even with echo
  // cancellation) the eager semantic VAD hears it as a user turn, making the
  // model reply to itself. Mute the mic for the greeting — no user input is
  // expected during it — and unmute once its audio finishes playing.
  beginWelcomeMicGuard();
  sendRealtimeDataChannelEvent({
    type: "response.create",
    response: {
      output_modalities: ["audio"],
      instructions: buildWelcomeInstructions(agentProfile),
    },
  });
}

function beginWelcomeMicGuard() {
  setMicrophoneMuted(true);
  if (welcomeMicGuardTimer !== null) {
    clearTimeout(welcomeMicGuardTimer);
  }
  // Safety net: never leave the mic muted if the audio-stopped event is missed.
  welcomeMicGuardTimer = setTimeout(endWelcomeMicGuard, 12000);
}

function endWelcomeMicGuard() {
  if (welcomeMicGuardTimer === null) {
    return;
  }
  clearTimeout(welcomeMicGuardTimer);
  welcomeMicGuardTimer = null;
  setMicrophoneMuted(false);
}

function setMicrophoneMuted(muted) {
  if (!localStream) {
    return;
  }
  for (const track of localStream.getAudioTracks()) {
    track.enabled = !muted;
  }
}

function sendRealtimeDataChannelEvent(event) {
  if (event?.type === "response.create") {
    // Only one response may be in progress at a time. Gate creates through the
    // coordinator so a barge-in/VAD-initiated response doesn't collide with our
    // welcome or tool-output creates; queued creates flush on response.done.
    const allowed = responseCoordinator.requestCreate(event);
    if (!allowed) {
      void writeRendererDiagnostic("realtime.response_create.queued", {});
      return;
    }
  }
  if (dataChannel?.readyState !== "open") {
    void writeRendererDiagnostic("realtime.send.skipped", {
      type: event?.type,
      readyState: dataChannel?.readyState ?? "missing",
    });
    return;
  }
  void writeRendererDiagnostic("realtime.send", summarizeRealtimeClientEvent(event));
  dataChannel.send(JSON.stringify(event));
}

function summarizeRealtimeClientEvent(event) {
  const summary = { type: event?.type };
  if (event?.session?.instructions) {
    summary.sessionInstructions = "present";
  }
  if (event?.session?.audio?.output?.voice) {
    summary.sessionVoice = event.session.audio.output.voice;
  }
  if (event?.item?.type) {
    summary.itemType = event.item.type;
  }
  if (event?.item?.call_id) {
    summary.callId = event.item.call_id;
  }
  if (event?.response?.input) {
    summary.responseInput = summarizeRealtimeInput(event.response.input);
  }
  if (event?.response?.output_modalities) {
    summary.outputModalities = event.response.output_modalities;
  }
  return summary;
}

// Streaming/per-token events that fire dozens of times per turn and add no
// diagnostic value; everything else (lifecycle, errors, tool calls) is kept.
const NOISY_REALTIME_EVENTS = new Set([
  "response.function_call_arguments.delta",
  "response.output_audio_transcript.delta",
  "response.output_audio.delta",
  "response.output_text.delta",
  "response.audio_transcript.delta",
  "response.audio.delta",
  "response.text.delta",
  "conversation.item.input_audio_transcription.delta",
  "rate_limits.updated",
]);

function isNoisyRealtimeEvent(type) {
  return typeof type === "string" && NOISY_REALTIME_EVENTS.has(type);
}

function summarizeRealtimeEvent(event) {
  const summary = { type: event?.type };
  if (event?.error) {
    summary.error = event.error;
  }
  if (event?.response) {
    summary.response = {
      id: event.response.id,
      status: event.response.status,
      statusDetails: event.response.status_details,
    };
  }
  if (event?.item) {
    summary.item = {
      id: event.item.id,
      type: event.item.type,
      role: event.item.role,
      status: event.item.status,
    };
  }
  return summary;
}

function summarizeRealtimeInput(input) {
  return input.map((item) => ({
    type: item?.type,
    role: item?.role,
    content: Array.isArray(item?.content)
      ? item.content.map((content) => ({
          type: content?.type,
          textLength: typeof content?.text === "string" ? content.text.length : undefined,
          imageUrlLength:
            typeof content?.image_url === "string" ? content.image_url.length : undefined,
        }))
      : undefined,
  }));
}

function formatConnectionState(state) {
  switch (state) {
    case "connected":
      return "Listening";
    case "connecting":
      return "Connecting";
    case "failed":
      return "Failed";
    case "disconnected":
      return "Disconnected";
    default:
      return "Ready";
  }
}

function startAudioLevelMonitor(microphoneStream) {
  audioLevelMonitor?.stop();
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  const audioContext = new AudioContextClass();
  const micAnalyser = createAnalyser(audioContext, microphoneStream);
  let remoteAnalyser = null;
  let animationFrame = null;
  let smoothedLevel = 0;

  setupWaveCanvas();

  function read() {
    const micLevel = readAnalyserLevel(micAnalyser);
    const remoteLevel = remoteAnalyser ? readAnalyserLevel(remoteAnalyser) : 0;
    const level = Math.max(micLevel, remoteLevel * 1.15);
    smoothedLevel = smoothedLevel * 0.72 + level * 0.28;
    setOrbLevel(smoothedLevel);
    drawWaveform(micAnalyser, remoteAnalyser, smoothedLevel);
    animationFrame = requestAnimationFrame(read);
  }

  audioLevelMonitor = {
    setRemoteStream(stream) {
      remoteAnalyser = createAnalyser(audioContext, stream);
    },
    stop() {
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }
      clearWaveform();
      void audioContext.close();
    },
  };

  read();
}

function createAnalyser(audioContext, stream) {
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.55;
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);
  return {
    analyser,
    data: new Uint8Array(analyser.fftSize),
    freq: new Uint8Array(analyser.frequencyBinCount),
  };
}

function readAnalyserLevel({ analyser, data }) {
  analyser.getByteTimeDomainData(data);
  let sum = 0;
  for (const value of data) {
    const centered = (value - 128) / 128;
    sum += centered * centered;
  }
  const rms = Math.sqrt(sum / data.length);
  return Math.min(1, Math.max(0, (rms - 0.015) * 8));
}

/* ---------- Waveform visualizer ----------
 * Mirrored rounded frequency bars, grounded in wavesurfer.js' bar model
 * (center-aligned bars, barGap ≈ barWidth/2, roundRect with barRadius). */
const WAVE_BAR_COUNT = 18;
const WAVE_CSS_WIDTH = 122;
const WAVE_CSS_HEIGHT = 20;
const waveBarHeights = new Array(WAVE_BAR_COUNT).fill(0);
let waveContext = null;
let waveGradient = null;

function readRendererColorToken(tokenName) {
  return getComputedStyle(appShellElement).getPropertyValue(tokenName).trim() || "rgb(255 255 255)";
}

function setupWaveCanvas() {
  if (!callWaveCanvas) {
    return;
  }
  const ratio = window.devicePixelRatio || 1;
  callWaveCanvas.width = Math.round(WAVE_CSS_WIDTH * ratio);
  callWaveCanvas.height = Math.round(WAVE_CSS_HEIGHT * ratio);
  waveContext = callWaveCanvas.getContext("2d");
  if (!waveContext) {
    return;
  }
  waveContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  waveGradient = waveContext.createLinearGradient(0, 0, WAVE_CSS_WIDTH, 0);
  waveGradient.addColorStop(0, readRendererColorToken("--legacy-nebula-2"));
  waveGradient.addColorStop(0.5, readRendererColorToken("--legacy-nebula-3"));
  waveGradient.addColorStop(1, readRendererColorToken("--legacy-accent-bright"));
}

function clearWaveform() {
  waveBarHeights.fill(0);
  if (waveContext) {
    waveContext.clearRect(0, 0, WAVE_CSS_WIDTH, WAVE_CSS_HEIGHT);
  }
}

function drawWaveform(micAnalyser, remoteAnalyser, level) {
  if (!waveContext) {
    return;
  }
  micAnalyser.analyser.getByteFrequencyData(micAnalyser.freq);
  if (remoteAnalyser) {
    remoteAnalyser.analyser.getByteFrequencyData(remoteAnalyser.freq);
  }
  // Voice energy lives in the lower spectrum; sample that band across the bars.
  const usableBins = Math.floor(micAnalyser.freq.length * 0.62);
  const binsPerBar = Math.max(1, Math.floor(usableBins / WAVE_BAR_COUNT));

  const half = WAVE_CSS_HEIGHT / 2;
  const spacing = WAVE_CSS_WIDTH / WAVE_BAR_COUNT;
  const barWidth = Math.max(2, spacing * 0.52);
  const barRadius = barWidth / 2;
  const minHeight = 2;

  waveContext.clearRect(0, 0, WAVE_CSS_WIDTH, WAVE_CSS_HEIGHT);
  waveContext.fillStyle = waveGradient;
  waveContext.globalAlpha = 0.55 + Math.min(0.45, level * 0.6);
  waveContext.beginPath();

  for (let i = 0; i < WAVE_BAR_COUNT; i += 1) {
    let sum = 0;
    const start = i * binsPerBar;
    for (let j = 0; j < binsPerBar; j += 1) {
      const micValue = micAnalyser.freq[start + j] ?? 0;
      const remoteValue = remoteAnalyser ? (remoteAnalyser.freq[start + j] ?? 0) : 0;
      sum += Math.max(micValue, remoteValue);
    }
    const target = Math.min(1, sum / binsPerBar / 255);
    // Ease toward the target for fluid, non-jittery motion.
    waveBarHeights[i] = waveBarHeights[i] * 0.6 + target * 0.4;

    const amplitude = Math.max(minHeight, waveBarHeights[i] * (half - 1));
    const x = i * spacing + (spacing - barWidth) / 2;
    const y = half - amplitude;
    const totalHeight = amplitude * 2;
    if (typeof waveContext.roundRect === "function") {
      waveContext.roundRect(x, y, barWidth, totalHeight, barRadius);
    } else {
      waveContext.rect(x, y, barWidth, totalHeight);
    }
  }

  waveContext.fill();
  waveContext.globalAlpha = 1;
}

menuToggleButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleMenu();
});
document.addEventListener("click", (event) => {
  if (appMenuElement.hidden) {
    return;
  }
  if (!appMenuElement.contains(event.target) && event.target !== menuToggleButton) {
    setMenuOpen(false);
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !appMenuElement.hidden) {
    setMenuOpen(false);
  }
});
connectOpenAIButton.addEventListener("click", () => {
  setMenuOpen(false);
  void connectOpenAI();
});
permissionsToggleButton.addEventListener("click", () => {
  setMenuOpen(false);
  permissionsPanelElement.hidden = !permissionsPanelElement.hidden;
  if (!permissionsPanelElement.hidden) {
    void refreshOsPermissions();
  }
});
agentToggleButton.addEventListener("click", () => {
  setMenuOpen(false);
  agentPanelElement.hidden = !agentPanelElement.hidden;
  if (!agentPanelElement.hidden) {
    agentStatusElement.textContent = "";
    void loadAgentProfile();
  }
});
agentBackButton.addEventListener("click", () => {
  agentPanelElement.hidden = true;
});
agentFormElement.addEventListener("submit", (event) => {
  event.preventDefault();
  void saveAgentProfile();
});
windowMinimizeButton.addEventListener("click", () => {
  setMenuOpen(false);
  void window.leena.minimizeWindow();
});
appQuitButton.addEventListener("click", () => {
  setMenuOpen(false);
  void window.leena.quitApp();
});
permissionsBackButton.addEventListener("click", () => {
  permissionsPanelElement.hidden = true;
});
permissionsRefreshButton.addEventListener("click", () => {
  void refreshOsPermissions();
});
diagnosticsOpenButton.addEventListener("click", () => {
  void window.leena.openDiagnosticLog();
});
const panelController = createPanelController({
  leena: window.leena,
  onModeChange: (mode) => {
    appShellElement.dataset.panel = mode === "panel" ? "open" : "closed";
  },
});

function shouldForceOnboarding() {
  return new URLSearchParams(window.location.search).get("onboarding") === "1";
}

async function shouldStartOnboarding() {
  return shouldForceOnboarding() || (await shouldShowOnboarding(window.leena));
}

function showAppShell() {
  onboardingMount?.remove();
  onboardingMount = null;
  leenaShellElement.hidden = false;
  leenaShellElement.removeAttribute("aria-hidden");
  appShellElement.dataset.onboarding = "complete";
}

function showOnboardingShell() {
  leenaShellElement.hidden = true;
  leenaShellElement.setAttribute("aria-hidden", "true");
  appShellElement.dataset.onboarding = "active";
  if (onboardingMount) {
    return onboardingMount;
  }
  onboardingMount = document.createElement("div");
  onboardingMount.id = "onboarding-root";
  onboardingMount.className = "onboarding-root";
  appShellElement.append(onboardingMount);
  return onboardingMount;
}

function startAppRuntime() {
  if (appRuntimeStarted) {
    return;
  }
  appRuntimeStarted = true;
  callToggleButton.addEventListener("click", toggleCall);
  headerCallButton.addEventListener("click", toggleCall);
  callEndButton.addEventListener("click", () => {
    if (voiceStartupFailure) {
      void handleVoiceStartupFailureAction();
      return;
    }
    // Same button, context-aware: during computer use it stops the task and keeps
    // the call going; otherwise it ends the call.
    if (appShellElement.dataset.toolActivity === "active") {
      void stopComputerUse();
    } else {
      void stopCall();
    }
  });
  micSelectElement.addEventListener("change", () => {
    void handleMicSelection();
  });
  navigator.mediaDevices?.addEventListener?.("devicechange", () => {
    void populateMicDevices();
  });
  window.addEventListener("leena:persona-changed", (event) => {
    void handleAgentRuntimeConfigChanged(event.detail?.profile ?? null);
  });
  window.leena.onDataChanged?.(handleDataChanged);
  setOrbLevel(0);
  bindVoiceDockOrbTokens();
  syncVoiceOrbStateForMode(appShellElement.dataset.mode);

  panelController.init({ openByDefault: false });
  shellController = initShell();
  mountLiveCommandCenter();
  initClickSound();

  refreshOpenAIStatus().catch((error) => {
    setOpenAIConnected(false);
    setStatus(`Status failed: ${error.message}`);
  });
  refreshOsPermissions().catch((error) => {
    setStatus(`Permissions failed: ${error.message}`);
  });
  populateAgentOptions();
  loadAgentProfile().catch((error) => {
    setStatus(`Agent profile failed: ${error.message}`);
  });
  loadMicPreference()
    .then(() => populateMicDevices())
    .catch(() => {});
}

async function startRenderer() {
  if (await shouldStartOnboarding()) {
    await mountOnboarding(showOnboardingShell(), {
      bridge: window.leena,
      onComplete: () => {
        showAppShell();
        startAppRuntime();
      },
    });
    return;
  }

  showAppShell();
  startAppRuntime();
}

startRenderer().catch((error) => {
  showAppShell();
  startAppRuntime();
  setStatus(`Onboarding failed: ${error.message}`);
});
