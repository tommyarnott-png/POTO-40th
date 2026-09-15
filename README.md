# The Phantom of the Opera — 40th Anniversary Stem Archive

A listening page for the 40th anniversary remaster. Two sections:

1. **Masters A/B** — the 1986 original master and the 2026 remaster on a single
   audio clock, with a two-mask switch between them. The switch only changes
   gain; it never restarts or retriggers either source, so you can flip it
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

`npm run build` typechecks and emits a static `dist/`. There is no server and no
database. `npm run deploy` builds and publishes it to Cloudflare as the
`poto-40th` Worker (`wrangler.jsonc`), fetching Wrangler 4 through `npx`; run
`npx wrangler@4 login` once first, or set `CLOUDFLARE_API_TOKEN`. The staging URL is
`https://poto-40th.tommy-arnott3.workers.dev`. To embed the page in another
site, see [docs/EMBED.md](docs/EMBED.md).

## Audio assets

Compressed playback audio (~13.5MB of AAC) is committed under `public/audio`, so
the player works straight after a clone. The full-resolution sources are **not**
in git — the grouped-stem archive alone is 220MB, past GitHub's 100MB per-file
limit. See [docs/ASSETS.md](docs/ASSETS.md) for where the sources live and how
to regenerate the playback audio.

The official production wordmark (`public/images/phantom-wordmark-white.avif`
and `.png`), the A/B masks and the page background are committed too; see
`docs/ASSETS.md`.

## Layout

```
src/
  assets.ts              asset paths, durations, master-alignment constants
  data/trackPeaks.json   generated waveform envelopes
  pages/Home.tsx         both players and the whole page
  audioLoader.ts         fetches, decodes, holds and releases a set of tracks
  embed.ts               whether the page is framed; reports its height to the frame
  components/            error boundary
tools/
  generate-peaks.mjs     regenerates trackPeaks.json from the playback audio
  measure_excerpt_offset.py  locates an edit in a recording; aligns the masters layer by layer
  measure_alignment.py   cross-correlates the two masters (provenance)
  measure_envelope_drift.py
scripts/
  build-audio.sh         cuts and transcodes source WAVs to the playback audio
docs/                    asset handling, embedding, brand provenance, verification notes
wrangler.jsonc           Cloudflare deployment
```

## Provenance

This started as a Manus WebDev full-stack project: an Express/tRPC backend
served a `media.manifest` procedure returning signed Manus File Storage URLs,
backed by Drizzle/MySQL and Manus OAuth. None of that runs outside the Manus
platform, and the page needs no server, so it was rebuilt as a static Vite app
with the asset manifest collapsed into `src/assets.ts`.
