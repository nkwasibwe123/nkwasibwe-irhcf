#!/usr/bin/env bash
set -euo pipefail

# Build a self-hosted multilingual whisper.cpp engine for Render/native Linux.
# Run this in the service build command before "npm install" completes.
ROOT="${WHISPER_CPP_DIR:-$PWD/.local/whisper.cpp}"
MODEL_DIR="${WHISPER_MODEL_DIR:-$PWD/.local/models}"
MODEL_NAME="${WHISPER_MODEL_NAME:-ggml-tiny}"
REPO="https://github.com/ggml-org/whisper.cpp.git"
MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${MODEL_NAME}.bin"

command -v git >/dev/null || { echo "ERROR: git is required" >&2; exit 1; }
command -v cmake >/dev/null || { echo "ERROR: cmake is required" >&2; exit 1; }
command -v c++ >/dev/null || { echo "ERROR: a C++ compiler is required" >&2; exit 1; }
command -v curl >/dev/null || { echo "ERROR: curl is required" >&2; exit 1; }

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
[ -x "$BIN" ] || { echo "ERROR: whisper-cli was not built at $BIN" >&2; exit 1; }
"$BIN" --help >/dev/null 2>&1 || true
printf '\nSelf-hosted transcription engine prepared.\n'
printf 'Set these Render environment variables exactly:\n'
printf 'WHISPER_CPP_PATH=%s\n' "$BIN"
printf 'WHISPER_MODEL_PATH=%s\n' "$MODEL_PATH"
printf 'WHISPER_THREADS=%s\n' "${WHISPER_THREADS:-2}"
