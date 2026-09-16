# The Phantom of the Opera 40th — stems microsite

A static Vite + React + TypeScript + Tailwind v4 page: a masters A/B (1986
original against the 2026 remaster) and an eight-stem mixer, all playing on one
Web Audio clock. It is built to be embedded in the official site in an iframe.

**Current build state (16 September 2026):** eight passes are done and live on
staging: the production team's feedback, hardening, brand alignment, host-page
embedding, the mix export, the artwork and levels pass, the download gate, and the
Box Five presentation pass (the signup form and the smoke background).
The A/B plays a 104.77s section cut to match the stems. It switches between the two **release
packshots** — AVIF with a JPEG fallback at 320/640/960, `srcset` and `sizes`
against a box that runs 122–240px — not the masks it used to show; clicking one
cuts between the masters in 8ms on an equal-power curve, and a crossfade slider
beneath blends them on an equal-power law at a master level of 0.78 so the blend
never clips. The packshots are full-bleed sleeves, so they carry a drawn edge
that brightens with the mix rather than the screen blend the cut-out masks used.
The page follows the official London site: the real wordmark (AVIF with a PNG
fallback), Jost for all text, the site's palette, heading treatments and button
styling, and very little small print. Waveforms are mirrored canvas bars, the
stems on one shared scale. Stem rows are two lines below 768px, and each row
becomes playable as its own stem decodes; stems that decode after play has been
pressed join the running clock. The eight stems share a **bus trim** before the
output (see Stem bus trim). Audio plays at 40kHz with staged loading and release
(see Loading and memory). A visitor can **render their mix to an MP3** (see The
mix export). Inside a frame the page leaves out its links to other sites and
reports its height to the parent; it is kept out of search indexes. Playback
audio is AAC (masters 128 kbps, stems 96 kbps). **Both downloads now sit behind a
details-capture form** (see The data path): the visitor's own mix, and the
high-quality stem pack served from R2. Not built yet: nothing, beyond uploading
the stem archive itself, which has never been located — the bucket is empty and
the button says so.

The A/B masks (`public/images/mask-original.png`, `mask-remaster.png`) are still
in the repo and still tracked, but nothing renders them: their `BRAND` entries in
`src/assets.ts` are marked unused, as `BRAND.logo` is.

**Staging:** https://poto-40th.tommy-arnott3.workers.dev — deployed with
`npm run deploy` as the Cloudflare Worker `poto-40th`: static assets, plus a
Worker script serving `/api/*` and an R2 bucket for the stem pack.

## Repo map

```
src/pages/Home.tsx        the whole page: both players, the audio engine, waveforms, crossfade slider, export control
src/audioLoader.ts        fetches, decodes, holds and releases a set of tracks
src/mixExport.ts          renders the visitor's stem mix offline and encodes it to MP3
src/consent.ts            the consent wording, verbatim from the Box Five signup; shared by the form and the Worker
src/components/           ErrorBoundary, and SignupModal — the capture form behind both downloads
worker/index.ts           the Worker: POST /api/signup, GET|HEAD /api/download
supabase/migrations/      the signups schema, applied to project sbldznxjtqnwibspcydm
src/assets.ts             asset paths, durations, playback sample rate, stem bus trim, master-alignment constants
src/embed.ts              whether the page is framed; posts its height to the frame
src/data/trackPeaks.json  generated waveform envelopes (npm run peaks)
src/index.css             Tailwind, Jost @font-face, heading treatments, the few custom classes
public/audio/             playback AAC files, committed
public/images/, fonts/    wordmark, release packshots, the unused A/B masks, smoke background, self-hosted Jost
public/_headers           noindex on every response; robots.txt allows crawling so it is read
scripts/build-audio.sh    cuts and encodes the source WAVs (sources are not in git)
tools/                    waveform generator and alignment measurement scripts
docs/                     ASSETS.md (audio, alignment), EMBED.md (iframe snippet, search engines), brand-assets-provenance.md (official site measurements)
wrangler.jsonc            Cloudflare deployment: the Worker entry, run_worker_first, the R2 and rate-limit bindings
```

## Loading and memory

Decoded audio, not the download, is what fills memory: Web Audio holds every
sample as a 32-bit float, and iOS Safari closes a tab that holds too much. So:

- **Nothing downloads on page load.** The masters load when a visitor reaches
  for the A/B: pointer or focus on its card, or play.
- **The stems load when their section is near and the visitor has left the A/B.**
  Near means a marker 200px above the section, the section or the rows is on
  screen (a frame on another origin ignores `rootMargin`). Left means less than
  half the A/B card is on screen and the masters are not playing, since starting
  the masters releases the stems and a load at the A/B would be thrown away. Do
  not move this trigger without re-measuring.
