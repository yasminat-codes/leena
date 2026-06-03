import { CHAT, EMBEDDINGS } from "../providers/types.js";
import { closeDatabase, getDatabase, getDatabasePath } from "../realtime/tools/database.js";
import { MemoryStore } from "./memory-store.js";

const DEFAULT_CONVERSATION_ID = "default";
const DEFAULT_ROLE = "user";
const VALID_ROLES = new Set(["system", "user", "assistant", "tool"]);
const VECTOR_PREFILTER_LIMIT = 1000;
const MAX_EPISODES_LIMIT = 50;
const MAX_EPISODES_PAGE = 500;
const MAX_EPISODES_QUERY_LENGTH = 200;

export class SQLiteMemoryStore extends MemoryStore {
  constructor({ dbPath = getDatabasePath(), providerRegistry = null } = {}) {
    super();
    this.dbPath = dbPath;
    this.providerRegistry = providerRegistry;
    this.db = getDatabase(this.dbPath);
    this.closed = false;
  }

  async remember(text, metadata = {}) {
    this.assertOpen();
    const content = normalizeContent(text);
    const normalizedMetadata = normalizeMetadata(metadata);
    const embedding = await createEmbedding(this.providerRegistry, content);
    const result = this.db
      .prepare(
        `
          INSERT INTO memories_episodic (conversation_id, role, content, embedding, metadata)
          VALUES (?, ?, ?, ?, ?)
        `,
      )
      .run(
        normalizeConversationId(normalizedMetadata),
        normalizeRole(normalizedMetadata.role),
        content,
        vectorToBlob(embedding),
        stringifyJson(normalizedMetadata, "{}"),
      );
    return Number(result.lastInsertRowid);
  }

