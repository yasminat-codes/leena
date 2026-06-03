import { DEFAULT_PERSONA_ID, PersonaEngine } from "../identity/persona-engine.js";
import {
  loadAgentProfile as defaultLoadAgentProfile,
  saveAgentProfile as defaultSaveAgentProfile,
} from "../realtime/tools/agent-profile-store.js";
import { LeenaError, serializeError } from "../utils/errors.js";

export const IDENTITY_IPC_CHANNELS = Object.freeze({
  listPersonas: "identity:list-personas",
  switchPersona: "identity:switch-persona",
  createPersona: "identity:create-persona",
  updatePersona: "identity:update-persona",
  deletePersona: "identity:delete-persona",
});

export const IDENTITY_DEFAULT_PERSONA_PROTECTED = "IDENTITY_DEFAULT_PERSONA_PROTECTED";
export const IDENTITY_IPC_ERROR = "IDENTITY_IPC_ERROR";

export function registerIdentityHandlers({ ipcMain, ...options } = {}) {
  if (!ipcMain || typeof ipcMain.handle !== "function") {
    throw new TypeError("ipcMain.handle is required to register identity handlers.");
  }

  const handlers = createIdentityIpcHandlers(options);
  ipcMain.handle(IDENTITY_IPC_CHANNELS.listPersonas, handlers.listPersonas);
  ipcMain.handle(IDENTITY_IPC_CHANNELS.switchPersona, handlers.switchPersona);
  ipcMain.handle(IDENTITY_IPC_CHANNELS.createPersona, handlers.createPersona);
  ipcMain.handle(IDENTITY_IPC_CHANNELS.updatePersona, handlers.updatePersona);
  ipcMain.handle(IDENTITY_IPC_CHANNELS.deletePersona, handlers.deletePersona);

  return {
    channels: IDENTITY_IPC_CHANNELS,
    handlers,
  };
}

export function createIdentityIpcHandlers(options = {}) {
  const { personaEngine } = normalizeIdentityDependencies(options);

  return {
    listPersonas: () => personaEngine.getAll(),
    switchPersona: (_event, payload) =>
      personaEngine.setActive(readPersonaId(payload, "personaId")),
    createPersona: (_event, personaData) => personaEngine.create(personaData),
    updatePersona: (_event, idOrPayload, changes) => {
      const payload = parseUpdatePayload(idOrPayload, changes);
      return personaEngine.update(payload.id, payload.changes);
    },
    deletePersona: (_event, payload) => {
      const id = readPersonaId(payload, "id");
      try {
        return {
          ok: true,
          id,
          deleted: Boolean(personaEngine.delete(id)),
        };
      } catch (error) {
        return {
          ok: false,
          id,
          error: serializeIdentityIpcError(error),
        };
      }
    },
  };
}

export function createAgentProfileIdentityAdapters(options = {}) {
  const {
    personaEngine,
    loadAgentProfile = defaultLoadAgentProfile,
    saveAgentProfile = defaultSaveAgentProfile,
  } = normalizeProfileDependencies(options);

  return {
    getAgentProfile: () =>
      extendAgentProfileWithActivePersona(loadAgentProfile(), personaEngine.getActive()),
    setAgentProfile: (_event, profile = {}) => {
      const personaId = readProfilePersonaId(profile);
      if (personaId) {
        personaEngine.setActive(personaId);
      }

      const savedProfile = saveAgentProfile(stripIdentityProfileFields(profile));
      return extendAgentProfileWithActivePersona(savedProfile, personaEngine.getActive());
    },
  };
}

export function extendAgentProfileWithActivePersona(profile = {}, activePersona) {
  const persona = cloneRecord(activePersona);
  const extendedProfile = {
    ...profile,
    persona: persona.id,
    personaId: persona.id,
    activePersona: persona,
  };

  if (typeof profile?.persona === "string" && profile.persona.trim()) {
    extendedProfile.legacyPersona = profile.persona.trim();
  }

  return extendedProfile;
}

export function stripIdentityProfileFields(profile = {}) {
  if (!isRecord(profile)) {
    return {};
  }

  const normalizedProfile = { ...profile };
  delete normalizedProfile.personaId;
  delete normalizedProfile.activePersona;
  delete normalizedProfile.legacyPersona;

  if (isRecord(normalizedProfile.persona)) {
    delete normalizedProfile.persona;
  }

  return normalizedProfile;
}

