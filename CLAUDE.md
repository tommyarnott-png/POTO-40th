# The Phantom of the Opera 40th — stems microsite

A static Vite + React + TypeScript + Tailwind v4 page: a masters A/B (1986
original against the 2026 remaster) and an eight-stem mixer, all playing on one
Web Audio clock. It is built to be embedded in the official site in an iframe.

**Current build state (16 September 2026):** six passes are done and live on
staging: the production team's feedback, hardening, brand alignment, host-page
embedding, the mix export, and the artwork and levels pass. The A/B plays a
104.77s section cut to match the stems. It switches between the two **release
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
audio is AAC (masters 128 kbps, stems 96 kbps). Not built yet: the signup
endpoint and the gate in front of the export.

The A/B masks (`public/images/mask-original.png`, `mask-remaster.png`) are still
in the repo and still tracked, but nothing renders them: their `BRAND` entries in
`src/assets.ts` are marked unused, as `BRAND.logo` is.

**Staging:** https://poto-40th.tommy-arnott3.workers.dev — deployed with
`npm run deploy` as the Cloudflare Worker `poto-40th` (static assets only).

## Repo map

```
src/pages/Home.tsx        the whole page: both players, the audio engine, waveforms, crossfade slider, export control
src/audioLoader.ts        fetches, decodes, holds and releases a set of tracks
src/mixExport.ts          renders the visitor's stem mix offline and encodes it to MP3
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
wrangler.jsonc            Cloudflare deployment; adding "main" brings in a Worker
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
a 44.1kHz 192kbps CBR MP3. It nulls against the transport's own scheduling at
**−138dBFS**, against a deliberately mis-scheduled control at −1.1dBFS, so the
null is proven to have the power to see misalignment. Re-run that null after any
change to the render path.

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
