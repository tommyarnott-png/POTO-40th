import wave
import numpy as np

AUDIO_RATE = 8000
ENVELOPE_HZ = 100
HOP = AUDIO_RATE // ENVELOPE_HZ


def read_wav(path: str) -> np.ndarray:
    with wave.open(path, "rb") as handle:
        raw = handle.readframes(handle.getnframes())
    return np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32768.0


def envelope(audio: np.ndarray) -> np.ndarray:
    usable = audio[: len(audio) // HOP * HOP]
    framed = usable.reshape(-1, HOP)
    rms = np.sqrt(np.mean(framed * framed, axis=1) + 1e-10)
    log_rms = 20 * np.log10(rms + 1e-8)
    # Smooth with a 100 ms Hann window while retaining transient rhythm.
    kernel = np.hanning(11)
    kernel /= kernel.sum()
    return np.convolve(log_rms, kernel, mode="same")


def normalized_correlation(pattern: np.ndarray, candidate: np.ndarray) -> float:
    a = pattern - pattern.mean()
    b = candidate - candidate.mean()
    return float(np.dot(a, b) / ((np.linalg.norm(a) * np.linalg.norm(b)) + 1e-12))


def best_offset(old_env: np.ndarray, new_env: np.ndarray, center_seconds: float, window_seconds: float = 28.0, search_seconds: float = 2.0):
    half = int(window_seconds * ENVELOPE_HZ / 2)
    center = int(center_seconds * ENVELOPE_HZ)
    search = int(search_seconds * ENVELOPE_HZ)
    pattern = new_env[center - half:center + half]
    best = (-2.0, 0)
    for lag in range(-search, search + 1):
        start = center - half + lag
        candidate = old_env[start:start + len(pattern)]
        if len(candidate) != len(pattern):
            continue
        score = normalized_correlation(pattern, candidate)
        if score > best[0]:
            best = (score, lag)
    score, lag = best
    return lag / ENVELOPE_HZ, score


old_env = envelope(read_wav("/home/ubuntu/phantom-audio-analysis/old-8k.wav"))
new_env = envelope(read_wav("/home/ubuntu/phantom-audio-analysis/new-8k.wav"))

rows = []
print("new_time_s, old_minus_new_s, correlation")
for time_seconds in [20, 35, 50, 65, 80, 95, 110, 125, 140, 155, 170, 185, 200, 215, 230, 242]:
    offset, score = best_offset(old_env, new_env, time_seconds)
    rows.append((time_seconds, offset, score))
    print(f"{time_seconds:7.2f}, {offset:+.4f}, {score:.5f}")

reliable = np.array([(time, offset) for time, offset, score in rows if score > 0.38])
if len(reliable) >= 2:
    slope, intercept = np.polyfit(reliable[:, 0], reliable[:, 1], 1)
    playback_rate = 1.0 + slope
    print(f"\nFitted offset = {intercept:+.6f} + time * {slope:+.8f}")
    print(f"Recommended old-master start offset: {intercept:+.6f} seconds")
    print(f"Recommended old-master playbackRate: {playback_rate:.8f}")
    residuals = reliable[:, 1] - (intercept + slope * reliable[:, 0])
    print(f"Residual standard deviation: {np.std(residuals):.6f} seconds")
else:
    print("\nInsufficient reliable envelope matches.")
