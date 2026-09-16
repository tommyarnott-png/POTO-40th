# Embedding the page

The page is built to sit inside an iframe on another site, such as the official
Webflow build. A cross-origin iframe cannot measure its own content or scroll the
page around it, so the page talks to the frame's parent: it reports its height so
the parent can size the frame, and it asks the parent to scroll when a visitor
follows an in-page link.

Staging: `https://poto-40th.tommy-arnott3.workers.dev`

## What the page sends

Two messages, both posted to `window.parent`, both a type string and a number and
nothing else. They are sent with an open target origin, because the page cannot
know which domain will embed it — so the parent must check where each message came
from before acting on it. The code is in `src/embed.ts`; it sends nothing when the
page is not in a frame.

**Height**, whenever it changes, and once more after fonts and images have loaded:

```js
{ type: "resize-iframe", height: 3107 }
```

**Scroll request**, when a visitor follows an in-page link such as "Begin listening":

```js
{ type: "scroll-iframe", offset: 570 }
```

`offset` is the target's distance in pixels from the top of *our* page. The parent
knows where the frame starts on its own page and we do not, so the parent adds that
itself.

> An earlier version of this document gave the height message's type as
> `poto-40th:height`. The page has not sent that since it was changed to
> `resize-iframe`, the type the host's listener expects. A listener written against
> the old name never resizes the frame. With the scrollbar suppression described
> below, that now leaves the bottom of the page unreachable, so check any
> existing integration against the snippet here.

## Parent-side snippet

In Webflow, put this in an Embed element where the player should appear. Change
`POTO_ORIGIN` if the page moves off the staging hostname.

```html
<iframe
  id="poto-40th"
  src="https://poto-40th.tommy-arnott3.workers.dev/"
  title="The Phantom of the Opera: the original cast recording, masters A/B and stems"
  allow="autoplay"
  loading="lazy"
  style="display:block;width:100%;height:3000px;border:0"
></iframe>

<script>
  (function () {
    // The full origin, scheme included: only messages from the embedded page count.
    var POTO_ORIGIN = "https://poto-40th.tommy-arnott3.workers.dev";
    // Height of anything fixed over the top of this page, such as a sticky
    // navigation bar, so a scrolled-to section is not left underneath it.
    var HEADER_OFFSET = 0;
    var frame = document.getElementById("poto-40th");

    window.addEventListener("message", function (event) {
      if (event.origin !== POTO_ORIGIN) return;
      var data = event.data;
      if (!data || typeof data.type !== "string") return;

      if (data.type === "resize-iframe" && typeof data.height === "number") {
        frame.style.height = Math.ceil(data.height) + "px";
      }

      if (data.type === "scroll-iframe" && typeof data.offset === "number") {
        var top = frame.getBoundingClientRect().top + window.scrollY + data.offset - HEADER_OFFSET;
        var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: top, behavior: still ? "auto" : "smooth" });
      }
    });
  })();
</script>
```

- **The resize listener is required.** Inside a frame the page hides its own
  vertical scrollbar (see below), so it relies entirely on the parent to make the
  frame tall enough. A frame left shorter than the content has no scrollbar to
  reach the rest with.
- **The scroll listener is what makes in-page links glide.** A smooth scroll
  started inside a cross-origin frame reaches the parent as an instant jump, so the
  page asks the parent to do the scrolling instead. The snippet honours the
  visitor's reduced-motion setting, as the page itself does when not framed.
- **Without the scroll listener**, the page waits 0.4 seconds, sees the parent has
  not moved, and scrolls itself: Chrome, Edge and Firefox pass that on as an
  instant jump, so the link still works there. **Safari does not**: WebKit lets a
  cross-origin frame move its parent by no means at all, so in Safari — every
  browser on an iPhone included — the link does nothing unless the parent
  implements the scroll listener. Treat it as required for Safari visitors.
- **`allow="autoplay"`** lets the frame start audio. Playback still only begins
  when the visitor presses play, but without it some browsers block Web Audio in
  a cross-origin frame.
- **The starting height** (3000px) is roughly the page's height in a 340–700px
  column: measured at 2,943–3,156px. The frame corrects it within a moment of
  loading, larger or smaller; until then, content past the starting height is
  hidden rather than scrollable.
- **`loading="lazy"`** defers the frame until it is near the viewport. Remove it
  if the player sits at the top of the page.

## Layout inside a frame

- **Scrolling:** the page has no vertical scrollbar of its own when framed
  (`html.embedded` in `src/index.css`). The frame is sized to the content and the
  parent page does the scrolling, so an inner scrollbar was only ever a second,
  redundant one — appearing whenever the content grew a moment before the parent
  caught up. The height the page reports is unaffected by this; it measured the
  same with and without the rule in Chromium, WebKit and Firefox.
- **Width:** checked in a 340px frame and at 360px, 390px, 700px and 768px, with
  no horizontal scrolling. Narrower than 320px the page holds its 320px minimum
  width and scrolls sideways — only the vertical scrollbar is suppressed, so that
  still works. Below 768px each stem row takes two lines, keeping its level slider.
- **Links:** the page has one in-page link, "Begin listening", which scrolls to the
  masters section as described above. The host page supplies the logo and
  navigation, so the page has no header or wordmark of its own.
- **Background:** the smoke background is fixed to the viewport, so inside a
  full-height frame — and on iOS, which does not support fixed backgrounds — it
  stretches over the whole page and looks softer.

## Search engines

Staging is kept out of search results by a `noindex, nofollow` rule, sent both
as an `X-Robots-Tag` header on every response (`public/_headers`) and as a meta
tag in `index.html`. `public/robots.txt` deliberately allows all crawling: a
crawler that is told not to fetch a page never reads its noindex rule, and can
still list the bare URL if another site links to it.

Revisit all three when the site goes public. If the standalone page should
appear in search, remove the header and the meta tag; if only the official
page embedding it should, keep them. Either way the allow-all `robots.txt` is
intentional, not an oversight.
