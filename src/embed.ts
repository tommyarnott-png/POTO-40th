/**
 * Reports the page's height to the frame embedding it, so a cross-origin iframe
 * can size itself to the content (see docs/EMBED.md). The message carries a type
 * string and a number and nothing else.
 *
 * The target origin is left open: the parent is a Phantom domain whose origin is
 * not yet known, so checking where the message came from is the parent's job.
 */
const MESSAGE_TYPE = "poto-40th:height";

/** Whether the page is inside another page's frame, where the host supplies its own navigation. */
export const embedded = window.parent !== window;

if (embedded) {
  let reported = 0;

  // The body rather than the document element: the root's scroll height never
  // drops below the frame's own height, so a frame sized too tall could not
  // shrink back to fit.
  const report = (force = false) => {
    const height = Math.ceil(document.body.scrollHeight);
    if (height === reported && !force) return;
    reported = height;
    window.parent.postMessage({ type: MESSAGE_TYPE, height }, "*");
  };

  new ResizeObserver(() => report()).observe(document.body);

  const loaded = document.readyState === "complete"
    ? Promise.resolve()
    : new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
  Promise.all([loaded, document.fonts.ready]).then(() => report(true));
}
