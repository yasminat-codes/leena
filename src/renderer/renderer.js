import { createRealtimeToolHandler } from "./realtime-tool-handler.js";

const appShellElement = document.querySelector("#app-shell");
const statusElement = document.querySelector("#status");
const connectOpenAIButton = document.querySelector("#connect-openai");
const permissionsToggleButton = document.querySelector("#permissions-toggle");
const permissionsPanelElement = document.querySelector("#permissions-panel");
const permissionsRefreshButton = document.querySelector("#permissions-refresh");
const diagnosticsOpenButton = document.querySelector("#diagnostics-open");
const permissionsListElement = document.querySelector("#permissions-list");
const callToggleButton = document.querySelector("#call-toggle");
const callLabelElement = document.querySelector("#call-label");
const remoteAudioElement = document.querySelector("#remote-audio");

let isOpenAIConnected = false;
let peerConnection = null;
let dataChannel = null;
let localStream = null;
let audioLevelMonitor = null;
const realtimeToolHandler = createRealtimeToolHandler({
  executeTool: (name, args) => window.brah.executeRealtimeTool(name, args),
  sendEvent: sendRealtimeDataChannelEvent,
  setMode,
  setStatus,
});

function setStatus(message) {
  statusElement.textContent = message;
}

function setMode(mode) {
  appShellElement.dataset.mode = mode;
}

function setOrbLevel(level) {
  const normalized = Math.max(0, Math.min(level, 1));
  appShellElement.style.setProperty("--orb-level", normalized.toFixed(3));
}

function setOpenAIConnected(connected) {
  isOpenAIConnected = connected;
  connectOpenAIButton.textContent = connected ? "Reconnect" : "Connect";
  connectOpenAIButton.disabled = false;
  callToggleButton.disabled = !connected;
  appShellElement.classList.toggle("is-authorized", connected);
  if (!connected) {
    setMode("idle");
    setStatus("Connect OpenAI");
  }
}

function setCallActive(active) {
  callToggleButton.classList.toggle("is-active", active);
  callToggleButton.setAttribute("aria-pressed", String(active));
  callLabelElement.textContent = active ? "End" : "Call";
}

async function refreshOpenAIStatus() {
  const status = await window.brah.getOpenAIStatus();
  setOpenAIConnected(status.connected);
  if (status.connected) {
    setStatus("Ready");
  }
}

async function refreshOsPermissions() {
  const permissions = await window.brah.getOsPermissions();
  renderOsPermissions(permissions);
}

function renderOsPermissions(permissions) {
  permissionsListElement.replaceChildren(
    ...permissions.map((permission) => {
      const item = document.createElement("article");
      item.className = "permission-item";

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
    renderOsPermissions(await window.brah.requestOsPermission(id));
    setStatus("Permissions updated");
  } catch (error) {
    setStatus(`Permission failed: ${error.message}`);
  }
}

async function openOsPermissionSettings(id) {
  setStatus("Opening settings…");
  try {
    await window.brah.openOsPermissionSettings(id);
    setStatus("Settings opened");
  } catch (error) {
    setStatus(`Settings failed: ${error.message}`);
  }
}

async function connectOpenAI() {
  connectOpenAIButton.disabled = true;
  callToggleButton.disabled = true;
  setStatus(isOpenAIConnected ? "Reconnecting…" : "Opening browser…");
  setMode("connecting");

  try {
    if (isOpenAIConnected) {
      await stopCall();
      await window.brah.logoutOpenAI();
      setOpenAIConnected(false);
    }
    await window.brah.loginOpenAI();
    setOpenAIConnected(true);
    setMode("idle");
    setStatus("Ready");
  } catch (error) {
    setOpenAIConnected(false);
    setStatus(`Connect failed: ${error.message}`);
  } finally {
    connectOpenAIButton.disabled = false;
    callToggleButton.disabled = !isOpenAIConnected;
  }
}

async function toggleCall() {
  if (peerConnection) {
    await stopCall();
    return;
  }

  await startCall();
}

async function startCall() {
  if (!isOpenAIConnected) {
    setStatus("Connect first");
    return;
  }

  callToggleButton.disabled = true;
  setStatus("Starting…");
  setMode("connecting");
  await writeRendererDiagnostic("call.start", {
    mediaDevicesAvailable: Boolean(navigator.mediaDevices?.getUserMedia),
  });

  try {
    const secret = await window.brah.createRealtimeSecret();
    await writeRendererDiagnostic("call.secret.created", { hasValue: Boolean(secret?.value) });
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    await writeRendererDiagnostic("call.microphone.stream", describeMediaStream(localStream));
    startAudioLevelMonitor(localStream);

    peerConnection = new RTCPeerConnection();
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
      }
      if (["closed", "disconnected", "failed"].includes(peerConnection.connectionState)) {
        void stopCall();
      }
    };
    dataChannel.addEventListener("open", () => {
      void writeRendererDiagnostic("call.data_channel.open", {});
      setStatus("Listening");
      setMode("listening");
    });
    dataChannel.addEventListener("message", (event) => {
      const realtimeEvent = JSON.parse(event.data);
      void writeRendererDiagnostic("realtime.event", summarizeRealtimeEvent(realtimeEvent));
      void handleRealtimeEvent(realtimeEvent);
    });

    for (const track of localStream.getTracks()) {
      peerConnection.addTrack(track, localStream);
    }
    await writeRendererDiagnostic("call.microphone.tracks_added", describeMediaStream(localStream));

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

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

    await peerConnection.setRemoteDescription({
      type: "answer",
      sdp: await sdpResponse.text(),
    });
    await writeRendererDiagnostic("call.remote_description.set", {
      connectionState: peerConnection.connectionState,
    });

    setCallActive(true);
    setStatus("Connecting");
  } catch (error) {
    await writeRendererDiagnostic("call.error", formatRendererError(error));
    setStatus(`Failed: ${error.message}`);
    await stopCall();
  } finally {
    callToggleButton.disabled = !isOpenAIConnected;
  }
}