- **One set at a time.** Starting either transport releases the other set; spare
  masters are released once the stems are ready and the visitor has left the A/B.
- **Held small.** Everything decodes at `PLAYBACK_SAMPLE_RATE` (40kHz, above the
  AAC encode's 17.6kHz ceiling), one track at a time; the kick is held as one
  channel (the only genuinely mono stem); each stem's leading and trailing audio
  below −72dBFS, beyond a 0.5s margin, is not held.
- **In time despite the trim.** Trimmed stems start after a delay while the rest
  play from an offset, and engines round a fraction of a frame differently in
  the two, so every stem position is snapped to a whole frame before scheduling.
  Stems that decode late join the running clock a whole number of frames after it
  started. Verified by null test against the untrimmed stems (residual below
  −76dBFS, the trimmed-away tail).

Measured in Chrome's memory-infra after garbage collection: fresh load 46MB;
masters playing 117MB (64MB of it decoded audio); all eight stems loaded with the
masters released 267MB (195MB). The hardening pass started from 431MB with both
sets held and a 1,045MB peak while the stems decoded; its peak afterwards was
468–500MB. The original target of under 200MB with all stems loaded is not met,
because only the kick can be downmixed.

## Stem bus trim

The eight stems run through one shared gain before the output,
`STEM_BUS_TRIM = 0.794` in `src/assets.ts`. **Do not remove it and do not round
it.** Measured: at their 0.86 default the eight stems sum to **+0.51dBFS**, so
before it existed the stem bus clipped at the hardware on a mix nobody had
touched, while the two masters — which carry their 0.78 inside `masterLevels()`
rather than on a bus — peak at −1.97dBFS. 0.794 is 2.01dB down, which puts the
default at −1.4dBFS playing and −1.6dBFS through the export's resample: clear of
full scale and clear of the export's −1dBFS ceiling.

It covers the whole fader range, not just the default. Every fader at 1.0 is the
loudest the bus can be asked for and reaches only −0.28dBFS; solo and mute only
ever remove stems. So nothing a visitor can set will clip it.

What it does **not** do is close the loudness gap to the A/B, and that is not a
bug to fix. The stem sum has a 17.4dB crest where the mastered 2026 file has
14.2dB, so peak-matching and loudness-matching pull opposite ways: the section
reads 2.9LU below the A/B (−17.1 against −14.2 LUFS). Only limiting would close
it, and a limiter would move the balance the visitor set.

## The mix export

`src/mixExport.ts` renders the visitor's fader, solo and mute positions through
an `OfflineAudioContext` that rebuilds the live graph — same bus trim, same
silence-trim compensation, same whole-frame snapping — and encodes the result to
a 44.1kHz 192kbps CBR MP3. It nulls against the transport's own scheduling
**consistently below −130dBFS**, against a deliberately mis-scheduled control at
**about −1dBFS** — a discrimination of roughly 130dB, which is what proves the
null can see a misalignment rather than merely being quiet. Re-run it after any
change to the render path.

Read it as a threshold, not a figure. Repeated runs have given −134.95 and
−138.47 for an unchanged render; that spread is float32 arithmetic noise in the
subtraction, not a regression. Anything in that region is a pass; a shallow null
means tens of dB, not tenths.

Three decisions that look like mistakes and are not:

- **The render runs at 44.1kHz although the player decodes at 40kHz.** MPEG-1 has
  no 40kHz rate. Chrome resamples the buffers in flight; measured, that costs
  **5.8MB**, not the ~200MB a second decode at 44.1kHz would cost. Do not "fix"
  this by re-fetching the stems at a higher rate.
- **Makeup attenuation is applied after the render, never a limiter.** The peak is
  measured and, only if it passes −1dBFS, one constant gain brings it there. Since
  the bus trim landed, a default mix needs none at all; it only fires when a
  visitor pushes faders up, and then lands at exactly −1.00dBFS.
- **The encode runs on the main thread, not in a Web Worker.** It was in a worker,
  and moving it out halved the export's peak — 644MB against 744MB measured
  back to back under identical conditions. The encoder and the data are the same;
  a fresh worker isolate grows its own heap to a plateau under the encode and
  never hands the pages back, where the main thread's heap absorbs the same
  allocations and releases them. Nothing else accounted for it: a worker that only
  passed the blocks back without encoding cost nothing, and the blocks were
  already handed over rather than copied.

  It stays responsive by yielding after every block — 250 blocks at a median of
  8.0ms and a 95th percentile of 9.6ms, so the worst case is a dropped frame, not
  the freeze one uninterrupted encode would cause. **Do not move it back into a
  worker for responsiveness.** That trade was made deliberately: this page is held
  to a memory budget by mobile Safari, and the worker costs more of that budget
  than the yielding costs in smoothness. Live with playback running, the export
  adds 149MB to the renderer on a cold first run and 54MB on a second, the
  difference being allocator growth that is then reused.

  The encoder is loaded by dynamic `import()` so its ~169kB chunk only downloads
  for a visitor who actually exports. Keep it that way.

## The data path

Both downloads sit behind one form. This is the only place a visitor gives
anything back, so it is worth knowing exactly how it is wired before changing it.

**What is collected.** The Box Five Club field set, in that order: first name,
last name and email (required); postcode, country or region, favourite musical
and birthday (optional); and a marketing consent tick that starts unticked and
without which the form will not submit. Also stored: the exact consent wording
shown, which offer the visitor came for, and a source string. **No IP address is
stored** — the table has no column for one, and that is deliberate: it is personal
data whose value here would not justify the obligations.

**Why it looks like someone else's form.** The modal deliberately carries **The Box
Five Club's identity, not this page's**: its gold (`#aa9574` to `#eee0ca`), its
translucent sheet, its field treatment, and its copy verbatim — heading, paragraph,
labels, placeholders and consent sentence. The page around it keeps the official
site's blue-grey. That mismatch is the point: this capture feeds the production's own
mailing operation, so it has to look like the form that audience already signs up
through rather than like a third party asking for their details. Do not "correct" the
modal to the page palette. The measurements are in `docs/brand-assets-provenance.md`
under "The Box Five signup", including which of the three signup surfaces across the
estate this one is — they are not all the same form.

**Where it goes.** One table, `public.signups`, in Supabase project
`sbldznxjtqnwibspcydm` (eu-west-2), created by the migration in
`supabase/migrations/`. Row level security is on, **no policy grants anon or
authenticated anything**, and their table privileges are revoked outright. The
browser never holds a Supabase key or URL, never holds the project ref, and never
speaks to Supabase; it posts to our own Worker and nothing else.

**How the Worker holds its secret.** Three Wrangler secrets, never in the repo and
never in the bundle: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` and
`DOWNLOAD_TOKEN_SECRET`. The URL is a secret rather than a `var` so the project
ref is not committed either. The Worker talks to Supabase over its **HTTP REST
API, never a Postgres connection** — a Micro instance's connection limit is
exhaustible by a traffic spike and HTTP has nothing to exhaust. Validation is
entirely server-side and the client is not trusted: required fields, email shape,
consent strictly `=== true`, bounded lengths, unexpected fields refused outright,
and a birthday only accepted as a complete real date. A Supabase failure returns a
502 with a generic message; the underlying error goes to the logs, never to the
browser. Rate limited to **ten submissions a minute per address** by Cloudflare's
native binding, keyed on the whole address rather than the /24 the token is bound
to, so a shared office address does not run one bucket between everyone behind it.

That ceiling is deliberately loose. The counter is **per Cloudflare edge machine,
not global** — a new connection can land on a different machine with a fresh
budget — so it never was a hard cap, and tightening it only ever risked catching a
real person: one submission per download, another after a mistyped address,
another after moving networks. The controls that actually matter are the
server-side validation and the fact that nothing invalid is ever stored.

**`/api/*` must stay in `run_worker_first`.** Assets get first refusal, and with a
compatibility date past 2025-04-01 a navigation request that misses an asset is
answered `index.html` with a 200. An `<a href="/api/download">` is a navigation
request. Remove that rule and the download silently serves the page's HTML
instead, and a form POST gets a bare 405.

### Two decisions that look like mistakes and are not

**The signups table has no unique constraint on email, and the Worker inserts
rather than upserting.** Do not "fix" this into an upsert. Each row is a consent
event with its own timestamp and its own copy of the wording agreed to; an upsert
would overwrite exactly the record `consent_text` exists to preserve. A visitor
who takes both downloads legitimately produces two rows, which is how the
`download` column tells the two offers apart. The mailing export groups by
address at merge time — that is a one-line `distinct on`, and it is the right
place for it.

**Download authorisation is an HMAC token bound to the requester's address, not a
presigned URL.** Do not "fix" this into a presigned R2 URL. A presigned URL needs
a second credential (S3-style key and secret), and — decisively — **cannot be
bound to the requester**, so it is freely forwardable for its whole lifetime. The
token is HMAC-SHA256 over `payload.address`, carries its own 15-minute expiry,
verifies with a constant-time compare and needs no database lookup. The address is
hashed into the signature and never stored. The Worker streams the object from the
R2 binding, so a 220MB archive is not a memory question.

**It binds to the network, not the whole address — /24 for IPv4, /48 for IPv6.**
Do not tighten this to the exact address. It was exact once, and measurement
showed that refuses ordinary behaviour: IPv6 privacy extensions rotate the
interface identifier, and NAT pools vary the host within a subnet, so a visitor
could be handed an authorisation their own next request was refused. The worst
shape was the availability check passing and the download after it failing, since
they are separate requests. A prefix permits all of that and still refuses a link
opened on a different network, which is the thing worth refusing. IPv6 is expanded
before it is cut, because `2001:db8::1` and `2001:db8:0:1::1` share a /48 but not
a prefix of their written form.

A genuine change of network — wifi to cellular — is still refused, and that is
correct. It recovers without asking anything of the visitor twice: the page keeps
their details for the session, so pressing the button again issues a fresh token
bound to where they are now.

One measurement worth keeping, because it looks like a bug when you first hit it.
Testing this with `curl` gave intermittent 403s, and the cause was not the code:
consumer egress can rotate across *entirely different* networks between
connections — the machine this was built on alternates between two unrelated
addresses, seconds apart. A prefix cannot cover that and should not try. It does
not bite real visitors because a browser reuses one connection for the signup, the
availability check and the download, so all three leave from the same address;
verified against the deployed site, three presses in a row, the token accepted
every time. If you ever test this endpoint with a fresh connection per request,
expect refusals that a browser will never see.

## The smoke background

Two fixed layers behind the content in `src/pages/Home.tsx`: the photograph, carrying
a `brightness(2) contrast(1.16)` filter, and a shaping scrim over it. Not stacked
background-images on one element, because the filter must reach the photograph and
not the darkening above it.

**The filter is not decoration.** `public/images/smoke-bg.jpg` is very dark in its own
right — mean `rgb(27,30,34)`, nothing in it above 112 of 255, four fifths below 48 —
so its whole range sits in the bottom sixth of the scale. There is plenty of texture
inside that range (its spread is as large as its mean); the range simply never rises
far enough to be seen. An earlier pass then raised a flat wash from .20–.48 to
.45–.65 to pass contrast checks, which halved what little was left and made the page
read as flat near-black. Removing the wash alone does not fix it: with no wash at all
the page only reached a mean luminance of 0.0106 against the image's own 0.0156.

**Measured, worst contrast over every text run on the page:** 5.52:1 at 1280px, 5.30:1
at 768px, 5.01:1 at 390px, against a 4.5 requirement. Plate mean luminance roughly
doubled (0.0059 to 0.0118 at 1280px) and its spread rose about fourfold in the flat
regions.

**Check 390px before 1280px.** `cover` crops a narrow viewport into the middle of the
photograph, which is its brightest part, so a phone is the harder case: the settings
that measured 4.78:1 at 1280px measured 3.92:1 at 390px and failed. The binding
constraint throughout is pale blue `#a5bed3` at 13.44px sitting straight on the plate
("Begin listening"); brightening fails that before it fails anything else. Disabled
controls are exempt (WCAG 1.4.3 covers inactive components) and measuring them as
live produces false failures.

**The scrim is shaped, not a flat wash**, and the vertical shaping earns its keep
twice: it holds the very top and bottom near the page's own `#00060f`, so where our
page meets the host page's background there is no tonal step. Verified in a 340px
frame — host `rgb(0,6,15)`, our first rows `rgb(1,7,15)`, our last `rgb(5,9,15)`.

## Why the A/B cannot be perfectly aligned

The 1986 master and the 2026 remix come from different tape transfers and are
different mixes. Measured part by part — each 2026 stem against the 1986 master
— the remix does not keep every part on one timeline: against the drums it moves
the vocals by up to about 45ms, changing phrase by phrase, and sits the guitar
about 17ms late.

The player can give the 1986 master only one start offset and one playback rate,
so it can lock one layer at a time. It is locked to the rhythm section: bass and
percussion sit within about 5ms and the kick within about 13ms, with no drift
across the section. Switching mid-phrase can still slap on the vocal. No single
offset and rate does better than about 34ms somewhere, and only 1986 audio
conformed to the 2026 timeline by the mix engineer would remove the problem.

The measurements and commands are in `docs/ASSETS.md`. Re-measure with
`tools/measure_excerpt_offset.py` whenever either master is replaced.
