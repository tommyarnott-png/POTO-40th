"""
Locates an excerpt inside a longer recording by cross-correlation, and checks
that it is a plain top-and-tail trim rather than an internal re-edit.

    python3 tools/measure_excerpt_offset.py FULL EXCERPT

Both files are decoded with ffmpeg to mono at --rate (8kHz by default, as in
measure_alignment.py), so sources at different sample rates compare directly.
It reports:

  * where the whole excerpt sits in FULL, its correlation there, and how far
    that peak stands above the rest of the correlation surface;
  * the same search repeated independently for short windows spread across the
    excerpt (--fractions). A plain trim puts every window on the same offset;
    an internal cut shows up as windows that disagree;
  * a straight-line fit of window offset against excerpt time. Between two
    edits of one recording the slope is zero.

Comparing the 1986 master with the 2026 remix needs three more options, because
they are different mixes of a recording made on a different tape transfer:

  --play-rate R  plays FULL at R before comparing, as the player's playbackRate
                 does, so offsets are measured on the excerpt's clock and a
                 correct rate leaves a flat line;
  --phat BETA    whitens both spectra (GCC-PHAT) so the match follows timing
                 rather than tonal balance, with --band limiting the frequencies;
  --around/--search  confine each window to a range of offsets, so a beat-length
                 alias elsewhere in the track cannot win;
  --min-z Z      leaves weak windows out of the median and the fit.

The two mixes do not share one timeline for every part, so compare layer by
layer: pass one 2026 stem as EXCERPT (the stems start on the remaster's first
sample) against the 1986 audio as FULL. For example, the rhythm-section check:

    python3 tools/measure_excerpt_offset.py old_master.m4a stems/Bass.wav \\
        --play-rate 1.00191398 --phat 0.8 --band 40 6000 --rate 16000 \\
        --window 2 --around 0 --search 0.15 --min-z 6 --fractions 0.1 0.2 ... 0.9
"""
import argparse
import subprocess

import numpy as np


def decode(path: str, rate: int) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(rate), "-f", "f64le", "-"],
        check=True,
        capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype="<f8")


def correlation(reference: np.ndarray, pattern: np.ndarray, rate: int, phat: float, band) -> np.ndarray:
    """Match strength of `pattern` at every position in `reference`.

    Without PHAT this is the Pearson correlation, 1.0 for an exact match. With
    PHAT it is a whitened cross-correlation, read through its z-score.
    """
    n, m = len(reference), len(pattern)
    size = 1 << (n + m - 1).bit_length()
    if phat:
        pattern = pattern * np.hanning(m)
    pattern = pattern - pattern.mean()
    pattern /= np.linalg.norm(pattern) + 1e-12
    cross = np.fft.rfft(reference, size) * np.conj(np.fft.rfft(pattern, size))

    if phat:
        frequencies = np.fft.rfftfreq(size, 1 / rate)
        cross[(frequencies < band[0]) | (frequencies > band[1])] = 0
        cross /= (np.abs(cross) + 1e-12) ** phat
        return np.fft.irfft(cross, size)[: n - m + 1]

    raw = np.fft.irfft(cross, size)[: n - m + 1]
    # The pattern is zero-mean, so only the reference's local variance is needed.
    sums = np.concatenate(([0.0], np.cumsum(reference)))
    squares = np.concatenate(([0.0], np.cumsum(reference * reference)))
    local = (squares[m:] - squares[:-m]) - (sums[m:] - sums[:-m]) ** 2 / m
    local = np.maximum(local, 1e-6 * local.max())
    return raw / np.sqrt(local)


def locate(reference: np.ndarray, pattern: np.ndarray, rate: int, args, allowed=None):
    """Best position in seconds (sub-sample), its score, the best peak outside
    +-exclusion, that peak's distance, and the winning peak's z-score. None when
    the allowed range leaves no room for the pattern inside the reference."""
    # Whitening only works over the stretch actually being searched: across a
    # whole track the spectra average out and the timing peak drowns.
    first = 0
    if allowed is not None:
        first = max(0, allowed[0])
        last = min(allowed[1], len(reference) - len(pattern) + 1)
        if last <= first:
            return None
        reference = reference[first:last + len(pattern) - 1]
    surface = correlation(reference, pattern, rate, args.phat, args.band)
    peak = int(np.argmax(surface))
    refined = float(peak)
    if 0 < peak < len(surface) - 1:
        before, at, after = surface[peak - 1], surface[peak], surface[peak + 1]
        curvature = before - 2 * at + after
        if curvature < 0:
            refined += 0.5 * (before - after) / curvature

    guard = int(args.exclusion * rate)
    outside = surface.copy()
    outside[max(0, peak - guard): peak + guard + 1] = -np.inf
    runner_up = int(np.argmax(outside))
    has_runner = np.isfinite(outside[runner_up])
    return (
        (first + refined) / rate,
        float(surface[peak]),
        float(outside[runner_up]) if has_runner else float("nan"),
        (runner_up - peak) / rate if has_runner else float("nan"),
        float((surface[peak] - surface.mean()) / (surface.std() + 1e-12)),
    )


