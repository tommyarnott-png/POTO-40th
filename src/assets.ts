/**
 * Every asset the player pulls in, and the measured constants that keep the two
 * masters locked to one clock.
 *
 * This replaces the `media.manifest` tRPC procedure the original Manus build
 * used to hand back signed File Storage URLs (kept for reference under
 * reference/manus-fullstack/). Compressed playback audio ships in the repo, so
 * plain static paths are enough.
 */

/** Official brand artwork — see docs/ASSETS.md before deploying. */
export const BRAND = {
  logo: "/images/phantom-logo-white.png",
  background: "/images/london-background-texture.jpg",
} as const;

/** Compressed playback audio, committed under public/audio. */
export const PLAYBACK = {
  oldMaster: "/audio/old_master.mp3",
  newMaster: "/audio/new_master.mp3",
} as const;

/**
 * Full-resolution downloads. The two source WAVs and the 220MB grouped-stem
 * archive are not tracked in git, so they are served from wherever
 * VITE_SOURCE_AUDIO_BASE points. When it is unset these links are hidden
 * instead of rendering as dead ends.
 */
const SOURCE_BASE = import.meta.env.VITE_SOURCE_AUDIO_BASE?.replace(/\/+$/, "");

export const SOURCE_DOWNLOADS = SOURCE_BASE
  ? {
      oldMaster: `${SOURCE_BASE}/1-06PhantomOfTheOpera.wav`,
      newMaster: `${SOURCE_BASE}/POTO_OriginalAlbumRemix_07_ThePhantomOfTheOpera_100726_M11b_MASTERED_48kHz_24bit.wav`,
      stemsZip: `${SOURCE_BASE}/GroupedStems-ForWebsite.zip`,
    }
  : null;

export type Stem = {
  id: StemId;
  name: string;
  group: string;
  file: string;
};

export type StemId =
  | "christine_vocal"
  | "phantom_vocal"
  | "organ"
  | "guitar"
  | "bass"
  | "kick"
  | "perc"
  | "orchestra";

/** Row order here is the order the mixer renders. */
export const STEMS: Stem[] = [
  { id: "christine_vocal", name: "Christine Vocal", group: "Vocals", file: "/audio/stems/christine_vocal.mp3" },
  { id: "phantom_vocal", name: "Phantom Vocal", group: "Vocals", file: "/audio/stems/phantom_vocal.mp3" },
  { id: "organ", name: "Organ", group: "Keys", file: "/audio/stems/organ.mp3" },
  { id: "guitar", name: "Guitar", group: "Guitar", file: "/audio/stems/guitar.mp3" },
  { id: "bass", name: "Bass", group: "Low End", file: "/audio/stems/bass.mp3" },
  { id: "kick", name: "Kick", group: "Drums", file: "/audio/stems/kick.mp3" },
  { id: "perc", name: "Percussion", group: "Drums", file: "/audio/stems/perc.mp3" },
  { id: "orchestra", name: "Orchestra", group: "Orchestra", file: "/audio/stems/orchestra.mp3" },
];

/** Exact source durations, in seconds, as reported by ffprobe. */
export const MASTER_DURATION = 256.27;
export const STEM_DURATION = 104.08;

/**
 * The 1986 master and the 2026 remaster were cut from different tape transfers,
 * so they neither start at the same sample nor run at quite the same speed.
 * These three constants were measured by cross-correlating the two recordings
 * (tools/measure_alignment.py, verified for drift by
 * tools/measure_envelope_drift.py) and are what let the A/B fader crossfade
 * between them without a flam or a slow slide out of sync.
 *
 * Both masters are scheduled against a single AudioContext start time; the
 * fader only ever changes gain, never restarts a source.
 */
export const OLD_MASTER_START_OFFSET = 0.021385;
export const OLD_MASTER_PLAYBACK_RATE = 1.00237026;
/** The 1986 master sits quieter; this matches it to the remaster at unity. */
export const OLD_MASTER_GAIN_COMPENSATION = 1.17489755;
