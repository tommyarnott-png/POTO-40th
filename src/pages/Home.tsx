import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, RefObject } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  Download,
  LoaderCircle,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  BRAND,
  FADE_SECONDS,
  MASTER_DURATION,
  OLD_MASTER_DECODE_RATE,
  OLD_MASTER_GAIN_COMPENSATION,
  OLD_MASTER_PLAYBACK_RATE,
  OLD_MASTER_SPEED,
  OLD_MASTER_START_OFFSET,
  OLD_MASTER_TILT_DB,
  PACKSHOTS,
  PLAYBACK,
  PLAYBACK_SAMPLE_RATE,
  STEM_BUS_TRIM,
  STEM_DURATION,
  STEMS,
} from "@/assets";
import type { StemId } from "@/assets";
import { createTrackSet } from "@/audioLoader";
import trackPeaks from "@/data/trackPeaks.json";
import { MIX_FILENAME, exportMix } from "@/mixExport";
import type { ExportStage } from "@/mixExport";
import SignupModal, { submitSignup } from "@/components/SignupModal";
import type { SignupDetails } from "@/components/SignupModal";
import type { DownloadKind } from "@/consent";
import { bringIntoView, embedded } from "@/embed";
import { PRODUCTS, loadProductDetails } from "@/shop";
import type { ProductDetail } from "@/shop";

/**
 * The smoke behind the page, in two layers.
 *
 * The photograph is very dark in its own right — measured, its mean is rgb(27,30,34),
 * nothing in it reaches 112 of 255 and four fifths of it sits below 48 — so its whole
 * range is crushed into the bottom sixth of the scale. It has plenty of texture inside
 * that range (its spread is as large as its mean); the range simply never rises far
 * enough to be seen. A flat wash on top then halved what little there was, which is
 * why the page read as flat near-black. Lifting the wash alone cannot fix that, so the
 * plate carries a filter that opens the photograph's range out.
 *
 * The darkening over it is the same strength everywhere. It used to be heavier at the
 * top and bottom than through the middle, and inside the host's auto-height frame,
 * where "fixed" means the whole document, that read as bands changing strength down
 * the page. The sides are still held back, the site's own treatment, and at exactly
 * 270deg: any angle off horizontal drifts down a tall frame as well.
 *
 * Contrast is judged by the worst case, not at a few scroll positions: the photograph
 * does not move with the page, so any line of copy can come to rest over any part of
 * it. The worst is the brightest glyph-sized patch of this backdrop anywhere in the
 * content column. At .70 it is a luminance of 0.043 on a phone, 0.052 on a 1440px
 * desktop and 0.050 inside the host's frame at any width, which puts the smallest pale
 * blue labels at 5.3:1 or better and the section headings' darker gradient stop at
 * 3.3:1 — enough for large text only, which is why .section-heading is 24px on a phone.
 * The shaped version it replaces failed that test: 2.8:1 for the labels at 1440px.
 *
 * The cost is the smoke. This much darkening leaves about half the visible texture the
 * shaped version had through the middle of the page; no uniform treatment kept more
 * and passed at every width, whether the plate was dimmed or the wash raised.
 */
const SMOKE_FILTER = "brightness(2) contrast(1.16)";
const SMOKE_SCRIM = [
  "linear-gradient(270deg, rgba(0,6,15,.78), transparent 25%, transparent 75%, rgba(0,6,15,.78))",
  "linear-gradient(rgba(0,6,15,.7), rgba(0,6,15,.7))",
].join(", ");

