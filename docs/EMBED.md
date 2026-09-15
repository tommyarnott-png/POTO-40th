# Embedding the page

The page is built to sit inside an iframe on another site, such as the official
Webflow build. A cross-origin iframe cannot measure its own content, so the page
reports its height to the frame's parent and the parent resizes the frame to fit.

Staging: `https://poto-40th.tommy-arnott3.workers.dev`

## What the page sends

Whenever its height changes, and once more after fonts and images have loaded,
the page posts this to `window.parent`:

```js
{ type: "poto-40th:height", height: 2954 }
```

The message is a type string and a number, nothing else. It is sent with an open
target origin, because the page cannot know which domain will embed it — so the
parent must check where each message came from before acting on it. The code is
in `src/embed.ts`; it does nothing when the page is not in a frame.

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
    // Only trust height messages that really come from the embedded page.
    var POTO_ORIGIN = "https://poto-40th.tommy-arnott3.workers.dev";
    var frame = document.getElementById("poto-40th");

    window.addEventListener("message", function (event) {
      if (event.origin !== POTO_ORIGIN) return;
      var data = event.data;
      if (!data || data.type !== "poto-40th:height" || typeof data.height !== "number") return;
      frame.style.height = Math.ceil(data.height) + "px";
    });
  })();
</script>
```

- **`allow="autoplay"`** lets the frame start audio. Playback still only begins
  when the visitor presses play, but without it some browsers block Web Audio in
  a cross-origin frame.
- **The starting height** (3000px) is roughly the page's height in a 340–700px
  column: measured at 2,943–3,156px. The frame corrects it within a moment of
  loading, larger or smaller.
- **`loading="lazy"`** defers the frame until it is near the viewport. Remove it
  if the player sits at the top of the page.

## Layout inside a frame

- **Width:** checked in a 340px frame and at 360px, 390px, 700px and 768px, with
  no horizontal scrolling. Narrower than 320px the page holds its 320px minimum
  width and scrolls sideways. Below 768px each stem row takes two lines,
  keeping its level slider.
- **Header and links:** the page's sticky header does not stick inside a frame,
  because the frame is as tall as its content and the parent page does the
  scrolling. The in-page links ("Begin listening", the wordmark) scroll the
  parent page instead.
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