  async recall(query, limit = 5) {
    this.assertOpen();
    const normalizedLimit = normalizeLimit(limit);
    if (normalizedLimit === 0) {
      return [];
    }

    const queryText = normalizeContent(query);
    const queryEmbedding = await createEmbedding(this.providerRegistry, queryText);
    const results = [];
    const seen = new Set();

    if (queryEmbedding) {
      for (const candidate of this.loadVectorCandidates()) {
        const candidateEmbedding = blobToVector(candidate.row.embedding);
        const score = cosineSimilarity(queryEmbedding, candidateEmbedding);
        if (score <= 0) {
          continue;
        }
        const key = `${candidate.type}:${candidate.row.id}`;
        seen.add(key);
        results.push({
          entry: mapRow(candidate.type, candidate.row),
          score,
        });
      }
      results.sort(compareRecallResults);
    }

    if (results.length < normalizedLimit) {
      for (const fallback of this.keywordRecall(queryText, normalizedLimit - results.length)) {
        const key = `${fallback.entry.type}:${fallback.entry.id}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        results.push(fallback);
        if (results.length >= normalizedLimit) {
          break;
        }
      }
    }

    return results.slice(0, normalizedLimit);
  }

  getEpisodic(conversationId) {
    this.assertOpen();
    return this.db
      .prepare(
        `
          SELECT id, conversation_id, role, content, embedding, created_at, metadata
          FROM memories_episodic
          WHERE conversation_id = ?
          ORDER BY created_at ASC, id ASC
        `,
      )
      .all(normalizeConversationId({ conversationId }))
      .map((row) => mapEpisodicRow(row));
  }

  getEpisodes(options = {}) {
    this.assertOpen();
    const limit = normalizeBoundedPositiveInteger(
      options.limit ?? 20,
      MAX_EPISODES_LIMIT,
      "episodes limit",
    );
    const page = normalizeBoundedPositiveInteger(
      options.page ?? 1,
      MAX_EPISODES_PAGE,
      "episodes page",
    );
    const query = limitText(normalizeContent(options.query).trim(), MAX_EPISODES_QUERY_LENGTH);
    const offset = (page - 1) * limit;
    const whereClause = query ? "WHERE content LIKE ? ESCAPE '\\'" : "";
    const queryParams = query ? [`%${escapeLikePattern(query)}%`] : [];
    const total = this.db
      .prepare(`SELECT COUNT(*) AS count FROM memories_episodic ${whereClause}`)
      .get(...queryParams).count;
    const entries = this.db
      .prepare(
        `
          SELECT id, conversation_id, role, content, embedding, created_at, metadata
          FROM memories_episodic
          ${whereClause}
          ORDER BY created_at DESC, id DESC
          LIMIT ? OFFSET ?
        `,
      )
      .all(...queryParams, limit, offset)
      .map((row) => mapEpisodicRow(row));

    return {
      entries,
      hasMore: total > page * limit,
      limit,
      page,
      total,
    };
  }

  async consolidate() {
    this.assertOpen();
    const episodes = this.loadUnlinkedEpisodes();
    if (episodes.length === 0) {
      return { episodic: 0, semantic: 0, ids: [] };
    }

    const content = await createConsolidation(this.providerRegistry, episodes);
    const facts = parseFacts(content);
    if (facts.length === 0) {
      return { episodic: episodes.length, semantic: 0, ids: [] };
    }

    const sourceEpisodeIds = episodes.map((episode) => String(episode.id));
    const ids = [];
    const insert = this.db.prepare(
      `
        INSERT INTO memories_semantic (category, content, confidence, embedding, source_episode_ids)
        VALUES (?, ?, ?, ?, ?)
      `,
    );

    for (const fact of facts) {
      const embedding = await createEmbedding(this.providerRegistry, fact);
      const result = insert.run(
        inferFactCategory(fact),
        fact,
        0.85,
        vectorToBlob(embedding),
        JSON.stringify(sourceEpisodeIds),
      );
      ids.push(Number(result.lastInsertRowid));
    }

    return { episodic: episodes.length, semantic: ids.length, ids };
  }

  stats() {
    this.assertOpen();
    return {
      episodic: countRows(this.db, "memories_episodic"),
      semantic: countRows(this.db, "memories_semantic"),
    };
  }

  close() {
    if (this.closed) {
      return;
    }
    closeDatabase(this.dbPath);
    this.db = null;
    this.closed = true;
  }

  assertOpen() {
    if (this.closed || !this.db) {
      throw new Error("SQLiteMemoryStore is closed");
    }
  }

  loadVectorCandidates() {
    return [
      ...selectSemanticRows(this.db, true).map((row) => ({ type: "semantic", row })),
      ...selectEpisodicRows(this.db, true).map((row) => ({ type: "episodic", row })),
    ];
  }

  keywordRecall(query, limit) {
    const rows = [
      ...selectSemanticRows(this.db, false).map((row) => ({ type: "semantic", row })),
      ...selectEpisodicRows(this.db, false).map((row) => ({ type: "episodic", row })),
    ];
    return rows
      .map((candidate) => ({
        entry: mapRow(candidate.type, candidate.row),
        score: keywordScore(query, candidate.row.content),
      }))
      .filter((result) => result.score > 0)
      .sort(compareRecallResults)
      .slice(0, limit);
  }

  loadUnlinkedEpisodes() {
    const linkedEpisodeIds = new Set();
    for (const row of this.db.prepare("SELECT source_episode_ids FROM memories_semantic").all()) {
      for (const id of parseJson(row.source_episode_ids, [])) {
        linkedEpisodeIds.add(String(id));
      }
    }

    return this.db
      .prepare(
        `
          SELECT id, conversation_id, role, content, embedding, created_at, metadata
          FROM memories_episodic
          ORDER BY created_at ASC, id ASC
        `,
      )
      .all()
      .filter((row) => !linkedEpisodeIds.has(String(row.id)))
      .slice(0, 20);
  }
}

export function cosineSimilarity(a, b) {
  const left = normalizeVector(a);
  const right = normalizeVector(b);
  if (!left || !right || left.length !== right.length || left.length === 0) {
    return 0;
  }

  let dot = 0;
  let normLeft = 0;
  let normRight = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index];
    const rightValue = right[index];
    dot += leftValue * rightValue;
    normLeft += leftValue * leftValue;
    normRight += rightValue * rightValue;
  }

  if (normLeft === 0 || normRight === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normLeft) * Math.sqrt(normRight));
}

async function createEmbedding(providerRegistry, text) {
  const providers = getCapabilityProviders(providerRegistry, EMBEDDINGS, "embed");
  for (const provider of providers) {
    try {
      const response = await provider.embed({ input: text });
      const embedding = normalizeEmbeddingResponse(response);
      if (embedding) {
        return embedding;
      }
    } catch {}

    try {
      const response = await provider.embed(text);
      const embedding = normalizeEmbeddingResponse(response);
      if (embedding) {
        return embedding;
      }
    } catch {}
  }
  return null;
}

async function createConsolidation(providerRegistry, episodes) {
  const providers = getCapabilityProviders(providerRegistry, CHAT, "chat");
  const messages = buildConsolidationMessages(episodes);
  for (const provider of providers) {
    try {
      const response = await provider.chat({ messages, temperature: 0, maxTokens: 512 });
      const content = await normalizeChatResponse(response);
      if (content) {
        return content;
      }
    } catch {}

    try {
      const response = await provider.chat(messages);
      const content = await normalizeChatResponse(response);
      if (content) {
        return content;
      }
    } catch {}
  }
  return "";
}

function getCapabilityProviders(providerRegistry, capability, methodName) {
  if (!providerRegistry) {
    return [];
  }

  const providers = [];
  addProvider(
    providers,
    safeCall(() => providerRegistry.getDefault(capability)),
    methodName,
  );
  const candidates = safeCall(() => providerRegistry.getForCapability(capability));
  if (Array.isArray(candidates)) {
    for (const candidate of candidates) {
      addProvider(providers, candidate, methodName);
    }
  } else {
    addProvider(providers, candidates, methodName);
  }
  return providers;
}

function addProvider(providers, provider, methodName) {
  if (!provider || typeof provider[methodName] !== "function" || providers.includes(provider)) {
    return;
  }
  providers.push(provider);
}

function safeCall(callback) {
  try {
    return callback();
  } catch {
    return null;
  }
}

function normalizeEmbeddingResponse(response) {
  if (isRecord(response)) {
    if (Array.isArray(response.embeddings) && response.embeddings.length > 0) {
      return normalizeVector(response.embeddings[0]);
    }
    return normalizeVector(response.embedding);
  }
  return normalizeVector(response);
}

function normalizeVector(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Float32Array) {
    return value.length > 0 && vectorIsFinite(value) ? value : null;
  }
  if (ArrayBuffer.isView(value)) {
    return normalizeVector(Array.from(value));
  }
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const vector = Float32Array.from(value.map((item) => Number(item)));
  return vectorIsFinite(vector) ? vector : null;
}

function vectorIsFinite(vector) {
  for (const value of vector) {
    if (!Number.isFinite(value)) {
      return false;
    }
  }
  return true;
}

function vectorToBlob(vector) {
  if (!vector) {
    return null;
  }
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
}

function blobToVector(blob) {
  if (!blob) {
    return null;
  }
  const buffer = Buffer.from(blob);
  if (buffer.byteLength === 0 || buffer.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) {
    return null;
  }
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return new Float32Array(arrayBuffer);
}

async function normalizeChatResponse(response) {
  if (typeof response === "string") {
    return response.trim();
  }
  if (isRecord(response) && typeof response.content === "string") {
    return response.content.trim();
  }
  if (response && typeof response[Symbol.asyncIterator] === "function") {
    let content = "";
    for await (const chunk of response) {
      content += chunk?.content ?? chunk?.delta ?? "";
    }
    return content.trim();
  }
  return "";
}

function buildConsolidationMessages(episodes) {
  const transcript = episodes.map((episode) => `${episode.role}: ${episode.content}`).join("\n");
  return [
    {
      role: "system",
      content:
        "Summarize these conversation exchanges into discrete facts. Return one durable fact per line. Do not include commentary.",
    },
    {
      role: "user",
      content: transcript,
    },
  ];
}

function parseFacts(content) {
  const trimmed = normalizeContent(content).trim();
  if (!trimmed) {
    return [];
  }

  const parsed = parseJson(trimmed, null);
  const candidates = Array.isArray(parsed) ? parsed : trimmed.split(/\r?\n/);
  const facts = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const fact = normalizeFact(candidate);
    if (!fact || seen.has(fact.toLowerCase())) {
      continue;
    }
    seen.add(fact.toLowerCase());
    facts.push(fact);
  }
  return facts;
}

function normalizeFact(value) {
  const fact = normalizeContent(value)
    .replace(/^\s*(?:[-*]|\d+[.)])\s*/, "")
    .replace(/^["']|["']$/g, "")
    .trim();
  if (!fact || /^no durable facts?\.?$/i.test(fact)) {
    return null;
  }
  return fact;
}

function inferFactCategory(fact) {
  const lower = fact.toLowerCase();
  if (/\b(prefers?|likes?|wants?|needs?)\b/.test(lower)) {
    return "preference";
  }
  if (/\b(name is|called|works at|lives in)\b/.test(lower)) {
    return "profile";
  }
  return "general";
}

function selectSemanticRows(db, embeddedOnly) {
  const rowCount = countRows(db, "memories_semantic");
  const limitClause = rowCount > VECTOR_PREFILTER_LIMIT ? "LIMIT 1000" : "";
  const embeddingClause = embeddedOnly ? "AND embedding IS NOT NULL" : "";
  return db
    .prepare(
      `
        SELECT id, category, content, confidence, embedding, source_episode_ids, created_at,
          last_seen, superseded_by
        FROM memories_semantic
        WHERE superseded_by IS NULL ${embeddingClause}
        ORDER BY last_seen DESC, id DESC
        ${limitClause}
      `,
    )
    .all();
}

function selectEpisodicRows(db, embeddedOnly) {
  const rowCount = countRows(db, "memories_episodic");
  const limitClause = rowCount > VECTOR_PREFILTER_LIMIT ? "LIMIT 1000" : "";
  const embeddingClause = embeddedOnly ? "WHERE embedding IS NOT NULL" : "";
  return db
    .prepare(
      `
        SELECT id, conversation_id, role, content, embedding, created_at, metadata
        FROM memories_episodic
        ${embeddingClause}
        ORDER BY created_at DESC, id DESC
        ${limitClause}
      `,
    )
    .all();
}

function mapRow(type, row) {
  return type === "semantic" ? mapSemanticRow(row) : mapEpisodicRow(row);
}

function mapEpisodicRow(row) {
  return {
    id: String(row.id),
    type: "episodic",
    conversationId: row.conversation_id,
    role: normalizeRole(row.role),
    content: row.content,
    embedding: vectorToArray(blobToVector(row.embedding)),
    createdAt: row.created_at,
    metadata: parseJson(row.metadata, {}),
  };
}

function mapSemanticRow(row) {
  return {
    id: String(row.id),
    type: "semantic",
    category: row.category,
    content: row.content,
    confidence: Number(row.confidence),
    embedding: vectorToArray(blobToVector(row.embedding)),
    sourceEpisodeIds: parseJson(row.source_episode_ids, []).map((id) => String(id)),
    createdAt: row.created_at,
    lastSeen: row.last_seen,
    supersededBy: row.superseded_by === null ? null : String(row.superseded_by),
  };
}

function vectorToArray(vector) {
  return vector ? Array.from(vector) : null;
}

function compareRecallResults(left, right) {
  if (right.score !== left.score) {
    return right.score - left.score;
  }
  return Number(right.entry.id) - Number(left.entry.id);
}

function keywordScore(query, content) {
  const queryText = normalizeContent(query).toLowerCase();
  const contentText = normalizeContent(content).toLowerCase();
  if (!queryText || !contentText) {
    return 0;
  }

  const tokens = Array.from(new Set(queryText.match(/[a-z0-9]+/g) ?? []));
  if (tokens.length === 0) {
    return 0;
  }

  let matches = 0;
  for (const token of tokens) {
    if (contentText.includes(token)) {
      matches += 1;
    }
  }
  const phraseBonus = contentText.includes(queryText) ? 0.25 : 0;
  return Math.min(1, matches / tokens.length + phraseBonus);
}

function normalizeContent(value) {
  return typeof value === "string" ? value : String(value ?? "");
}

function normalizeMetadata(metadata) {
  return isRecord(metadata) ? { ...metadata } : {};
}

function normalizeConversationId(metadata) {
  const value = metadata.conversationId ?? metadata.conversation_id;
  return typeof value === "string" && value.trim() ? value.trim() : DEFAULT_CONVERSATION_ID;
}

function normalizeRole(role) {
  return VALID_ROLES.has(role) ? role : DEFAULT_ROLE;
}

function normalizeLimit(limit) {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.floor(parsed);
}

function normalizeBoundedPositiveInteger(value, maxValue, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new TypeError(`Memory ${label} must be a positive integer.`);
  }
  return Math.min(Math.floor(parsed), maxValue);
}

function limitText(value, maxLength) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function countRows(db, tableName) {
  return db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get().count;
}

function stringifyJson(value, fallback) {
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function parseJson(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
