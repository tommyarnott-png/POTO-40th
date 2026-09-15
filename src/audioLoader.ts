/**
 * Loads a set of tracks for the player and holds only what playback needs.
 *
 * Decoded audio, not the download, is what fills memory: Web Audio keeps every
 * sample of every channel as a 32-bit float, so the eight stereo stems alone
 * come to over 300MB at a 48kHz device rate, enough for iOS Safari to close the
 * tab. So a set decodes at PLAYBACK_SAMPLE_RATE, one track at a time, keeps
 * mono tracks as one channel and, when asked to, leaves out each track's
 * leading and trailing silence. A set can be released and loaded again; a load
 * still running when its set is released is thrown away.
 */
import { PLAYBACK_SAMPLE_RATE } from "@/assets";

export type Track = { id: string; file: string; mono?: boolean };

/** A track's audio, and where on its timeline the held audio begins, in seconds. */
export type HeldTrack = { buffer: AudioBuffer; start: number };
export type HeldTracks = Record<string, HeldTrack>;

/** Leading and trailing audio that stays below −72dBFS is not held. */
const SILENCE = 10 ** (-72 / 20);
/** Kept either side of the audible span, so nothing that fades into or out of silence is clipped. */
const MARGIN_SECONDS = 0.5;

function hold(context: BaseAudioContext, decoded: AudioBuffer, track: Track, trim: boolean): HeldTrack {
  const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index));
  let first = 0;
  let last = decoded.length - 1;
  if (trim) {
    const audible = (frame: number) => channels.some((data) => Math.abs(data[frame]) > SILENCE);
    while (first < last && !audible(first)) first += 1;
    while (last > first && !audible(last)) last -= 1;
    const margin = Math.round(MARGIN_SECONDS * decoded.sampleRate);
    first = Math.max(0, first - margin);
    last = Math.min(decoded.length - 1, last + margin);
  }
  if (!track.mono && first === 0 && last === decoded.length - 1) return { buffer: decoded, start: 0 };

  const buffer = context.createBuffer(track.mono ? 1 : channels.length, last - first + 1, decoded.sampleRate);
  if (track.mono) {
    const mono = buffer.getChannelData(0);
    for (let frame = first; frame <= last; frame += 1) {
      let sum = 0;
      for (const data of channels) sum += data[frame];
      mono[frame - first] = sum / channels.length;
    }
  } else {
    channels.forEach((data, index) => buffer.copyToChannel(data.subarray(first, last + 1), index));
  }
  return { buffer, start: first / decoded.sampleRate };
}

export function createTrackSet(tracks: Track[], { trim = false } = {}) {
  let held: HeldTracks | null = null;
  let pending: Promise<HeldTracks | null> | null = null;
  let generation = 0;

  async function fetchAndDecode(expected: number) {
    const files = await Promise.all(tracks.map(async (track) => {
      const response = await fetch(track.file);
      if (!response.ok) throw new Error(`Unable to load ${track.id}`);
      return response.arrayBuffer();
    }));

    // Downloads run together, but decodes run one after another: a decode
    // briefly holds its track at the file's own rate as well as the player's.
    const decoder = new OfflineAudioContext(1, 1, PLAYBACK_SAMPLE_RATE);
    const next: HeldTracks = {};
    for (const [index, track] of tracks.entries()) {
      if (expected !== generation) return null;
      next[track.id] = hold(decoder, await decoder.decodeAudioData(files[index]), track, trim);
    }
    if (expected !== generation) return null;
    held = next;
    return next;
  }

  return {
    get held() {
      return held;
    },
    load() {
      if (held) return Promise.resolve(held);
      if (!pending) {
        const expected = generation;
        // A released load comes to nothing whether it succeeds or fails, so a
        // late failure can't disturb whatever has been asked for since.
        const request: Promise<HeldTracks | null> = fetchAndDecode(expected)
          .catch((error) => {
            if (expected !== generation) return null;
            throw error;
          })
          .finally(() => {
            if (pending === request) pending = null;
          });
        pending = request;
      }
      return pending;
    },
    release() {
      generation += 1;
      held = null;
      pending = null;
    },
  };
}
