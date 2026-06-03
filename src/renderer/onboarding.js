import { DEFAULT_HOTKEY_ACCELERATOR, formatHotkeyAccelerator } from "../hotkey-accelerator.js";

const STEP_IDS = Object.freeze(["welcome", "auth", "permissions", "name", "done"]);
const DISPLAY_PERMISSION_IDS = Object.freeze(["microphone", "screen", "accessibility", "computer"]);
const REQUIRED_PERMISSION_IDS = DISPLAY_PERMISSION_IDS;

const permissionFallbacks = Object.freeze({
  microphone: {
    id: "microphone",
    label: "Microphone",
    description: "Needed for Realtime voice input.",
    activation: "Click Request to trigger the OS microphone prompt.",
    requirement: "Required for voice",
  },
  screen: {
    id: "screen",
    label: "Screen Recording",
    description: "Recommended for screenshots, screen analysis, and Computer Use OS control.",
    activation: "Click Request, then allow Leena in Screen Recording settings.",
    requirement: "Required for screen understanding",
  },
  accessibility: {
    id: "accessibility",
    label: "Accessibility Control",
    description: "Recommended for Computer Use control of the OS mouse and keyboard.",
    activation: "Click Request, then allow Leena in Accessibility settings.",
    requirement: "Required for OS control",
  },
  computer: {
    id: "computer",
    label: "Automation Browser",
    description: "Needed for browser-based Computer Use without controlling the real OS.",
    activation: "Click Request to install the automation browser.",
    requirement: "Required for browser control",
  },
});

const onboardingPermissionCopy = Object.freeze({
  microphone: {
    description: "Realtime voice input.",
    activation: "Native OS microphone prompt.",
  },
  screen: {
    description: "Screenshots, screen reading, and OS control.",
    activation: "Opens Screen Recording settings.",
  },
  accessibility: {
    description: "OS mouse and keyboard control.",
    activation: "Opens Accessibility settings.",
  },
  computer: {
    description: "Browser-based Computer Use.",
    activation: "Installs the automation browser.",
  },
});

export const ONBOARDING_SETTING_KEY = "onboardingCompleted";
export const ONBOARDING_HOTKEY_DEFAULT = DEFAULT_HOTKEY_ACCELERATOR;

export function createInitialOnboardingState(overrides = {}) {
  return {
    authStatus: null,
    currentStepId: "welcome",
    error: "",
    hotkey: ONBOARDING_HOTKEY_DEFAULT,
    isBusy: false,
    name: "",
    permissions: [],
    profile: null,
    ...overrides,
  };
}

export function normalizeAuthStatus(status) {
  if (!status || typeof status !== "object") {
    return { connected: false, authType: "none" };
  }
  const authType =
    typeof status.authType === "string"
      ? status.authType
      : typeof status.type === "string"
        ? status.type
        : "unknown";
  return {
    ...status,
    authType,
    connected: Boolean(status.connected),
  };
}

export function normalizePermissions(permissions) {
  const byId = new Map();
  for (const permission of Array.isArray(permissions) ? permissions : []) {
    if (permission?.id) {
      byId.set(permission.id, permission);
    }
  }
  return DISPLAY_PERMISSION_IDS.map((id) => {
    const fallback = permissionFallbacks[id];
    const permission = byId.get(id) ?? {};
    return {
      ...fallback,
      ...permission,
      id,
      label: permission.label ?? fallback.label,
      description: permission.description ?? fallback.description,
      activation: permission.activation ?? fallback.activation,
      requirement: permission.requirement ?? fallback.requirement,
      status: normalizePermissionStatus(permission.status),
    };
  });
}

export function normalizePermissionStatus(status) {
  return ["not-determined", "granted", "denied", "restricted", "unknown", "unsupported"].includes(
    status,
  )
    ? status
    : "unknown";
}

export function hasRequiredPermissions(permissions) {
  const normalized = normalizePermissions(permissions);
  return REQUIRED_PERMISSION_IDS.every((id) =>
    normalized.some(
      (permission) => permission.id === id && isPermissionReadyOrUnsupported(permission.status),
    ),
  );
}

export function getMissingRequiredPermissions(permissions) {
  const normalized = normalizePermissions(permissions);
  return normalized.filter(
    (permission) =>
      REQUIRED_PERMISSION_IDS.includes(permission.id) &&
      !isPermissionReadyOrUnsupported(permission.status),
  );
}

function isPermissionReadyOrUnsupported(status) {
  return status === "granted" || status === "unsupported";
}

