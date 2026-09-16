/**
 * Renders the visitor's stem mix to one buffer, for the MP3 export.
 *
 * **Sample rate.** The player decodes and plays at 40kHz, and MPEG-1 has no
 * 40kHz rate, so the render runs at 44.1kHz and each buffer resamples on its way
 * through. Measured in Chrome 152: a 40kHz buffer rendered at 44.1kHz keeps its
 * length (44100 frames per second, not 40000), keeps its pitch (a 1kHz tone
 * reads 1kHz, with the 1102.5Hz image that reinterpreting would leave at
 * -206dB), and lands an impulse on its exact frame. It rolls the top off by
 * 1.8dB at 10kHz, rising to 5.4dB at 16.8kHz. That costs almost nothing here:
 * the stems carry about 30dB less energy above 12kHz than across the band and
 * 45dB less above 16kHz, and the live output is already resampled from the
 * page's 40kHz context to the device's 48kHz, so this is the conversion the
 * visitor is hearing rather than a new one.
 *
 * Do not "fix" this by fetching and decoding the stems again at 44.1kHz. That
 * would add over 200MB to a page that already peaks close to where mobile
 * Safari closes a tab, to recover content the AAC encode did not keep.
 *
 * **Clipping.** Eight stems pushed up together go past full scale. The mix is
 * rendered faithfully and then, only if it would clip, brought down by one
 * constant gain. A single gain keeps every balance and every dynamic exactly as
 * the visitor set them, where a limiter would move them moment by moment; and a
 * clipped MP3 sounds worse than the same mix a decibel quieter. The visitor is
 * told when it happens.
 *
 * **Why the encode is not in a worker.** It was, and moving it here halved the
 * export's peak: 185MB in a worker against 89MB on this thread, measured live
 * with playback running. The encoder is the same and so is the data; a fresh
 * worker isolate grows its own heap to a plateau under the encode and never
 * hands the pages back, where this thread's heap absorbs the same allocations
 * and releases them. Nothing else accounted for it — rendering at 44.1kHz costs
 * only 5.8MB more than at 40kHz, the blocks were already handed over rather than
 * copied, and a worker that only passed the blocks back without encoding cost
 * nothing at all.
 *
 * The page stays responsive because it yields after every block: 250 blocks at a
 * median of 8.0ms and a 95th percentile of 9.6ms, so the worst case is a dropped
 * frame rather than the freeze a single uninterrupted encode would cause. This
 * page is held to a memory budget by mobile Safari, and that is what decides it.
 * Moving it back to a worker would undo the larger half of that budget.
 */
import { FADE_SECONDS, STEM_BUS_TRIM, STEM_DURATION, STEMS } from "@/assets";
import type { HeldTracks } from "@/audioLoader";

export const EXPORT_SAMPLE_RATE = 44100;

/**
 * Where a clipping mix is brought down to. Lossy encoding overshoots the sample
 * peaks it was handed, so the file is left a dB under full scale.
 */
export const EXPORT_CEILING = 10 ** (-1 / 20);

/** The mix as a plain level per stem, so it can be read once and rendered without the page's state. */
export type MixLevels = Record<string, number>;

/**
 * Builds the live graph again offline: every stem through its own gain, entering
 * where its held audio begins.
 *
 * `sampleRate` is only ever passed for the null test, which renders at the
 * player's own rate so the two graphs can be compared sample for sample.
 */
