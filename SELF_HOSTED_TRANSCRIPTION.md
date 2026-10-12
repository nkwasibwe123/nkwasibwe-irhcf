# Self-hosted multilingual transcription

Nkwasibwe IRHCF can use a local `whisper.cpp` executable and multilingual GGML model instead of requiring transcription API credits.

## Runtime configuration

Set these environment variables on the backend service:

- `WHISPER_CPP_PATH`: absolute path to the built `whisper-cli` executable.
- `WHISPER_MODEL_PATH`: absolute path to a multilingual model file (for example, a `ggml-small.bin`-family model).
- `WHISPER_THREADS`: optional CPU threads (default 2, clamped to 1–16).
- `WHISPER_TIMEOUT_MS`: optional per-file timeout (default 180000 ms, clamped to 10–600 seconds).

The executable must be built with support for the audio formats accepted by the API. The multilingual model must be present on persistent storage or installed during image build. Model files are large; choose a model that fits the host RAM, disk and CPU budget. This is self-hosted inference, so it removes per-request transcription API credits but still uses compute, memory, storage and bandwidth.

## Language and output

Language `auto` requests automatic language detection. An explicit two- or three-letter language code can be passed to the local engine. The local runner returns transcript text, detected language when exposed by the model output, and timestamped segments when available.

## Security and lifecycle

The runner invokes the executable without a shell, writes audio into a private temporary directory, limits input to 6 MiB, enforces a timeout, and removes temporary audio/output files in a `finally` block. Keep the model path controlled by the server environment, never by a client request.

## Important

This module is the local runtime adapter. It is not proof that the production Render service already has the executable or model installed. Deployment wiring and real audio end-to-end validation are required before claiming credit-independent transcription is live.
