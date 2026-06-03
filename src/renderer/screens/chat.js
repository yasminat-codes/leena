export function renderChat() {
  return `
    <section class="chat-screen" aria-labelledby="chat-heading">
      <div class="card chat-screen__card">
        <div class="row__txt">
          <h2 id="chat-heading" class="lx-h2">Chat</h2>
          <p class="lx-sm text-dim">Conversation workspace</p>
        </div>
        <article class="row chat-screen__placeholder" data-chat-empty="true">
          <span class="tooldot" aria-hidden="true">
            <span class="dot"></span>
          </span>
          <div class="row__txt">
            <strong class="lx-body screen-text-strong">Leena chat</strong>
            <span class="lx-sm text-dim">Messages will appear here when chat is connected.</span>
          </div>
        </article>
      </div>
    </section>
  `;
}
