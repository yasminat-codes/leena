/**
 * @typedef {{
 *   id: string;
 *   content: string;
 *   type: "episodic" | "semantic";
 *   embedding?: number[] | null;
 *   createdAt: string;
 *   metadata?: Record<string, unknown>;
 * }} MemoryEntry
 */

/**
 * @typedef {{
 *   id: string;
 *   conversationId: string;
 *   role: "system" | "user" | "assistant" | "tool";
 *   content: string;
 *   embedding?: number[] | null;
 *   createdAt: string;
 *   metadata?: Record<string, unknown>;
 * }} EpisodicEntry
 */

/**
 * @typedef {{
 *   id: string;
 *   category: string;
 *   content: string;
 *   confidence: number;
 *   embedding?: number[] | null;
 *   sourceEpisodeIds: string[];
 *   createdAt: string;
 *   lastSeen: string;
 *   supersededBy?: string | null;
 * }} SemanticEntry
 */

/**
 * @typedef {{
 *   entry: MemoryEntry | EpisodicEntry | SemanticEntry;
 *   score: number;
 * }} RecallResult
 */

export {};
