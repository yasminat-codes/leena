const DEFAULT_CONVERSATION_ID = "default";
const ROLE_LABELS = Object.freeze({
  assistant: "Leena",
  system: "System",
  tool: "Tool",
  user: "You",
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return "";
}

function parseMetadata(metadata) {
  if (isRecord(metadata)) {
    return metadata;
  }
  if (typeof metadata !== "string" || !metadata.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(metadata);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeRole(...values) {
  const role = firstString(...values).toLowerCase();
  return ROLE_LABELS[role] ? role : "assistant";
}

function getRoleIcon(role) {
  if (role === "assistant") {
    return "AI";
  }
  return (ROLE_LABELS[role] ?? role).slice(0, 2).toUpperCase();
}

function truncatePreview(content, maxLength = 120) {
  const normalized = String(content ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function formatTimestamp(value) {
  const fallback = firstString(value);
  if (!fallback) {
    return "Unknown";
  }

  const date = new Date(fallback);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(date);
}

function unwrapEntry(candidate) {
  return isRecord(candidate?.entry) ? candidate.entry : candidate;
}

function normalizeTranscriptEntry(candidate, index = 0) {
  const entry = unwrapEntry(candidate);
  const record = isRecord(entry) ? entry : {};
  const metadata = parseMetadata(record.metadata);
  const content = firstString(record.content, record.preview, record.text, record.message);
  const role = normalizeRole(record.role, metadata.role);
  const conversationId = firstString(
    record.conversationId,
    record.conversation_id,
    metadata.conversationId,
    metadata.conversation_id,
    DEFAULT_CONVERSATION_ID,
  );
  const createdAt = firstString(
    record.createdAt,
    record.created_at,
    record.timestamp,
    record.updatedAt,
    record.updated_at,
  );
  const id = firstString(record.id, `${conversationId}-${createdAt || index}`);

  return {
    content,
    conversationId,
    createdAt,
    icon: getRoleIcon(role),
    id,
    preview: truncatePreview(content || "Saved memory"),
    role,
    roleLabel: ROLE_LABELS[role],
    timestamp: formatTimestamp(createdAt),
  };
}

function compareCreatedAtAscending(left, right) {
  const leftTime = Date.parse(left.createdAt);
  const rightTime = Date.parse(right.createdAt);
  const normalizedLeft = Number.isNaN(leftTime) ? 0 : leftTime;
  const normalizedRight = Number.isNaN(rightTime) ? 0 : rightTime;
  if (normalizedLeft !== normalizedRight) {
    return normalizedLeft - normalizedRight;
  }
  return String(left.id).localeCompare(String(right.id));
}

function compareCreatedAtDescending(left, right) {
  return compareCreatedAtAscending(right, left);
}

function normalizeTranscriptEntries(entries = []) {
  return Array.isArray(entries)
    ? entries.map(normalizeTranscriptEntry).sort(compareCreatedAtAscending)
    : [];
}

function getResponseEntries(response) {
  if (Array.isArray(response)) {
    return response;
  }
  if (!isRecord(response)) {
    return [];
  }
  for (const key of ["entries", "episodes", "items", "data", "results"]) {
    if (Array.isArray(response[key])) {
      return response[key];
    }
  }
  return [];
}

function normalizeConversationGroup(group = {}) {
  const entries = normalizeTranscriptEntries(group.entries);
  const summary = entries[0] ?? normalizeTranscriptEntry({ conversationId: group.conversationId });
  const latest = [...entries].sort(compareCreatedAtDescending)[0] ?? summary;
  const relevance = isRecord(group.relevance) ? group.relevance : null;

  return {
    conversationId: firstString(
      group.conversationId,
      summary.conversationId,
      DEFAULT_CONVERSATION_ID,
    ),
    entries,
    latest,
    relevance,
    summary,
  };
}

function formatConversationLabel(conversationId) {
  if (!conversationId || conversationId === DEFAULT_CONVERSATION_ID) {
    return "Conversation";
  }
  return `Conversation ${conversationId}`;
}

function renderRelevanceBadge(relevance) {
  if (!relevance?.level) {
    return "";
  }

  const className = relevance.level === "high" ? "chip chip--green" : "chip chip--accent";
  const label = relevance.level === "high" ? "High match" : "Medium match";
  return `<span class="${className}" data-activity-relevance="${escapeHtml(relevance.level)}">${label}</span>`;
}

function renderTranscriptRow(entry) {
  return `
    <article class="row" role="listitem" data-activity-id="${escapeHtml(entry.id)}" data-conversation-id="${escapeHtml(entry.conversationId)}" data-role="${escapeHtml(entry.role)}">
      <span class="tooldot lx-mono" aria-hidden="true">${escapeHtml(entry.icon)}</span>
      <div class="row__txt">
        <div class="lx-body screen-text-strong">${escapeHtml(entry.roleLabel)}</div>
        <div class="lx-sm text-dim">${escapeHtml(entry.preview)}</div>
      </div>
      <time class="lx-mono text-faint" datetime="${escapeHtml(entry.createdAt)}">${escapeHtml(entry.timestamp)}</time>
    </article>`;
}

export function renderConversationTranscript(entries = []) {
  const transcript = normalizeTranscriptEntries(entries);
  if (transcript.length === 0) {
    return `
      <div class="row" role="status" data-conversation-transcript-empty="true">
        <span class="tooldot lx-mono" aria-hidden="true">--</span>
        <div class="row__txt">
          <div class="lx-body screen-text-strong">No transcript entries</div>
          <div class="lx-sm text-dim">This conversation has no saved episodic turns.</div>
        </div>
        <time class="lx-mono text-faint" datetime="">Idle</time>
      </div>`;
  }

  return `<div role="list" data-conversation-transcript-list="true">${transcript.map(renderTranscriptRow).join("")}</div>`;
}

export function renderConversationCard(group = {}) {
  const conversation = normalizeConversationGroup(group);
  const label = formatConversationLabel(conversation.conversationId);
  const countLabel = `${conversation.entries.length} ${conversation.entries.length === 1 ? "entry" : "entries"}`;

  return `
    <section class="activity-screen__group" role="group" aria-label="${escapeHtml(label)}" data-activity-conversation="${escapeHtml(conversation.conversationId)}" data-conversation-card>
      <button class="row conversation-card__summary" type="button" data-conversation-toggle aria-expanded="false" aria-controls="conversation-transcript-${escapeHtml(conversation.conversationId)}" data-conversation-id="${escapeHtml(conversation.conversationId)}" data-activity-id="${escapeHtml(conversation.summary.id)}">
        <span class="tooldot lx-mono" aria-hidden="true">${escapeHtml(conversation.summary.icon)}</span>
        <span class="row__txt">
          <span class="lx-body screen-text-strong">${escapeHtml(label)}</span>
          <span class="lx-sm text-dim">${escapeHtml(conversation.summary.preview)}</span>
        </span>
        ${renderRelevanceBadge(conversation.relevance)}
        <span class="lx-mono text-faint">${escapeHtml(countLabel)}</span>
        <time class="lx-mono text-faint" datetime="${escapeHtml(conversation.latest.createdAt)}">${escapeHtml(conversation.latest.timestamp)}</time>
      </button>
      <div id="conversation-transcript-${escapeHtml(conversation.conversationId)}" data-conversation-transcript hidden></div>
    </section>`;
}

async function invokeGetConversation(bridge, conversationId) {
  if (typeof bridge?.getConversation === "function") {
    return bridge.getConversation(conversationId);
  }
  if (typeof bridge?.invoke === "function") {
    return bridge.invoke("memory:get-conversation", { conversationId });
  }

  const memory = bridge?.memory ?? bridge;
  if (typeof memory?.getConversation === "function") {
    return memory.getConversation(conversationId);
  }
  if (typeof memory?.invoke === "function") {
    return memory.invoke("memory:get-conversation", { conversationId });
  }

  throw new Error("Activity screen requires memory:get-conversation.");
}

function renderTranscriptLoading() {
  return `
    <div class="row" role="status" data-conversation-transcript-loading="true">
      <span class="tooldot lx-mono" aria-hidden="true"><span class="dot"></span></span>
      <div class="row__txt">
        <div class="lx-body screen-text-strong">Loading transcript</div>
        <div class="lx-sm text-dim">Fetching saved episodic turns.</div>
      </div>
      <time class="lx-mono text-faint" datetime="">Loading</time>
    </div>`;
}

function renderTranscriptError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return `
    <div class="row" role="status" data-conversation-transcript-error="true">
      <span class="tooldot lx-mono" aria-hidden="true">--</span>
      <div class="row__txt">
        <div class="lx-body screen-text-strong">Unable to load transcript</div>
        <div class="lx-sm text-dim">${escapeHtml(message)}</div>
      </div>
      <time class="lx-mono text-faint" datetime="">Error</time>
    </div>`;
}

function findConversationCard(toggle) {
  return toggle?.closest?.("[data-conversation-card]") ?? null;
}

export async function toggleConversationCard(toggle, bridge) {
  const card = findConversationCard(toggle);
  const transcript = card?.querySelector?.("[data-conversation-transcript]");
  const conversationId = firstString(
    toggle?.dataset?.conversationId,
    card?.dataset?.conversationId,
  );
  if (!card || !transcript || !conversationId) {
    return null;
  }

  const isExpanded = toggle.getAttribute?.("aria-expanded") === "true";
  if (isExpanded) {
    toggle.setAttribute?.("aria-expanded", "false");
    card.dataset.conversationExpanded = "false";
    transcript.hidden = true;
    return { expanded: false, loaded: transcript.dataset.conversationLoaded === "true" };
  }

  toggle.setAttribute?.("aria-expanded", "true");
  card.dataset.conversationExpanded = "true";
  transcript.hidden = false;

  if (transcript.dataset.conversationLoaded === "true") {
    return { expanded: true, loaded: true };
  }

  transcript.innerHTML = renderTranscriptLoading();
  try {
    const response = await invokeGetConversation(bridge, conversationId);
    transcript.innerHTML = renderConversationTranscript(getResponseEntries(response));
    transcript.dataset.conversationLoaded = "true";
    return { expanded: true, loaded: true };
  } catch (error) {
    transcript.innerHTML = renderTranscriptError(error);
    return { expanded: true, error };
  }
}