function formatPermissionStatus(status) {
  switch (status) {
    case "granted":
      return "Allowed";
    case "not-determined":
      return "Needs setup";
    case "denied":
      return "Needs settings";
    case "restricted":
      return "Restricted";
    case "unsupported":
      return "Not needed here";
    default:
      return "Check needed";
  }
}

function getOnboardingPermissionCopy(permission) {
  return {
    ...permission,
    ...(onboardingPermissionCopy[permission.id] ?? {}),
  };
}

export function formatHotkey(hotkey = ONBOARDING_HOTKEY_DEFAULT) {
  return formatHotkeyAccelerator(hotkey);
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getFormValue(root, name, formValues = null) {
  if (formValues && Object.hasOwn(formValues, name)) {
    return formValues[name];
  }
  return root?.querySelector?.(`[name="${name}"]`)?.value?.trim() ?? "";
}

function snapshotFormValues(root) {
  return {
    apiKey: getFormValue(root, "apiKey"),
    name: getFormValue(root, "name"),
  };
}

function getDefaultBridge(bridge) {
  const resolved = bridge ?? globalThis.window?.leena;
  if (!resolved) {
    throw new Error("Leena bridge is unavailable.");
  }
  return resolved;
}

function renderStepProgress(currentStepId) {
  const currentIndex = STEP_IDS.indexOf(currentStepId);
  return `
    <ol class="onboarding-progress" aria-label="Onboarding progress">
      ${STEP_IDS.map((id, index) => {
        const state =
          index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming";
        return `<li class="onboarding-progress__item" data-state="${state}">${escapeHtml(getStepById(id).label)}</li>`;
      }).join("")}
    </ol>
  `;
}

function renderFooter(state, step) {
  const index = STEP_IDS.indexOf(step.id);
  const isFirst = index === 0;
  const isLast = index === STEP_IDS.length - 1;
  const nextLabel =
    step.id === "welcome" ? "Get Started" : step.id === "done" ? "Start Using Leena" : "Continue";
  return `
    <footer class="onboarding-footer">
      <button type="button" class="btn" data-onboarding-action="back" ${isFirst ? "disabled" : ""}>
        Back
      </button>
      ${
        step.id === "name"
          ? '<button type="button" class="btn" data-onboarding-action="skip-name">Skip</button>'
          : ""
      }
      <button type="${isLast ? "button" : "submit"}" class="btn btn--primary" data-onboarding-action="${isLast ? "complete" : "next"}">
        ${state.isBusy ? "Working..." : nextLabel}
      </button>
    </footer>
  `;
}

export function renderOnboardingShell(state = createInitialOnboardingState()) {
  const step = getStepById(state.currentStepId);
  return `
    <section class="onboarding" aria-label="Leena onboarding">
      ${renderStepProgress(step.id)}
      <form class="onboarding-card panel-glass" data-onboarding-form="${escapeHtml(step.id)}">
        ${state.error ? `<p class="onboarding-error" role="alert">${escapeHtml(state.error)}</p>` : ""}
        ${step.render(state)}
        ${renderFooter(state, step)}
      </form>
    </section>
  `;
}

function renderWelcomeStep() {
  return `
    <section class="onboarding-step" data-step="welcome">
      <p class="eyebrow">Leena setup</p>
      <h1>Make Leena yours</h1>
      <p>
        Connect OpenAI, grant local access for voice and screen control, and add the name Leena
        should use for you.
      </p>
      <div class="onboarding-intro-grid" aria-label="Setup checklist">
        <div>
          <span class="onboarding-intro-grid__number">01</span>
          <strong>Connect intelligence</strong>
          <p>Use an API key or OAuth before starting a realtime session.</p>
        </div>
        <div>
          <span class="onboarding-intro-grid__number">02</span>
          <strong>Grant access</strong>
          <p>Microphone, Screen Recording, Accessibility, and browser automation are checked.</p>
        </div>
        <div>
          <span class="onboarding-intro-grid__number">03</span>
          <strong>Personalize</strong>
          <p>Set the name Leena should use and confirm your hotkey.</p>
        </div>
      </div>
    </section>
  `;
}

function renderAuthStep(state) {
  const status = normalizeAuthStatus(state.authStatus);
  const statusText = status.connected
    ? `Connected with ${status.authType === "api-key" ? "API key" : status.authType}`
    : "Not connected";
  return `
    <section class="onboarding-step" data-step="auth">
      <p class="eyebrow">OpenAI</p>
      <h1>Connect voice intelligence</h1>
      <p>Paste an OpenAI API key. ChatGPT OAuth remains available as an optional fallback.</p>
      <label class="agent-field">
        <span class="agent-label">OpenAI API key</span>
        <input
          class="agent-input"
          name="apiKey"
          type="password"
          autocomplete="off"
          placeholder="sk-..."
        />
      </label>
      <div class="onboarding-actions">
        <button type="button" class="btn" data-onboarding-action="save-api-key">
          Save API Key
        </button>
        <button type="button" class="btn" data-onboarding-action="oauth-login">
          Use ChatGPT OAuth
        </button>
      </div>
      <p class="panel-footer-text" role="status">${escapeHtml(statusText)}</p>
    </section>
  `;
}

function renderPermissionsStep(state) {
  const permissions = normalizePermissions(state.permissions);
  const readyCount = permissions.filter((permission) =>
    isPermissionReadyOrUnsupported(permission.status),
  ).length;
  return `
    <section class="onboarding-step" data-step="permissions">
      <p class="eyebrow">Permissions</p>
      <h1>Allow every local access</h1>
      <p>
        Leena needs these grants to hear you, understand your screen, and control the browser or
        your Mac when you ask. macOS will keep some choices in System Settings after you click
        Request.
      </p>
      <div class="onboarding-permissions__summary" role="status">
        <strong>${readyCount} of ${permissions.length} ready</strong>
        <span>Finish every supported item before continuing.</span>
      </div>
      <div class="onboarding-permissions" aria-label="Required local access">
        ${permissions
          .map((permission) => {
            const displayPermission = getOnboardingPermissionCopy(permission);
            const statusText = formatPermissionStatus(permission.status);
            const isReady = isPermissionReadyOrUnsupported(permission.status);
            const requestLabel = permission.id === "computer" ? "Install" : "Request";
            return `
              <article class="onboarding-permission" data-permission-id="${escapeHtml(permission.id)}" data-status="${escapeHtml(permission.status)}">
                <div class="onboarding-permission__header">
                  <div>
                    <span class="onboarding-permission__kicker">${escapeHtml(displayPermission.requirement)}</span>
                    <h2>${escapeHtml(displayPermission.label)}</h2>
                  </div>
                  <span class="onboarding-permission__status${isReady ? " is-granted" : ""}">
                    ${escapeHtml(statusText)}
                  </span>
                </div>
                <p class="onboarding-permission__description">${escapeHtml(displayPermission.description)}</p>
                <p class="onboarding-permission__activation">${escapeHtml(displayPermission.activation)}</p>
                <div class="onboarding-permission__actions">
                  <button
                    type="button"
                    class="btn"
                    data-onboarding-action="request-permission"
                    data-permission-id="${escapeHtml(permission.id)}"
                    ${permission.status === "unsupported" ? "disabled" : ""}
                  >
                    ${escapeHtml(requestLabel)}
                  </button>
                  <button
                    type="button"
                    class="btn"
                    data-onboarding-action="open-permission-settings"
                    data-permission-id="${escapeHtml(permission.id)}"
                  >
                    Open Settings
                  </button>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
      <div class="onboarding-inline-actions">
        <button type="button" class="btn" data-onboarding-action="refresh-permissions">
          Refresh status
        </button>
      </div>
    </section>
  `;
}

function renderNameStep(state) {
  return `
    <section class="onboarding-step" data-step="name">
      <p class="eyebrow">Profile</p>
      <h1>What should Leena call you?</h1>
      <p>This is optional and can be changed later from Settings.</p>
      <label class="agent-field">
        <span class="agent-label">Your name</span>
        <input
          class="agent-input"
          name="name"
          type="text"
          autocomplete="name"
          maxlength="80"
          value="${escapeHtml(state.name)}"
          placeholder="Yasmin"
        />
      </label>
    </section>
  `;
}

function renderDoneStep(state) {
  const status = normalizeAuthStatus(state.authStatus);
  const permissions = normalizePermissions(state.permissions);
  return `
    <section class="onboarding-step" data-step="done">
      <p class="eyebrow">Ready</p>
      <h1>Leena is ready</h1>
      <p>Everything Leena needs for voice, screen awareness, and local control is ready.</p>
      <ul class="onboarding-summary-list">
        <li>OpenAI: ${escapeHtml(status.connected ? status.authType : "not connected")}</li>
        ${permissions
          .map(
            (permission) =>
              `<li>${escapeHtml(permission.label)}: ${escapeHtml(formatPermissionStatus(permission.status))}</li>`,
          )
          .join("")}
        <li>Name: ${escapeHtml(state.name || "Skipped")}</li>
        <li>Hotkey: ${escapeHtml(formatHotkey(state.hotkey))}</li>
      </ul>
    </section>
  `;
}

async function validateWelcomeStep() {
  return true;
}

async function validateAuthStep({ bridge, formValues, root, state }) {
  const resolvedBridge = getDefaultBridge(bridge);
  const apiKey = getFormValue(root, "apiKey", formValues);
  if (apiKey) {
    state.authStatus = normalizeAuthStatus(await resolvedBridge.saveApiKey(apiKey));
  }
  state.authStatus = normalizeAuthStatus(await resolvedBridge.getOpenAIStatus());
  if (!state.authStatus.connected) {
    throw new Error("Paste an OpenAI API key or connect with OAuth before continuing.");
  }
  return true;
}

async function validatePermissionsStep({ bridge, state }) {
  const resolvedBridge = getDefaultBridge(bridge);
  state.permissions = normalizePermissions(await resolvedBridge.getOsPermissions());
  if (!hasRequiredPermissions(state.permissions)) {
    const missing = getMissingRequiredPermissions(state.permissions)
      .map((permission) => permission.label)
      .join(", ");
    throw new Error(`Finish setup for: ${missing}.`);
  }
  return true;
}

async function validateNameStep({ bridge, formValues, root, state }) {
  const resolvedBridge = getDefaultBridge(bridge);
  const name = getFormValue(root, "name", formValues);
  state.name = name;
  if (!name) {
    return true;
  }
  const existingProfile =
    typeof resolvedBridge.getAgentProfile === "function"
      ? await resolvedBridge.getAgentProfile()
      : {};
  state.profile = await resolvedBridge.setAgentProfile({
    ...(existingProfile ?? {}),
    name,
  });
  return true;
}

async function validateDoneStep({ bridge, state }) {
  await completeOnboarding(bridge);
  state.completed = true;
  return true;
}

export const ONBOARDING_STEPS = Object.freeze([
  Object.freeze({
    id: "welcome",
    label: "Welcome",
    render: renderWelcomeStep,
    validate: validateWelcomeStep,
  }),
  Object.freeze({
    id: "auth",
    label: "Auth",
    render: renderAuthStep,
    validate: validateAuthStep,
  }),
  Object.freeze({
    id: "permissions",
    label: "Permissions",
    render: renderPermissionsStep,
    validate: validatePermissionsStep,
  }),
  Object.freeze({
    id: "name",
    label: "Name",
    render: renderNameStep,
    validate: validateNameStep,
  }),
  Object.freeze({
    id: "done",
    label: "Done",
    render: renderDoneStep,
    validate: validateDoneStep,
  }),
]);

export function getStepById(id) {
  return ONBOARDING_STEPS.find((step) => step.id === id) ?? ONBOARDING_STEPS[0];
}

export function getNextStepId(currentStepId) {
  const index = STEP_IDS.indexOf(currentStepId);
  return STEP_IDS[Math.min(STEP_IDS.length - 1, index + 1)] ?? "welcome";
}

export function getPreviousStepId(currentStepId) {
  const index = STEP_IDS.indexOf(currentStepId);
  return STEP_IDS[Math.max(0, index - 1)] ?? "welcome";
}

export async function shouldShowOnboarding(bridge) {
  const resolvedBridge = getDefaultBridge(bridge);
  return !(await resolvedBridge.getSetting(ONBOARDING_SETTING_KEY, false));
}

export async function completeOnboarding(bridge) {
  const resolvedBridge = getDefaultBridge(bridge);
  if (typeof resolvedBridge.completeOnboarding === "function") {
    return resolvedBridge.completeOnboarding();
  }
  return resolvedBridge.setSetting(ONBOARDING_SETTING_KEY, true);
}

export async function resetOnboarding(bridge) {
  const resolvedBridge = getDefaultBridge(bridge);
  if (typeof resolvedBridge.resetOnboarding === "function") {
    return resolvedBridge.resetOnboarding();
  }
  return resolvedBridge.setSetting(ONBOARDING_SETTING_KEY, false);
}

export function createOnboardingFlow(options = {}) {
  const bridge = getDefaultBridge(options.bridge);
  const state = createInitialOnboardingState(options.state);
  const root = options.root ?? null;
  let mountedRoot = null;

  async function refreshInitialState() {
    const [authStatus, permissions, hotkey] = await Promise.all([
      callBridge(bridge.getOpenAIStatus, null),
      callBridge(bridge.getOsPermissions, []),
      callBridge(bridge.getSetting, ONBOARDING_HOTKEY_DEFAULT, "hotkey", ONBOARDING_HOTKEY_DEFAULT),
    ]);
    state.authStatus = normalizeAuthStatus(authStatus);
    state.permissions = normalizePermissions(permissions);
    state.hotkey = hotkey ?? ONBOARDING_HOTKEY_DEFAULT;
  }

  function render() {
    if (!mountedRoot) {
      return;
    }
    mountedRoot.innerHTML = renderOnboardingShell(state);
  }

  async function run(action, target = null) {
    state.error = "";
    try {
      if (action === "back") {
        state.currentStepId = getPreviousStepId(state.currentStepId);
        render();
        return;
      }
      if (action === "skip-name") {
        state.name = "";
        state.currentStepId = "done";
        render();
        return;
      }
      if (action === "request-permission") {
        state.isBusy = true;
        render();
        state.permissions = normalizePermissions(
          await bridge.requestOsPermission(target?.dataset?.permissionId),
        );
        state.isBusy = false;
        render();
        return;
      }
      if (action === "open-permission-settings") {
        state.isBusy = true;
        render();
        await bridge.openOsPermissionSettings(target?.dataset?.permissionId);
        state.isBusy = false;
        render();
        return;
      }
      if (action === "refresh-permissions") {
        state.isBusy = true;
        render();
        state.permissions = normalizePermissions(await bridge.getOsPermissions());
        state.isBusy = false;
        render();
        return;
      }
      if (action === "oauth-login") {
        state.isBusy = true;
        render();
        state.authStatus = normalizeAuthStatus(await bridge.loginOpenAI());
        state.authStatus = normalizeAuthStatus(await bridge.getOpenAIStatus());
        state.isBusy = false;
        render();
        return;
      }
      if (action === "save-api-key") {
        const apiKey = getFormValue(mountedRoot, "apiKey");
        if (!apiKey) {
          throw new Error("Paste an OpenAI API key before saving.");
        }
        state.isBusy = true;
        render();
        state.authStatus = normalizeAuthStatus(await bridge.saveApiKey(apiKey));
        state.authStatus = normalizeAuthStatus(await bridge.getOpenAIStatus());
        state.isBusy = false;
        render();
        return;
      }
      await advance(action === "complete");
    } catch (error) {
      state.isBusy = false;
      state.error = error instanceof Error ? error.message : String(error);
      render();
    }
  }

  async function advance(isCompleteAction = false) {
    const step = getStepById(state.currentStepId);
    const formValues = snapshotFormValues(mountedRoot);
    state.isBusy = true;
    render();
    try {
      await step.validate({ bridge, formValues, root: mountedRoot, state });
      if (isCompleteAction || step.id === "done") {
        mountedRoot?.dispatchEvent?.(
          new CustomEvent("leena:onboarding-complete", { detail: { state: { ...state } } }),
        );
        await options.onComplete?.({ ...state });
        return;
      }
      state.currentStepId = getNextStepId(state.currentStepId);
    } finally {
      state.isBusy = false;
      render();
    }
  }

  async function mount(target = root) {
    if (!target) {
      throw new Error("Onboarding mount target is required.");
    }
    mountedRoot = target;
    mountedRoot.addEventListener("click", (event) => {
      const actionTarget = event.target.closest?.("[data-onboarding-action]");
      if (!actionTarget) {
        return;
      }
      event.preventDefault();
      void run(actionTarget.dataset.onboardingAction, actionTarget);
    });
    mountedRoot.addEventListener("submit", (event) => {
      event.preventDefault();
      void run("next", event.target);
    });
    await refreshInitialState();
    render();
    return controller;
  }

  const controller = {
    advance,
    getState: () => ({ ...state }),
    mount,
    render,
    reset: async () => resetOnboarding(bridge),
    run,
  };

  return controller;
}

export async function mountOnboarding(target, options = {}) {
  const controller = createOnboardingFlow({ ...options, root: target });
  return controller.mount(target);
}

async function callBridge(method, fallback, ...args) {
  if (typeof method !== "function") {
    return fallback;
  }
  try {
    return await method(...args);
  } catch {
    return fallback;
  }
}
