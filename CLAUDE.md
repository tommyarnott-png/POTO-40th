# The Phantom of the Opera 40th — stems microsite

A static Vite + React + TypeScript + Tailwind v4 page: a masters A/B (1986
original against the 2026 remaster) and an eight-stem mixer, all playing on one
Web Audio clock. It is built to be embedded in the official site in an iframe.

**Current build state (19 September 2026):** thirteen passes are done and live on
staging, and new signups are now forwarded from the database to the production's
Zapier hook, and on to Dotdigital, by a trigger that leaves the capture path
untouched (see The data path — Forwarding to Zapier). The thirteenth pass added the
**shop section** at the foot of the page: the three Phantom 40th physical releases,
each card a single link out to its product page on the official UK store, with
prices and pre-order labels read from the store at every visit rather than written
into the page (see The shop section). The passes: the production
team's feedback, hardening, brand alignment, host-page embedding, the mix export,
the artwork and levels pass, the download gate, the Box Five presentation pass
(the signup form and the smoke background), the frame pass (in-page scrolling and
the scrollbar when embedded, see The frame
relationship), and the client-review pass: the 1986 master's distortion and level
(see The 1986 master), a uniform background (see The smoke background), wider stem
rows with a one-line phone layout, and the iPhone audio session (see Audio on an
iPhone — applied but not yet confirmed on a device); the embed-cleanup pass: the
hero is hidden when framed, with the A/B heading promoted to `h1` in its place, the
rules between sections and the stem list's tint are gone, and `docs/EMBED.md` and
`README.md` were brought up to date (see The frame relationship); and the
presentation pass for the production team. In that pass both section introductions
are centred with balanced lines, the headings across the 700px introduction column
and the paragraphs on a 620px measure; "Reset mix" sits on its own line above the
stem list; the A/B title is set as the official site's h3 (19px); the download
blocks are down to heading and button, apart from the one line below; and the rest
of the small print was reviewed and kept. The pass settled five things that are
easy to undo by accident:
- **The A/B status line must never move the play button.** The masters start
  loading when a finger lands on the card, so "Loading" appears mid-tap, and a
  status that pushed the button down made Chromium drop the first tap. Below 768px
  the title has a line of its own, sized from the header's width (`cqi`) so it never
  truncates, and the status sits between the button and the time.
- **On phones, download messages sit below their button** for the same reason.
- **The only idle line in the download blocks is "Available once the stems have
  loaded"**, in the mix block: below the button on phones, under the heading beside
  it from 640px. It shows while the stems are idle or loading, unless an export is
  running or a mix download has left a message; releasing the stems (playing the A/B
  does) clears that message so the line comes back. By the client's request, the
  other idle lines are gone and should stay gone.
- **Centred section headings are shifted right by half their tracking**
  (`position: relative`). Padding does the same centring but changes where they wrap.
- **"the original master" is held together with no-break spaces.** A `nowrap` span
  overflowed its line in WebKit.

The framed heights in `docs/EMBED.md` were re-measured at every width after that pass,
and again after the shop section: 3,044–3,504px at load across 340–1440px, 3,520px at
its tallest in any state, so the snippet's starting height is now 3,550px.

