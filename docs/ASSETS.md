# Audio and brand assets

## What is in git

`public/audio` holds the compressed audio the player streams and decodes — AAC
in MP4 (`.m4a`), about 13.5MB total, committed so the page works immediately
after a clone. Both masters are the short section the stems cover, not the full
recordings.

| File | Source | Length | Size |
| --- | --- | --- | --- |
| `old_master.m4a` | 1986 original master, cut to the section, AAC 128 kbps | 104.97s | 1.72MB |
| `new_master.m4a` | 2026 remaster short edit, AAC 128 kbps | 104.77s | 1.72MB |
| `stems/*.m4a` | 8 grouped stems, AAC 96 kbps | 104.08s each | 1.07–1.31MB each, 10.0MB together |

The 1986 cut is 0.2s longer than the 2026 edit because that transfer runs
slightly slow, so the player speeds it up to match; see
[Master alignment](#master-alignment).

The player also needs `src/data/trackPeaks.json`, the pre-computed waveform
envelopes. It is committed; regenerate it with `npm run peaks` if the audio
changes. The master's envelope is scaled to its own loudest moment; the eight
stems share one scale, so their relative levels read at a glance.

## What is not in git

| Asset | Size | Why |
| --- | --- | --- |
| `1-06PhantomOfTheOpera.wav` | 54MB | Source master, 44.1kHz/16-bit, 302.89s |
| `POTO 40th - Short.wav` | 28MB | The production's short edit of the 2026 remaster, 44.1kHz/24-bit, 104.77s |
| `POTO_OriginalAlbumRemix_07_..._48kHz_24bit.wav` | 74MB | Full 2026 remaster, 48kHz/24-bit, 256.27s — only needed to re-measure where the short edit sits |
| `GroupedStems-ForWebsite.zip` | 220MB | Source stems, 44.1kHz/24-bit — over GitHub's 100MB per-file limit |

Keep these on managed storage (S3, R2, or whatever CDN the production uses).
Nothing in the build depends on them; they are only needed to regenerate the
playback audio.

### Regenerating the playback audio

```bash
SOURCE_DIR=/path/to/sources ./scripts/build-audio.sh
npm run peaks
```

`SOURCE_DIR` must contain the 1986 master WAV, the short edit, and a `stems/`
subfolder with the eight WAVs from the archive, under their original names.
Needs `ffmpeg`. The cut points and the fade applied to the 1986 master are named
variables at the top of the script.

## Brand artwork

| Path | Asset | In git |
| --- | --- | --- |
| `public/images/mask-original.png` | White plaster half-mask, 887 × 887 — the A/B switch's 1986 side | Yes |
| `public/images/mask-remaster.png` | Chrome half-mask, 887 × 887 — the A/B switch's 2026 side | Yes |
| `public/images/smoke-bg.jpg` | Dark smoke page background, 1920 × 1080 | Yes |
| `public/images/phantom-wordmark-white.avif` | White production wordmark, 1092 × 330, from the official site's CDN, scaled down from 6543 × 1980 | Yes |
| `public/images/phantom-wordmark-white.png` | The same wordmark as PNG, for browsers without AVIF | Yes |

All four are committed; the repo is private. The masks and the background were
supplied for this page, and the wordmark comes from the official site. There is
no typeset fallback: if the wordmark files go missing, the header and footer show
a broken image. The masks sit on pure black, which the page blends away so they
read against its own background.

Jost, the official site's heading face, is self-hosted from `public/fonts` under
the SIL Open Font License, with the licence text alongside, and sets all of the
page's text.

See [brand-assets-provenance.md](brand-assets-provenance.md) for where the logo
came from on the official site, the palette, and the typefaces. Note that the
Box Five Club logo is a separate mark and must not be used here.

## Master alignment

The two masters were cut from different transfers: they do not start at the same
sample and do not run at quite the same speed. Three constants in `src/assets.ts`
correct for that — a start offset, a playback-rate ratio and a gain match — and
are what let the A/B switch cross between the two without a slow slide out of
sync. Re-measure them whenever either master is re-cut.

**Where the section comes from.** The short edit starts at the very start of the
2026 remaster and is a plain trim (resampled to 44.1kHz) with a 3s fade-out:
every window agrees on the same offset to within 0.001ms. The stems start there
too.

```bash
python3 tools/measure_excerpt_offset.py FULL_REMASTER.wav "POTO 40th - Short.wav"
```

**How the 1986 side lines up.** The 1986 master and the 2026 remix are different
mixes, so plain waveform correlation between them fails. The alignment is
measured layer by layer instead: each 2026 stem against the 1986 cut, played at
the candidate rate, with whitened cross-correlation.

```bash
python3 tools/measure_excerpt_offset.py public/audio/old_master.m4a stems/Perc.wav \
    --play-rate 1.00191398 --phat 0.8 --band 40 6000 --rate 16000 \
    --window 2 --around 0 --search 0.15 --min-z 6 --fractions 0.05 0.0625 ... 0.975
```

The constants lock the rhythm section. With them applied, as measured through
Chrome's own decoder (offset is where the part sounds in the 1986 master minus
where it sounds in the 2026 mix, so negative means the 2026 part is later):

| Layer | Offset, 1986 minus 2026 | Drift across the section |
| --- | --- | --- |
| Percussion | −5.4ms | +2.6ms |
| Bass | +1.3ms | +0.4ms |
| Kick | +5.5ms (two nearby peaks, about −4 and +13ms) | −0.4ms |
| Guitar | about −17ms | none measured |
| Vocals | −43 to +24ms, changing phrase by phrase | — |

**The limit.** No single offset and rate can line up every part, because the two
mixes do not keep every part on one timeline: the 2026 remix moves the vocals by
up to about 45ms against the drums, phrase by phrase, and sits the guitar about
17ms late. The best compromise across all layers still leaves a worst case near
34ms, and nothing brings even one vocal within ±10ms. Switching mid-phrase can
therefore slap or stutter on the vocal while the drums stay steady. Only 1986
audio conformed to the 2026 timeline by the mix engineer would remove that.

Over the whole track the player has to speed the 1986 transfer up by 1.00237026
to keep pace (`tools/measure_envelope_drift.py`, which reads 8kHz 16-bit mono
decodes of the two masters). The tape speed wanders, and across this section the
ratio is 1.00191398. The gain match (1.17489755, +1.40dB) still holds for the section,
which measures +1.46dB by RMS.
