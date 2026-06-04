export function renderChat() {
  return `
    <section class="chat-screen integrations-detail-layout" aria-labelledby="chat-heading" data-chat-workspace>
      <aside class="card settings-card chat-screen__rail" aria-labelledby="chat-history-heading" data-chat-history-rail>
        <div class="activity-screen__header">
          <div class="row__txt">
            <h2 id="chat-history-heading" class="lx-h2">Conversations</h2>
            <p class="lx-sm text-dim">Saved turns and drafts</p>
          </div>
          <button class="btn btn--ghost chat-screen__new" type="button" data-chat-new-conversation>
            New
          </button>
        </div>

        <div class="activity-screen__list chat-screen__history-list" role="list" data-chat-conversation-list>
          <button class="row chat-screen__history-row" type="button" role="listitem" aria-current="true" data-chat-conversation-active>
            <span class="tooldot lx-mono" aria-hidden="true"><span class="dot"></span></span>
            <span class="row__txt">
              <span class="lx-body screen-text-strong">New chat</span>
              <span class="lx-sm text-dim">No saved messages yet</span>
            </span>
            <span class="lx-mono text-faint">Draft</span>
          </button>
        </div>
      </aside>

      <section class="card integrations-detail chat-screen__workspace" aria-labelledby="chat-heading">
        <header class="activity-screen__header chat-screen__header">
          <div class="row__txt">
            <h2 id="chat-heading" class="lx-h2">Chat</h2>
            <p class="lx-sm text-dim">Ask, review context, and continue the active thread.</p>
          </div>

          <div class="chat-screen__controls" aria-label="Chat routing">
            <label class="sr-only" for="chat-provider">Chat provider</label>
            <select id="chat-provider" class="settings-select chat-screen__select" data-chat-provider-select>
              <option value="">Default provider</option>
            </select>

            <label class="sr-only" for="chat-model">Chat model</label>
            <select id="chat-model" class="settings-select chat-screen__select" data-chat-model-select>
              <option value="">Default model</option>
            </select>
          </div>
        </header>

        <div class="chat-screen__transcript" role="log" aria-live="polite" data-chat-transcript data-chat-chunk-channel="chat:chunk">
          <article class="chat-bubble chat-bubble--assistant chat-screen__empty" data-role="assistant" data-chat-empty="true">
            <div class="chat-bubble__body">
              <p class="chat-bubble__paragraph">No messages in this conversation.</p>
              <p class="chat-bubble__paragraph">Send a focused request or choose an existing conversation from the rail.</p>
            </div>
            <span class="chat-bubble__status" hidden></span>
          </article>
        </div>

        <form class="chat-input chat-screen__composer" aria-label="Message composer" data-chat-send-path="window.leena.chat.send">
          <button class="btn btn--ghost chat-input__voice chat-screen__voice" type="button" disabled aria-label="Voice input unavailable" title="Voice input not wired yet" data-chat-voice-affordance>
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M10 3.5a2.5 2.5 0 0 0-2.5 2.5v4a2.5 2.5 0 0 0 5 0V6A2.5 2.5 0 0 0 10 3.5Z" stroke="currentColor" stroke-width="1.6" />
              <path d="M5.5 9.5a4.5 4.5 0 0 0 9 0M10 14v2.5M7.5 16.5h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </button>
          <textarea class="chat-input__field settings-input chat-screen__message" rows="2" placeholder="Message Leena" aria-label="Message Leena"></textarea>
          <button class="chat-input__send chat-screen__send" type="submit" aria-label="Send message">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
              <path d="M5 12h13m0 0-5-5m5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </form>
      </section>
    </section>
  `;
}