export function serializeIdentityIpcError(error) {
  const message = error instanceof Error ? error.message : String(error);
  const code = isDefaultPersonaProtectionError(error)
    ? IDENTITY_DEFAULT_PERSONA_PROTECTED
    : IDENTITY_IPC_ERROR;
  return serializeError(new LeenaError(message, { code }), {
    includeStack: false,
    redactSecrets: true,
  });
}

export const IDENTITY_CHANNELS = IDENTITY_IPC_CHANNELS;
export const createIdentityHandlers = createIdentityIpcHandlers;
export const createAgentProfileAdapters = createAgentProfileIdentityAdapters;

function normalizeIdentityDependencies(options) {
  const personaEngine = options.personaEngine ?? new PersonaEngine(options);
  assertPersonaEngineShape(personaEngine);
  return { personaEngine };
}

function normalizeProfileDependencies(options) {
  const personaEngine = options.personaEngine ?? new PersonaEngine(options);
  assertPersonaEngineShape(personaEngine);

  if (
    typeof options.loadAgentProfile !== "undefined" &&
    typeof options.loadAgentProfile !== "function"
  ) {
    throw new TypeError("loadAgentProfile must be a function.");
  }
  if (
    typeof options.saveAgentProfile !== "undefined" &&
    typeof options.saveAgentProfile !== "function"
  ) {
    throw new TypeError("saveAgentProfile must be a function.");
  }

  return {
    personaEngine,
    loadAgentProfile: options.loadAgentProfile,
    saveAgentProfile: options.saveAgentProfile,
  };
}

function assertPersonaEngineShape(personaEngine) {
  for (const method of ["getAll", "getActive", "setActive", "create", "update", "delete"]) {
    if (typeof personaEngine?.[method] !== "function") {
      throw new TypeError(`personaEngine.${method} is required.`);
    }
  }
}

function parseUpdatePayload(idOrPayload, changes) {
  if (isRecord(idOrPayload)) {
    return {
      id: readPersonaId(idOrPayload, "id"),
      changes: idOrPayload.changes,
    };
  }
  return {
    id: readPersonaId(idOrPayload, "id"),
    changes,
  };
}

function readPersonaId(payload, preferredKey) {
  if (typeof payload === "string") {
    return normalizePersonaId(payload);
  }

  if (!isRecord(payload)) {
    throw new TypeError("Persona payload must be an object or id string.");
  }

  if (typeof payload[preferredKey] === "string") {
    return normalizePersonaId(payload[preferredKey]);
  }
  if (preferredKey === "personaId" && typeof payload.id === "string") {
    return normalizePersonaId(payload.id);
  }
  if (preferredKey === "id" && typeof payload.personaId === "string") {
    return normalizePersonaId(payload.personaId);
  }

  throw new TypeError(`Persona payload requires ${preferredKey}.`);
}

function readProfilePersonaId(profile) {
  if (!isRecord(profile)) {
    return null;
  }
  if (typeof profile.personaId === "string" && profile.personaId.trim()) {
    return normalizePersonaId(profile.personaId);
  }
  if (
    isRecord(profile.persona) &&
    typeof profile.persona.id === "string" &&
    profile.persona.id.trim()
  ) {
    return normalizePersonaId(profile.persona.id);
  }
  if (typeof profile.persona === "string" && profile.persona.trim()) {
    return normalizePersonaId(profile.persona);
  }
  return null;
}

function normalizePersonaId(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError("Persona id must be a non-empty string.");
  }
  return value.trim().toLowerCase();
}

function isDefaultPersonaProtectionError(error) {
  return (
    error instanceof Error &&
    /default Leena persona cannot be (?:deleted|updated)/i.test(error.message)
  );
}

function cloneRecord(record) {
  if (!isRecord(record)) {
    throw new TypeError("Active persona must be an object.");
  }
  const clone = { ...record };
  if (typeof clone.id !== "string" || !clone.id.trim()) {
    clone.id = DEFAULT_PERSONA_ID;
  }
  return clone;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
