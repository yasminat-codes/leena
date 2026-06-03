import { AGENT_PERSONAS, DEFAULT_VOICE } from "../realtime/prompts.js";
import * as defaultSettingsStore from "../settings-store.js";

export const PERSONAS_SETTING_KEY = "personas";
export const ACTIVE_PERSONA_ID_SETTING_KEY = "active_persona_id";
export const DEFAULT_PERSONA_ID = "default";

const SEED_CREATED_AT = "2026-06-01T00:00:00.000Z";
const DEFAULT_RESPONSE_STYLE = "concise";
const SEED_PERSONA_IDS = Object.freeze(["therapist", "explainer", "coach", "honest"]);

export const DEFAULT_LEENA_PERSONA = Object.freeze({
  id: DEFAULT_PERSONA_ID,
  name: "Leena",
  tone: "warm, direct, conversational",
  instructions: "Be warm, direct, conversational, and concise.",
  systemPrompt: "",
  voicePreference: DEFAULT_VOICE,
  responseStyle: DEFAULT_RESPONSE_STYLE,
  isDefault: true,
  createdAt: SEED_CREATED_AT,
});

export class PersonaEngine {
  constructor({ settingsStore = defaultSettingsStore } = {}) {
    if (!settingsStore || typeof settingsStore.setSetting !== "function") {
      throw new TypeError("PersonaEngine requires a settingsStore with setSetting().");
    }
    this.settingsStore = settingsStore;
  }

  getAll() {
    return this.#loadPersonas().map(clonePersona);
  }

  getActive() {
    const personas = this.#loadPersonas();
    const activePersonaId = this.#getString(ACTIVE_PERSONA_ID_SETTING_KEY, DEFAULT_PERSONA_ID);
    return clonePersona(
      personas.find((persona) => persona.id === activePersonaId) ?? getDefaultPersona(personas),
    );
  }

  setActive(personaId) {
    const persona = this.#findPersona(personaId);
    this.settingsStore.setSetting(ACTIVE_PERSONA_ID_SETTING_KEY, persona.id);
    return clonePersona(persona);
  }

  create(personaData) {
    const personas = this.#loadPersonas();
    const normalized = normalizeMutablePersonaData(personaData);
    const persona = normalizePersonaRecord({
      ...normalized,
      id: uniquePersonaId(slugify(normalized.name), personas),
      isDefault: false,
      createdAt: new Date().toISOString(),
    });

    personas.push(persona);
    this.#savePersonas(personas);
    return clonePersona(persona);
  }

  update(id, changes) {
    const personaId = normalizePersonaId(id);
    const personas = this.#loadPersonas();
    const index = personas.findIndex((persona) => persona.id === personaId);
    if (index === -1) {
      throw new RangeError(`Unknown persona: ${personaId}`);
    }
    if (personas[index].isDefault) {
      throw new Error("The default Leena persona cannot be updated.");
    }

    const updated = normalizePersonaRecord({
      ...personas[index],
      ...normalizePersonaChanges(changes),
      id: personas[index].id,
      isDefault: false,
      createdAt: personas[index].createdAt,
    });
    personas[index] = updated;
    this.#savePersonas(personas);
    return clonePersona(updated);
  }

  delete(id) {
    const personaId = normalizePersonaId(id);
    if (personaId === DEFAULT_PERSONA_ID) {
      throw new Error("The default Leena persona cannot be deleted.");
    }

    const personas = this.#loadPersonas();
    const index = personas.findIndex((persona) => persona.id === personaId);
    if (index === -1) {
      throw new RangeError(`Unknown persona: ${personaId}`);
    }

    personas.splice(index, 1);
    this.#savePersonas(personas);
    if (this.#getString(ACTIVE_PERSONA_ID_SETTING_KEY, DEFAULT_PERSONA_ID) === personaId) {
      this.settingsStore.setSetting(ACTIVE_PERSONA_ID_SETTING_KEY, DEFAULT_PERSONA_ID);
    }
    return true;
  }

  #findPersona(personaId) {
    const normalizedId = normalizePersonaId(personaId);
    const persona = this.#loadPersonas().find((item) => item.id === normalizedId);
    if (!persona) {
      throw new RangeError(`Unknown persona: ${normalizedId}`);
    }
    return persona;
  }

  #loadPersonas() {
    const storedPersonas = this.#getJSON(PERSONAS_SETTING_KEY, null);
    if (!Array.isArray(storedPersonas)) {
      const seededPersonas = createSeedPersonas();
      this.#savePersonas(seededPersonas);
      return seededPersonas;
    }

    const { personas, changed } = normalizeStoredPersonas(storedPersonas);
    if (changed) {
      this.#savePersonas(personas);
    }
    return personas;
  }

  #savePersonas(personas) {
    this.settingsStore.setSetting(PERSONAS_SETTING_KEY, personas.map(clonePersona));
  }

  #getJSON(key, defaultValue) {
    if (typeof this.settingsStore.getJSON === "function") {
      return this.settingsStore.getJSON(key, defaultValue);
    }
    if (typeof this.settingsStore.getSetting === "function") {
      const value = this.settingsStore.getSetting(key, defaultValue);
      return value && typeof value === "object" ? value : defaultValue;
    }
    throw new TypeError("PersonaEngine requires a settingsStore with getJSON() or getSetting().");
  }

  #getString(key, defaultValue) {
    if (typeof this.settingsStore.getString === "function") {
      return this.settingsStore.getString(key, defaultValue);
    }
    if (typeof this.settingsStore.getSetting === "function") {
      const value = this.settingsStore.getSetting(key, defaultValue);
      return typeof value === "string" ? value : defaultValue;
    }
    return defaultValue;
  }
}

