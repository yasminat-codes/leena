const SOUND_URL = "./assets/click.mp3";
const INTERACTIVE_SELECTOR =
  'button, a[href], [role="button"], [role="menuitem"], [role="tab"], input[type="button"], input[type="submit"], summary';

/**
 * Plays a short click sound on any interactive UI element activation.
 * Uses the Web Audio API so overlapping clicks don't cut each other off,
 * and decodes the asset once and reuses the buffer.
 */
export function initClickSound() {
  let audioContext = null;
  let buffer = null;
  let decodePromise = null;

  function getContext() {
    if (!audioContext) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      audioContext = new Ctor();
    }
    return audioContext;
  }

  async function ensureBuffer(context) {
    if (buffer) return buffer;
    if (!decodePromise) {
      decodePromise = (async () => {
        const response = await fetch(SOUND_URL);
        const arrayBuffer = await response.arrayBuffer();
        buffer = await context.decodeAudioData(arrayBuffer);
        return buffer;
      })();
    }
    return decodePromise;
  }

  async function play() {
    const context = getContext();
    if (!context) return;
    try {
      if (context.state === "suspended") await context.resume();
      const decoded = await ensureBuffer(context);
      const source = context.createBufferSource();
      source.buffer = decoded;
      source.connect(context.destination);
      source.start(0);
    } catch {
      // Audio playback is best-effort; ignore decode/playback failures.
    }
  }

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const trigger = target.closest(INTERACTIVE_SELECTOR);
      if (!trigger) return;
      if (trigger.hasAttribute("disabled") || trigger.getAttribute("aria-disabled") === "true") {
        return;
      }
      if (trigger.dataset.noClickSound !== undefined) return;
      void play();
    },
    true,
  );
}