def rms_db(samples: np.ndarray) -> float:
    return float(20 * np.log10(np.sqrt(np.mean(samples * samples)) + 1e-12))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("full", help="the longer recording to search in")
    parser.add_argument("excerpt", help="the excerpt to locate")
    parser.add_argument("--rate", type=int, default=8000, help="analysis sample rate in Hz (default 8000)")
    parser.add_argument("--window", type=float, default=8.0, help="window length in seconds (default 8)")
    parser.add_argument("--fractions", type=float, nargs="+", default=[0.1, 0.3, 0.5, 0.7, 0.9],
                        help="window centres as fractions of the excerpt (default 0.1 0.3 0.5 0.7 0.9)")
    parser.add_argument("--exclusion", type=float, default=0.25,
                        help="seconds either side of a peak ignored when finding the runner-up (default 0.25)")
    parser.add_argument("--play-rate", type=float, default=1.0,
                        help="play FULL at this rate before comparing, as the player's playbackRate does")
    parser.add_argument("--phat", type=float, default=0.0,
                        help="GCC-PHAT whitening exponent, 0 (off) to 1; use ~0.8 between different mixes")
    parser.add_argument("--band", type=float, nargs=2, default=[40.0, 6000.0], metavar=("LO", "HI"),
                        help="frequency band in Hz kept when --phat is on (default 40 6000)")
    parser.add_argument("--around", type=float, help="only accept window offsets near this value, in seconds")
    parser.add_argument("--search", type=float, default=0.15,
                        help="half-width in seconds of the range --around allows (default 0.15)")
    parser.add_argument("--min-z", type=float, default=0.0,
                        help="leave windows whose peak z-score is below this out of the median and fit")
    args = parser.parse_args()

    rate = args.rate
    full = decode(args.full, rate)
    if args.play_rate != 1.0:
        positions = np.arange(int(len(full) / args.play_rate)) * args.play_rate
        full = np.interp(positions, np.arange(len(full)), full)
    excerpt = decode(args.excerpt, rate)
    duration = len(excerpt) / rate
    print(f"full:    {len(full) / rate:.6f}s  {args.full}" + (f"  (played at {args.play_rate:.8f})" if args.play_rate != 1.0 else ""))
    print(f"excerpt: {duration:.6f}s  {args.excerpt}")
    print(f"analysis rate {rate}Hz (one sample = {1000 / rate:.3f}ms)"
          + (f", GCC-PHAT beta {args.phat} over {args.band[0]:g}-{args.band[1]:g}Hz" if args.phat else "") + "\n")
    if args.play_rate != 1.0:
        print(f"Offsets are on the excerpt's clock; the matching position in FULL is offset x {args.play_rate:.8f}.\n")

    if len(excerpt) <= len(full) and args.around is None:
        offset, score, runner, runner_lag, z = locate(full, excerpt, rate, args)
        start = int(round(offset * rate))
        matched = full[start:start + len(excerpt)]
        print("Whole excerpt")
        print(f"  offset in full:       {offset:.6f}s")
        print(f"  score at peak:        {score:.6f}")
        print(f"  runner-up peak:       {runner:.6f} at {runner_lag:+.3f}s  (peak/runner-up {score / runner:.2f}x)")
        print(f"  peak above surface:   {z:.1f} standard deviations")
        print(f"  level, excerpt - full: {rms_db(excerpt) - rms_db(matched):+.2f}dB")
        block = int(0.5 * rate)
        for label, span in (("head", range(0, 6)), ("tail", range(-6, 0))):
            ratios = []
            for index in span:
                lo = index * block if index >= 0 else len(excerpt) + index * block
                ratios.append(rms_db(excerpt[lo:lo + block]) - rms_db(matched[lo:lo + block]))
            print(f"  {label} level per 0.5s:  " + " ".join(f"{value:+.1f}" for value in ratios) + " dB")
        print()

    half = int(args.window * rate / 2)
    rows = []
    print("Windows (each searched independently" + (f", offsets within {args.around:+.3f} +- {args.search:.3f}s)" if args.around is not None else " across the whole of full)"))
    print("  centre_s    offset_s     vs_median_ms  score        runner_up  peak_z   level_dB")
    for fraction in args.fractions:
        centre = int(fraction * len(excerpt))
        lo, hi = max(0, centre - half), min(len(excerpt), centre + half)
        pattern = excerpt[lo:hi]
        allowed = None
        if args.around is not None:
            first = lo + int(round((args.around - args.search) * rate))
            allowed = (first, first + int(round(2 * args.search * rate)) + 1)
        located = locate(full, pattern, rate, args, allowed)
        if located is None:
            print(f"  {centre / rate:9.3f}  skipped: its allowed offsets run past the ends of full")
            continue
        found, score, runner, _, z = located
        offset = found - lo / rate
        start = int(round(found * rate))
        level = rms_db(pattern) - rms_db(full[start:start + len(pattern)])
        rows.append((centre / rate, offset, score, runner, z, level))

    kept = [row for row in rows if row[4] >= args.min_z]
    offsets = np.array([row[1] for row in kept])
    median = float(np.median(offsets)) if len(kept) else float("nan")
    for centre_s, offset, score, runner, z, level in rows:
        print(f"  {centre_s:9.3f}  {offset:11.6f}  {1000 * (offset - median):+11.3f}  {score:11.6f}  "
              f"{runner:9.6f}  {z:7.1f}  {level:+8.2f}" + ("" if z >= args.min_z else "  (below --min-z)"))
    if not kept:
        print("\n  no usable window: every one was skipped or fell below --min-z")
        return
    print(f"\n  {len(kept)} of {len(rows)} windows used: median offset {median:.6f}s, "
          f"spread {1000 * (offsets.max() - offsets.min()):.3f}ms")

    if len(kept) >= 2:
        centres = np.array([row[0] for row in kept])
        slope, intercept = np.polyfit(centres, offsets, 1)
        residual = offsets - (intercept + slope * centres)
        print(f"  fit: offset = {intercept:+.6f}s + t * {slope:+.9f}  (rate ratio {1 + slope:.8f})")
        print(f"  drift across the excerpt {1000 * slope * duration:+.3f}ms, "
              f"fit residual max {1000 * np.abs(residual).max():.3f}ms")


if __name__ == "__main__":
    main()
