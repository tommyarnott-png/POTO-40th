# The Phantom of the Opera 40th — stems microsite

A static Vite + React + TypeScript + Tailwind v4 page: a masters A/B (1986
original against the 2026 remaster) and an eight-stem mixer, all playing on one
Web Audio clock. It is built to be embedded in the official site in an iframe.

**Current build state (15 September 2026):** the production team's feedback
pass is done and live on staging. The A/B plays a 104.77s section cut to match
the stems, switched between two masks with a 60ms gain crossfade. Waveforms are
mirrored canvas bars, with the stems drawn on one shared scale. There are no
download controls. The page has the new banner copy and smoke background,
self-hosted Jost and Montserrat, 44px stem control hit targets, and reports its
height to an embedding frame. Playback audio is AAC (masters 128 kbps, stems
96 kbps). Not built yet: the gated mix export and the signup endpoint.

**Staging:** https://poto-40th.tommy-arnott3.workers.dev — deployed with
`npm run deploy` as the Cloudflare Worker `poto-40th` (static assets only).

## Repo map

```
src/pages/Home.tsx        the whole page: both players, the audio engine, waveforms
src/assets.ts             asset paths, durations, master-alignment constants
src/embed.ts              posts the page height to an embedding frame
src/data/trackPeaks.json  generated waveform envelopes (npm run peaks)
src/index.css             Tailwind, @font-face rules, the few custom classes
public/audio/             playback AAC files, committed
public/images/, fonts/    A/B masks, smoke background, self-hosted fonts
scripts/build-audio.sh    cuts and encodes the source WAVs (sources are not in git)
tools/                    waveform generator and alignment measurement scripts
docs/                     ASSETS.md (audio, alignment), EMBED.md (iframe snippet), brand provenance
wrangler.jsonc            Cloudflare deployment; adding "main" brings in a Worker
```

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
