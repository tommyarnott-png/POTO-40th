#!/usr/bin/env bash
#
# Transcodes the source masters and stems into the compressed AAC assets the
# web player streams. Source audio is deliberately not tracked in git (see
# docs/ASSETS.md); point SOURCE_DIR at your local copy before running.
#
#   SOURCE_DIR=/path/to/sources ./scripts/build-audio.sh
#
# Expects, inside SOURCE_DIR:
#   1-06PhantomOfTheOpera.wav                             (old master, 1986)
#   POTO 40th - Short.wav                                 (the production's short edit of the 2026 remaster)
#   stems/{Christine Vocal,Phantom Vocal,Organ,Guitar,Bass,Kick,Perc,Orchestra}.wav
#
set -euo pipefail

# The A/B plays one section: the one the stems cover. Its 2026 side is the
# production's short edit as delivered, which tools/measure_excerpt_offset.py
# places at the very start of the remaster: a plain trim of it (at 44.1kHz rather
# than the remaster's 48kHz) for 104.774036s, with a 3s fade-out from 101.774036s.
#
# The 1986 side is cut from the full 1986 master to the same musical window. It
# starts OLD_MASTER_START_SAMPLE in and runs the short edit's length times the
# section's playback-rate ratio (OLD_MASTER_PLAYBACK_RATE in src/assets.ts), so
# the two stay locked to the end rather than drifting apart. The short edit's
# fade is reproduced on it, stretched by the same ratio, as a polynomial fitted
# to the delivered fade (within 0.7dB down to -40dB).
OLD_MASTER_START_SAMPLE=2294        # 0.052018s at 44.1kHz
OLD_MASTER_SAMPLES=4629379          # 104.974580s = 104.774036s x 1.00191398
OLD_MASTER_FADE_START=101.968821    # seconds into the cut = 101.774036s x 1.00191398
OLD_MASTER_FADE_SECONDS=3.005742    # 3s x 1.00191398
FADE_CURVE="1+X*(-0.45816+X*(-1.247314+X*(-1.600879+X*(3.802758-1.496404*X))))"

SOURCE_DIR="${SOURCE_DIR:?set SOURCE_DIR to the folder holding the source WAVs}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/public/audio"

MASTER_BITRATE="${MASTER_BITRATE:-128k}"
STEM_BITRATE="${STEM_BITRATE:-96k}"

mkdir -p "$OUT/stems"

encode() { # <input> <output> <bitrate> [audio filter]
  ffmpeg -v error -y -i "$1" ${4:+-af "$4"} -codec:a aac -b:a "$3" -movflags +faststart "$2"
  printf '  %-26s %s\n' "$(basename "$2")" "$(du -h "$2" | cut -f1)"
}

FADE_POSITION="min(1,(t-$OLD_MASTER_FADE_START)/$OLD_MASTER_FADE_SECONDS)"
OLD_MASTER_CUT="atrim=start_sample=$OLD_MASTER_START_SAMPLE:end_sample=$((OLD_MASTER_START_SAMPLE + OLD_MASTER_SAMPLES)),asetpts=PTS-STARTPTS"
OLD_MASTER_FADE="aeval='val(ch)*if(lt(t,$OLD_MASTER_FADE_START),1,${FADE_CURVE//X/$FADE_POSITION})':c=same"

echo "Masters -> $OUT"
encode "$SOURCE_DIR/1-06PhantomOfTheOpera.wav" "$OUT/old_master.m4a" "$MASTER_BITRATE" "$OLD_MASTER_CUT,$OLD_MASTER_FADE"
encode "$SOURCE_DIR/POTO 40th - Short.wav" "$OUT/new_master.m4a" "$MASTER_BITRATE"

echo "Stems -> $OUT/stems"
encode "$SOURCE_DIR/stems/Christine Vocal.wav" "$OUT/stems/christine_vocal.m4a" "$STEM_BITRATE"
encode "$SOURCE_DIR/stems/Phantom Vocal.wav"   "$OUT/stems/phantom_vocal.m4a"   "$STEM_BITRATE"
encode "$SOURCE_DIR/stems/Organ.wav"           "$OUT/stems/organ.m4a"           "$STEM_BITRATE"
encode "$SOURCE_DIR/stems/Guitar.wav"          "$OUT/stems/guitar.m4a"          "$STEM_BITRATE"
encode "$SOURCE_DIR/stems/Bass.wav"            "$OUT/stems/bass.m4a"            "$STEM_BITRATE"
encode "$SOURCE_DIR/stems/Kick.wav"            "$OUT/stems/kick.m4a"            "$STEM_BITRATE"
encode "$SOURCE_DIR/stems/Perc.wav"            "$OUT/stems/perc.m4a"            "$STEM_BITRATE"
encode "$SOURCE_DIR/stems/Orchestra.wav"       "$OUT/stems/orchestra.m4a"       "$STEM_BITRATE"

echo "Done."
