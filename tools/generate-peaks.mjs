#!/usr/bin/env node
/**
 * Generates src/data/trackPeaks.json — the pre-computed waveform envelopes the
 * player renders. Doing this at build time means the UI can draw all nine
 * waveforms immediately, without downloading and decoding ~13.5MB of audio first.
 *
 *   node tools/generate-peaks.mjs
 *
 * Reads the AAC files from public/audio (run scripts/build-audio.sh first) and
 * shells out to ffmpeg to decode each one to low-rate mono PCM, so the same
 * code path handles any source sample rate uniformly.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const AUDIO = join(ROOT, "public", "audio");
const OUT = join(ROOT, "src", "data", "trackPeaks.json");

/**
 * Measured at high resolution and downsampled in the browser to whatever the
 * viewport can actually fit (see `resample` in src/pages/Home.tsx). Baking a
 * fixed bar count in here would clip the waveform on narrow screens and slide
 * the playhead out of step with the bars it is drawn over.
 */
const MASTER_BARS = 1024;
const STEM_BARS = 512;

/** Decode to 8kHz mono 16-bit PCM — ample resolution for an envelope. */
const DECODE_RATE = 8000;

/**
 * Exponent applied to stem bar heights. The stems share one scale, so a stem
 * 12dB down would otherwise draw at a quarter height with its detail pressed
 * flat. 0.7 compresses level differences by 30% in dB: that stem draws at 38%,
 * a passage 26dB down at 12% rather than 5%, and the order of the stems and the
 * shape of each is unchanged. The master is left linear — it sits in the top
 * half of its range already, and a curve would only flatten its dynamics.
 */
const STEM_CURVE = 0.7;

function decode(file) {
  const raw = execFileSync(
    "ffmpeg",
    ["-v", "error", "-i", file, "-ac", "1", "-ar", String(DECODE_RATE), "-f", "s16le", "-"],
    { maxBuffer: 1 << 30 },
  );
  return new Int16Array(raw.buffer, raw.byteOffset, raw.length / 2);
}

/**
 * Reduces samples to `bars` loudness values.
 *
 * Each bar is the RMS of its bucket rather than the absolute maximum: RMS
 * tracks perceived loudness, where max-abs is dominated by isolated transients
 * and flattens the whole envelope.
 */
function envelope(samples, bars) {
  const bucket = samples.length / bars;
  const peaks = new Array(bars);

  for (let i = 0; i < bars; i += 1) {
    const start = Math.floor(i * bucket);
    const end = Math.min(samples.length, Math.floor((i + 1) * bucket));
    let sum = 0;
    for (let j = start; j < end; j += 1) {
      const value = samples[j] / 32768;
      sum += value * value;
    }
    peaks[i] = end > start ? Math.sqrt(sum / (end - start)) : 0;
  }

  return peaks;
}

/** Scales bars to 0..1 against `loudest`, then applies `curve`. */
function normalise(peaks, loudest, curve = 1) {
  const scale = loudest > 0 ? 1 / loudest : 0;
  return peaks.map(peak => Number(((peak * scale) ** curve).toFixed(4)));
}

const STEM_IDS = [
  "christine_vocal",
  "phantom_vocal",
  "organ",
  "guitar",
  "bass",
  "kick",
  "perc",
  "orchestra",
];

console.log("Measuring new_master.m4a");
const master = envelope(decode(join(AUDIO, "new_master.m4a")), MASTER_BARS);

const stems = {};
for (const id of STEM_IDS) {
  console.log(`Measuring stems/${id}.m4a`);
  stems[id] = envelope(decode(join(AUDIO, "stems", `${id}.m4a`)), STEM_BARS);
}

// The master is normalised on its own. The stems share the loudest bar across
// all eight, so a quiet stem draws quietly and the balance of the mix reads at
// a glance instead of every row filling its height.
const loudestStem = Math.max(...Object.values(stems).flat());
const trackPeaks = {
  new_master: normalise(master, Math.max(...master)),
  stems: {},
};
for (const id of STEM_IDS) {
  trackPeaks.stems[id] = normalise(stems[id], loudestStem, STEM_CURVE);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(trackPeaks)}\n`);
console.log(`Wrote ${OUT}`);
