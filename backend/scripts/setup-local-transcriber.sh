#!/usr/bin/env bash
set -euo pipefail

# Runs from the backend service root during Render's npm install.
ROOT="${WHISPER_CPP_DIR:-$PWD/.local/whisper.cpp}"
MODEL_DIR="${WHISPER_MODEL_DIR:-$PWD/.local/models}"
MODEL_NAME="${WHISPER_MODEL_NAME:-ggml-tiny}"
MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${MODEL_NAME}.bin"

for tool in git cmake c++ curl; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "[local-transcriber] ERROR: required build tool '$tool' is unavailable; refusing to report a successful install without the local engine." >&2
    exit 1
  fi
done

mkdir -p "$(dirname "$ROOT")" "$MODEL_DIR"
if [ ! -f "$ROOT/CMakeLists.txt" ]; then
  git clone --depth 1 https://github.com/ggml-org/whisper.cpp.git "$ROOT"
fi

cmake -S "$ROOT" -B "$ROOT/build" -DCMAKE_BUILD_TYPE=Release -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_EXAMPLES=ON
cmake --build "$ROOT/build" --config Release --target whisper-cli -j "${BUILD_JOBS:-2}"

MODEL_PATH="$MODEL_DIR/${MODEL_NAME}.bin"
if [ ! -s "$MODEL_PATH" ]; then
  curl --fail --location --retry 3 --output "$MODEL_PATH.tmp" "$MODEL_URL"
  mv "$MODEL_PATH.tmp" "$MODEL_PATH"
fi

BIN="$ROOT/build/bin/whisper-cli"
if [ ! -x "$BIN" ] || [ ! -s "$MODEL_PATH" ]; then
  echo "[local-transcriber] ERROR: local engine build did not produce executable binary and non-empty model." >&2
  exit 1
fi

# Verify that the binary starts and accepts CLI arguments before declaring success.
"$BIN" --help >/dev/null

# Run genuine local inference on upstream speech, then exercise each required
# upload container through FFmpeg normalization and whisper.cpp. This catches
# broken binaries/models/codecs during deployment rather than on a user's upload.
SAMPLE="$ROOT/samples/jfk.wav"
FFMPEG_BIN="$(node -e 'process.stdout.write(require("ffmpeg-static") || "")')"
if [ ! -s "$SAMPLE" ] || [ ! -x "$FFMPEG_BIN" ]; then
  echo "[local-transcriber] ERROR: speech smoke-test audio or FFmpeg is unavailable." >&2
  exit 1
fi
SMOKE_DIR="$(mktemp -d "$MODEL_DIR/.smoke.XXXXXX")"
trap 'rm -rf "$SMOKE_DIR"' EXIT
for EXT in wav mp3 m4a webm; do
  INPUT="$SMOKE_DIR/input.$EXT"
  NORMALIZED="$SMOKE_DIR/normalized.wav"
  if [ "$EXT" = "wav" ]; then
    cp "$SAMPLE" "$INPUT"
  elif [ "$EXT" = "mp3" ]; then
    "$FFMPEG_BIN" -nostdin -hide_banner -loglevel error -y -i "$SAMPLE" -vn -c:a libmp3lame -q:a 5 "$INPUT"
  elif [ "$EXT" = "m4a" ]; then
    "$FFMPEG_BIN" -nostdin -hide_banner -loglevel error -y -i "$SAMPLE" -vn -c:a aac -b:a 96k "$INPUT"
  else
    "$FFMPEG_BIN" -nostdin -hide_banner -loglevel error -y -i "$SAMPLE" -vn -c:a libopus -b:a 64k "$INPUT"
  fi
  "$FFMPEG_BIN" -nostdin -hide_banner -loglevel error -y -i "$INPUT" -vn -ac 1 -ar 16000 -c:a pcm_s16le "$NORMALIZED"
  OUTPUT_BASE="$SMOKE_DIR/result-$EXT"
  "$BIN" -m "$MODEL_PATH" -f "$NORMALIZED" -l en -t 1 -oj -of "$OUTPUT_BASE" >/dev/null
  if [ ! -s "$OUTPUT_BASE.json" ] || ! grep -qi "country" "$OUTPUT_BASE.json"; then
    echo "[local-transcriber] ERROR: real speech smoke test failed for $EXT input." >&2
    exit 1
  fi
  echo "[local-transcriber] Real speech inference passed for $EXT input."
done
rm -rf "$SMOKE_DIR"
trap - EXIT

echo "[local-transcriber] whisper.cpp binary, multilingual model, FFmpeg and speech inference verified."
echo "[local-transcriber] WHISPER_CPP_PATH=$BIN"
echo "[local-transcriber] WHISPER_MODEL_PATH=$MODEL_PATH"
