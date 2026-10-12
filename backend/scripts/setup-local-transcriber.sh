#!/usr/bin/env bash
set -euo pipefail

# Runs from the backend service root during Render's npm install.
ROOT="${WHISPER_CPP_DIR:-$PWD/.local/whisper.cpp}"
MODEL_DIR="${WHISPER_MODEL_DIR:-$PWD/.local/models}"
MODEL_NAME="${WHISPER_MODEL_NAME:-ggml-tiny}"
MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${MODEL_NAME}.bin"

for tool in git cmake c++ curl; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "[local-transcriber] WARNING: $tool is unavailable; skipping local engine build." >&2
    exit 0
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
  echo "[local-transcriber] ERROR: local engine build did not produce binary/model." >&2
  exit 1
fi

echo "[local-transcriber] whisper.cpp and multilingual model installed."
echo "[local-transcriber] WHISPER_CPP_PATH=$BIN"
echo "[local-transcriber] WHISPER_MODEL_PATH=$MODEL_PATH"
echo "[local-transcriber] Runtime auto-discovery is enabled when these files are present; set WHISPER_CPP_PATH/WHISPER_MODEL_PATH only to override."
