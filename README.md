# The Phantom of the Opera — 40th Anniversary Stem Archive

A listening page for the 40th anniversary remaster, built to be embedded in the
official site in an iframe and to work on its own. Two players:

1. **Masters A/B** — the 1986 original master and the 2026 remaster on a single
   audio clock. Clicking either release packshot cuts between them; a crossfade
   slider blends them. Both only change gain, never restart a source, so you can
   switch mid-phrase and hear the difference on the same beat.
2. **Stem mixer** — the remaster as eight synchronised stems with per-row solo,
   mute, level and seek, and an export that renders the visitor's mix to an MP3.

Both are built on the Web Audio API with `AudioBufferSourceNode`s scheduled
against one `AudioContext.currentTime`, rather than separate `<audio>` elements,
which drift apart within seconds.

Both downloads — the visitor's own mix and the high-quality stem pack — sit behind
a details-capture form styled as the Box Five Club signup. The form posts to the
site's own Worker, which validates it, stores it in Supabase and returns a
short-lived token. The mix is then rendered in the browser; the stem pack is
streamed from R2 against the token. The browser never holds a Supabase key or URL.

## Running it

```bash
npm install
npm run dev
```

`npm run dev` serves the page only; the signup and download endpoints are the
Worker's, so the form cannot submit there. `npm run build` typechecks the page and the Worker and emits `dist/`.
`npm run deploy` builds and publishes both to Cloudflare as the `poto-40th` Worker
(`wrangler.jsonc`), fetching Wrangler 4 through `npx`; run `npx wrangler@4 login`
once first, or set `CLOUDFLARE_API_TOKEN`. The staging URL is
`https://poto-40th.tommy-arnott3.workers.dev`. To embed the page in another site,
see [docs/EMBED.md](docs/EMBED.md).

The Worker needs three secrets, set once per account and never committed:

```bash
npx wrangler@4 secret put SUPABASE_URL
npx wrangler@4 secret put SUPABASE_SERVICE_KEY
npx wrangler@4 secret put DOWNLOAD_TOKEN_SECRET
```

It also needs the R2 bucket `poto-40th-downloads` holding the stem archive as
`GroupedStems-ForWebsite.zip`, and the `signups` table from
`supabase/migrations/`, which must be applied to the Supabase project before the
form can store anything:

```bash
npx wrangler@4 r2 object put "poto-40th-downloads/GroupedStems-ForWebsite.zip" --file=<path> --remote
```

## Audio assets

Compressed playback audio (~13.5MB of AAC) is committed under `public/audio`, so
the player works straight after a clone. The full-resolution sources are **not**
in git — the grouped-stem archive alone is 220MB, past GitHub's 100MB per-file
limit. See [docs/ASSETS.md](docs/ASSETS.md) for where the sources live and how
to regenerate the playback audio.

The release packshots, the smoke background and the self-hosted Jost font are
committed too, along with the official wordmark and two A/B masks the page no
longer renders; see `docs/ASSETS.md`.

## Layout

```
src/
  pages/Home.tsx         both players and the whole page
  audioLoader.ts         fetches, decodes, holds and releases a set of tracks
  mixExport.ts           renders the visitor's stem mix offline and encodes it to MP3
  consent.ts             the consent wording, shared by the form and the Worker
  components/            error boundary; SignupModal, the form behind both downloads
  embed.ts               whether the page is framed; posts its height to the frame
  assets.ts              asset paths, durations, sample rate, levels, master alignment
  data/                  generated waveform envelopes; the form's option lists
worker/index.ts          POST /api/signup, GET|HEAD /api/download
supabase/migrations/     the signups table, with row level security
tools/                   waveform generator and alignment measurement scripts
scripts/build-audio.sh   cuts and transcodes source WAVs to the playback audio
docs/                    assets, embedding, brand provenance, verification notes
wrangler.jsonc           the Worker, its R2 and rate-limit bindings
```

[CLAUDE.md](CLAUDE.md) records why the code is the way it is — the audio
decisions, the data path and its access controls, and the frame relationship —
including several choices that look like mistakes and are not. Read it before
changing any of them.