function formatTime(value: number) {
  const seconds = Number.isFinite(value) ? Math.max(0, value) : 0;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

/**
 * Bar geometry in CSS pixels: a 2px bar on a 3px pitch. The pitch decides how
 * many bars a given width can hold.
 */
const BAR_WIDTH = 2;
const BAR_PITCH = 3;
/** The official site's accent for what has played, and its rule colour for what has not. */
const WAVE_PLAYED = "#a5bed3";
const WAVE_UNPLAYED = "#3b4154";

/**
 * The A/B cut. The two versions' vocals sit up to 43ms apart, so any real
 * overlap is heard as an echo: the cut lasts 8ms, just long enough not to click,
 * drawn as an equal-power curve in eight straight segments.
 */
const SWITCH_SECONDS = 0.008;
const SWITCH_STEPS = 8;

const START_DELAY_SECONDS = 0.02;

/**
 * The crossfade slider. A drag starts once the pointer has moved this far, mostly
 * sideways, so a landing touch or a scroll does not nudge the mix; and a full
 * crossfade always takes at least this much pointer travel, however narrow the frame.
 */
const FADE_SLOP_PX = 6;
const FADE_TRAVEL_PX = 400;

/**
 * What the browser needs to pick a packshot width: the artwork box is half the
 * card's inner width, capped at 240px. Below 640px the page is inset 20px, the
 * card padded 20px and the pair gapped 16px; from 640px those are 32, 36 and 32,
 * and the cap takes over at 648px.
 */
const ART_SIZES = "(min-width: 648px) 240px, (min-width: 640px) calc((100vw - 168px) / 2), calc((100vw - 96px) / 2)";

/**
 * The same for a product shot. A card runs it down the side until 768px — 112px
 * wide, 128px from 480px — and across the top of a column above that: the page is
 * inset 32px, the three columns are gapped 24px and each card padded 20px, until
 * the page stops growing at 1240px and the shot at 336px.
 */
const SHOT_SIZES = "(min-width: 1240px) 336px, (min-width: 768px) calc((100vw - 112px) / 3 - 40px), (min-width: 480px) 128px, 112px";

type MasterId = "oldMaster" | "newMaster";
type Transport = "masters" | "stems";
type LoadState = "idle" | "loading" | "ready" | "failed";
type Voice = { source: AudioBufferSourceNode; gain: GainNode; when: number };
type Voices = Record<string, Voice>;

function isRunning(voices: Voices) {
  return Object.keys(voices).length > 0;
}

/** Tracks the rendered size of an element, and how many bars its width holds. */
function useBarLayout(ref: RefObject<HTMLElement | null>) {
  const [layout, setLayout] = useState({ count: 0, width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? 0;
      const height = entries[0]?.contentRect.height ?? 0;
      setLayout({ count: Math.max(1, Math.floor(width / BAR_PITCH)), width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return layout;
}

/**
 * Reduces a high-resolution envelope to `count` bars, keeping the loudest value
 * in each bucket so transients survive the downsample. Rendering every measured
 * peak would overflow the container and leave the playhead — positioned as a
 * percentage of the full width — pointing at the wrong bar.
 */
function resample(peaks: number[], count: number) {
  if (count <= 0) return [];
  if (count >= peaks.length) return peaks;

  const bucket = peaks.length / count;
  const bars = new Array<number>(count);

  for (let i = 0; i < count; i += 1) {
    const start = Math.floor(i * bucket);
    const end = Math.min(peaks.length, Math.floor((i + 1) * bucket));
    let loudest = 0;
    for (let j = start; j < end; j += 1) {
      if (peaks[j] > loudest) loudest = peaks[j];
    }
    bars[i] = loudest;
  }

  return bars;
}

/**
 * A mirrored waveform drawn to one canvas: rounded bars symmetrical about the
 * centre line, bright up to the playhead and dim after it. One canvas per row
 * keeps nine waveforms from costing several thousand DOM nodes of layout.
 */
function WaveBars({ peaks, progress }: { peaks: number[]; progress: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { count, width, height } = useBarLayout(canvasRef);
  const bars = useMemo(() => resample(peaks, count), [peaks, count]);

  // The bars only change with the data or the size, so the shape is built once
  // per layout; each frame just moves the split between the two fills. Bars are
  // spread across the full width so they stay in step with the playhead.
  const shape = useMemo(() => {
    const path = new Path2D();
    const spacing = width / Math.max(1, bars.length);
    bars.forEach((peak, index) => {
      const barHeight = Math.max(BAR_WIDTH, peak * height * 0.92);
      path.roundRect(index * spacing + (spacing - BAR_WIDTH) / 2, (height - barHeight) / 2, BAR_WIDTH, barHeight, BAR_WIDTH / 2);
    });
    return path;
  }, [bars, width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const scale = window.devicePixelRatio || 1;
    const pixelWidth = Math.round(width * scale);
    const pixelHeight = Math.round(height * scale);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    const split = (progress / 100) * width;
    const fills: [number, number, string][] = [[0, split, WAVE_PLAYED], [split, width, WAVE_UNPLAYED]];
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, width, height);
    fills.forEach(([from, to, colour]) => {
      context.save();
      context.beginPath();
      context.rect(from, 0, to - from, height);
      context.clip();
      context.fillStyle = colour;
      context.fill(shape);
      context.restore();
    });
  }, [shape, progress, width, height]);

  return (
    <div className="relative h-full w-full overflow-hidden" aria-hidden="true">
      <canvas ref={canvasRef} className="block h-full w-full" />
      <div className="absolute inset-y-0 w-px bg-white shadow-[0_0_8px_rgba(255,255,255,.75)]" style={{ left: `${progress}%` }} />
    </div>
  );
}

/**
 * In-page links scroll rather than navigate to a fragment: a fragment change
 * would neither move the parent page when framed nor stay out of its Back
 * history. How the scroll happens differs between a standalone page and a framed
 * one; see bringIntoView.
 */
function scrollToTarget(event: ReactMouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  const target = document.getElementById(event.currentTarget.hash.slice(1));
  if (target) bringIntoView(target);
}

function pointerTime(event: ReactPointerEvent<HTMLElement>, duration: number) {
  const bounds = event.currentTarget.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
  return ratio * duration;
}

export default function Home() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const stemBusRef = useRef<GainNode | null>(null);
  const [masterSet] = useState(() => createTrackSet([
    { id: "oldMaster", file: PLAYBACK.oldMaster, decodeRate: OLD_MASTER_DECODE_RATE },
    { id: "newMaster", file: PLAYBACK.newMaster },
  ]));
  const [stemSet] = useState(() => createTrackSet(STEMS, { trim: true, onTrack: joinStem }));

  // What the visitor has asked for, as distinct from what is sounding: the
  // transport that should be running, and a count every play, pause and seek
  // advances. A start that waited on a download goes ahead only if nothing has
  // been asked since, and then reads the side, mix and position as they are now.
  const wantedRef = useRef<Transport | null>(null);
  const requestRef = useRef(0);

  const masterVoicesRef = useRef<Voices>({});
  const masterStartedAtRef = useRef(0);
  const masterOffsetRef = useRef(0);

  const stemVoicesRef = useRef<Voices>({});
  const stemsStartedAtRef = useRef(0);
  const stemsOffsetRef = useRef(0);

  // Set when the stems finish loading. The masters are then released as soon as
  // they are idle and the visitor has left the A/B, once: releasing either set
  // clears it, so scrolling back and forth past the A/B cannot unload and reload
  // them repeatedly, nor unload them when the stems are no longer held.
  const mastersSpareRef = useRef(false);
  /** The visitor is at the A/B while at least half its card is on screen. */
  const atMastersRef = useRef(false);
  const stemsInViewRef = useRef(new Set<Element>());
  const masterCardRef = useRef<HTMLDivElement>(null);
  const stemsSectionRef = useRef<HTMLElement>(null);
  const stemsApproachRef = useRef<HTMLDivElement>(null);
  const stemListRef = useRef<HTMLDivElement>(null);

  /** The crossfade: 0 is the 1986 original alone, 1 the 2026 remaster alone. */
  const [fade, setFade] = useState(1);
  const [fadeDragging, setFadeDragging] = useState(false);
  const fadeDragRef = useRef<{ pointer: number; x: number; y: number; from: number; started: boolean } | null>(null);
  const [wanted, setWanted] = useState<Transport | null>(null);
  const [masterLoad, setMasterLoad] = useState<LoadState>("idle");
  const [masterTime, setMasterTime] = useState(0);
  const [masterPlaying, setMasterPlaying] = useState(false);

  const [stemLoad, setStemLoad] = useState<LoadState>("idle");
  /** Stems of the current load that have decoded, for the rows' ready state. */
  const [stemReady, setStemReady] = useState<Record<string, boolean>>({});
  const [stemsTime, setStemsTime] = useState(0);
  const [stemsPlaying, setStemsPlaying] = useState(false);
  const [stemVolume, setStemVolume] = useState<Record<string, number>>(() => Object.fromEntries(STEMS.map((stem) => [stem.id, 0.86])));
  const [stemMute, setStemMute] = useState<Record<string, boolean>>(() => Object.fromEntries(STEMS.map((stem) => [stem.id, false])));
  const [stemSolo, setStemSolo] = useState<Record<string, boolean>>(() => Object.fromEntries(STEMS.map((stem) => [stem.id, false])));
  const [outputMuted, setOutputMuted] = useState(false);

  /** What the shop says about each release, for those it answered for; see src/shop.ts. */
  const [productDetails, setProductDetails] = useState<Record<string, ProductDetail>>({});

  const [exportStage, setExportStage] = useState<ExportStage | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportNote, setExportNote] = useState<string | null>(null);
  /** Which download is waiting on the form, and where on the page to put the dialog. */
  const [gate, setGate] = useState<{ download: DownloadKind; anchorTop: number; pageHeight: number } | null>(null);
  /** What the visitor gave, kept for this session so the second download needn't ask again. */
  const signupRef = useRef<SignupDetails | null>(null);
  const [packStage, setPackStage] = useState<"sending" | "fetching" | null>(null);
  const [packNote, setPackNote] = useState<string | null>(null);
  /** Whichever download is in flight, so neither can start twice or start over the other. */
  const [busy, setBusy] = useState<DownloadKind | null>(null);
  /** Held as a ref as well, so a second press in the same tick cannot start a second run. */
  const busyRef = useRef(false);

  // The side and mix as last rendered, for audio that starts after an await.
  const mixRef = useRef({ fade, outputMuted, stemVolume, stemMute, stemSolo });
  mixRef.current = { fade, outputMuted, stemVolume, stemMute, stemSolo };

  const masterProgress = Math.min(100, (masterTime / MASTER_DURATION) * 100);
  const stemProgress = Math.min(100, (stemsTime / STEM_DURATION) * 100);
  const stemsReady = Object.keys(stemReady).length;

  function getContext() {
    if (!audioContextRef.current) {
      // An iPhone's silent switch mutes Web Audio outright: Safari files a bare
      // AudioContext under iOS's ambient category, and the page gets no error and no
      // sign of it. Playback is the category a music player uses; it plays through the
      // switch and, as a music player does, pauses whatever else was playing. Inside a
      // cross-origin frame Safari ignores this unless the frame is allowed the
      // microphone, so there the host page sets it (see docs/EMBED.md).
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session) session.type = "playback";
      const context = new AudioContext({ latencyHint: "interactive", sampleRate: PLAYBACK_SAMPLE_RATE });
      // Eight stems need one place to hold the sum down; the two masters carry
      // their own level in masterLevels() instead. See STEM_BUS_TRIM.
      const bus = context.createGain();
      bus.gain.value = STEM_BUS_TRIM;
      bus.connect(context.destination);
      audioContextRef.current = context;
      stemBusRef.current = bus;
    }
    return audioContextRef.current;
  }

  function setWantedTransport(next: Transport | null) {
    wantedRef.current = next;
    setWanted(next);
  }

  function loadMasters() {
    if (!masterSet.held) setMasterLoad("loading");
    return masterSet.load().then((held) => {
      if (held) setMasterLoad("ready");
      else if (masterSet.failed) {
        setMasterLoad("failed");
        if (wantedRef.current === "masters") setWantedTransport(null);
      }
      return held;
    });
  }

  function loadStems() {
    if (!stemSet.held) setStemLoad("loading");
    return stemSet.load().then((held) => {
      if (held) {
        setStemLoad("ready");
        mastersSpareRef.current = true;
        releaseSpareMasters();
      } else if (stemSet.failed) {
        setStemLoad("failed");
        // Stems that did load play on without the rest; with none, the wait to start ends.
        if (wantedRef.current === "stems" && Object.keys(stemSet.ready).length === 0) pauseStems();
      }
      return held;
    });
  }

  function releaseMasters() {
    mastersSpareRef.current = false;
    masterSet.release();
    setMasterLoad("idle");
  }

  function releaseStems() {
    mastersSpareRef.current = false;
    stemSet.release();
    setStemLoad("idle");
    setStemReady({});
    // An earlier mix download's result would otherwise stand where the export
    // control says why it is unavailable until the stems are back.
    setExportNote(null);
  }

  function releaseSpareMasters() {
    if (mastersSpareRef.current && !atMastersRef.current && wantedRef.current !== "masters") releaseMasters();
  }

  /** A source through its own gain, faded in from its start time. Stems pass the bus; the masters go straight out. */
  function createVoice(context: AudioContext, buffer: AudioBuffer, level: number, when: number, destination: AudioNode = context.destination): Voice {
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.value = 0;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(level, when + FADE_SECONDS);
    source.connect(gain).connect(destination);
    source.onended = () => gain.disconnect();
    return { source, gain, when };
  }

  /** Fades voices out and stops them once silent; they stay alive until the fade ends. */
  function fadeOut(voices: Voices) {
    const context = audioContextRef.current;
    if (!context) return;
    const now = context.currentTime;
    Object.values(voices).forEach(({ source, gain }) => {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
      try {
        source.stop(now + FADE_SECONDS);
      } catch {
        // The node may already have reached the end.
      }
    });
  }

  /**
   * The masters' gains for the crossfade position, on an equal-power law. Measured
   * across the section (BS.1770 loudness) it stays within 0.24LU of the ends at every
   * position, where a linear law dips 3.23LU at the centre: the two versions correlate
   * at -0.05, band-only passages included, so they add as unrelated signals. At 0.84
   * the centre peaked 0.09dB over full scale; at 0.78, with the 1986 side matched and
   * then tilted down (see OLD_MASTER_TILT_DB), the loudest position peaks at -0.6dBTP.
   * Sines keep the ends exactly 0 and 1.
   */
  function masterLevels(): Record<MasterId, number> {
    const { fade: toRemaster, outputMuted: muted } = mixRef.current;
    const level = muted ? 0 : 0.78;
    return {
      oldMaster: level * OLD_MASTER_GAIN_COMPENSATION * 10 ** (OLD_MASTER_TILT_DB / 20) * Math.sin((Math.PI / 2) * (1 - toRemaster)),
      newMaster: level * Math.sin((Math.PI / 2) * toRemaster),
    };
  }

  /**
   * Cuts the running masters over to the selected side. The squared gains trade
   * along a quarter sine, so the level holds across the cut: at 8ms the two
   * versions are too far apart in time to sum coherently, as a linear fade assumes.
   */
  function crossMasters() {
    const context = audioContextRef.current;
    const voices = masterVoicesRef.current;
    if (!context || !isRunning(voices)) return;
    const now = context.currentTime;
    const notStarted = now < masterStartedAtRef.current;
    const at = Math.max(now, masterStartedAtRef.current);
    const levels = masterLevels();
    (["oldMaster", "newMaster"] as const).forEach((id) => {
      const param = voices[id].gain.gain;
      const from = notStarted ? 0 : param.value;
      param.cancelScheduledValues(now);
      param.setValueAtTime(from, at);
      for (let step = 1; step <= SWITCH_STEPS; step += 1) {
        const blend = Math.sin((Math.PI / 2) * (step / SWITCH_STEPS)) ** 2;
        param.linearRampToValueAtTime(Math.sqrt(from ** 2 * (1 - blend) + levels[id] ** 2 * blend), at + (SWITCH_SECONDS * step) / SWITCH_STEPS);
      }
    });
  }

  /** What the visitor has set this stem to. The output mute is left out: it silences the page, it is not part of the mix. */
  function mixLevel(id: StemId) {
    const { stemMute: mute, stemSolo: solo, stemVolume: volume } = mixRef.current;
    const anySolo = Object.values(solo).some(Boolean);
    return !mute[id] && (!anySolo || solo[id]) ? volume[id] ?? 0.86 : 0;
  }

  function stemLevel(id: StemId) {
    return mixRef.current.outputMuted ? 0 : mixLevel(id);
  }

  function updateStemGains() {
    const context = audioContextRef.current;
    if (!context) return;
    const now = context.currentTime;
    STEMS.forEach((stem) => {
      const voice = stemVoicesRef.current[stem.id];
      if (!voice) return;
      // Each voice from its own start: a stem that joined late may not have begun.
      const at = Math.max(now, voice.when);
      const param = voice.gain.gain;
      param.cancelScheduledValues(now);
      param.setValueAtTime(now < voice.when ? 0 : param.value, at);
      param.setTargetAtTime(stemLevel(stem.id), at, 0.01);
    });
  }

  function stopMasters() {
    const context = audioContextRef.current;
    if (context && isRunning(masterVoicesRef.current)) {
      const position = Math.min(MASTER_DURATION, masterOffsetRef.current + Math.max(0, context.currentTime - masterStartedAtRef.current));
      masterOffsetRef.current = position;
      setMasterTime(position);
    }
    fadeOut(masterVoicesRef.current);
    masterVoicesRef.current = {};
    setMasterPlaying(false);
  }

  function stopStems() {
    const context = audioContextRef.current;
    if (context && isRunning(stemVoicesRef.current)) {
      const position = Math.min(STEM_DURATION, stemsOffsetRef.current + Math.max(0, context.currentTime - stemsStartedAtRef.current));
      stemsOffsetRef.current = position;
      setStemsTime(position);
    }
    fadeOut(stemVoicesRef.current);
    stemVoicesRef.current = {};
    setStemsPlaying(false);
  }

  async function requestMasters(offset: number) {
    const request = ++requestRef.current;
    // Resumed before any await: iOS only lets audio start inside the tap itself.
    const context = getContext();
    const resumed = context.resume();
    setWantedTransport("masters");
    stopStems();
    masterOffsetRef.current = offset;
    setMasterTime(offset);

    const held = await loadMasters();
    await resumed;
    if (request !== requestRef.current || !held) return;

    const when = context.currentTime + START_DELAY_SECONDS;
    // Both offsets on whole frames: Safari reads a buffer at a fractional offset by
    // interpolating, which took up to 4dB off the top at 15kHz. The 1986 buffer is
    // already at the 1986 side's speed, so its offset is the matched 1986 position
    // in that buffer's own time.
    const frame = (seconds: number) => Math.round(seconds * PLAYBACK_SAMPLE_RATE) / PLAYBACK_SAMPLE_RATE;
    const position = frame(Math.min(masterOffsetRef.current, MASTER_DURATION - 0.02));
    const levels = masterLevels();
    const oldMaster = createVoice(context, held.oldMaster.buffer, levels.oldMaster, when);
    oldMaster.source.start(when, frame((OLD_MASTER_START_OFFSET + position * OLD_MASTER_PLAYBACK_RATE) / OLD_MASTER_SPEED));
    const newMaster = createVoice(context, held.newMaster.buffer, levels.newMaster, when);
    newMaster.source.start(when, position);

    masterVoicesRef.current = { oldMaster, newMaster };
    masterOffsetRef.current = position;
    masterStartedAtRef.current = when;
    setMasterPlaying(true);
    releaseStems();
  }

  async function requestStems(offset: number) {
    const request = ++requestRef.current;
    const context = getContext();
    const resumed = context.resume();
    setWantedTransport("stems");
    stopMasters();
    stemsOffsetRef.current = offset;
    setStemsTime(offset);

    const loading = loadStems();
    // Stems already decoded start now and the rest join as they decode. With none
    // decoded yet the start waits for the whole set, so the arrangement opens
    // complete rather than on whichever file happened to download first.
    if (Object.keys(stemSet.ready).length === 0) await loading;
    await resumed;
    const ready = stemSet.ready;
    if (request !== requestRef.current || Object.keys(ready).length === 0) return;

    const when = context.currentTime + START_DELAY_SECONDS;
    // Snapped to a whole frame, and the stems drift apart without it. A stem whose
    // trimmed audio has not begun is scheduled by delaying its start; the rest play
    // from an offset into their buffers. Engines treat a fraction of a frame
    // differently in the two (Chrome rounds an offset to the nearest frame but keeps
    // the fraction in a start time), so from a fractional position the two groups
    // land up to half a frame apart. Nothing hears that but a null test. A whole
    // frame leaves nothing to round.
    const position = Math.round(Math.min(stemsOffsetRef.current, STEM_DURATION - 0.02) * PLAYBACK_SAMPLE_RATE) / PLAYBACK_SAMPLE_RATE;
    stemVoicesRef.current = Object.fromEntries(STEMS.filter((stem) => ready[stem.id]).map((stem) => {
      const { buffer, start } = ready[stem.id];
      const voice = createVoice(context, buffer, stemLevel(stem.id), when, stemBusRef.current!);
      // A stem's leading silence isn't held, so it enters at its place on the shared clock.
      voice.source.start(when + Math.max(0, start - position), Math.max(0, position - start));
      return [stem.id, voice];
    }));

    stemsOffsetRef.current = position;
    stemsStartedAtRef.current = when;
    setStemsPlaying(true);
    releaseMasters();
  }

  /**
   * Marks a stem's row ready as it decodes and, if the others are already playing,
   * joins it to their clock: it starts a whole number of frames after them, at the
   * position they have reached by then, so it is in time from its first sample.
   */
  function joinStem(id: string) {
    setStemReady((previous) => ({ ...previous, [id]: true }));
    const context = audioContextRef.current;
    if (!context || !isRunning(stemVoicesRef.current)) return;
    const { buffer, start } = stemSet.ready[id];
    const frames = Math.max(0, Math.ceil((context.currentTime + START_DELAY_SECONDS - stemsStartedAtRef.current) * PLAYBACK_SAMPLE_RATE));
    const when = stemsStartedAtRef.current + frames / PLAYBACK_SAMPLE_RATE;
    const position = (Math.round(stemsOffsetRef.current * PLAYBACK_SAMPLE_RATE) + frames) / PLAYBACK_SAMPLE_RATE;
    const voice = createVoice(context, buffer, stemLevel(id as StemId), when, stemBusRef.current!);
    voice.source.start(when + Math.max(0, start - position), Math.max(0, position - start));
    stemVoicesRef.current[id] = voice;
  }

  function pauseMasters() {
    requestRef.current += 1;
    setWantedTransport(null);
    stopMasters();
    releaseSpareMasters();
    preloadStems();
  }

  function pauseStems() {
    requestRef.current += 1;
    setWantedTransport(null);
    stopStems();
  }

  function toggleMasters() {
    if (wantedRef.current === "masters") pauseMasters();
    else void requestMasters(masterOffsetRef.current >= MASTER_DURATION ? 0 : masterOffsetRef.current);
  }

  function toggleStems() {
    if (wantedRef.current === "stems") pauseStems();
    else void requestStems(stemsOffsetRef.current >= STEM_DURATION ? 0 : stemsOffsetRef.current);
  }

  /**
   * Renders the mix as the visitor has it and saves it as an MP3. It reads the
   * decoded stems and builds its own offline graph, so it never touches what is
   * playing; and it holds the stems it started with, so a visitor who moves back
   * to the masters mid-export still gets the mix they asked for.
   *
   * Only offered once every stem has decoded. A mix quietly missing a part would
   * be a worse thing to hand someone than no file at all.
   */
  async function runExport() {
    const ready = stemSet.held;
    if (!ready) return;

    const levels = Object.fromEntries(STEMS.map((stem) => [stem.id, mixLevel(stem.id)]));
    const { blob, gain } = await exportMix(ready, levels, (stage, progress) => {
      setExportStage(stage);
      setExportProgress(progress);
    });

    // In the document and revoked on a timer: Firefox will not follow a link it
    // cannot see, and Safari can still be reading the blob when the click returns.
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = MIX_FILENAME;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);

    setExportStage(null);
    // Anything that would read as "0.0dB down" is not worth saying.
    const reduction = -20 * Math.log10(gain);
    setExportNote(reduction >= 0.05 ? `Saved, ${reduction.toFixed(1)}dB down so it doesn't clip` : "Saved");
  }

  /** Confirms the archive is there before starting it, so a refusal is not saved as a file of JSON. */
  async function fetchPack(token: string) {
    const address = `/api/download?token=${encodeURIComponent(token)}`;
    setPackStage("fetching");
    const checked = await fetch(address, { method: "HEAD" }).catch(() => null);
    if (!checked || !checked.ok) {
      setPackStage(null);
      setPackNote(checked?.status === 404
        ? "The stem pack isn't ready to download yet."
        : "That download couldn't be authorised. Please try again.");
      return;
    }
    const link = document.createElement("a");
    link.href = address;
    document.body.append(link);
    link.click();
    link.remove();
    setPackStage(null);
    setPackNote("Downloading");
  }

  /**
   * Both offers come through the same form and neither is reachable without it. A
   * visitor who has already given their details is not asked again: the page sends
   * what they gave with the other download named, which records that they took
   * that one too and returns a fresh authorisation, the previous one being good
   * for minutes only.
   */
  function requestDownload(download: DownloadKind, trigger: HTMLElement) {
    if (busyRef.current) return;
    const details = signupRef.current;
    if (!details) {
      // The page's height is taken now, before the dialog is in it, so the dialog
      // can keep itself inside it. Growing the document would move the height
      // posted to the host frame and make its iframe jump under the visitor.
      setGate({
        download,
        anchorTop: trigger.getBoundingClientRect().top + window.scrollY - 24,
        pageHeight: document.body.scrollHeight,
      });
      return;
    }
    void start(download, details);
  }

  async function start(download: DownloadKind, details: SignupDetails) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(download);
    if (download === "stem-pack") {
      setPackNote(null);
      setPackStage("sending");
    } else {
      setExportNote(null);
    }

    const result = await submitSignup(details, download);
    if ("error" in result) {
      if (download === "stem-pack") {
        setPackStage(null);
        setPackNote(result.error);
      } else {
        setExportNote(result.error);
      }
    } else if (download === "mix") {
      await runExport();
    } else {
      await fetchPack(result.token);
    }

    busyRef.current = false;
    setBusy(null);
  }

  /** The form has already posted and been answered; this only spends what it returned. */
  async function afterSignup(details: SignupDetails, token: string, download: DownloadKind) {
    signupRef.current = details;
    setGate(null);
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(download);
    if (download === "mix") await runExport();
    else await fetchPack(token);
    busyRef.current = false;
    setBusy(null);
  }

  function seekMasters(nextTime: number) {
    const target = Math.min(MASTER_DURATION, Math.max(0, nextTime));
    masterOffsetRef.current = target;
    setMasterTime(target);
    if (wantedRef.current !== "masters") return;
    fadeOut(masterVoicesRef.current);
    masterVoicesRef.current = {};
    setMasterPlaying(false);
    void requestMasters(target);
  }

  /** Ends a crossfade drag; a gesture the browser takes back for scrolling leaves the mix where it was. */
  function releaseFade(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = fadeDragRef.current;
    if (drag?.pointer !== event.pointerId) return;
    if (event.type === "pointercancel") setFade(drag.from);
    fadeDragRef.current = null;
    setFadeDragging(false);
  }

  function seekStems(nextTime: number) {
    const target = Math.min(STEM_DURATION, Math.max(0, nextTime));
    stemsOffsetRef.current = target;
    setStemsTime(target);
    if (wantedRef.current !== "stems") return;
    fadeOut(stemVoicesRef.current);
    stemVoicesRef.current = {};
    setStemsPlaying(false);
    void requestStems(target);
  }

  useEffect(() => {
    crossMasters();
  }, [fade, outputMuted]);

  useEffect(() => {
    updateStemGains();
  }, [stemVolume, stemMute, stemSolo, outputMuted]);

  /**
   * Loading prompted by where the visitor is rather than a press waits while the other transport plays, so the two sets aren't held together.
   * After a failure it waits for a press too, so moving around the page doesn't retry, and announce the failure, over and over.
   */
  function loadMastersOnIntent() {
    if (wantedRef.current !== "stems" && !masterSet.failed) void loadMasters();
  }

  /**
   * Loads the stems once their section is near, unless the visitor is still with
   * the masters: at the A/B, or playing them. Starting the masters releases the
   * stems, so a load then would only be thrown away. On a phone the whole A/B
   * card fits on screen with the stems marker below it, so where the visitor is
   * decides this, not whether they have touched the card yet. After a failure
   * it waits for a press, as loading the masters does.
   */
  function preloadStems() {
    if (stemsInViewRef.current.size > 0 && !stemSet.held && !stemSet.failed && !atMastersRef.current && wantedRef.current !== "masters") void loadStems();
  }

  // The marker watched sits 200px above the stems section because a frame on
  // another origin ignores rootMargin; the section and the rows are watched too,
  // for a visitor who arrives directly. The A/B card is watched to know when the
  // visitor has moved on from the masters.
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.target === masterCardRef.current) atMastersRef.current = entry.intersectionRatio >= 0.5;
        else if (entry.isIntersecting) stemsInViewRef.current.add(entry.target);
        else stemsInViewRef.current.delete(entry.target);
      });
      releaseSpareMasters();
      preloadStems();
    }, { threshold: [0, 0.5] });
    [masterCardRef, stemsApproachRef, stemsSectionRef, stemListRef].forEach((ref) => observer.observe(ref.current!));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const context = audioContextRef.current;
      if (context && isRunning(masterVoicesRef.current)) {
        const value = masterOffsetRef.current + Math.max(0, context.currentTime - masterStartedAtRef.current);
        if (value >= MASTER_DURATION) {
          fadeOut(masterVoicesRef.current);
          masterVoicesRef.current = {};
          masterOffsetRef.current = MASTER_DURATION;
          setWantedTransport(null);
          setMasterPlaying(false);
          setMasterTime(MASTER_DURATION);
          preloadStems();
        } else {
          setMasterTime(value);
        }
      }
      if (context && isRunning(stemVoicesRef.current)) {
        const value = stemsOffsetRef.current + Math.max(0, context.currentTime - stemsStartedAtRef.current);
        if (value >= STEM_DURATION) {
          fadeOut(stemVoicesRef.current);
          stemVoicesRef.current = {};
          stemsOffsetRef.current = STEM_DURATION;
          setWantedTransport(null);
          setStemsPlaying(false);
          setStemsTime(STEM_DURATION);
        } else {
          setStemsTime(value);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  // Asked for once, as the page loads, so the answer is there long before anyone
  // has scrolled to the foot. A shop that cannot be reached leaves the cards
  // without prices, which is the same as the moment before an answer arrives, and
  // is why neither state is announced.
  useEffect(() => {
    loadProductDetails().then(setProductDetails, () => {});
  }, []);

  const masters = [
    { id: "oldMaster", art: PACKSHOTS.oldMaster, label: "1986 original" },
    { id: "newMaster", art: PACKSHOTS.newMaster, label: "2026 remaster" },
  ] as const;

  return (
    // Standalone, the page opens with room above the introduction, as it has no header of its own. Framed, the host's own
    // introduction sits directly above, and its bottom padding with the A/B section's top padding makes the same gap the
    // introduction leaves standalone. Positioned so the gate can sit absolutely over the page without lengthening it.
    <div className={`relative bg-[#00060f] text-white ${embedded ? "" : "pt-15"}`}>
      {/* Two layers rather than stacked background-images on this div, because the
          photograph needs a filter that the darkening above it must not share. Fixed,
          which inside the auto-height frame means the whole document, matching the
          background-attachment these layers replace. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${BRAND.background})`, filter: SMOKE_FILTER }}
      />
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0" style={{ backgroundImage: SMOKE_SCRIM }} />
      <main className="relative z-10">
        {/* The host page carries its own copy of this introduction above the frame, so it is left out inside one. */}
        {!embedded && (
          <section className="mx-auto flex min-h-[510px] max-w-[1240px] flex-col items-center justify-center px-5 py-20 text-center sm:px-8">
            <p className="mb-5 text-[13.44px] uppercase tracking-[0.1em] text-[#a5bed3]">The original London production</p>
            <h1 className="section-heading">The Original Cast Recording</h1>
            <h2 className="divider-heading mt-3">Like You&apos;ve Never Heard Before</h2>
            <p className="mt-8 max-w-[620px] text-[14px] leading-[1.8] min-[480px]:text-[16px]">
              Hear The Phantom of the Opera in two ways: compare the original and new masters, then scroll down to explore the new remaster as eight synchronised stems.
            </p>
            <a href="#masters" onClick={scrollToTarget} className="mt-10 flex flex-col items-center gap-2 text-[13.44px] uppercase tracking-[0.1em] text-[#a5bed3]">
              Begin listening <ArrowDown className="h-4 w-4" />
            </a>
          </section>
        )}

        {/* No rules between sections, and no section of its own tint: the page reads as one continuous scroll. */}
        <section id="masters" className="py-20 sm:py-28">
          <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
            <div className="mx-auto mb-12 max-w-[700px] text-center">
              {/* The page's h1 is the introduction's; framed, where that is left out, this heading takes its place. */}
              {embedded ? (
                <h1 className="section-heading text-balance">One performance. Two mixes.</h1>
              ) : (
                <h2 className="section-heading text-balance">One performance. Two mixes.</h2>
              )}
              <p className="mx-auto mt-5 max-w-[620px] text-balance text-[14px] leading-[1.8] min-[480px]:text-[16px]">Press play once, then switch between the&nbsp;original&nbsp;master and the new remaster at any moment.</p>
            </div>

            {/* Nothing downloads until a visitor reaches for the comparison. */}
            <div ref={masterCardRef} onPointerEnter={loadMastersOnIntent} onFocus={loadMastersOnIntent} className="border border-[#3b4154] bg-black/30 p-5 shadow-[0_18px_18px_rgba(0,0,0,.3)] sm:p-9">
              {/* The recording's name, set as the official site's h3: 19px on a line of the same height. It runs 16.2
                  times its own size, so beside the play button and the time it would have to shrink below the labels
                  round it to fit a 340px frame. Below 768px it takes a line of its own above them instead, sized from
                  the header's width so it stays on one line, and the status moves into the gap between the button and
                  the time. The status appears the moment a finger lands on the card, so wherever it goes it must not
                  move the button that finger is pressing. */}
              <div className="@container grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-4 border-b border-[#3b4154] pb-5 md:gap-x-4">
                {/* The icon swaps to a spinner the moment a pointer arrives and loading starts; icons that
                    ignore the pointer keep that swap from swallowing the first tap. */}
                <button onClick={masterLoad === "failed" ? () => void loadMasters() : toggleMasters} aria-busy={masterLoad === "loading"} aria-label={masterLoad === "failed" ? "Retry loading the master comparison" : wanted === "masters" ? "Pause master comparison" : "Play master comparison"} className="grid h-12 w-12 place-items-center rounded-full border border-[#a5bed3] bg-[linear-gradient(72deg,#6a99ab,#a5bed3)] text-[#00060f] transition-transform *:pointer-events-none active:scale-95">
                  {masterLoad === "loading" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : masterLoad === "failed" ? <RefreshCw className="h-5 w-5" /> : masterPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
                </button>
                <div className="contents md:block">
                  <p className="order-first col-span-3 truncate text-[length:clamp(13.44px,calc(100cqi/16.5),19px)] leading-none uppercase tracking-[0.1em]">The Phantom of the Opera</p>
                  {/* Always rendered, so screen readers are already watching it when a load starts or fails. */}
                  <p role="status" className="text-[12px] uppercase tracking-[0.1em] text-[#a5bed3] md:not-empty:mt-1">{masterLoad === "loading" ? "Loading" : masterLoad === "failed" ? "Couldn't load" : null}</p>
                </div>
                <div className="flex items-center gap-3 text-[13.44px] tabular-nums text-[#a5bed3]">
                  <button onClick={() => seekMasters(0)} aria-label="Restart master comparison" className="transition-colors hover:text-white"><RotateCcw className="h-4 w-4" /></button>
                  <span>{formatTime(masterTime)}</span><span className="text-[#6a99ab]">/</span><span>{formatTime(MASTER_DURATION)}</span>
                </div>
              </div>

              <div
                className="relative mt-7 h-[122px] cursor-pointer sm:h-[154px]"
                role="slider"
                tabIndex={0}
                aria-label="Master playback position"
                aria-valuemin={0}
                aria-valuemax={MASTER_DURATION}
                aria-valuenow={masterTime}
                onPointerDown={(event) => seekMasters(pointerTime(event, MASTER_DURATION))}
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft") seekMasters(masterTime - 5);
                  if (event.key === "ArrowRight") seekMasters(masterTime + 5);
                }}>
                <WaveBars peaks={trackPeaks.new_master} progress={masterProgress} />
              </div>

              <fieldset className="mt-8 min-w-0 border-t border-[#3b4154] pt-8">
                <legend className="sr-only">Choose which master you hear</legend>
                <div className="grid grid-cols-2 items-start gap-4 text-[12px] sm:gap-8">
                  {masters.map((master, index) => {
                    // How much of this side is in the mix: the artwork lights in proportion to the crossfade.
                    const lit = master.id === "oldMaster" ? 1 - fade : fade;
                    return (
                      <label key={master.id} className="group block cursor-pointer">
                        <input type="radio" name="master" value={master.id} checked={lit === 1} onChange={() => setFade(master.id === "oldMaster" ? 0 : 1)} className="peer sr-only" />
                        {/* Full-bleed sleeves, not cut-outs on black like the masks were, so neither the
                            screen blend nor the contrast lift comes across: screening would drop the
                            2026's pure black out altogether and lifting would crush the 1986's navy to
                            match it, losing the one thing that tells them apart at a glance. The edge is
                            drawn instead and brightens with the mix, so the lit side stays obvious even
                            where the artwork itself is almost the colour of the page behind it. */}
                        <picture className="mx-auto block w-full max-w-[240px]">
                          <source type="image/avif" srcSet={master.art.avif} sizes={ART_SIZES} />
                          <img
                            src={master.art.fallback}
                            srcSet={master.art.jpeg}
                            sizes={ART_SIZES}
                            alt=""
                            width={960}
                            height={960}
                            style={{ "--lit": 0.45 + 0.55 * lit, "--edge": `rgba(165, 190, 211, ${0.2 + 0.6 * lit})` } as CSSProperties}
                            className={`block aspect-square w-full border border-(--edge) opacity-(--lit) shadow-[0_14px_34px_rgba(0,0,0,.5)] group-hover:opacity-[max(0.7,var(--lit))] ${fadeDragging ? "" : "transition-[opacity,border-color] duration-300"}`}
                          />
                        </picture>
                        {/* The same box as the artwork above it, so the label sits against its own
                            outer edge at every width instead of the column's, which leaves it adrift
                            once the artwork stops growing at 240px. It stays a sibling of the input,
                            because that is what the focus outline is keyed to. */}
                        <span className={`mx-auto mt-3 block w-full max-w-[240px] uppercase tracking-[0.1em] outline-offset-4 transition-colors peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-[#a5bed3] ${index === 1 ? "text-right" : ""} ${lit >= 0.5 ? "text-[#a5bed3]" : "text-[#6a99ab]"}`}>{master.label}</span>
                      </label>
                    );
                  })}
                </div>

                {/* Dragging moves the mix relative to where it was, never jumping to the pointer, and
                    scales a narrow frame's travel up so a small drag is always a small change. */}
                <div
                  role="slider"
                  tabIndex={0}
                  aria-label="Crossfade between the 1986 original and the 2026 remaster"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(fade * 100)}
                  aria-valuetext={fade === 0 ? "1986 original only" : fade === 1 ? "2026 remaster only" : `${100 - Math.round(fade * 100)}% 1986 original, ${Math.round(fade * 100)}% 2026 remaster`}
                  onPointerDown={(event) => {
                    if (event.button !== 0 || fadeDragRef.current) return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    fadeDragRef.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, from: fade, started: false };
                  }}
                  onPointerMove={(event) => {
                    const drag = fadeDragRef.current;
                    if (drag?.pointer !== event.pointerId) return;
                    const dx = event.clientX - drag.x;
                    if (!drag.started) {
                      if (Math.abs(dx) < FADE_SLOP_PX || Math.abs(dx) < Math.abs(event.clientY - drag.y)) return;
                      drag.started = true;
                      drag.x = event.clientX;
                      setFadeDragging(true);
                      return;
                    }
                    setFade(Math.min(1, Math.max(0, drag.from + dx / Math.max(FADE_TRAVEL_PX, event.currentTarget.clientWidth - 56))));
                  }}
                  onPointerUp={releaseFade}
                  onPointerCancel={releaseFade}
                  onKeyDown={(event) => {
                    const step = ({ ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, Home: -20, End: 20 } as Record<string, number | undefined>)[event.key];
                    if (step === undefined) return;
                    event.preventDefault();
                    setFade(Math.min(20, Math.max(0, Math.round(fade * 20) + step)) / 20);
                  }}
                  className={`group/fade relative mt-6 h-12 touch-pan-y select-none focus-visible:outline-none ${fadeDragging ? "cursor-grabbing" : "cursor-grab"}`}>
                  <span className="absolute inset-x-[28px] top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[#3b4154]" />
                  <span className="absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-[#6a99ab]" />
                  <span
                    style={{ left: `calc(${fade} * (100% - 56px))` }}
                    className={`absolute top-1/2 grid h-8 w-[56px] -translate-y-1/2 place-items-center rounded-[5.6px] border border-[#a5bed3] bg-[linear-gradient(72deg,#6a99ab,#a5bed3)] outline-offset-4 group-focus-visible/fade:outline group-focus-visible/fade:outline-1 group-focus-visible/fade:outline-[#a5bed3] ${fadeDragging ? "shadow-[0_0_0_8px_rgba(165,190,211,.22)]" : "shadow-[0_0_0_4px_rgba(165,190,211,.14)] transition-[left] duration-300"}`}>
                    <span className="h-4 w-px bg-[#00060f]/45" />
                  </span>
                </div>
              </fieldset>
            </div>
          </div>
        </section>

        <section id="stems" ref={stemsSectionRef} className="relative py-20 sm:py-28">
          <div ref={stemsApproachRef} aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-[200px] h-px" />
          <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
            <div className="mx-auto mb-8 max-w-[700px] text-center">
              <h2 className="section-heading text-balance">Inside the new mix.</h2>
              <p className="mx-auto mt-5 max-w-[620px] text-balance text-[14px] leading-[1.8] min-[480px]:text-[16px]">Press play on any row to hear the complete arrangement, then solo, mute or rebalance individual parts.</p>
            </div>

            {/* On a line of its own at the head of the list, so the introduction above can centre. */}
            <div className="mb-3 flex justify-end">
              <button onClick={() => { setStemMute(Object.fromEntries(STEMS.map((stem) => [stem.id, false]))); setStemSolo(Object.fromEntries(STEMS.map((stem) => [stem.id, false]))); setStemVolume(Object.fromEntries(STEMS.map((stem) => [stem.id, 0.86]))); }} className="text-[13.44px] uppercase tracking-[0.1em] text-[#a5bed3] hover:text-white">Reset mix</button>
            </div>

            <div ref={stemListRef} className="border-t border-[#3b4154]">
              {STEMS.map((stem) => {
                const anySolo = Object.values(stemSolo).some(Boolean);
                const audible = !stemMute[stem.id] && (!anySolo || stemSolo[stem.id]);
                // A row is pending until its own stem decodes. Until the stems are asked to play, a pending
                // row's play button does nothing; once they are, it works like any other row, and its stem
                // joins the others the moment it decodes. A row whose stem failed to load offers to retry
                // it, and a stem that loads on a retry joins the others the same way.
                const pending = stemLoad === "loading" && !stemReady[stem.id];
                const failed = stemLoad === "failed" && !stemReady[stem.id];
                const starting = stemLoad === "loading" && wanted === "stems" && !stemsPlaying;
                const inert = pending && wanted !== "stems";
                // A row reads like a mixer channel: play, name, solo, mute, level, then the
                // stem's waveform taking whatever width is left. Below 768px the controls
                // share one 44px line and the waveform runs as a slim strip beneath them, so
                // eight rows fit under the section heading on a phone; a full-height
                // waveform there took more room than it gave. Both layouts follow the
                // source order, so tabbing follows the screen at any width. The name column
                // never drops below the longest single word, "Percussion".
                return (
                  <article key={stem.id} className={`grid grid-cols-[40px_minmax(88px,1fr)_auto_minmax(0,1.25fr)] items-center gap-x-2 gap-y-0.5 border-b border-[#3b4154] py-1 transition-opacity md:grid-cols-[44px_minmax(110px,160px)_auto_120px_minmax(0,1fr)] md:gap-x-5 lg:grid-cols-[44px_minmax(110px,160px)_auto_160px_minmax(0,1fr)] md:gap-y-0 md:py-[13px] ${audible ? "opacity-100" : "opacity-45"}`}>
                    <button onClick={failed ? () => void loadStems() : inert ? undefined : toggleStems} aria-disabled={inert} aria-busy={pending || starting} aria-label={failed ? `Retry loading ${stem.name}` : inert ? `${stem.name} still loading` : `${wanted === "stems" ? "Pause" : "Play"} all stems from ${stem.name} row`} className={`relative grid h-9 w-9 place-items-center rounded-full border transition-colors *:pointer-events-none before:absolute before:-inset-[5px] before:content-[''] ${inert ? "cursor-default border-[#3b4154] text-[#6a99ab]" : "border-[#a5bed3] bg-[rgba(42,75,90,.38)] text-[#a5bed3] hover:bg-[#a5bed3] hover:text-[#00060f]"}`}>
                      {pending || starting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : failed ? <RefreshCw className="h-3.5 w-3.5" /> : stemsPlaying ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="ml-px h-3.5 w-3.5 fill-current" />}
                    </button>
                    <p className="min-w-0 text-[12.8px] uppercase leading-[1.4] tracking-[0.06em] md:truncate">{stem.name}</p>
                    <div className="flex items-center gap-2 md:gap-3">
                      <button onClick={() => setStemSolo((previous) => ({ ...previous, [stem.id]: !previous[stem.id] }))} className={`stem-button ${stemSolo[stem.id] ? "active" : ""}`} aria-label={`Solo ${stem.name}`}>S</button>
                      <button onClick={() => setStemMute((previous) => ({ ...previous, [stem.id]: !previous[stem.id] }))} className={`stem-button ${stemMute[stem.id] ? "active" : ""}`} aria-label={`Mute ${stem.name}`}>M</button>
                    </div>
                    <input aria-label={`${stem.name} volume`} type="range" min="0" max="1" step="0.01" value={stemVolume[stem.id]} onChange={(event) => setStemVolume((previous) => ({ ...previous, [stem.id]: Number(event.target.value) }))} className="w-full min-w-0 cursor-pointer" />
                    <div
                      className={`relative col-span-4 h-[18px] min-w-0 cursor-pointer transition-opacity before:absolute before:inset-x-0 before:-inset-y-[3px] before:content-[''] md:col-span-1 md:h-[38px] ${pending || failed ? "opacity-40" : ""}`}
                      role="slider"
                      tabIndex={0}
                      aria-label={`${stem.name} playback position`}
                      aria-valuemin={0}
                      aria-valuemax={STEM_DURATION}
                      aria-valuenow={stemsTime}
                      onPointerDown={(event) => seekStems(pointerTime(event, STEM_DURATION))}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowLeft") seekStems(stemsTime - 5);
                        if (event.key === "ArrowRight") seekStems(stemsTime + 5);
                      }}>
                      <WaveBars peaks={trackPeaks.stems[stem.id]} progress={stemProgress} />
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-5 flex flex-col justify-between gap-4 text-[12px] uppercase tracking-[0.1em] text-[#a5bed3] sm:flex-row sm:items-center">
              <span className="tabular-nums">
                {formatTime(stemsTime)} / {formatTime(STEM_DURATION)}
                <span role="status">{stemLoad === "loading" ? ` • Loading stems • ${stemsReady} of ${STEMS.length} ready` : stemLoad === "failed" ? (stemsReady === 0 ? " • Stems couldn't load" : ` • ${stemsReady} of ${STEMS.length} ready • ${STEMS.length - stemsReady} couldn't load`) : stemLoad === "ready" ? <span className="sr-only">All stems ready</span> : ""}</span>
              </span>
              <button onClick={() => setOutputMuted((value) => !value)} className="flex items-center gap-2 text-[13.44px] text-[#a5bed3] hover:text-white" aria-label={outputMuted ? "Unmute all audio" : "Mute all audio"}>
                {outputMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />} {outputMuted ? "Output muted" : "Output active"}
              </button>
            </div>

            {/* The source material, beside the section that plays it. The mix below is the
                visitor's own version of the same recording; the two headings tell them apart.
                The status line says nothing until there is something to report, and takes no
                room until then. Stacked on a phone it goes below the button, so a message
                appearing never moves the button. */}
            <div className="mt-6 flex flex-col border-t border-[#3b4154] pt-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="contents sm:block sm:min-w-0">
                <p className="mb-3 text-[13.44px] uppercase tracking-[0.1em] sm:mb-0">The stems themselves</p>
                <p role="status" className="order-last text-[12px] uppercase tracking-[0.1em] text-[#a5bed3] not-empty:mt-3 sm:not-empty:mt-1">
                  {packStage === "sending"
                    ? "Sending your details"
                    : packStage === "fetching"
                      ? "Starting your download"
                      : packNote}
                </p>
              </div>
              <button
                onClick={(event) => requestDownload("stem-pack", event.currentTarget)}
                disabled={busy !== null}
                aria-busy={busy === "stem-pack"}
                className="flex shrink-0 items-center justify-center gap-2 rounded-[5.6px] border border-[#a5bed3] px-[22px] py-[11px] text-[13.44px] uppercase tracking-[0.1em] text-[#a5bed3] transition-colors hover:bg-[#a5bed3] hover:text-[#00060f] disabled:cursor-default disabled:border-[#3b4154] disabled:bg-transparent disabled:text-[#6a99ab]">
                {busy === "stem-pack" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Get the stem pack
              </button>
            </div>

            {/* Beside the faders, since they are what it renders. The status line carries the
                stage and the bar carries the position, so a screen reader is told the export
                has started and finished without being read a new percentage every block.
                While the stems are not loaded and no mix download has anything to report, it
                says why the button is not yet available: while the A/B plays they are not
                loading, and nothing else on the page says so. */}
            <div className="mt-6 flex flex-col border-t border-[#3b4154] pt-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="contents sm:block sm:min-w-0">
                <p className="mb-3 text-[13.44px] uppercase tracking-[0.1em] sm:mb-0">Take your mix with you</p>
                <p role="status" className="order-last text-[12px] uppercase tracking-[0.1em] text-[#a5bed3] not-empty:mt-3 sm:not-empty:mt-1">
                  {exportStage === "rendering"
                    ? "Rendering your mix"
                    : exportStage === "encoding"
                      ? "Encoding your mix"
                      : exportNote ?? (stemLoad === "idle" || stemLoad === "loading" ? "Available once the stems have loaded" : null)}
                </p>
                {exportStage && (
                  <div
                    role="progressbar"
                    aria-label="Export progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(exportProgress * 100)}
                    className="order-last mt-3 h-[3px] w-full max-w-[220px] overflow-hidden rounded-full bg-[#3b4154]">
                    <div className="h-full rounded-full bg-[linear-gradient(72deg,#6a99ab,#a5bed3)]" style={{ width: `${exportProgress * 100}%` }} />
                  </div>
                )}
              </div>
              <button
                onClick={(event) => requestDownload("mix", event.currentTarget)}
                disabled={stemLoad !== "ready" || busy !== null}
                aria-busy={busy === "mix"}
                className="flex shrink-0 items-center justify-center gap-2 rounded-[5.6px] border border-[#a5bed3] bg-[linear-gradient(72deg,#6a99ab,#a5bed3)] px-[22px] py-[11px] text-[13.44px] uppercase tracking-[0.1em] text-[#00060f] transition-opacity hover:opacity-90 disabled:cursor-default disabled:border-[#3b4154] disabled:bg-none disabled:bg-[rgba(42,75,90,.38)] disabled:text-[#6a99ab]">
                {exportStage ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {exportStage === "encoding" ? `Encoding ${Math.round(exportProgress * 100)}%` : "Download your mix"}
              </button>
            </div>
          </div>
        </section>

        {/* The releases themselves, for a visitor who has just spent time with the
            recording. Prices come from the shop as the page loads and are shown only
            when they arrive in the currency this page can name (see src/shop.ts). */}
        <section id="shop" className="py-20 sm:py-28">
          <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
            <div className="mx-auto mb-12 max-w-[700px] text-center">
              <h2 className="section-heading text-balance">Take it home.</h2>
              <p className="mx-auto mt-5 max-w-[620px] text-balance text-[14px] leading-[1.8] min-[480px]:text-[16px]">The Andrew Lloyd Webber 2026 Mix on vinyl and CD, and the collector&apos;s box set, from the official Andrew Lloyd Webber UK store.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3 md:gap-6">
              {PRODUCTS.map((product) => {
                const detail = productDetails[product.id];
                return (
                  // One link to a card, on the heading, stretched over the whole card by its
                  // own ::after: making the shot and the call to action links of their own
                  // would read as three links to the same place. A new tab, because the page
                  // may be inside the host's frame, where following a link in the top frame
                  // would take the host's page away with it.
                  <article key={product.id} className="group relative flex flex-col border border-[#3b4154] bg-black/30 p-4 shadow-[0_18px_18px_rgba(0,0,0,.3)] outline-offset-4 transition-colors hover:border-[#a5bed3] has-[a:focus-visible]:outline has-[a:focus-visible]:outline-1 has-[a:focus-visible]:outline-[#a5bed3] md:p-5">
                    {/* The shot runs down the side of the name until the cards become columns.
                        The price below spans the whole card rather than the space beside the
                        shot, because in a 340px frame that space cannot hold a price and a
                        label on one line. */}
                    <div className="flex gap-4 md:flex-col md:gap-5">
                      <picture className="w-28 shrink-0 min-[480px]:w-32 md:w-full">
                        <source type="image/avif" srcSet={product.art.avif} sizes={SHOT_SIZES} />
                        <img
                          src={product.art.fallback}
                          srcSet={product.art.jpeg}
                          sizes={SHOT_SIZES}
                          alt=""
                          width={720}
                          height={720}
                          loading="lazy"
                          decoding="async"
                          className="block aspect-square w-full border border-[#3b4154]"
                        />
                      </picture>
                      <h3 className="min-w-0 text-[12.8px] uppercase leading-[1.4]">
                        <a href={product.url} target="_blank" rel="noopener noreferrer" className="after:absolute after:inset-0 after:content-['']">
                          <span className="block tracking-[0.1em] text-[#a5bed3]">{product.format}</span>
                          <span className="mt-2 block text-balance tracking-[0.06em]">{product.name}</span>
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      </h3>
                    </div>
                    {/* The price keeps its line whether or not there is a price to put in it,
                        so an answer arriving late — or not at all — cannot change the height
                        the page reports to the host frame. */}
                    <div className="mt-auto pt-4">
                      <p className="flex h-[26px] items-center gap-3 text-[14px] min-[480px]:text-[16px]">
                        {detail && <span>{detail.price}</span>}
                        {detail?.soldOut ? (
                          <span className="whitespace-nowrap border border-[#3b4154] px-2 py-1 text-[12px] uppercase leading-none tracking-[0.1em] text-[#a5bed3]">Sold out</span>
                        ) : detail?.preorder ? (
                          <span className="whitespace-nowrap border border-[#3b4154] px-2 py-1 text-[12px] uppercase leading-none tracking-[0.1em] text-[#a5bed3]">Pre-order</span>
                        ) : null}
                      </p>
                      {/* The card's own link says where it goes and that it opens a tab, so
                          this is the same thing said again to anyone who can see it. */}
                      <p aria-hidden="true" className="mt-3 flex items-center gap-2 text-[13.44px] uppercase tracking-[0.1em] text-[#a5bed3] transition-colors group-hover:text-white">
                        Shop now <ArrowUpRight className="h-4 w-4" />
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {gate && (
        <SignupModal
          download={gate.download}
          anchorTop={gate.anchorTop}
          pageHeight={gate.pageHeight}
          onClose={() => setGate(null)}
          onComplete={(details, token) => void afterSignup(details, token, gate.download)}
        />
      )}
    </div>
  );
}
