/**
 * Every asset the player pulls in, and the measured constants that keep the two
 * masters locked to one clock.
 *
 * This replaces the `media.manifest` tRPC procedure the original Manus build
 * used to hand back signed File Storage URLs. Compressed playback audio ships
 * in the repo, so plain static paths are enough.
 */

/** Brand artwork, all committed; see docs/ASSETS.md. */
export const BRAND = {
  // Not used by the page: the host page shows the wordmark. Kept with the files for reference.
  logo: "/images/phantom-wordmark-white.png",
  logoAvif: "/images/phantom-wordmark-white.avif",
  background: "/images/smoke-bg.jpg",
  // The Box Five Club's own mark, shown on the signup the capture form is modelled on.
  boxFiveLogo: "/images/boxfive-logo.svg",
  // Not used by the page: the A/B switches between the release packshots now. Kept with the files for reference.
  maskOriginal: "/images/mask-original.png",
  maskRemaster: "/images/mask-remaster.png",
} as const;

/**
 * The release artwork the A/B switches between, as AVIF with a JPEG fallback, the
 * same pair of formats the wordmark ships in.
 *
 * Three widths for one box: the control draws the artwork at 122px inside a 340px
 * frame, 147px on a 390px phone, and 240px from 648px up, where it stops growing.
 * So 320 covers a phone at 2x and any desktop at 1x, 640 a phone at 3x and a
 * retina desktop, and 960 only the capped box at 3x.
 */
const PACKSHOT_WIDTHS = [320, 640, 960];

function packshot(release: string) {
  return {
    avif: PACKSHOT_WIDTHS.map((width) => `/images/packshot-${release}-${width}.avif ${width}w`).join(", "),
    jpeg: PACKSHOT_WIDTHS.map((width) => `/images/packshot-${release}-${width}.jpg ${width}w`).join(", "),
    fallback: `/images/packshot-${release}-640.jpg`,
  };
}

export const PACKSHOTS = {
  oldMaster: packshot("1986"),
  newMaster: packshot("2026"),
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

/** Pause, seek and start fade the gain this long, so no waveform is cut mid-cycle. */
export const FADE_SECONDS = 0.005;

/**
 * The trim the eight stems share before the output. Measured: at their 0.86
 * default the eight sum to +0.51dBFS, so without it the stem bus clipped at the
 * hardware, while the masters — carrying 0.78 inside their own gains — peak at
 * -1.97dBFS. 0.794 is 2.01dB down, which lands the default at -1.4dBFS playing
 * and -1.6dBFS through the export's resample: clear of full scale, and clear of
 * the export's -1dBFS ceiling, so a default mix now needs no makeup at all.
 *
 * It covers the whole range, not just the default: every fader at 1.0 is the
 * loudest the bus can be asked for, and that reaches only -0.28dBFS. Solo and
 * mute only ever remove stems. So nothing a visitor can set will clip it.
 *
 * What it does not do is close the loudness gap to the A/B. The stem sum has a
 * 17.4dB crest where the mastered 2026 file has 14.2dB, so peak-matching and
 * loudness-matching pull opposite ways: the section reads 2.9LU below the A/B
 * (-17.1 against -14.2 LUFS). Only limiting would close that, and a limiter
 * would move the balance the visitor set.
 */
export const STEM_BUS_TRIM = 0.794;

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
