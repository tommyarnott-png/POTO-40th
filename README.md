# The Phantom of the Opera — 40th Anniversary Stem Archive

A listening page for the 40th anniversary remaster. Two sections:

1. **Masters A/B** — the 1986 original master and the 2026 remaster on a single
   audio clock, with a continuous fader between them. The fader only changes
   gain; it never restarts or retriggers either source, so you can move it
   mid-phrase and hear the difference on the same beat.
2. **Stem mixer** — the remaster as eight synchronised stems with per-row solo,
   mute, level and seek. All eight share one clock, so soloing or rebalancing
   never introduces drift.

Both players are built on the Web Audio API with `AudioBufferSourceNode`s
scheduled against one `AudioContext.currentTime`, rather than separate `<audio>`
elements, which drift apart within seconds.

## Running it

```bash
npm install
npm run dev
```

`npm run build` typechecks and emits a static `dist/` you can deploy anywhere —
GitHub Pages, Netlify, Vercel, S3. There is no server and no database.

## Audio assets

Compressed playback audio (~30MB of MP3) is committed under `public/audio`, so
the player works straight after a clone. The full-resolution sources are **not**
in git — the grouped-stem archive alone is 220MB, past GitHub's 100MB per-file
limit. See [docs/ASSETS.md](docs/ASSETS.md) for where the sources live, how to
regenerate the playback MP3s, and how to wire up the source download links.

Two pieces of official brand artwork (the white production logo and the London
background texture) are also not redistributed here. The page falls back to a
typeset wordmark and the palette gradient without them, so it still renders
correctly — drop them in per `docs/ASSETS.md` before deploying publicly.

## Layout

```
src/
  assets.ts              asset paths, durations, master-alignment constants
  data/trackPeaks.json   generated waveform envelopes
  pages/Home.tsx         both players and the whole page
  components/            error boundary
tools/
  generate-peaks.mjs     regenerates trackPeaks.json from the playback MP3s
  measure_alignment.py   cross-correlates the two masters (provenance)
  measure_envelope_drift.py
scripts/
  build-audio.sh         transcodes source WAVs to the playback MP3s
reference/
  manus-fullstack/       the original tRPC/Drizzle/File-Storage backend
docs/                    asset handling, brand provenance, verification notes
```

## Provenance

This started as a Manus WebDev full-stack project: an Express/tRPC backend
served a `media.manifest` procedure returning signed Manus File Storage URLs,
backed by Drizzle/MySQL and Manus OAuth. None of that runs outside the Manus
platform, and the page needs no server, so it was rebuilt as a static Vite app
with the asset manifest collapsed into `src/assets.ts`. The original server
files are kept verbatim under `reference/manus-fullstack/` — they are not part
of the build.
