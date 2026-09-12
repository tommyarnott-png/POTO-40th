#!/usr/bin/env node
/**
 * Generates src/data/trackPeaks.json — the pre-computed waveform envelopes the
 * player renders. Doing this at build time means the UI can draw all nine
 * waveforms immediately, without downloading and decoding ~30MB of audio first.
 *
 *   node tools/generate-peaks.mjs
 *
 * Reads the MP3s from public/audio (run scripts/build-audio.sh first) and
 * shells out to ffmpeg to decode each one to low-rate mono PCM, so the same
 * code path handles the 44.1kHz and 48kHz sources uniformly.
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

function decode(file) {
  const raw = execFileSync(
    "ffmpeg",
    ["-v", "error", "-i", file, "-ac", "1", "-ar", String(DECODE_RATE), "-f", "s16le", "-"],
    { maxBuffer: 1 << 30 },
  );
  return new Int16Array(raw.buffer, raw.byteOffset, raw.length / 2);
}

/**
 * Reduces samples to `bars` peak values in 0..1.
 *
 * Each bar is the RMS of its bucket rather than the absolute maximum: RMS
 * tracks perceived loudness, where max-abs is dominated by isolated transients
 * and flattens the whole envelope. Values are then normalised against the
 * track's own loudest bar, so every row draws a legible waveform regardless of
 * how quiet the stem sits in the mix.
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

  const loudest = Math.max(...peaks);
  const scale = loudest > 0 ? 1 / loudest : 0;
  return peaks.map(peak => Number((peak * scale).toFixed(4)));
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

console.log("Measuring new_master.mp3");
const trackPeaks = {
  new_master: envelope(decode(join(AUDIO, "new_master.mp3")), MASTER_BARS),
  stems: {},
};

for (const id of STEM_IDS) {
  console.log(`Measuring stems/${id}.mp3`);
  trackPeaks.stems[id] = envelope(decode(join(AUDIO, "stems", `${id}.mp3`)), STEM_BARS);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(trackPeaks)}\n`);
console.log(`Wrote ${OUT}`);
