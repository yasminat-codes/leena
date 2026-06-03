export const VOICE_STARTUP_ACTIONS = Object.freeze({
  configureProvider: "configure_provider",
  openSettings: "open_settings",
  retry: "retry",
});

export const VOICE_STARTUP_STAGES = Object.freeze({
  listening: "listening",
  microphone: "microphone",
  peer: "peer",
  provider: "provider",
  secret: "secret",
  session: "session",
  starting: "starting",
});

const stageLabels = Object.freeze({
  [VOICE_STARTUP_STAGES.starting]: "Starting...",
  [VOICE_STARTUP_STAGES.provider]: "Checking provider...",
  [VOICE_STARTUP_STAGES.secret]: "Creating voice session...",
  [VOICE_STARTUP_STAGES.microphone]: "Checking microphone...",
  [VOICE_STARTUP_STAGES.peer]: "Preparing audio link...",
  [VOICE_STARTUP_STAGES.session]: "Connecting voice...",
  [VOICE_STARTUP_STAGES.listening]: "Listening",
});

export class VoiceStartupPreflightError extends Error {
  constructor({ action, actionLabel, cause = null, kind, message, stage }) {
    super(message);
    this.name = "VoiceStartupPreflightError";
    this.action = action;
    this.actionLabel = actionLabel;
    this.cause = cause;
    this.kind = kind;
    this.stage = stage;
  }
}

export async function runVoiceStartupPreflight({
  acquireMicrophone,
  createPeerConnection,
  createSecret,
  getProviderStatus,
  onResource = () => {},
  onStage = () => {},
} = {}) {
  const providerStatus = await runVoiceStartupStage({
    action: getProviderStatus,
    fallbackStage: VOICE_STARTUP_STAGES.provider,
    onStage,
  });
  if (!providerIsReady(providerStatus)) {
    throw createProviderMissingError(providerStatus);
  }

  const secret = normalizeRealtimeSecret(
    await runVoiceStartupStage({
      action: createSecret,
      fallbackStage: VOICE_STARTUP_STAGES.secret,
      onStage,
    }),
  );

  const stream = await runVoiceStartupStage({
    action: acquireMicrophone,
    fallbackStage: VOICE_STARTUP_STAGES.microphone,
    onStage,
  });
  if (!stream) {
    throw createStageError(VOICE_STARTUP_STAGES.microphone, new Error("No microphone stream."));
  }
  onResource(VOICE_STARTUP_STAGES.microphone, stream);

  const peerConnection = await runVoiceStartupStage({
    action: createPeerConnection,
    fallbackStage: VOICE_STARTUP_STAGES.peer,
    onStage,
  });
  if (!peerConnection) {
    throw createStageError(VOICE_STARTUP_STAGES.peer, new Error("No peer connection."));
  }
  onResource(VOICE_STARTUP_STAGES.peer, peerConnection);

  return { peerConnection, providerStatus, secret, stream };
}

export function voiceStartupStageLabel(stage) {
  return stageLabels[stage] ?? stageLabels[VOICE_STARTUP_STAGES.starting];
}

export function classifyVoiceStartupError(error, fallbackStage = VOICE_STARTUP_STAGES.session) {
  if (error instanceof VoiceStartupPreflightError) {
    return freezeFailure(error);
  }

  if (isProviderMissingPayload(error)) {
    return freezeFailure(createProviderMissingError(error));
  }

  return freezeFailure(createStageError(fallbackStage, error));
}

async function runVoiceStartupStage({ action, fallbackStage, onStage }) {
  if (typeof action !== "function") {
    throw createStageError(fallbackStage, new TypeError(`${fallbackStage} check is unavailable.`));
  }

  onStage(fallbackStage);

  try {
    return await action();
  } catch (error) {
    throw error instanceof VoiceStartupPreflightError
      ? error
      : createStageError(fallbackStage, error);
  }
}

function normalizeRealtimeSecret(secret) {
  if (isProviderMissingPayload(secret)) {
    throw createProviderMissingError(secret);
  }

  if (!secret?.value) {
    throw createStageError(
      VOICE_STARTUP_STAGES.secret,
      new Error("Realtime session did not return a client secret."),
    );
  }

  return secret;
}

function providerIsReady(status) {
  if (status === true) {
    return true;
  }

  if (!status || typeof status !== "object") {
    return false;
  }

  return status.connected === true || status.ready === true || status.status === "connected";
}

function createProviderMissingError(cause = null) {
  return new VoiceStartupPreflightError({
    action: VOICE_STARTUP_ACTIONS.configureProvider,
    actionLabel: "Configure Provider",
    cause,
    kind: "provider_missing",
    message: "Configure a realtime provider before starting voice.",
    stage: VOICE_STARTUP_STAGES.provider,
  });
}

function createStageError(stage, cause) {
  if (stage === VOICE_STARTUP_STAGES.microphone) {
    return createMicrophoneError(cause);
  }

  if (stage === VOICE_STARTUP_STAGES.secret) {
    return new VoiceStartupPreflightError({
      action: VOICE_STARTUP_ACTIONS.retry,
      actionLabel: "Retry",
      cause,
      kind: "secret_failure",
      message: "Voice session setup failed. Check the provider connection, then retry.",
      stage,
    });
  }

  return new VoiceStartupPreflightError({
    action: VOICE_STARTUP_ACTIONS.retry,
    actionLabel: "Retry",
    cause,
    kind: stage === VOICE_STARTUP_STAGES.peer ? "peer_failure" : "session_failure",
    message: "Voice startup failed before listening. Retry to start a new session.",
    stage,
  });
}

function createMicrophoneError(cause) {
  const denied = isMicrophoneDeniedError(cause);
  return new VoiceStartupPreflightError({
    action: VOICE_STARTUP_ACTIONS.openSettings,
    actionLabel: "Open Settings",
    cause,
    kind: denied ? "mic_denied" : "mic_unavailable",
    message: denied
      ? "Microphone access is blocked. Open macOS microphone settings, then retry."
      : "Microphone input is unavailable. Open settings, confirm access, then retry.",
    stage: VOICE_STARTUP_STAGES.microphone,
  });
}

function isProviderMissingPayload(value) {
  const code = value?.error ?? value?.code ?? value?.name;
  if (code === "NO_REALTIME_PROVIDER") {
    return true;
  }

  const message = value instanceof Error ? value.message : value?.message;
  return (
    typeof message === "string" &&
    (/NO_REALTIME_PROVIDER/.test(message) || /configure .*openai .*voice/i.test(message))
  );
}

function isMicrophoneDeniedError(error) {
  const name = error?.name;
  return name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError";
}

function freezeFailure(error) {
  return Object.freeze({
    action: error.action,
    actionLabel: error.actionLabel,
    kind: error.kind,
    message: error.message,
    stage: error.stage,
  });
}