The A/B plays a 104.77s section cut to match the stems. It switches between the two **release
packshots** — AVIF with a JPEG fallback at 320/640/960, `srcset` and `sizes`
against a box that runs 122–240px — not the masks it used to show; clicking one
cuts between the masters in 8ms on an equal-power curve, and a crossfade slider
beneath blends them on an equal-power law at a master level of 0.78 so the blend
never clips. The 1986 side is deliberately 1dB under a loudness match. The
packshots are full-bleed sleeves, so they carry a drawn edge
that brightens with the mix rather than the screen blend the cut-out masks used.
The page follows the official London site — the host page supplies the wordmark
and navigation — with Jost for all text, the site's palette, heading treatments and button
styling, and very little small print. Waveforms are mirrored canvas bars, the
stems on one shared scale. A stem row reads like a mixer channel — play, name,
solo, mute, level, waveform — on one line from 768px; below that its controls share
one 44px line with the waveform as a slim strip beneath, so all eight rows fit
under their heading on a phone. Each row
becomes playable as its own stem decodes; stems that decode after play has been
pressed join the running clock. The eight stems share a **bus trim** before the
output (see Stem bus trim). Audio plays at 40kHz with staged loading and release
(see Loading and memory). A visitor can **render their mix to an MP3** (see The
mix export). Inside a frame the page leaves out its hero, reports its height to the
parent, and hides its own vertical scrollbar (see The frame
relationship); it is kept out of search indexes. Playback audio is AAC
(masters 128 kbps, stems 96 kbps). **Both downloads now sit behind a
details-capture form** (see The data path): the visitor's own mix, and the
high-quality stem pack served from R2. The stem archive is now in the bucket
(`GroupedStems-ForWebsite.zip`, 220,322,302 bytes, eight 44.1kHz 24-bit WAVs) and
has been downloaded through the gate end to end, byte-identical to the object,
standalone and from inside a cross-origin frame. The page ends with the **shop
section** (see The shop section): three cards for the physical releases, whose
prices and pre-order labels come from the store live. Not built yet: nothing.

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
src/shop.ts               the three releases the foot of the page sells, and the live read of their prices; the only place a store is named
src/components/           ErrorBoundary, and SignupModal — the capture form behind both downloads
worker/index.ts           the Worker: POST /api/signup, GET|HEAD /api/download
supabase/migrations/      the signups schema, applied to project sbldznxjtqnwibspcydm
src/assets.ts             asset paths, durations, playback sample rate, stem bus trim, master-alignment constants
src/embed.ts              whether the page is framed; posts its height, and scroll requests for in-page links, to the parent
src/data/trackPeaks.json  generated waveform envelopes (npm run peaks)
src/index.css             Tailwind, Jost @font-face, heading treatments, the few custom classes
public/audio/             playback AAC files, committed
public/images/, fonts/    wordmark, release packshots, the shop's product shots, the unused A/B masks, smoke background, self-hosted Jost
public/_headers           noindex on every response; robots.txt allows crawling so it is read
scripts/build-audio.sh    cuts and encodes the source WAVs (sources are not in git)
tools/                    waveform generator and alignment measurement scripts
docs/                     ASSETS.md (audio, alignment), EMBED.md (the two frame messages, the host snippet, what we have seen on the host page, search engines), brand-assets-provenance.md (official site measurements)
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
- **Held small.** Everything is held at `PLAYBACK_SAMPLE_RATE` (40kHz, above the
  AAC encode's 17.6kHz ceiling), one track at a time; the kick is held as one
  channel (the only genuinely mono stem); each stem's leading and trailing audio
  below −72dBFS, beyond a 0.5s margin, is not held. The one exception to how it is
  *decoded* is the 1986 master (see The 1986 master): it decodes at 39,924Hz and is
  copied into a 40kHz buffer, so for that one decode the two copies coexist — about
  33.5MB more at that moment, by arithmetic from the code rather than measured. What
  is held afterwards is the same size as before, and the masters' peak stays well
  under the stems'.
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
rather than on a bus — peaked at −1.97dBFS at the time (their levels now are under
The 1986 master). 0.794 is 2.01dB down, which puts the
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

## The 1986 master

The client heard the 1986 side distort. It was never clipping: through the live
gain path, no crossfade position reaches 0dBTP in Chrome's or Safari's decode. The
cause was how its speed was applied, and its level was separately off. Three
decisions follow, and each looks like something to tidy up. None is.

**It is decoded at 39,924Hz so that it plays at rate 1. Do not "simplify" this back
to a `playbackRate`.** The 1986 side has to run 1.00191398 fast to stay locked to the
2026 (see Why the A/B cannot be perfectly aligned). It used to get that from
`playbackRate`, and browsers resample a buffer source by interpolating between
neighbouring samples, which moves every read off the sample grid. Measured on a sine
at this rate, Chrome and Safari left distortion **18dB down at 10kHz** (32dB at
5kHz, 8.6dB at 15kHz) and took up to 4dB off the top; Firefox was worse. On the 1986
master itself the error came to −39.9 LUFS under music at −13.9 — audible, and only
on the 1986 side, because the 2026 plays at exactly 1 and passes through bit-exact.
Decoding the file at `OLD_MASTER_DECODE_RATE` and holding the samples as 40kHz gives
the same speed through each engine's own converter instead: **73–93dB down** across
the band in Chrome, Safari and Firefox. Putting any `playbackRate` other than 1
back on either master brings the distortion back.

- **A whole number** — `Math.round(40000 / 1.00191398)` — because Firefox truncates a
  fractional decode rate (it decoded 39,923.59 as 39,923), while all three engines
  are clean at an integer. The 1986 side therefore runs 1.0019036 fast rather than
  1.00191398; its offset is worked out afresh from the measured mapping at every
  start and seek, so the difference only builds while it plays, to 1.1ms across the
  whole section, inside the 5ms the rhythm section is aligned to.
- **Both masters start on whole frames.** Safari reads a buffer from a fractional
  offset by interpolating even at rate 1, which took up to 4dB off the top at 15kHz.
- **The sample rate stays 40kHz.** A context at any other rate would put exactly this
  interpolation between the context and every buffer, stems included (see Audio on an
  iPhone).

**`OLD_MASTER_GAIN_COMPENSATION` is a measurement: the loudness match.** +1.79dB,
from the two sides' integrated loudness (BS.1770) over the section as it plays,
−13.92 against −12.13 LUFS at unity. It exists so the A/B compares the two mixes
rather than two volumes. It was +1.40dB, set by RMS, which counts the 1986 master's
heavier low end as loudness it does not have; by loudness that left the 1986 side
0.46LU under the remaster before anyone had chosen to. Re-measure it by loudness if
either master is replaced.

**`OLD_MASTER_TILT_DB` is a choice, not a measurement: −1dB, by the client's
request.** The 1986 side plays that much under the match so the remaster lands with
more impact. It makes the 2026 sound better partly for a reason that has nothing to
do with the mix, which is what the match exists to prevent, so it is kept as its own
constant: **set it to 0** to compare the mixes on their own, without touching the
measured figure.

Measured with both: 1986 alone −15.20 LUFS and −1.70dBTP, 2026 alone −14.20 LUFS and
−1.90dBTP — the 1986 side 1.0LU under, which is the tilt and nothing else, with
matching headroom. The loudest crossfade position peaks at −0.60dBTP, and the 8ms
cut moves monotonically between the two levels with no dip or bump.

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

**Verified, not assumed (16 September 2026).** With both of the project's public keys
(the legacy anon JWT and the publishable key), reading, counting, inserting, updating
and deleting were each refused — 401, `42501 permission denied for table signups`.
GraphQL is not enabled, no view or function references the table, and it is not in
the realtime publication. What can read and change it is narrower than "the owner"
but wider than one person: the service key the Worker holds (it bypasses RLS and can
read, edit, delete and truncate; the Worker's code only inserts), and so anyone who
can deploy the `poto-40th` Worker; the `postgres` role, through the database
password; members of the "The Other Songs" Supabase organisation with access to the
project; the Supabase connector on the Claude account used to build this; and
Supabase itself. One hazard for later: this schema's default privileges give anon and
authenticated full rights on any *new* table, so a table added here must have RLS
enabled or its grants revoked when it is created.

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

### Forwarding to Zapier, and on to Dotdigital

The production's mailing list runs on Dotdigital, and the host's team wire that up
in Zapier. Rather than touch the capture path, which works, a database trigger
sends a copy of each new row to a Zapier catch hook. **Supabase stays the system of
record**: nothing here reads back, and whatever Dotdigital does with a contact
changes nothing in the table. Added 17 September 2026 by
`supabase/migrations/20260917161547_forward_signups_to_zapier.sql`; no application
code takes part.

**The hook's URL is a secret in Supabase Vault**, named `zapier_signups_webhook_url`,
and the trigger reads it by that name on each insert. It is in no migration, no
committed file and no log — checked, after the first sends, against the Postgres
logs, the edge logs and `pg_stat_statements`. Rotating it is the one risky moment: a
statement that fails is logged in full, URL and all, so use the recipe at the top of
the migration, which turns that logging off first. The function refuses any URL that
is not an HTTPS Zapier catch hook, because pg_net follows redirects and turns a
redirected POST into a GET without the body — which would look like a success.

**The trigger.** `forward_to_zapier`, AFTER INSERT FOR EACH ROW on `public.signups`,
runs `public.forward_signup_to_zapier()` (SECURITY DEFINER as `postgres`,
`search_path = ''`, `lock_timeout = 2s`, EXECUTE revoked from anon and
authenticated). It posts through **pg_net**, which queues the request inside the
inserting transaction and sends it after commit: a slow or failing Zapier can never
slow or fail a signup, and an insert that rolls back sends nothing. Anything that
goes wrong inside the trigger is caught, so the signup still succeeds; only the
row's id and the SQLSTATE are logged, because pg_net's own messages quote the URL.
The payload is flat JSON, named for whoever maps it in Zapier: `signup_id`,
`signed_up_at` (UTC), `email`, `first_name`, `last_name`, `postcode`,
`country_or_region`, `favourite_musical`, `date_of_birth`, `marketing_consent`,
`marketing_consent_text`, `download_requested` (`mix` or `stem-pack`) and
`signup_source`. Optional fields that were left blank arrive as `null`. The consent
wording travels in full rather than as a flag and a reference: it is the same short
sentence for everyone, so it is not personal data, and Dotdigital's consent record
is built around the wording itself.

**Two columns track the send**, because pg_net keeps its own responses for six hours
only and that setting needs Supabase Support to change. `forward_request_id` is the
pg_net request id; `forward_status` is the outcome:

| `forward_status` | Meaning |
| --- | --- |
| null | the row predates forwarding — the five rows from 16–17 September, which were never sent |
| -1 | waiting: inserted, not yet resolved (the column's default) |
| 0 | nothing came back within 30 minutes: a timeout, a connection error, a send that was never queued, or one lost in a restart |
| 200–299 | Zapier accepted it |
| anything else | what Zapier answered |

The job `record-signup-forward-status` (pg_cron, every 15 minutes) copies each
outcome onto its row while pg_net still holds it, and nudges pg_net's worker, which
can otherwise sit on a queued request until the next signup. **It only accepts a
response that arrived within 30 minutes of the signup**: pg_net's tables and their
id sequence are unlogged, so ids start again from 1 after a crash or a restore, and
an old id would otherwise match a new response and record a lost send as delivered.

**Which signups did not reach Zapier:**

```sql
select id, created_at, email, download, forward_status, forward_request_id
from public.signups
where forward_status not between 200 and 299
  and created_at < now() - interval '45 minutes'
order by created_at;
```

The grace period covers the send, the 30-minute window and a job run. Rows that
predate forwarding are left out by their null status. If everything is suddenly
listed, check the job itself rather than Zapier:

```sql
select j.active, d.status, d.return_message, d.start_time
from cron.job j
left join lateral (select * from cron.job_run_details x where x.jobid = j.jobid order by start_time desc limit 3) d on true
where j.jobname = 'record-signup-forward-status';
```

Two limits worth knowing. **A 2xx only means Zapier's hook accepted the request**;
a Zap that is off, or anything Dotdigital refuses, shows up only in Zap History, so
the Zap should de-duplicate on `signup_id` — pg_net can re-send a request whose
batch failed. And **a database restore re-inserts rows, which fires this trigger
and would send every restored signup to Dotdigital again**: restore with
`session_replication_role = replica`, or disable the trigger for the restore.

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

## The shop section

Three cards at the foot of the page, one per physical release, each a single link
out to its product page on `uk.andrewlloydwebber.shop`. The whole card is the click
target, but there is only ever **one link per card** — it sits on the heading and is
stretched over the card by its own `::after` — so a screen reader hears one link,
not three to the same place. Each opens a new tab: framed, a link that navigated the
top frame would take the host's page away with it.

**Prices, availability and pre-order labels are read from the store at every visit,
and nothing about them is written into the page.** A price in the production's own
name that disagreed with the store would be worse than no price at all. This is not
hypothetical: during the pass that built this, the 3LP dropped from £69.99 to £59.99
while the work was in progress. The page followed it with no change; the figure in
the brief that commissioned it was already wrong.

**The read is Shopify's Storefront API, tokenless, pinned to the UK market**
(`@inContext(country: GB)`), one POST for all three products, on version 2026-07.
Three reasons, each of which rules out the obvious alternative:

- **Not the Ajax API (`/products/<handle>.js`), though it answers cross-origin.**
  Shopify documents it as usable only by themes it hosts, and — decisively — it
  returns a price with **no currency code**. The store sells to 237 countries in 107
  currencies and Shopify picks one from the visitor's own location, so a visitor in
  New York can be handed `2100` for the 2CD, which a page assuming pounds would show
  as "£21.00". `.oembed` and `.json` carry a currency code but are undocumented.
- **Pinned to GB rather than left to follow the visitor**, so every visitor sees the
  same pounds and any other currency is a fault rather than a number under the wrong
  sign. The cost is that a visitor outside the UK may see their own currency when
  they click through, which is a conversion of the same price, not a contradiction.
- **Version 2026-07 is supported until 16 July 2027.** An out-of-support version is
  not an outage — Shopify answers with the oldest it still serves — but move it on.

**Whatever goes wrong, the card simply has no price.** A product that has been
renamed comes back null; a field the store stops sharing comes back null beside the
rest (measured: a refused field nulls only itself); a price in another currency, or
one that does not parse, is dropped. The request is made once as the page loads, and
a failure is swallowed on purpose. **The price line keeps its height whether or not
there is a price in it**, which is what lets a late answer, or none, leave the
reported height untouched (see The frame relationship and `docs/EMBED.md`).

**"Pre-order" follows the store's `preorder` tag**, matched exactly and in
lowercase; `availableForSale: false` shows "Sold out" instead and takes precedence,
because what the store's own theme does with a sold-out pre-order is not knowable
from outside. The tag matches the store's badge on all 53 of its products, but that
the tag *causes* the badge is an inference: a release-date field, the vendor and the
publish date all coincide on the same three products. Tags are documented as needing
an access token and work tokenless today, so if they stop, the labels disappear and
the prices stay — the harmless direction.

**`src/shop.ts` opens with the store configuration, and it is the only place a store
is named.** Changing `STORE_ORIGIN` and the three handles in `STORE_HANDLES` moves
both the links and the live read; the file lists what to check against a new store.

**On the store the brand sites link to.** `phantomoftheopera.com` and
`andrewlloydwebber.com` point their own "Store" links at
`store.andrewlloydwebber.com`, which is a different shop from this one. Measured
there: the box set does not exist (404), and the 3LP and 2CD are `availableForSale:
false` with no `preorder` tag, so pointing this section at it would show two cards
reading "Sold out" and one with no price. `us.` (USD) and `eu.` (EUR) carry all
three at their own prices. This section sells from `uk.` deliberately, and the
introduction above the cards names that store.

**The product shots are ours, not the store's CDN.** AVIF with a JPEG fallback at
240/480/720, from the store's own product images, so the section cannot break when
the store reorganises its assets. `public/images/product-*` needs its `.gitignore`
exception, as the packshots do.

**One thing the links give up:** `rel="noopener noreferrer"` means the store is not
told where the visitor came from, so this traffic is not attributable. Tracking
parameters on the URLs would be the way to get that back.

## The smoke background

Two fixed layers behind the content in `src/pages/Home.tsx`: the photograph, carrying
a `brightness(2) contrast(1.16)` filter, and a flat darkening over it
(`SMOKE_SCRIM`). Not stacked background-images on one element, because the filter
must reach the photograph and not the darkening above it.

**The filter is not decoration.** `public/images/smoke-bg.jpg` is very dark in its own
right — mean `rgb(27,30,34)`, nothing in it above 112 of 255, four fifths below 48 —
so its whole range sits in the bottom sixth of the scale. There is plenty of texture
inside that range (its spread is as large as its mean); the range simply never rises
far enough to be seen without it.

**The darkening is uniform: `rgba(0,6,15,.7)` everywhere, plus the site's side
treatment at exactly 270deg.** An earlier pass shaped it — heavier at the top and
bottom, lighter through the middle — and inside the host's auto-height frame, where
`fixed` means the whole document, that read as bands changing strength down the
page. Any side angle off horizontal drifts down a tall frame in the same way. The
masters section also carried its own 44% darkening, a band at its edges; it has
gone. So have its 1px rules above and below, and the stem list's own tint, taken out
in the embed-cleanup pass so the page reads as one continuous scroll. The rules
inside components stay — between stem rows, along the top of the list, above the
download blocks, and round the A/B card.

**How contrast must be checked: the brightest glyph-sized patch anywhere text can
sit — never a few scroll positions.** The photograph does not move with the page, so
any line of copy can come to rest over any part of it. The check renders the
backdrop alone (content hidden), averages it over a 13px patch, and takes the
brightest patch anywhere in the content column, standalone at 360, 390, 768 and
1440px and down the whole document inside a 340, 390 and 1440px frame; each text
colour is then judged against that. The previous method sampled the background
behind each line at a handful of scroll positions, and **it passed a page that was
failing at 2.8:1** — the shaped overlay, whose contrast depended on where the text
happened to be on screen.

- **Measured at .70:** the worst backdrop is a luminance of 0.042–0.052 standalone
  (1440px is the worst — the photograph is nearest its own scale there) and 0.050
  framed. Small pale-blue labels (`#a5bed3`, 12–13.44px) reach at least 5.37:1, white
  at least 10.3:1, and the section headings' darker gradient stop (`#6a99ab`) 3.33:1.
  A check of every real line of copy in place, alongside, found no failures at any of
  the four widths. Re-run after the shop section, which made the page 850px taller and
  so stretched the framed backdrop further: 0.0427–0.0523 standalone and 0.0507 framed,
  giving 5.33:1, 10.26:1 and 3.30:1 — the same picture, and the section's own colours
  are these three. One trap when re-running it: the smoke is an 882kB background image
  and the load event does not wait for it to be painted, so a shot taken too early
  measures the flat base colour and passes everything.
- **That is why `.section-heading` is 24px on a phone, where the official site sets
  22px.** At 24px the headings count as large text and need 3:1; at 22px they need
  4.5:1, which their dark stop cannot reach over any smoke that is still visible. Do
  not set it back to 22px without re-running the check.
- **The trade, made deliberately:** this much darkening leaves about half the
  visible texture the shaped version had through the middle of the page. No uniform
  treatment kept more and passed at every width — dimming the photograph instead of
  raising the wash traces the same curve. The alternative, if the smoke matters more,
  is a dark backing behind each block of copy rather than over the whole image.
- **Disabled controls are exempt** (WCAG 1.4.3 covers inactive components); measuring
  them as live produces false failures. So does sampling a status line while its
  text is changing — re-measure once it settles.
- The top and bottom edges no longer fade to `#00060f`, so where the page meets the
  host's own background the tone steps. Measured on the host page in the
  embed-cleanup pass: ΔE 11–16 at the top, from the host introduction's 1px rule and
  its lighter navy (in `docs/EMBED.md` under "What we have seen on the host page"),
  and 10–12 at the bottom, where the smoke meets the host's flat background. Inside
  the page there is no seam: ΔE 0.78 at most. A bottom-edge fade would soften the
  lower step but is not uniform, so it was offered and not made.

## The frame relationship

The contract with the host page is in `docs/EMBED.md`; the code is `src/embed.ts`.
The page has two messages for its parent, `{ type: "resize-iframe", height }` and
`{ type: "scroll-iframe", offset }`. Framed, it only ever sends the first, since it
has no in-page links there (see below), so the host needs only the resize listener.
Keep the scroll message and `bringIntoView`'s framed branch: they are what an in-page
link added later would use.

**The page must keep working standalone.** The production team may link out to it
rather than embed it if the embed does not work out, so nothing may be moved onto
the host site or made to depend on a frame. Standalone, in-page links scroll the page
themselves, smoothly, and the page scrolls normally; everything frame-specific is
behind the `embedded` check in `src/embed.ts` and the `html.embedded` class.

**The hero is hidden when framed, not deleted.** The host's `/stem-mixer` page
(phantom-franchise.webflow.io) supplies its own introduction directly above the
frame, in its own markup (`stem-intro-section`), so framed the page renders from the
A/B section down (`{!embedded && …}` in `Home.tsx`) and drops the `pt-15` top
padding; the host's 80px bottom padding and the A/B section's own top padding make
the gap. Standalone, the hero and its "Begin listening" link stay exactly as they
were — do not delete them. The hero carried the page's only `h1`, so framed, "One
performance. Two mixes." is rendered as the `h1` instead of an `h2`; the two share
`.section-heading`, so nothing moves. Keep exactly one `h1` in each state if the
headings change.

The host's own "Begin Listening" is `<a href="#begin">` to the iframe's id, which is
the right way in: it moves the host page, which is what has to move, with no message
involved, and so works in Safari. As of the embed-cleanup pass that page embeds us
without `allow="autoplay"`, and its listener handles only `resize-iframe`, without
an origin check. Its intro's 1px bottom rule and lighter navy, and its cookie
banner's scroll lock (the reason a scrollbar appears and disappears there — ours is
hidden throughout), are written up for the host in `docs/EMBED.md`.

**Host integrations that predate this pass are broken and need re-copying.**
`docs/EMBED.md` documented the height message as `poto-40th:height`, a type the
page has not sent since `c74ab10` changed it to `resize-iframe`. A listener copied
from the old document never resizes the frame — verified: it stays at its 3000px
starting height while the content is 3127px at 340px. That used to cost a second
scrollbar. With this pass hiding the page's own vertical scrollbar when framed, it
now leaves the bottom of the page unreachable, so any existing integration has to
be re-copied from the current snippet.

**If the framed page ever gains an in-page link, the host's scroll listener becomes
required in Safari.** WebKit does not let a cross-origin frame move its parent by any
means — `scrollIntoView`, `focus()` and a fragment change were all tried and none
moves it. So without the listener such a link does nothing in Safari, which is every
browser on an iPhone; "Begin listening" was a dead link there when the hero was
still shown in the frame. `docs/EMBED.md` keeps the listener for that case. In Chrome,
Edge and Firefox the page falls back on its own: it watches the target with an
IntersectionObserver, and if the parent has not moved it within 400ms, scrolls
itself, which reaches the parent as an instant jump. Measured in Playwright's WebKit
build; confirm on a real iPhone when one is to hand.

Two decisions here look like mistakes and are not:

- **The fallback watches rather than waits.** A plain timer would scroll the page
  away from a host that had already scrolled smoothly to its own offset (to clear a
  sticky header, say). The baseline is taken before the request is posted, so a host
  that scrolls instantly — as it should for reduced-motion visitors — is not mistaken
  for one that did nothing.
- **`overflow-y: hidden`, not `overflow: hidden`, and on `html`.** Hiding both axes
  also removes the sideways scroll a frame narrower than the body's 320px minimum
  needs. `html` governs the viewport directly; `body` would only do so while `html`
  stays visible. `body.scrollHeight`, which the height report uses, measured the same
  with and without the rule in Chromium, WebKit and Firefox, and wheel and touch
  scrolling over the frame still move the host page. `overflow: clip` would not stop
  the fallback scrolling the page's own root in an undersized frame either: on the
  root element, `clip` is treated as `hidden`.

## Audio on an iPhone

The client heard nothing at all on a real iPhone, from the A/B or the stems, while
everything else rendered. The diagnosis, so none of it is undone:

- **Most likely cause: the silent switch.** Safari files a bare `AudioContext` under
  iOS's ambient audio category, which the ringer switch mutes completely, with no
  error and no sign of it. **`getContext()` sets `navigator.audioSession.type =
  "playback"`** before it creates the context, inside the tap — the category a music
  player uses, which plays through the switch and, as a music player does, pauses
  other audio once the visitor presses play. Browsers without the API skip it.
- **Inside a cross-origin frame Safari ignores that setting** unless the frame is
  allowed the microphone: the setter returns without effect and reads back "auto".
  So on the host page the host sets it — the one line in the `docs/EMBED.md` snippet
  — or adds `allow="autoplay; microphone"` to the iframe. Verified in Playwright's
  WebKit: standalone, the page's own setting takes; framed, it does not; with the
  host's line, the host page reads "playback". Whether that reaches the frame's
  audio on iOS itself is not yet confirmed.
- **The 40kHz sample rate was cleared, and must stay.** WebKit has run contexts at a
  requested rate, resampling to the hardware's, since 2020 (r267014), and a 40kHz
  context in WebKit starts, resumes and keeps time exactly as a 48kHz one does,
  framed or not. Letting the platform choose its rate would cost 20% more decoded
  memory at 48kHz, or — if the buffers stayed at 40kHz — put browser interpolation
  between every buffer and the context, the distortion described under The 1986
  master.
- **Resuming is already right:** `resume()` is called synchronously in the tap,
  before any await, for both transports.
- **Not the cause, in WebKit:** a cross-origin frame without `allow="autoplay"` still
  plays when the tap is inside it. Keep recommending the attribute anyway.

Everything above is from WebKit on a Mac, which has no silent switch. The checks
that settle it on a phone: standalone with the switch off, then on (the change
should make the second play); the host page with the switch on, before and after
the host adds its line; and, if nothing plays even with the switch off, the iOS
version, whether the play button spins forever or the stems report "couldn't load",
and the console through Safari's Web Inspector.

## Why the A/B cannot be perfectly aligned

The 1986 master and the 2026 remix come from different tape transfers and are
different mixes. Measured part by part — each 2026 stem against the 1986 master
— the remix does not keep every part on one timeline: against the drums it moves
the vocals by up to about 45ms, changing phrase by phrase, and sits the guitar
about 17ms late.

The player can give the 1986 master only one start offset and one speed — the
speed applied when it is decoded, not as a playback rate (see The 1986 master) —
so it can lock one layer at a time. It is locked to the rhythm section: bass and
percussion sit within about 5ms and the kick within about 13ms, with no drift
across the section. Switching mid-phrase can still slap on the vocal. No single
offset and rate does better than about 34ms somewhere, and only 1986 audio
conformed to the 2026 timeline by the mix engineer would remove the problem.

The measurements and commands are in `docs/ASSETS.md`. Re-measure with
`tools/measure_excerpt_offset.py` whenever either master is replaced.
