import wave
import numpy as np

SAMPLE_RATE = 8000


def read_wav(path: str) -> np.ndarray:
    with wave.open(path, "rb") as handle:
        frames = handle.readframes(handle.getnframes())
        channels = handle.getnchannels()
        width = handle.getsampwidth()
        if width != 2:
            raise ValueError(f"Expected 16-bit PCM, got {width * 8}-bit")
        data = np.frombuffer(frames, dtype="<i2").astype(np.float64)
        if channels > 1:
            data = data.reshape(-1, channels).mean(axis=1)
        return data / 32768.0


def best_offset(old: np.ndarray, new: np.ndarray, center_seconds: float, window_seconds: float = 8.0, search_seconds: float = 1.5):
    half_window = int(window_seconds * SAMPLE_RATE / 2)
    center = int(center_seconds * SAMPLE_RATE)
    pattern = new[center - half_window:center + half_window].copy()
    pattern -= pattern.mean()
    pattern /= np.linalg.norm(pattern) + 1e-12

    search = int(search_seconds * SAMPLE_RATE)
    candidate = old[center - half_window - search:center + half_window + search].copy()
    candidate -= candidate.mean()

    # FFT convolution computes correlation of candidate against the reversed pattern.
    convolution_size = len(candidate) + len(pattern) - 1
    fft_size = 1 << (convolution_size - 1).bit_length()
    correlation = np.fft.irfft(
        np.fft.rfft(candidate, fft_size) * np.fft.rfft(pattern[::-1], fft_size),
        fft_size,
    )[:convolution_size]

    valid = correlation[len(pattern) - 1:len(candidate)]
    best_index = int(np.argmax(valid))
    lag_samples = best_index - search
    old_time = center_seconds + lag_samples / SAMPLE_RATE

    selected = candidate[best_index:best_index + len(pattern)]
    selected /= np.linalg.norm(selected) + 1e-12
    score = float(np.dot(pattern, selected))
    return lag_samples / SAMPLE_RATE, old_time, score


old = read_wav("/home/ubuntu/phantom-audio-analysis/old-8k.wav")
new = read_wav("/home/ubuntu/phantom-audio-analysis/new-8k.wav")

print("new_time_s, old_minus_new_s, matching_old_time_s, correlation")
results = []
for time_seconds in [6, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 250]:
    offset, old_time, score = best_offset(old, new, time_seconds)
    results.append((time_seconds, offset, score))
    print(f"{time_seconds:7.2f}, {offset:+.6f}, {old_time:10.6f}, {score:.6f}")

usable = np.array([offset for _, offset, score in results if score > 0.35])
if len(usable):
    print(f"\nMedian reliable offset (old minus new): {np.median(usable):+.6f} seconds")
    print(f"Mean reliable offset (old minus new):   {np.mean(usable):+.6f} seconds")
    print(f"Range reliable offsets:                 {np.min(usable):+.6f} to {np.max(usable):+.6f} seconds")
else:
    print("\nNo windows reached the reliability threshold.")
