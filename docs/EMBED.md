# Embedding the page

The page is built to sit inside an iframe on another site, such as the official
Webflow build. A cross-origin iframe cannot measure its own content or scroll the
page around it, so the page talks to the frame's parent: it reports its height so
the parent can size the frame. It also has a message asking the parent to scroll
to an in-page link, which the framed page does not currently send.

Staging: `https://poto-40th.tommy-arnott3.workers.dev`

## What the page sends

Two message types, both posted to `window.parent`, both a type string and a number
and nothing else; only the height is sent at present. They are sent with an open
target origin, because the page cannot know which domain will embed it — so the
parent must check where each message came from before acting on it. The code is in `src/embed.ts`; it sends nothing when the
page is not in a frame.

**Height**, whenever it changes, and once more after fonts and images have loaded:

```js
{ type: "resize-iframe", height: 2265 }
```

**Scroll request**, when a visitor follows one of the page's own in-page links:

```js
{ type: "scroll-iframe", offset: 570 }
```

**The host does not need a listener for this.** Inside a frame the page has no
in-page links, so it never sends one: its only such link, "Begin listening", belongs
to the introduction it leaves out when framed (see [Layout inside a
frame](#layout-inside-a-frame)). The message stays in the page so that an in-page
link added later can use it; the listener for that case is under [If the page gains
an in-page link](#if-the-page-gains-an-in-page-link).

**To take visitors from the host's introduction to the player, link straight to the
iframe by its id** — `<a href="#poto-40th">` with the snippet below, or
`<a href="#begin">` to `<iframe id="begin">`, as the `/stem-mixer` page's "Begin
listening" already does. That is the right approach: it is an ordinary
link within the host's own page, which is the page that has to move, so no message
is involved and it works in every browser, Safari included. If the host has a fixed
header, give the iframe a `scroll-margin-top` of the header's height so the player
is not left underneath it.

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
  style="display:block;width:100%;height:3550px;border:0"
></iframe>

<script>
  (function () {
    // Lets the player be heard on an iPhone with the silent switch on (see below).
    if (navigator.audioSession) navigator.audioSession.type = "playback";

    // The full origin, scheme included: only messages from the embedded page count.
    var POTO_ORIGIN = "https://poto-40th.tommy-arnott3.workers.dev";
    var frame = document.getElementById("poto-40th");

    window.addEventListener("message", function (event) {
      if (event.origin !== POTO_ORIGIN) return;
      var data = event.data;
      if (!data || typeof data.type !== "string") return;

      if (data.type === "resize-iframe" && typeof data.height === "number") {
        frame.style.height = Math.ceil(data.height) + "px";
      }
    });
  })();
</script>
```

- **The resize listener is required.** Inside a frame the page hides its own
  vertical scrollbar (see below), so it relies entirely on the parent to make the
  frame tall enough. A frame left shorter than the content has no scrollbar to
  reach the rest with.
- **The audio session line is required for iPhones.** Safari puts web audio in
  iOS's ambient category, which the silent switch mutes completely — the player
  runs, and nothing is heard. The page asks for the playback category itself,
  but Safari ignores that request from a cross-origin frame (unless the frame is
  allowed the microphone), so on this page it has to come from the host. As a
  music player would, it pauses anything else playing on the phone once the
  visitor presses play. If adding script is a problem, `allow="autoplay;
  microphone"` on the iframe lets the page set it instead; the page never asks for
  the microphone, so no prompt appears.
- **`allow="autoplay"`** lets the frame start audio. Playback still only begins
  when the visitor presses play, but without it some browsers block Web Audio in
  a cross-origin frame.
- **The starting height** (3550px) is a little taller than the page as it loads in
  any frame from 340px to 1440px wide. Measured framed at every width in that range,
  the page is 3,044–3,504px tall, shortest at 768–769px and tallest at 648–652px, in
  Chromium and WebKit alike. The two report the same height at every width except
  twenty-one between 830px and 1428px (830, 918, 929, 940, 951, 962, 1043, 1046,
  1118, 1143, 1157, 1168, 1193, 1218, 1229, 1242, 1281, 1317, 1353, 1392 and 1428px),
  where the content ends within a sixteenth of a pixel of a half pixel and WebKit
  reports 1px less. The frame is resized to fit within a moment of
  loading. Keep the starting height at or above the content's, and re-measure if
  the page's copy or layout changes: until the first height message arrives,
  anything past it is hidden rather than scrollable. (Earlier versions of this
  document gave 2400px against 2,187–2,384px, before the shop section at the foot;
  2400px against 2,205–2,331px, tallest at 600px, before the
  17 September layout pass; and 3000px against 2,777–2,903px, before the page left
  out its introduction when framed.)
- **The height keeps changing after the first message**, so the listener has to act
  on every one. Below 640px the page is 30px shorter once the stems have loaded,
  because the line under the mix download button, "Available once the stems have
  loaded", goes away. It is 30px taller again whenever they are released, which
  playing the A/B does, unless a message from a mix download was showing there, in
  which case the line takes its place. At the narrowest widths the stems' own
  status line wraps and adds 18px: at 340px while they load (3,260px, then
  3,278px, then 3,230px once they are ready), and at 340–354px if some fail to
  load (3,248px at 340px, 3,232px at 354px). From 640px up, loading the stems changes
  nothing. Messages under the two download buttons can add up to 96px more, and take
  frames 640–652px wide past their loading height, to 3,520px at most — the tallest
  the page gets in any state.
- **The shop section at the foot never changes the height.** Its three product shots
  load lazily, each in a box of a size already reserved, and its prices — read from
  the shop as the page loads — arrive into a line of a fixed height, so a slow
  answer, or none at all, leaves the page exactly as tall as it was. Measured at
  340, 390, 640, 650, 768 and 1440px, in every state above, the page reported its
  own height exactly.
- **`loading="lazy"`** defers the frame until it is near the viewport. Remove it
  if the player sits at the top of the page.

### If the page gains an in-page link

Add this inside the listener above, and set `HEADER_OFFSET` to the height of
anything fixed over the top of the host page. It scrolls the host smoothly to the
target, honouring the visitor's reduced-motion setting as the page does when not
framed.

```js
      if (data.type === "scroll-iframe" && typeof data.offset === "number") {
        var HEADER_OFFSET = 0;
        var top = frame.getBoundingClientRect().top + window.scrollY + data.offset - HEADER_OFFSET;
        var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: top, behavior: still ? "auto" : "smooth" });
      }
```

The page asks rather than scrolling itself because a smooth scroll started inside a
cross-origin frame reaches the parent as an instant jump. Without this listener, the
page waits 0.4 seconds, sees the parent has not moved, and scrolls itself, which
Chrome, Edge and Firefox pass on as that instant jump. Safari does not: WebKit lets a
cross-origin frame move its parent by no means at all, so there the link would do
nothing without the listener.

## Layout inside a frame

- **Introduction:** the page leaves out its own introduction when framed — the
  heading, subheading, paragraph and "Begin listening" link — because the host page
  carries its own directly above the frame. The framed page opens at the A/B
  section, whose heading, "One performance. Two mixes.", becomes the page's `h1`;
  standalone it is an `h2` under the introduction's. Standalone, the page is
  unchanged, so it can still be linked to directly.
- **Scrolling:** the page has no vertical scrollbar of its own when framed
  (`html.embedded` in `src/index.css`). The frame is sized to the content and the
  parent page does the scrolling, so an inner scrollbar was only ever a second,
  redundant one — appearing whenever the content grew a moment before the parent
  caught up. The height the page reports is unaffected by this; it measured the
  same with and without the rule in Chromium, WebKit and Firefox.
- **Width:** checked in frames of every width from 340px to 1440px, with no
  horizontal scrolling. Narrower than 320px the page holds its 320px minimum
  width and scrolls sideways — only the vertical scrollbar is suppressed, so that
  still works. Below 768px each stem row keeps its controls on one 44px line with
  the waveform as a slim strip beneath, so all eight rows fit under their heading on
  a phone.
- **Links:** framed, the page has no in-page links (see the scroll request above).
  The host page supplies the logo and navigation, so the page has no header or
  wordmark of its own. The only links it does have are the three shop cards at the
  foot, and each opens the store in a new tab (`target="_blank"`, `rel="noopener
  noreferrer"`), so none of them ever navigates the host page away. Because of
  `noreferrer` the store is not told where the visitor came from; if that traffic
  should be attributable, the links need tracking parameters instead.
- **Background:** the smoke background is fixed to the viewport, so inside a
  full-height frame — and on iOS, which does not support fixed backgrounds — it
  stretches over the whole page and looks softer.

## What we have seen on the host page

Observed on `phantom-franchise.webflow.io/stem-mixer` on 16 September 2026. All
four are on the host's side of the frame. The first two need fixing before launch,
and the parent-side snippet above covers both; the last two are the host's to fix
if it wishes.

- **Required for audio on iOS: the iframe has no `allow` attribute, and the page sets
  no audio session.** With the silent switch on, an iPhone plays nothing: the player
  runs, and not a sound is heard. Safari files web audio under iOS's ambient
  category, which the silent switch mutes completely. The page asks for the
  playback category itself, but Safari ignores that request from a cross-origin
  frame unless the frame is allowed the microphone. So the host must do one of two
  things. Either add the snippet's audio session line
  (`navigator.audioSession.type = "playback"`), or give the iframe
  `allow="autoplay; microphone"`, which lets the page set the category itself; the
  page never asks for the microphone, so no prompt appears. `allow="autoplay"` alone
  is not enough, because it is the microphone permission that lets the frame set
  the category. Add `allow="autoplay"` in any case, as the snippet does. The
  diagnosis was made in WebKit on a Mac and has not yet been confirmed on a phone.
- **The message listener does not check `event.origin`.** It acts on any message
  whose `type` is `resize-iframe`, whichever window sent it, so any other frame on
  the page can set the player's height — to 0, hiding it. It also reads
  `event.data.type` without checking `event.data` exists, so a `null` message from
  any source throws. The snippet's listener checks the origin against
  `POTO_ORIGIN` and the shape of the data before acting.
- **A light rule and a step in tone above the frame.** `.stem-intro-section` has
  `border-bottom: 1px solid #3b4154`, which draws a line along the top edge of the
  frame, and its background finishes a lighter navy than the page below it:
  measured just above the rule at about `rgb(22, 27, 42)` 1440px wide and
  `rgb(37, 42, 54)` 390px wide, against about `rgb(3, 8, 16)` at the top of the
  frame (`#00060f` under the smoke). The two therefore read as separate panels
  rather than one surface. Removing the border and ending the introduction's
  background on `#00060f` would join them.
- **The scrollbar that comes and goes is the cookie banner's.** Until a visitor
  answers it, the CookieScript banner adds `cookiescript_overlay` to `body`, which
  hides overflow and holds the body to the viewport's height, so the host page has
  no scrollbar; accepting removes the class and the scrollbar appears. That
  scrollbar is the host page's own — the frame never shows one (see Scrolling
  above) — so only one is ever on screen. Where scrollbars take up space (Windows,
  or macOS set to always show them) its arrival also narrows the page by its width:
  in a 390px window, the page and the frame go from 390px to 374px wide, and the
  frame's content from 2,193px to 2,210px tall as the page first loads, which the
  resize message follows.

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