export function createSeedPersonas(agentPersonas = AGENT_PERSONAS) {
  const personas = [clonePersona(DEFAULT_LEENA_PERSONA)];
  for (const id of SEED_PERSONA_IDS) {
    const seed = agentPersonas?.[id];
    if (!seed) {
      continue;
    }
    personas.push(seedFromAgentPersona(id, seed));
  }
  return personas;
}

function normalizeStoredPersonas(storedPersonas) {
  const personas = [];
  const seenIds = new Set();
  let changed = false;

  for (const storedPersona of storedPersonas) {
    const persona = normalizeStoredPersona(storedPersona);
    if (!persona) {
      changed = true;
      continue;
    }
    if (seenIds.has(persona.id)) {
      changed = true;
      continue;
    }
    seenIds.add(persona.id);
    personas.push(persona);
    if (!samePersona(persona, storedPersona)) {
      changed = true;
    }
  }

  const orderBeforeDefaultSort = personas.map((persona) => persona.id).join("\0");
  if (!seenIds.has(DEFAULT_PERSONA_ID)) {
    personas.unshift(clonePersona(DEFAULT_LEENA_PERSONA));
    changed = true;
  }

  personas.sort((left, right) => {
    if (left.isDefault) {
      return -1;
    }
    if (right.isDefault) {
      return 1;
    }
    return 0;
  });
  if (orderBeforeDefaultSort !== personas.map((persona) => persona.id).join("\0")) {
    changed = true;
  }

  return { personas, changed };
}

function normalizeStoredPersona(storedPersona) {
  if (!storedPersona || typeof storedPersona !== "object") {
    return null;
  }

  try {
    if (storedPersona.id === DEFAULT_PERSONA_ID) {
      return clonePersona(DEFAULT_LEENA_PERSONA);
    }
    return normalizePersonaRecord(storedPersona);
  } catch {
    return null;
  }
}

function seedFromAgentPersona(id, seed) {
  const systemPrompt = typeof seed.prompt === "string" ? seed.prompt.trim() : "";
  return normalizePersonaRecord({
    id,
    name: typeof seed.label === "string" && seed.label.trim() ? seed.label : id,
    tone: extractTone(systemPrompt) || "conversational",
    instructions: stripTonePrefix(systemPrompt),
    systemPrompt,
    voicePreference: DEFAULT_VOICE,
    responseStyle: DEFAULT_RESPONSE_STYLE,
    isDefault: false,
    createdAt: SEED_CREATED_AT,
  });
}

function normalizeMutablePersonaData(personaData) {
  if (!personaData || typeof personaData !== "object") {
    throw new TypeError("Persona data must be an object.");
  }
  return {
    name: requireText(personaData.name, "Persona name"),
    tone: requireText(personaData.tone, "Persona tone"),
    instructions: optionalText(personaData.instructions),
    systemPrompt: optionalText(personaData.systemPrompt),
    voicePreference: optionalText(personaData.voicePreference) || DEFAULT_VOICE,
    responseStyle: optionalText(personaData.responseStyle) || DEFAULT_RESPONSE_STYLE,
  };
}

function normalizePersonaChanges(changes) {
  if (!changes || typeof changes !== "object") {
    throw new TypeError("Persona changes must be an object.");
  }

  const normalized = {};
  if ("name" in changes) {
    normalized.name = requireText(changes.name, "Persona name");
  }
  if ("tone" in changes) {
    normalized.tone = requireText(changes.tone, "Persona tone");
  }
  if ("instructions" in changes) {
    normalized.instructions = optionalText(changes.instructions);
  }
  if ("systemPrompt" in changes) {
    normalized.systemPrompt = optionalText(changes.systemPrompt);
  }
  if ("voicePreference" in changes) {
    normalized.voicePreference = optionalText(changes.voicePreference) || DEFAULT_VOICE;
  }
  if ("responseStyle" in changes) {
    normalized.responseStyle = optionalText(changes.responseStyle) || DEFAULT_RESPONSE_STYLE;
  }
  return normalized;
}

function normalizePersonaRecord(persona) {
  return {
    id: normalizePersonaId(persona.id),
    name: requireText(persona.name, "Persona name"),
    tone: requireText(persona.tone, "Persona tone"),
    instructions: optionalText(persona.instructions),
    systemPrompt: optionalText(persona.systemPrompt),
    voicePreference: optionalText(persona.voicePreference) || DEFAULT_VOICE,
    responseStyle: optionalText(persona.responseStyle) || DEFAULT_RESPONSE_STYLE,
    isDefault: Boolean(persona.isDefault),
    createdAt: optionalText(persona.createdAt) || new Date().toISOString(),
  };
}

function getDefaultPersona(personas) {
  return personas.find((persona) => persona.id === DEFAULT_PERSONA_ID) ?? DEFAULT_LEENA_PERSONA;
}

function uniquePersonaId(baseId, personas) {
  const existingIds = new Set(personas.map((persona) => persona.id));
  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  while (existingIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }
  return `${baseId}-${suffix}`;
}

function slugify(value) {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "persona";
}

function normalizePersonaId(value) {
  return requireText(value, "Persona id").toLowerCase();
}

function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function optionalText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function extractTone(prompt) {
  return prompt.match(/^Tone:\s*([^.]+)\./)?.[1]?.trim() ?? "";
}

function stripTonePrefix(prompt) {
  return prompt.replace(/^Tone:\s*[^.]+\.\s*/, "").trim();
}

function clonePersona(persona) {
  return { ...persona };
}

function samePersona(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
