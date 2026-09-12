# Audio and brand assets

## What is in git

`public/audio` holds the compressed audio the player streams and decodes —
about 30MB total, committed so the page works immediately after a clone.

| File | Source | Length |
| --- | --- | --- |
| `old_master.mp3` | 1986 original master, 192 kbps | 302.89s |
| `new_master.mp3` | 2026 remaster, 192 kbps | 256.27s |
| `stems/*.mp3` | 8 grouped stems, 160 kbps | 104.08s each |

The player also needs `src/data/trackPeaks.json`, the pre-computed waveform
envelopes. It is committed; regenerate it with `npm run peaks` if the audio
changes.

## What is not in git

| Asset | Size | Why |
| --- | --- | --- |
| `1-06PhantomOfTheOpera.wav` | 54MB | Source master, 44.1kHz/16-bit |
| `POTO_OriginalAlbumRemix_07_..._48kHz_24bit.wav` | 74MB | Source remaster, 48kHz/24-bit |
| `GroupedStems-ForWebsite.zip` | 220MB | Source stems, 44.1kHz/24-bit — over GitHub's 100MB per-file limit |

Keep these on managed storage (S3, R2, or whatever CDN the production uses).
Nothing in the build depends on them; they are only needed to regenerate the
playback MP3s and to serve the source download links.

### Wiring up the source downloads

The three "Download … WAV" / "Download source stems" links render only when
`VITE_SOURCE_AUDIO_BASE` is set. Point it at the folder holding the three files
above, using their exact filenames:

```bash
VITE_SOURCE_AUDIO_BASE=https://assets.example.com/poto-40th/source npm run build
```

Leave it unset and the links are omitted entirely rather than 404ing. The
per-stem download icons always work — they point at the committed MP3s.

### Regenerating the playback MP3s

```bash
SOURCE_DIR=/path/to/sources ./scripts/build-audio.sh
npm run peaks
```

`SOURCE_DIR` must contain the two master WAVs and a `stems/` subfolder with the
eight WAVs from the archive, under their original names. Needs `ffmpeg`.

## Brand artwork

Two official assets are referenced but deliberately not redistributed in this
repo:

| Path | Asset |
| --- | --- |
| `public/images/phantom-logo-white.png` | White production logo, 500 × 151 |
| `public/images/london-background-texture.jpg` | London page background, 1600 × 1158 |

Drop them in at those paths and the page picks them up. Without the logo the
header and footer fall back to a typeset wordmark; without the background the
page keeps its palette gradient over the base `#00060f`. Both look correct — the
fallbacks exist so a fresh clone is never visibly broken.

See [brand-assets-provenance.md](brand-assets-provenance.md) for where these
came from on the official site, the palette, and the typefaces. Note that the
Box Five Club logo is a separate mark and must not be used here.

## Master alignment

The two masters were cut from different transfers: they do not start at the same
sample and do not run at quite the same speed. Three constants in
`src/assets.ts` correct for that — a start offset, a playback-rate ratio and a
gain match — measured by cross-correlating the recordings
(`tools/measure_alignment.py`, checked for drift by
`tools/measure_envelope_drift.py`). They are what let the A/B fader cross
between the two without a flam or a slow slide out of sync. Re-measure them if
either master is ever re-cut.