export async function renderMix(ready: HeldTracks, levels: MixLevels, sampleRate = EXPORT_SAMPLE_RATE) {
  const context = new OfflineAudioContext(2, Math.round(STEM_DURATION * sampleRate), sampleRate);
  // The same trim the transport puts the stems through, so the file is the mix
  // the visitor heard rather than a louder one.
  const bus = context.createGain();
  bus.gain.value = STEM_BUS_TRIM;
  bus.connect(context.destination);

  STEMS.forEach((stem) => {
    const held = ready[stem.id];
    if (!held) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = held.buffer;
    // The transport's fade, on the schedule it uses: it runs from the start of
    // the render, so a stem entering later is already at its level by then and
    // only a stem with nothing trimmed off its head actually fades.
    gain.gain.setValueAtTime(0, 0);
    gain.gain.linearRampToValueAtTime(levels[stem.id] ?? 0, FADE_SECONDS);
    source.connect(gain).connect(bus);
    // Rendering from the top of the section means every stem plays its held
    // buffer from the first sample, so the buffer offset the transport snaps to a
    // whole frame is zero for all of them; only the entry time differs, and the
    // engine honours that exactly. Null tested against the transport's own
    // scheduling at the player's rate: silent to the last bit.
    source.start(held.start);
  });

  return context.startRendering();
}

/** The loudest sample in the render, across both channels. */
export function peakOf(buffer: AudioBuffer) {
  let peak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let frame = 0; frame < data.length; frame += 1) {
      const value = Math.abs(data[frame]);
      if (value > peak) peak = value;
    }
  }
  return peak;
}

/** The one gain that brings a clipping render under the ceiling; 1 when it already is. */
export function makeupGain(peak: number) {
  return peak > EXPORT_CEILING ? EXPORT_CEILING / peak : 1;
}

/**
 * The stems are 96 kbps AAC with nothing above about 16.8kHz, so the mix has no
 * detail left for a higher rate to carry; 192 kbps is past transparent for that
 * source and keeps the file to about 2.4MB.
 */
export const EXPORT_BITRATE_KBPS = 192;

/** Whole MPEG frames, so the encoder is handed work it can use without buffering a remainder. */
const CHUNK_FRAMES = 1152 * 16;

export const MIX_FILENAME = "phantom-of-the-opera-40th-your-mix.mp3";

export type ExportStage = "rendering" | "encoding";

/**
 * Renders the mix, then encodes it a block at a time, yielding between blocks.
 *
 * Returns the finished file rather than saving it, so a later pass can put a
 * gate between the two without touching any of this.
 */
export async function exportMix(
  ready: HeldTracks,
  levels: MixLevels,
  onProgress: (stage: ExportStage, progress: number) => void,
) {
  onProgress("rendering", 0);
  const rendered = await renderMix(ready, levels);
  const gain = makeupGain(peakOf(rendered));

  // Loaded here rather than with the page: the encoder is bigger than everything
  // else the page ships, and only a visitor who exports ever needs it.
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const encoder = new Mp3Encoder(2, rendered.sampleRate, EXPORT_BITRATE_KBPS);
  const parts: Uint8Array[] = [];

  const left = rendered.getChannelData(0);
  const right = rendered.getChannelData(1);
  // Filled again for each block rather than allocated again, so a hundred seconds
  // of encoding puts about 57MB less through the heap than a fresh pair per block.
  const left16 = new Int16Array(CHUNK_FRAMES);
  const right16 = new Int16Array(CHUNK_FRAMES);

  for (let from = 0; from < rendered.length; from += CHUNK_FRAMES) {
    const to = Math.min(rendered.length, from + CHUNK_FRAMES);
    const frames = to - from;
    // The render was measured and, if it would have clipped, brought under the
    // ceiling by `gain`, which only ever attenuates, so nothing here passes full scale.
    for (let frame = 0; frame < frames; frame += 1) {
      left16[frame] = Math.round(left[from + frame] * gain * 32767);
      right16[frame] = Math.round(right[from + frame] * gain * 32767);
    }
    const encoded = encoder.encodeBuffer(left16.subarray(0, frames), right16.subarray(0, frames));
    if (encoded.length > 0) parts.push(encoded);
    onProgress("encoding", to / rendered.length);
    // Back to the event loop between blocks, so the page keeps painting.
    await new Promise((resolve) => setTimeout(resolve));
  }

  const tail = encoder.flush();
  if (tail.length > 0) parts.push(tail);
  return { blob: new Blob(parts as BlobPart[], { type: "audio/mpeg" }), gain };
}
