export const MOCK_INTEGRATIONS_DATA = Object.freeze([
  Object.freeze({
    id: "gmail",
    name: "Gmail",
    description: "Read, summarize, draft, and triage email threads.",
    icon: "G",
    iconGradient: "grad",
    status: "connected",
  }),
  Object.freeze({
    id: "google-calendar",
    name: "Google Calendar",
    description: "Prep meetings, inspect availability, and create events.",
    icon: "C",
    iconGradient: "accent",
    status: "connected",
  }),
  Object.freeze({
    id: "browser",
    name: "Browser",
    description: "Navigate local pages, inspect screens, and automate clicks.",
    icon: "B",
    iconGradient: "iris",
    status: "connected",
  }),
  Object.freeze({
    id: "notion",
    name: "Notion",
    description: "Search workspace notes and capture durable decisions.",
    icon: "N",
    iconGradient: "mono",
    status: "connected",
  }),
  Object.freeze({
    id: "slack",
    name: "Slack",
    description: "Scan channel context and draft teammate updates.",
    icon: "S",
    iconGradient: "coral",
    status: "connected",
  }),
  Object.freeze({
    id: "github",
    name: "GitHub",
    description: "Inspect issues, pull requests, code, and CI state.",
    icon: "H",
    iconGradient: "dark",
    status: "connected",
  }),
  Object.freeze({
    id: "figma",
    name: "Figma",
    description: "Read design context and turn UI references into screens.",
    icon: "F",
    iconGradient: "aurora",
    status: "available",
  }),
  Object.freeze({
    id: "filesystem-mcp",
    name: "Filesystem MCP",
    description: "Local file search and document context for project work.",
    icon: "M",
    iconGradient: "mcp",
    status: "mcp",
  }),
  Object.freeze({
    id: "postgres-mcp",
    name: "Postgres MCP",
    description: "Query local and hosted databases through approved tools.",
    icon: "P",
    iconGradient: "mcp",
    status: "mcp",
  }),
]);

const STATUS_CHIP = Object.freeze({
  available: Object.freeze({ className: "chip chip--accent", label: "+ Connect" }),
  connected: Object.freeze({ className: "chip chip--green", label: "On" }),
  mcp: Object.freeze({ className: "chip chip--mcp", label: "MCP" }),
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderIntegrationTile(integration) {
  const status = STATUS_CHIP[integration.status];

  return `
    <article class="card integrations-tile" data-integration-id="${escapeHtml(integration.id)}">
      <header class="integrations-tile__head">
        <span class="tooldot integrations-tile__icon" data-icon-gradient="${escapeHtml(
          integration.iconGradient,
        )}" aria-hidden="true">${escapeHtml(integration.icon)}</span>
        <span class="${status.className}">${escapeHtml(status.label)}</span>
      </header>
      <div class="integrations-tile__body">
        <h2 class="lx-h3">${escapeHtml(integration.name)}</h2>
        <p class="lx-sm text-dim">${escapeHtml(integration.description)}</p>
      </div>
    </article>
  `;
}

export function renderIntegrations() {
  const connectedCount = MOCK_INTEGRATIONS_DATA.filter(
    (integration) => integration.status === "connected",
  ).length;

  return `
    <section class="integrations-screen" aria-label="Integrations">
      <header class="panel-glass integrations-header">
        <div class="integrations-header__copy">
          <p class="lx-mono">Connections</p>
          <p class="lx-h1">${connectedCount} connected</p>
          <p class="lx-sm text-dim">${MOCK_INTEGRATIONS_DATA.length} available integrations and MCP servers for Leena's realtime workspace.</p>
        </div>
      </header>

      <section class="integrations-grid" aria-label="Available integrations">
        ${MOCK_INTEGRATIONS_DATA.map(renderIntegrationTile).join("")}
      </section>
    </section>
  `;
}
