#!/usr/bin/env bash
#
# Transcodes the source masters and stems into the compressed MP3 assets the
# web player streams. Source audio is deliberately not tracked in git (see
# docs/ASSETS.md); point SOURCE_DIR at your local copy before running.
#
#   SOURCE_DIR=/path/to/sources ./scripts/build-audio.sh
#
# Expects, inside SOURCE_DIR:
#   1-06PhantomOfTheOpera.wav                             (old master, 1986)
#   POTO_OriginalAlbumRemix_07_..._48kHz_24bit.wav         (new remaster, 2026)
#   stems/{Christine Vocal,Phantom Vocal,Organ,Guitar,Bass,Kick,Perc,Orchestra}.wav
#
set -euo pipefail

SOURCE_DIR="${SOURCE_DIR:?set SOURCE_DIR to the folder holding the source WAVs}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/public/audio"

MASTER_BITRATE="${MASTER_BITRATE:-192k}"
STEM_BITRATE="${STEM_BITRATE:-160k}"

mkdir -p "$OUT/stems"

encode() { # <input> <output> <bitrate>
  ffmpeg -v error -y -i "$1" -codec:a libmp3lame -b:a "$3" -joint_stereo 1 \
    -write_xing 1 -id3v2_version 3 "$2"
  printf '  %-26s %s\n' "$(basename "$2")" "$(du -h "$2" | cut -f1)"
}

echo "Masters -> $OUT"
encode "$SOURCE_DIR/1-06PhantomOfTheOpera.wav" "$OUT/old_master.mp3" "$MASTER_BITRATE"
encode "$SOURCE_DIR/POTO_OriginalAlbumRemix_07_ThePhantomOfTheOpera_100726_M11b_MASTERED_48kHz_24bit.wav" \
       "$OUT/new_master.mp3" "$MASTER_BITRATE"

echo "Stems -> $OUT/stems"
encode "$SOURCE_DIR/stems/Christine Vocal.wav" "$OUT/stems/christine_vocal.mp3" "$STEM_BITRATE"
encode "$SOURCE_DIR/stems/Phantom Vocal.wav"   "$OUT/stems/phantom_vocal.mp3"   "$STEM_BITRATE"
encode "$SOURCE_DIR/stems/Organ.wav"           "$OUT/stems/organ.mp3"           "$STEM_BITRATE"
encode "$SOURCE_DIR/stems/Guitar.wav"          "$OUT/stems/guitar.mp3"          "$STEM_BITRATE"
encode "$SOURCE_DIR/stems/Bass.wav"            "$OUT/stems/bass.mp3"            "$STEM_BITRATE"
encode "$SOURCE_DIR/stems/Kick.wav"            "$OUT/stems/kick.mp3"            "$STEM_BITRATE"
encode "$SOURCE_DIR/stems/Perc.wav"            "$OUT/stems/perc.mp3"            "$STEM_BITRATE"
encode "$SOURCE_DIR/stems/Orchestra.wav"       "$OUT/stems/orchestra.mp3"       "$STEM_BITRATE"

echo "Done."
