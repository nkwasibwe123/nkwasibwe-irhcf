#!/usr/bin/env bash
set -euo pipefail

# Build a self-hosted multilingual whisper.cpp engine for Render/native Linux.
ROOT="${WHISPER_CPP_DIR:-$PWD/.local/whisper.cpp}"
MODEL_DIR="${WHISPER_MODEL_DIR:-$PWD/.local/models}"
MODEL_NAME="${WHISPER_MODEL_NAME:-ggml-tiny}"
REPO="https://github.com/ggml-org/whisper.cpp.git"
MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${MODEL_NAME}.bin"

for tool in git cmake c++ curl; do
  command -v "$tool" >/dev/null 2>&1 || { echo "ERROR: required build tool '$tool' is unavailable" >&2; exit 1; }
done

mkdir -p "$(dirname "$ROOT")" "$MODEL_DIR"
if [ ! -f "$ROOT/CMakeLists.txt" ]; then
  git clone --depth 1 "$REPO" "$ROOT"
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
  echo "ERROR: local engine binary or model is missing/empty." >&2
  exit 1
fi
"$BIN" --help >/dev/null

printf '\nSelf-hosted transcription engine built and verified.\n'
printf 'WHISPER_CPP_PATH=%s\n' "$BIN"
printf 'WHISPER_MODEL_PATH=%s\n' "$MODEL_PATH"
printf 'WHISPER_THREADS=%s\n' "${WHISPER_THREADS:-2}"
