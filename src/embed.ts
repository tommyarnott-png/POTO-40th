/**
 * The page's side of its relationship with a frame embedding it (see
 * docs/EMBED.md). It reports its height, so a cross-origin iframe can size itself
 * to the content, and it asks the parent to scroll to in-page targets, since the
 * parent is what moves. Each message is the kind the host page's listener
 * expects: a type string and a number and nothing else.
 *
 * The target origin is left open: the parent is a Phantom domain whose origin is
 * not yet known, so checking where the message came from is the parent's job.
 */
const RESIZE_MESSAGE = "resize-iframe";
const SCROLL_MESSAGE = "scroll-iframe";

/** How long the parent has to start moving before the page scrolls itself instead. */
const SCROLL_FALLBACK_MS = 400;
/** Fine enough that any real scroll of a section crosses a step. */
const EVERY_PERCENT = Array.from({ length: 101 }, (_, i) => i / 100);

/** Whether the page is inside another page's frame, where the host supplies its own navigation and introduction. */
export const embedded = window.parent !== window;

if (embedded) {
  // Framed, the parent does the scrolling; see html.embedded in index.css.
  document.documentElement.classList.add("embedded");

  let reported = 0;

  // The body rather than the document element: the root's scroll height never
  // drops below the frame's own height, so a frame sized too tall could not
  // shrink back to fit.
  const report = (force = false) => {
    const height = Math.ceil(document.body.scrollHeight);
    if (height === reported && !force) return;
    reported = height;
    window.parent.postMessage({ type: RESIZE_MESSAGE, height }, "*");
  };

  new ResizeObserver(() => report()).observe(document.body);

  const loaded = document.readyState === "complete"
    ? Promise.resolve()
    : new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
  Promise.all([loaded, document.fonts.ready]).then(() => report(true));
}

/**
 * Brings an in-page target into view.
 *
 * Standalone, the page scrolls itself, smoothly (see scroll-behavior in index.css).
 *
 * Framed, the frame is as tall as the content, so the page has nothing of its own
 * to scroll and the parent is what has to move — and a smooth scroll started inside
 * a cross-origin frame reaches the parent as an instant jump. So the page asks the
 * parent to do it, sending the target's offset from the top of this document; the
 * parent knows where the frame sits on its own page and adds that.
 *
 * A parent with no listener for the request would leave the visitor where they
 * were, so the page watches the target, and if the parent has not moved it within
 * a moment, scrolls itself: Chrome and Firefox pass that on to the parent as the
 * old instant jump. Movement is judged by the target's visible share changing,
 * which a cross-origin frame can observe, and the baseline is taken before the
 * request goes, so a parent that scrolls instantly is not mistaken for one that did
 * nothing. A fixed timer would instead yank the page away from a parent that had
 * scrolled smoothly to its own offset.
 *
 * Safari cannot be covered this way: WebKit does not let a cross-origin frame move
 * its parent at all, by any means, so there the parent's listener is the only thing
 * that makes the link work.
 */
export function bringIntoView(target: HTMLElement) {
  if (!embedded) {
    target.scrollIntoView();
    return;
  }

  const offset = Math.round(target.getBoundingClientRect().top + window.scrollY);
  let baseline: number | undefined;
  let moved = false;

  const observer = new IntersectionObserver((entries) => {
    const share = entries[entries.length - 1].intersectionRatio;
    if (baseline === undefined) {
      baseline = share;
      window.parent.postMessage({ type: SCROLL_MESSAGE, offset }, "*");
      setTimeout(() => {
        observer.disconnect();
        if (!moved) target.scrollIntoView();
      }, SCROLL_FALLBACK_MS);
    } else if (share !== baseline) {
      moved = true;
    }
  }, { threshold: EVERY_PERCENT });
  observer.observe(target);
}
