/**
 * Loads a set of tracks for the player and holds only what playback needs.
 *
 * Decoded audio, not the download, is what fills memory: Web Audio keeps every
 * sample of every channel as a 32-bit float, so the eight stereo stems alone
 * come to over 300MB at a 48kHz device rate, enough for iOS Safari to close the
 * tab. So a set decodes at PLAYBACK_SAMPLE_RATE, one track at a time, keeps
 * mono tracks as one channel and, when asked to, leaves out each track's
 * leading and trailing silence. A set can be released and loaded again; a load
 * still running when its set is released is thrown away. A track that fails to
 * load leaves the rest to finish, and loading again fetches only what is missing.
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

/**
 * `onTrack` is told each time a track of the current load is ready to play, so a
 * player can use tracks as they arrive rather than waiting for the whole set.
 */
export function createTrackSet(tracks: Track[], { trim = false, onTrack }: { trim?: boolean; onTrack?: (id: string) => void } = {}) {
  let held: HeldTracks | null = null;
  let ready: HeldTracks = {};
  let failed = false;
  let pending: Promise<HeldTracks | null> | null = null;
  let generation = 0;

  async function fetchAndDecode(expected: number) {
    // Downloads run together and each track decodes as soon as it arrives, but
    // only one decode runs at a time: a decode briefly holds its track at the
    // file's own rate as well as the player's.
    const decoder = new OfflineAudioContext(1, 1, PLAYBACK_SAMPLE_RATE);
    let decoding = Promise.resolve();
    const results = await Promise.allSettled(tracks.filter((track) => !ready[track.id]).map(async (track) => {
      const response = await fetch(track.file);
      if (!response.ok) throw new Error(`Unable to load ${track.id}`);
      const file = await response.arrayBuffer();
      const decode = decoding.then(async () => {
        if (expected !== generation) return;
        const decoded = hold(decoder, await decoder.decodeAudioData(file), track, trim);
        if (expected !== generation) return;
        ready[track.id] = decoded;
        onTrack?.(track.id);
      });
      // A file that will not decode fails its own track, not the ones queued behind it.
      decoding = decode.catch(() => {});
      await decode;
    }));
    if (expected !== generation) return null;
    if (results.some((result) => result.status === "rejected")) {
      failed = true;
      return null;
    }
    held = ready;
    return held;
  }

  return {
    get held() {
      return held;
    },
    /** The tracks of the current load that are ready so far; the whole set once it has loaded. */
    get ready() {
      return ready;
    },
    /** Whether the last load finished with tracks missing. Its promise resolves to null, as a released load's does. */
    get failed() {
      return failed;
    },
    load() {
      if (held) return Promise.resolve(held);
      if (!pending) {
        // A released load comes to nothing whether it succeeds or fails, so a
        // late failure can't disturb whatever has been asked for since. A load
        // that fails keeps what it decoded, and nothing of it is still running
        // once it settles, so loading again cannot land a track twice.
        failed = false;
        const expected = generation;
        const request: Promise<HeldTracks | null> = fetchAndDecode(expected)
          // Only the per-track failures settle inside fetchAndDecode. Anything
          // thrown around them — the decoder's own constructor, for one — would
          // otherwise reject out of here into callers that start a load without
          // waiting on it, where it surfaces as an unhandled rejection and the
          // visitor is told nothing. It reads as the failure the player already
          // shows, unless the set was released while it ran.
          .catch(() => {
            if (expected === generation) failed = true;
            return null;
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
      ready = {};
      failed = false;
      pending = null;
    },
  };
}
