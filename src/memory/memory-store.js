export class MemoryStore {
  remember(_text, _metadata = {}) {
    throw new Error("Not implemented");
  }

  recall(_query, _limit) {
    throw new Error("Not implemented");
  }

  getEpisodic(_conversationId) {
    throw new Error("Not implemented");
  }

  consolidate() {
    throw new Error("Not implemented");
  }

  stats() {
    throw new Error("Not implemented");
  }

  close() {
    throw new Error("Not implemented");
  }
}
