# The Phantom of the Opera 40th — stems microsite

A static Vite + React + TypeScript + Tailwind v4 page: a masters A/B (1986
original against the 2026 remaster) and an eight-stem mixer, all playing on one
Web Audio clock. It is built to be embedded in the official site in an iframe.

**Current build state (15 September 2026):** three passes are done and live on
staging: the production team's feedback, hardening, and brand alignment. The A/B
plays a 104.77s section cut to match the stems. Clicking a mask cuts between the
masters in 8ms on an equal-power curve; a crossfade slider beneath the masks
blends them on an equal-power law, at a master level of 0.78 so the blend never
clips. The page follows the official London site: the real wordmark (AVIF with a
PNG fallback), Jost for all text, the site's palette, heading treatments and
button styling, and very little small print. Waveforms are mirrored canvas bars,
the stems on one shared scale. Stem rows are two lines below 768px, and each row
becomes playable as its own stem decodes; stems that decode after play has been
pressed join the running clock. Audio plays at 40kHz with staged loading and
release (see Loading and memory). Inside a frame the page leaves out its links to
other sites and reports its height to the parent; it is kept out of search
indexes. Playback audio is AAC (masters 128 kbps, stems 96 kbps). Not built yet:
the gated mix export and the signup endpoint.

**Staging:** https://poto-40th.tommy-arnott3.workers.dev — deployed with
`npm run deploy` as the Cloudflare Worker `poto-40th` (static assets only).

## Repo map

```
src/pages/Home.tsx        the whole page: both players, the audio engine, waveforms, crossfade slider
src/audioLoader.ts        fetches, decodes, holds and releases a set of tracks
src/assets.ts             asset paths, durations, playback sample rate, master-alignment constants
src/embed.ts              whether the page is framed; posts its height to the frame
src/data/trackPeaks.json  generated waveform envelopes (npm run peaks)
src/index.css             Tailwind, Jost @font-face, heading treatments, the few custom classes
public/audio/             playback AAC files, committed
public/images/, fonts/    wordmark, A/B masks, smoke background, self-hosted Jost
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
