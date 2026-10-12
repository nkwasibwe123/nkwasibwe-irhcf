# Self-hosted multilingual audio transcription

Nkwasibwe IRHCF can use a local `whisper.cpp` executable and multilingual GGML model instead of requiring transcription API credits.

## Build a local engine

The repository includes `scripts/setup-local-transcriber.sh`. It builds the upstream whisper.cpp CLI and downloads a multilingual model. The default `ggml-tiny` model is relatively small and fast, but less accurate than larger models. It supports automatic language detection and many languages; accuracy varies by language, audio quality, and model size.

Requirements: Linux build environment with `git`, `cmake`, a C++ compiler, and `curl`. The build directory and model must be present in the deployed service filesystem. Example build steps (adapt to the service's existing build steps; do not replace required steps blindly):

```sh
npm install
bash scripts/setup-local-transcriber.sh
```

The script prints the exact values to set on the backend service:
- `WHISPER_CPP_PATH`: absolute path to the built `whisper-cli`
- `WHISPER_MODEL_PATH`: absolute path to the downloaded multilingual model
- `WHISPER_THREADS`: optional CPU threads (default 2, clamped to 1–16)
- `WHISPER_TIMEOUT_MS`: optional per-file timeout (default 180000 ms, clamped to 10–600 seconds)

Default output paths are under `.local/` in the repository working directory. Ensure these files remain available to the running service after the build. Model download increases deployment time and disk usage; the build requires a C++ toolchain. A small instance may be too slow for long recordings.

## Runtime behavior

- Audio uploads are limited to 6 MiB by the local transcription adapter.
- FFmpeg normalizes supported containers to mono 16 kHz PCM WAV before inference.
- Language is set to `auto` unless the caller explicitly provides a two- or three-letter language code.
- The response contains transcript text, detected language when reported by whisper.cpp, model identifier, and segment timestamps.
- The local engine is only active when both environment variables are set. Otherwise the existing hosted-provider route remains available.
- Once configured, a local inference failure is surfaced as an error; it does not fall back to a paid API.

## Verification required before declaring production-ready

1. Run `npm test`.
2. Confirm the deployed service has both files at the exact configured paths and can execute the binary.
3. Upload known speech in at least two languages and verify transcript, detected language, and segment timestamps.
4. Test MP3, WAV, M4A, and WebM inputs.
5. Confirm a missing model/binary gives a clear error and no paid provider is invoked.
6. Confirm the live service has enough RAM, CPU, and disk for the selected model.

The setup script is a reproducible build helper, not proof that Render has been reconfigured or that production inference has passed.
