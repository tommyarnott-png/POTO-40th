/**
 * Every asset the player pulls in, and the measured constants that keep the two
 * masters locked to one clock.
 *
 * This replaces the `media.manifest` tRPC procedure the original Manus build
 * used to hand back signed File Storage URLs. Compressed playback audio ships
 * in the repo, so plain static paths are enough.
 */

/**
 * Brand artwork. The masks and the smoke background are committed; the
 * production logo is not — see docs/ASSETS.md before deploying.
 */
export const BRAND = {
  logo: "/images/phantom-logo-white.png",
  background: "/images/smoke-bg.jpg",
  maskOriginal: "/images/mask-original.png",
  maskRemaster: "/images/mask-remaster.png",
} as const;

/** Compressed playback audio, committed under public/audio. */
export const PLAYBACK = {
  oldMaster: "/audio/old_master.m4a",
  newMaster: "/audio/new_master.m4a",
} as const;

export type Stem = {
  id: StemId;
  name: string;
  group: string;
  file: string;
  /** Held as one channel: its two channels are the same signal. */
  mono?: boolean;
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

/**
 * Row order here is the order the mixer renders. Only the kick is mono: its
 * source channels are identical and its encoded ones correlate at 0.9998, where
 * every other stem is genuinely stereo (correlation 0.13–0.89).
 */
export const STEMS: Stem[] = [
  { id: "christine_vocal", name: "Christine Vocal", group: "Vocals", file: "/audio/stems/christine_vocal.m4a" },
  { id: "phantom_vocal", name: "Phantom Vocal", group: "Vocals", file: "/audio/stems/phantom_vocal.m4a" },
  { id: "organ", name: "Organ", group: "Keys", file: "/audio/stems/organ.m4a" },
  { id: "guitar", name: "Guitar", group: "Guitar", file: "/audio/stems/guitar.m4a" },
  { id: "bass", name: "Bass", group: "Low End", file: "/audio/stems/bass.m4a" },
  { id: "kick", name: "Kick", group: "Drums", file: "/audio/stems/kick.m4a", mono: true },
  { id: "perc", name: "Percussion", group: "Drums", file: "/audio/stems/perc.m4a" },
  { id: "orchestra", name: "Orchestra", group: "Orchestra", file: "/audio/stems/orchestra.m4a" },
];

/**
 * Exact source durations, in seconds, as reported by ffprobe. The masters are
 * the short section the stems cover, not the full recordings.
 */
export const MASTER_DURATION = 104.77;
export const STEM_DURATION = 104.08;

/**
 * The rate the player decodes and plays at. The AAC encode leaves nothing above
 * 17.6kHz in any file (16.8kHz in the stems), so 40kHz keeps all of it with room
 * for resampling, while holding 17% less decoded audio than a 48kHz device rate.
 */
export const PLAYBACK_SAMPLE_RATE = 40000;

/**
 * The 1986 master and the 2026 remaster were cut from different tape transfers,
 * so they neither start at the same sample nor run at quite the same speed.
 * old_master.m4a is cut from the 1986 master to the section new_master.m4a
 * covers (scripts/build-audio.sh), and these constants map one onto the other
 * within it: the 1986 buffer position for 2026 time t is
 * OLD_MASTER_START_OFFSET + t * OLD_MASTER_PLAYBACK_RATE. They are what let the
 * A/B switch cross between the two without a slow slide out of sync.
 *
 * They were measured layer by layer, each 2026 stem against the 1986 cut
 * (tools/measure_excerpt_offset.py), and lock the rhythm section: bass and
 * percussion sit within about 5ms, the kick within about 13ms, with no drift
 * across the section. No single offset and rate can do better, because the two
 * mixes do not keep every part on one timeline: against the drums the 2026 remix
 * moves the vocals by up to about 45ms, phrase by phrase, and sits the guitar
 * about 17ms late. See docs/ASSETS.md.
 *
 * Over the whole track the rate is 1.00237026 (tools/measure_envelope_drift.py);
 * the tape speed wanders, and across this section it runs at 1.00191398.
 *
 * Both masters are scheduled against a single AudioContext start time; the
 * switch only ever changes gain, never restarts a source.
 */
export const OLD_MASTER_START_OFFSET = 0.000919;
export const OLD_MASTER_PLAYBACK_RATE = 1.00191398;
/** The 1986 master sits quieter; this matches it to the remaster at unity. */
export const OLD_MASTER_GAIN_COMPENSATION = 1.17489755;