async function stopCall() {
  audioLevelMonitor?.stop();
  audioLevelMonitor = null;
  setOrbLevel(0);

  if (dataChannel) {
    dataChannel.close();
    dataChannel = null;
  }

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (localStream) {
    for (const track of localStream.getTracks()) {
      track.stop();
    }
    localStream = null;
  }

  realtimeToolHandler.reset();
  remoteAudioElement.srcObject = null;
  setCallActive(false);
  setMode("idle");
  setStatus(isOpenAIConnected ? "Ready" : "Connect OpenAI");
}

async function handleRealtimeEvent(event) {
  if (await realtimeToolHandler.handleEvent(event)) {
    return;
  }
  if (event.type === "input_audio_buffer.speech_started") {
    setStatus("Listening");
    setMode("listening");
    return;
  }
  if (event.type === "response.output_audio.delta") {
    setStatus("Speaking");
    setMode("speaking");
    return;
  }
  if (event.type === "response.done") {
    setStatus("Listening");
    setMode("listening");
    return;
  }
  if (event.type === "error") {
    setStatus(event.error?.message ?? "Realtime error");
    setMode("idle");
  }
}

async function writeRendererDiagnostic(event, details = {}) {
  try {
    await window.brah.writeDiagnosticLog(event, details);
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

function sendRealtimeDataChannelEvent(event) {
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

  function read() {
    const micLevel = readAnalyserLevel(micAnalyser);
    const remoteLevel = remoteAnalyser ? readAnalyserLevel(remoteAnalyser) : 0;
    const level = Math.max(micLevel, remoteLevel * 1.15);
    smoothedLevel = smoothedLevel * 0.72 + level * 0.28;
    setOrbLevel(smoothedLevel);
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

connectOpenAIButton.addEventListener("click", connectOpenAI);
permissionsToggleButton.addEventListener("click", () => {
  permissionsPanelElement.hidden = !permissionsPanelElement.hidden;
  if (!permissionsPanelElement.hidden) {
    void refreshOsPermissions();
  }
});
permissionsRefreshButton.addEventListener("click", () => {
  void refreshOsPermissions();
});
diagnosticsOpenButton.addEventListener("click", () => {
  void window.brah.openDiagnosticLog();
});
callToggleButton.addEventListener("click", toggleCall);
setOrbLevel(0);

refreshOpenAIStatus().catch((error) => {
  setOpenAIConnected(false);
  setStatus(`Status failed: ${error.message}`);
});
refreshOsPermissions().catch((error) => {
  setStatus(`Permissions failed: ${error.message}`);
});
