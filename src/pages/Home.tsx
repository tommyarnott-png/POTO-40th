import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, RefObject } from "react";
import {
  ArrowDown,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  BRAND,
  MASTER_DURATION,
  OLD_MASTER_GAIN_COMPENSATION,
  OLD_MASTER_PLAYBACK_RATE,
  OLD_MASTER_START_OFFSET,
  PLAYBACK,
  STEM_DURATION,
  STEMS,
} from "@/assets";
import trackPeaks from "@/data/trackPeaks.json";

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
const WAVE_PLAYED = "rgba(220,234,242,.92)";
const WAVE_UNPLAYED = "rgba(165,190,211,.25)";

/**
 * How long the A/B switch takes to cross from one master to the other. Short
 * enough to feel immediate, long enough that neither gain steps and clicks.
 */
const CROSSFADE_SECONDS = 0.06;

type MasterId = "oldMaster" | "newMaster";

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
 * The official white production logo is not redistributed with this repo (see
 * docs/ASSETS.md). Rather than render a broken image when it has not been
 * dropped in, fall back to a typeset wordmark in the production's own palette.
 */
function Wordmark({ className, textClassName }: { className?: string; textClassName?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={`block whitespace-nowrap font-light uppercase leading-tight tracking-[0.14em] text-[#a5bed3] ${textClassName ?? ""}`}>
        The Phantom<span className="text-white/55"> of the </span>Opera
      </span>
    );
  }

  return (
    <img
      src={BRAND.logo}
      alt="Andrew Lloyd Webber's The Phantom of the Opera"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

/**
 * In-page links scroll with scrollIntoView rather than fragment navigation.
 * Embedded in an auto-height frame the page has nothing of its own to scroll,
 * and a fragment change would neither move the parent page nor stay out of its
 * Back history.
 */
function scrollToTarget(event: ReactMouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  document.getElementById(event.currentTarget.hash.slice(1))?.scrollIntoView();
}

function pointerTime(event: ReactPointerEvent<HTMLElement>, duration: number) {
  const bounds = event.currentTarget.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
  return ratio * duration;
}

export default function Home() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const decodedBuffersRef = useRef<Record<string, AudioBuffer>>({});

  const masterSourcesRef = useRef<Record<string, AudioBufferSourceNode>>({});
  const masterGainsRef = useRef<Record<string, GainNode>>({});
  const masterStartedAtRef = useRef(0);
  const masterOffsetRef = useRef(0);
  const masterPlayingRef = useRef(false);

  const stemSourcesRef = useRef<Record<string, AudioBufferSourceNode>>({});
  const stemGainsRef = useRef<Record<string, GainNode>>({});
  const stemsStartedAtRef = useRef(0);
  const stemsOffsetRef = useRef(0);
  const stemsPlayingRef = useRef(false);

  const [activeMaster, setActiveMaster] = useState<MasterId>("newMaster");
  const [masterTime, setMasterTime] = useState(0);
  const [masterPlaying, setMasterPlaying] = useState(false);
  const [masterLoading, setMasterLoading] = useState(false);
  const [masterReady, setMasterReady] = useState(false);

  const [stemsTime, setStemsTime] = useState(0);
  const [stemsPlaying, setStemsPlaying] = useState(false);
  const [stemsLoading, setStemsLoading] = useState(false);
  const [stemsReady, setStemsReady] = useState(false);
  const [stemVolume, setStemVolume] = useState<Record<string, number>>(() => Object.fromEntries(STEMS.map((stem) => [stem.id, 0.86])));
  const [stemMute, setStemMute] = useState<Record<string, boolean>>(() => Object.fromEntries(STEMS.map((stem) => [stem.id, false])));
  const [stemSolo, setStemSolo] = useState<Record<string, boolean>>(() => Object.fromEntries(STEMS.map((stem) => [stem.id, false])));
  const [outputMuted, setOutputMuted] = useState(false);

  const masterProgress = Math.min(100, (masterTime / MASTER_DURATION) * 100);
  const stemProgress = Math.min(100, (stemsTime / STEM_DURATION) * 100);

  function getContext() {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ latencyHint: "interactive" });
    }
    return audioContextRef.current;
  }

  async function decodeTrack(id: string, url: string) {
    if (decodedBuffersRef.current[id]) return decodedBuffersRef.current[id];
    const context = getContext();
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Unable to load ${id}`);
    const data = await response.arrayBuffer();
    const buffer = await context.decodeAudioData(data);
    decodedBuffersRef.current[id] = buffer;
    return buffer;
  }

  async function prepareMasters() {
    if (masterReady) return;
    setMasterLoading(true);
    try {
      await Promise.all([
        decodeTrack("oldMaster", PLAYBACK.oldMaster),
        decodeTrack("newMaster", PLAYBACK.newMaster),
      ]);
      setMasterReady(true);
    } finally {
      setMasterLoading(false);
    }
  }

  async function prepareStems() {
    if (stemsReady) return;
    setStemsLoading(true);
    try {
      await Promise.all(STEMS.map((stem) => decodeTrack(stem.id, stem.file)));
      setStemsReady(true);
    } finally {
      setStemsLoading(false);
    }
  }

  function stopNodes(nodes: Record<string, AudioBufferSourceNode>) {
    Object.values(nodes).forEach((node) => {
      try {
        node.stop();
      } catch {
        // The node may already have reached the end.
      }
      node.disconnect();
    });
  }

  /**
   * Crosses the two running masters to `nextMaster` with a linear ramp. The
   * recordings are the same performance, so equal-gain crossfading keeps the
   * level steady where an equal-power curve would bump it mid-ramp.
   */
  function updateMasterGain(nextMaster = activeMaster) {
    const context = audioContextRef.current;
    if (!context) return;
    const baseGain = outputMuted ? 0 : 0.84;
    const levels: Record<MasterId, number> = {
      oldMaster: nextMaster === "oldMaster" ? baseGain * OLD_MASTER_GAIN_COMPENSATION : 0,
      newMaster: nextMaster === "newMaster" ? baseGain : 0,
    };
    const now = context.currentTime;
    (["oldMaster", "newMaster"] as const).forEach((id) => {
      const gain = masterGainsRef.current[id];
      if (!gain) return;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(levels[id], now + CROSSFADE_SECONDS);
    });
  }

  function updateStemGains() {
    const context = audioContextRef.current;
    if (!context) return;
    const anySolo = Object.values(stemSolo).some(Boolean);
    const now = context.currentTime;
    STEMS.forEach((stem) => {
      const gain = stemGainsRef.current[stem.id];
      if (!gain) return;
      const audible = !outputMuted && !stemMute[stem.id] && (!anySolo || stemSolo[stem.id]);
      const level = audible ? stemVolume[stem.id] ?? 0.86 : 0;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(level, now, 0.01);
    });
  }

  async function startMasters(offset = masterTime) {
    pauseStems();
    await prepareMasters();
    const context = getContext();
    await context.resume();
    stopNodes(masterSourcesRef.current);
    masterSourcesRef.current = {};
    masterGainsRef.current = {};

    const when = context.currentTime + 0.02;
    const safeOffset = Math.min(offset, MASTER_DURATION - 0.02);
    (["oldMaster", "newMaster"] as const).forEach((id) => {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = decodedBuffersRef.current[id];
      if (id === "oldMaster") source.playbackRate.value = OLD_MASTER_PLAYBACK_RATE;
      gain.gain.value = 0;
      source.connect(gain).connect(context.destination);
      const bufferOffset = id === "oldMaster"
        ? OLD_MASTER_START_OFFSET + safeOffset * OLD_MASTER_PLAYBACK_RATE
        : safeOffset;
      source.start(when, bufferOffset);
      masterSourcesRef.current[id] = source;
      masterGainsRef.current[id] = gain;
    });

    masterOffsetRef.current = safeOffset;
    masterStartedAtRef.current = when;
    masterPlayingRef.current = true;
    setMasterPlaying(true);
    updateMasterGain(activeMaster);
  }

  function pauseMasters() {
    if (masterPlayingRef.current && audioContextRef.current) {
      const elapsed = Math.max(0, audioContextRef.current.currentTime - masterStartedAtRef.current);
      const nextTime = Math.min(MASTER_DURATION, masterOffsetRef.current + elapsed);
      masterOffsetRef.current = nextTime;
      setMasterTime(nextTime);
    }
    stopNodes(masterSourcesRef.current);
    masterSourcesRef.current = {};
    masterGainsRef.current = {};
    masterPlayingRef.current = false;
    setMasterPlaying(false);
  }

  async function toggleMasters() {
    if (masterPlayingRef.current) pauseMasters();
    else await startMasters(masterTime >= MASTER_DURATION ? 0 : masterTime);
  }

  async function seekMasters(nextTime: number) {
    const target = Math.min(MASTER_DURATION, Math.max(0, nextTime));
    const wasPlaying = masterPlayingRef.current;
    if (wasPlaying) {
      stopNodes(masterSourcesRef.current);
      masterSourcesRef.current = {};
      masterGainsRef.current = {};
      masterPlayingRef.current = false;
      setMasterPlaying(false);
    }
    setMasterTime(target);
    masterOffsetRef.current = target;
    if (wasPlaying) await startMasters(target);
  }

  async function startStems(offset = stemsTime) {
    pauseMasters();
    await prepareStems();
    const context = getContext();
    await context.resume();
    stopNodes(stemSourcesRef.current);
    stemSourcesRef.current = {};
    stemGainsRef.current = {};

    const when = context.currentTime + 0.02;
    const safeOffset = Math.min(offset, STEM_DURATION - 0.02);
    STEMS.forEach((stem) => {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = decodedBuffersRef.current[stem.id];
      gain.gain.value = 0;
      source.connect(gain).connect(context.destination);
      source.start(when, safeOffset);
      stemSourcesRef.current[stem.id] = source;
      stemGainsRef.current[stem.id] = gain;
    });

    stemsOffsetRef.current = safeOffset;
    stemsStartedAtRef.current = when;
    stemsPlayingRef.current = true;
    setStemsPlaying(true);
    updateStemGains();
  }

  function pauseStems() {
    if (stemsPlayingRef.current && audioContextRef.current) {
      const elapsed = Math.max(0, audioContextRef.current.currentTime - stemsStartedAtRef.current);
      const nextTime = Math.min(STEM_DURATION, stemsOffsetRef.current + elapsed);
      stemsOffsetRef.current = nextTime;
      setStemsTime(nextTime);
    }
    stopNodes(stemSourcesRef.current);
    stemSourcesRef.current = {};
    stemGainsRef.current = {};
    stemsPlayingRef.current = false;
    setStemsPlaying(false);
  }

  async function toggleStems() {
    if (stemsPlayingRef.current) pauseStems();
    else await startStems(stemsTime >= STEM_DURATION ? 0 : stemsTime);
  }

  async function seekStems(nextTime: number) {
    const target = Math.min(STEM_DURATION, Math.max(0, nextTime));
    const wasPlaying = stemsPlayingRef.current;
    if (wasPlaying) {
      stopNodes(stemSourcesRef.current);
      stemSourcesRef.current = {};
      stemGainsRef.current = {};
      stemsPlayingRef.current = false;
      setStemsPlaying(false);
    }
    setStemsTime(target);
    stemsOffsetRef.current = target;
    if (wasPlaying) await startStems(target);
  }

  // Also runs as playback starts, so a switch made while the masters were still
  // loading is the one that plays.
  useEffect(() => {
    updateMasterGain(activeMaster);
  }, [activeMaster, outputMuted, masterPlaying]);

  // Likewise, so solo, mute and levels set while the stems were loading apply.
  useEffect(() => {
    updateStemGains();
  }, [stemVolume, stemMute, stemSolo, outputMuted, stemsPlaying]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const context = audioContextRef.current;
      if (context && masterPlayingRef.current) {
        const value = masterOffsetRef.current + Math.max(0, context.currentTime - masterStartedAtRef.current);
        if (value >= MASTER_DURATION) {
          stopNodes(masterSourcesRef.current);
          masterSourcesRef.current = {};
          masterPlayingRef.current = false;
          setMasterPlaying(false);
          setMasterTime(MASTER_DURATION);
        } else {
          setMasterTime(value);
        }
      }
      if (context && stemsPlayingRef.current) {
        const value = stemsOffsetRef.current + Math.max(0, context.currentTime - stemsStartedAtRef.current);
        if (value >= STEM_DURATION) {
          stopNodes(stemSourcesRef.current);
          stemSourcesRef.current = {};
          stemsPlayingRef.current = false;
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
      stopNodes(masterSourcesRef.current);
      stopNodes(stemSourcesRef.current);
      audioContextRef.current?.close();
    };
  }, []);

  const navLinks = [
    ["London", "https://www.phantomoftheopera.com/london"],
    ["Tickets", "https://www.phantomoftheopera.com/london/tickets"],
    ["Origins", "https://www.phantomoftheopera.com/london/about"],
    ["Gallery", "https://www.phantomoftheopera.com/london/gallery"],
    ["Cast & Creative", "https://www.phantomoftheopera.com/london/cast-creative"],
    ["Merchandise", "https://store.playbill.co.uk/phantom"],
  ];

  const masters = [
    { id: "oldMaster", mask: BRAND.maskOriginal, title: "The old master of The Phantom of the Opera", label: "1986 original" },
    { id: "newMaster", mask: BRAND.maskRemaster, title: "The new remaster of The Phantom of the Opera", label: "2026 remaster" },
  ] as const;

  return (
    <div className="bg-[#00060f] text-white" style={{ backgroundImage: `linear-gradient(rgba(0,6,15,.45), rgba(0,6,15,.65)), url(${BRAND.background})`, backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}>
      <header className="sticky top-0 z-50 border-b border-white/15 bg-[#00060f]/94 backdrop-blur-xl">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
          <div className="flex h-[86px] items-center justify-between gap-4 sm:gap-8">
            <a href="#top" onClick={scrollToTarget} aria-label="The Phantom of the Opera" className="block shrink-0">
              <Wordmark className="h-auto w-[148px] sm:w-[232px]" textClassName="text-[13px] sm:text-[17px]" />
            </a>
            <a href="https://ticketing.lwtheatres.co.uk/event/121/" target="_blank" rel="noreferrer" className="bg-gradient-to-r from-[#6a99ab] to-[#a5bed3] px-3 py-2.5 text-[9px] font-medium uppercase tracking-[0.12em] text-[#00060f] transition-opacity hover:opacity-90 sm:px-5 sm:py-3 sm:text-[11px] sm:tracking-[0.16em]">
              London Tickets
            </a>
          </div>
          <nav className="hidden h-11 items-center justify-center gap-8 border-t border-white/10 text-[11px] uppercase tracking-[0.13em] text-white/90 md:flex">
            {navLinks.map(([label, href]) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" className="transition-colors hover:text-[#a5bed3]">{label}</a>
            ))}
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="mx-auto flex min-h-[510px] max-w-[1240px] flex-col items-center justify-center px-5 py-20 text-center sm:px-8">
          <p className="mb-5 text-[11px] uppercase tracking-[0.24em] text-[#a5bed3]">The original London production</p>
          <h1 className="text-[42px] font-light uppercase leading-[0.95] tracking-[0.08em] text-[#a5bed3] sm:text-[66px]">The Original Cast Recording</h1>
          <h2 className="mt-3 text-[13px] font-light uppercase tracking-[0.24em] text-white sm:text-[16px]">Like You&apos;ve Never Heard Before</h2>
          <p className="font-detail mt-8 max-w-[620px] text-[15px] leading-7 text-white/72">
            Hear The Phantom of the Opera in two ways: compare the original and new masters, then scroll down to explore the new remaster as eight synchronized stems.
          </p>
          <a href="#masters" onClick={scrollToTarget} className="mt-10 flex flex-col items-center gap-2 text-[10px] uppercase tracking-[0.17em] text-[#a5bed3]">
            Begin listening <ArrowDown className="h-4 w-4" />
          </a>
        </section>

        <section id="masters" className="scroll-mt-32 border-y border-white/14 bg-[#00060f]/44 py-20 sm:py-28">
          <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
            <div className="mb-12 max-w-[700px]">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#a5bed3]">01 — Masters A / B</p>
              <h2 className="mt-4 text-[36px] font-light leading-tight tracking-[-0.02em] sm:text-[52px]">One performance. Two mixes.</h2>
              <p className="font-detail mt-5 max-w-[620px] text-[15px] leading-7 text-white/65">Press play once, then switch between the original master and the new remaster at any moment. Both files run from the same sample-accurate audio clock.</p>
            </div>

            <div className="border border-[#a5bed3]/25 bg-[#020a15]/80 p-5 shadow-[0_30px_80px_rgba(0,0,0,.28)] sm:p-9">
              <div className="flex items-center justify-between gap-5 border-b border-white/12 pb-5">
                <div className="flex min-w-0 items-center gap-4">
                  <button onClick={toggleMasters} disabled={masterLoading} aria-label={masterPlaying ? "Pause master comparison" : "Play master comparison"} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#a5bed3] text-[#00060f] transition-transform active:scale-95 disabled:cursor-wait disabled:opacity-70">
                    {masterLoading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : masterPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
                  </button>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium">The Phantom of the Opera</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[#a5bed3]">Master comparison {masterReady ? "• Ready" : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[12px] tabular-nums text-[#a5bed3]">
                  <button onClick={() => seekMasters(0)} aria-label="Restart master comparison" className="transition-colors hover:text-white"><RotateCcw className="h-4 w-4" /></button>
                  <span>{formatTime(masterTime)}</span><span className="text-white/25">/</span><span>{formatTime(MASTER_DURATION)}</span>
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

              <fieldset className="mt-8 min-w-0 border-t border-white/12 pt-8">
                <legend className="sr-only">Choose which master you hear</legend>
                <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4 text-[11px] sm:gap-8">
                  {masters.map((master, index) => {
                    const active = activeMaster === master.id;
                    return (
                      <label key={master.id} className={`group block cursor-pointer ${index === 0 ? "col-start-1" : "col-start-3 text-right"} row-start-1`}>
                        <input type="radio" name="master" value={master.id} checked={active} onChange={() => setActiveMaster(master.id)} className="peer sr-only" />
                        {/* The masks sit on black. Screen blending lets the page show through it, the
                            slight contrast lift takes the photo's near-black noise to true black first,
                            and the clip trims the grey pixel edges the source files carry. */}
                        <img
                          src={master.mask}
                          alt=""
                          className={`mx-auto block aspect-square w-full max-w-[240px] contrast-[1.08] mix-blend-screen transition-opacity duration-300 [clip-path:inset(1px)] ${active ? "opacity-100" : "opacity-30 group-hover:opacity-55"}`}
                        />
                        <span className="mt-3 block outline-offset-4 peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-[#a5bed3]">
                          <span className={`block transition-colors ${active ? "text-white" : "text-white/55"}`}>{master.title}</span>
                          <span className={`mt-1 block uppercase tracking-[0.12em] ${active ? "text-[#a5bed3]" : "text-white/42"}`}>{master.label}</span>
                        </span>
                      </label>
                    );
                  })}
                  <p className="col-start-2 row-start-1 self-center pb-0.5 text-center uppercase tracking-[0.15em] text-[#a5bed3]">A / B</p>
                </div>
              </fieldset>
            </div>
          </div>
        </section>

        <section id="stems" className="scroll-mt-28 py-20 sm:py-28">
          <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
            <div className="mb-10 flex flex-col justify-between gap-7 sm:flex-row sm:items-end">
              <div className="max-w-[700px]">
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#a5bed3]">02 — New remaster stems</p>
                <h2 className="mt-4 text-[36px] font-light leading-tight tracking-[-0.02em] sm:text-[52px]">Inside the new mix.</h2>
                <p className="font-detail mt-5 max-w-[640px] text-[15px] leading-7 text-white/65">Every stem starts together on one clock. Press play on any row to hear the complete arrangement, then solo, mute or rebalance individual parts without timing drift.</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => { setStemMute(Object.fromEntries(STEMS.map((stem) => [stem.id, false]))); setStemSolo(Object.fromEntries(STEMS.map((stem) => [stem.id, false]))); setStemVolume(Object.fromEntries(STEMS.map((stem) => [stem.id, 0.86]))); }} className="text-[10px] uppercase tracking-[0.16em] text-[#a5bed3] hover:text-white">Reset mix</button>
              </div>
            </div>

            <div className="border-t border-[#a5bed3]/30 bg-[#00060f]/30">
              {STEMS.map((stem) => {
                const anySolo = Object.values(stemSolo).some(Boolean);
                const audible = !stemMute[stem.id] && (!anySolo || stemSolo[stem.id]);
                return (
                  <article key={stem.id} className={`grid grid-cols-[38px_minmax(84px,120px)_minmax(54px,1fr)_auto] items-center gap-2 border-b border-white/12 py-4 transition-opacity sm:grid-cols-[44px_minmax(110px,180px)_minmax(100px,1fr)_auto] sm:gap-5 md:py-[13px] ${audible ? "opacity-100" : "opacity-45"}`}>
                    <button onClick={toggleStems} disabled={stemsLoading} aria-label={`${stemsPlaying ? "Pause" : "Play"} all stems from ${stem.name} row`} className="relative grid h-9 w-9 place-items-center rounded-full border border-[#a5bed3]/45 text-[#a5bed3] transition-colors before:absolute before:-inset-[5px] before:content-[''] hover:border-[#a5bed3] hover:bg-[#a5bed3] hover:text-[#00060f] disabled:cursor-wait">
                      {stemsLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : stemsPlaying ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="ml-px h-3.5 w-3.5 fill-current" />}
                    </button>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-white">{stem.name}</p>
                      <p className="mt-1 text-[9px] uppercase tracking-[0.15em] text-[#7798ac]">{stem.group}</p>
                    </div>
                    <div
                      className="relative h-[38px] min-w-0 cursor-pointer before:absolute before:inset-x-0 before:-inset-y-[3px] before:content-['']"
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
                    <div className="flex items-center gap-3">
                      <button onClick={() => setStemSolo((previous) => ({ ...previous, [stem.id]: !previous[stem.id] }))} className={`stem-button ${stemSolo[stem.id] ? "active" : ""}`} aria-label={`Solo ${stem.name}`}>S</button>
                      <button onClick={() => setStemMute((previous) => ({ ...previous, [stem.id]: !previous[stem.id] }))} className={`stem-button ${stemMute[stem.id] ? "active" : ""}`} aria-label={`Mute ${stem.name}`}>M</button>
                      <input aria-label={`${stem.name} volume`} type="range" min="0" max="1" step="0.01" value={stemVolume[stem.id]} onChange={(event) => setStemVolume((previous) => ({ ...previous, [stem.id]: Number(event.target.value) }))} className="hidden w-28 cursor-pointer md:block lg:w-32" />
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-5 flex flex-col justify-between gap-4 text-[10px] uppercase tracking-[0.14em] text-[#7798ac] sm:flex-row sm:items-center">
              <span>{formatTime(stemsTime)} / {formatTime(STEM_DURATION)} • 8 stems synchronized</span>
              <button onClick={() => setOutputMuted((value) => !value)} className="flex items-center gap-2 text-[#a5bed3] hover:text-white" aria-label={outputMuted ? "Unmute all audio" : "Mute all audio"}>
                {outputMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />} {outputMuted ? "Output muted" : "Output active"}
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/14 bg-[#00060f]/72 py-9">
        <div className="mx-auto flex max-w-[1240px] flex-col items-center justify-between gap-5 px-5 text-center sm:flex-row sm:px-8 sm:text-left">
          <Wordmark className="w-[180px] opacity-85" textClassName="text-[15px]" />
          <p className="text-[9px] uppercase tracking-[0.14em] text-white/38">London audio archive mockup • Masters A/B • Grouped stems</p>
        </div>
      </footer>
    </div>
  );
}
