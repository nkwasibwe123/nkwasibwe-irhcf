# Media Studio — Research Record

Status: researched baseline. Some local editing capabilities can work without paid AI providers, but AI generation and transcription still depend on model availability, compute, licenses and provider quotas.

## Sources reviewed

1. FFmpeg Filters Documentation — deterministic audio mixing, denoising, EQ, color correction, cropping and video filter pipelines: https://ffmpeg.org/ffmpeg-filters.html
2. whisper.cpp — offline speech recognition, CPU/GPU acceleration, quantized models and supported platforms including Linux, Android and WebAssembly: https://github.com/ggml-org/whisper.cpp
3. OpenAI Image Generation guide — image generation/editing, masks, references, output formats, streaming, latency, moderation, quotas and explicit cost handling: https://developers.openai.com/api/docs/guides/image-generation
4. ElevenLabs Music API — prompt or composition-plan music generation, duration, output format, model selection and enterprise/plan restrictions: https://elevenlabs.io/docs/api-reference/music/compose
5. ElevenLabs Music API overview — licensing, plan availability and current usage limits: https://elevenlabs.io/eleven-music-api
6. MDN MediaRecorder API — browser recording, codec/container selection, chunk events, pause/resume/stop and recording errors: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
7. MDN MediaStream Recording API — recording from a MediaStream/HTML media element and browser support considerations: https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_Recording_API
8. OpenAI API deprecations — the Sora 2 models and Videos API were scheduled for shutdown on September 24, 2026, which is already past as of this research date (October 25, 2026): https://developers.openai.com/api/docs/deprecations

## Synthesis for Nkwasibwe

- Separate deterministic local media editing from AI generation. Trimming, joining, resizing, filtering, audio mixing and photo-to-video pan/zoom can use FFmpeg when the binary and required codecs are present; these are not equivalent to generative AI motion.
- Prefer local/open-source processing for supported conversions and transcription when hardware permits. Report model size, CPU/RAM cost, supported languages and likely latency rather than promising that every language is equally accurate.
- Treat browser recording as a permission- and codec-dependent workflow: check MediaRecorder.isTypeSupported, handle permission denial, stop tracks, retain chunks safely, and validate the resulting MIME type.
- Image generation/editing must expose provider/model status, input/output limits, quota errors and costs. Quota exhaustion should not be retried blindly; use bounded backoff only for transient failures.
- Music generation must expose provider availability, plan/credit limits and applicable licensing/usage terms. Do not silently send paid requests without an explicit user action.
- Critical current finding: the codebase's HD video route calls OpenAI's /v1/videos endpoint with sora-2, while the official deprecation page says the Videos API and Sora 2 models were removed on 2026-09-24. As of 2026-10-25 this route is stale and should not be presented as a working provider. Fail fast with a clear unavailable status until a supported provider adapter is integrated and tested.
- A local FFmpeg photo animation can be offered as a clearly labelled alternative, but must not be called AI-generated video. A real generative video provider needs current API documentation, account eligibility, cost/quotas and end-to-end verification.
- Store job ownership and provider IDs server-side; authorize status and content retrieval against the authenticated user. Verify output MIME type, size, duration and non-empty file before marking complete.
- Keep media outputs as downloadable artifacts with previews, codec/resolution/duration metadata, and retention/cleanup policy. Progress must come from real jobs, not a timer.
- Treat uploaded media as untrusted: validate MIME and actual file signature, bound size/duration/resolution, use temporary directories, invoke FFmpeg with argument arrays rather than shell interpolation, and clean up temporary files on success/failure.
- Track rights/consent for face, voice and music inputs; do not claim commercial rights unless the selected provider's terms support that claim.

## Acceptance criteria

1. Every media task records input metadata, requested operation, engine/provider, owner, job ID, progress events, errors and output artifact metadata.
2. Local FFmpeg operations run with time/resource limits, safe argument construction and temporary-directory cleanup.
3. Input files are validated by both declared MIME and detected content; limits cover bytes, duration, dimensions, frame rate and number of tracks.
4. Audio operations include preview, normalized output, clipping checks and correct extension/MIME.
5. Video operations verify that output is non-empty, decodable, has expected duration/resolution and can be downloaded by the owner.
6. Browser capture handles denied permissions, unsupported MIME types, interrupted streams, cancellation and mobile browser differences.
7. Offline transcription tests model availability, missing model, corrupted audio, empty speech, multiple languages, timeouts and low-memory failure.
8. Provider-backed generation reports unsupported/deprecated providers before submission, checks quotas, requires confirmation for potentially paid work and does not retry exhausted credits.
9. Photo animation via FFmpeg is clearly labelled as deterministic motion effects; AI video is labelled as generative only when a supported model actually generated it.
10. End-to-end tests cover provider unavailable, timeout, quota exhausted, invalid media, cancellation, cross-account access and downloadable output.

## Additional official source reviewed — 2026-10-25

- **Shotcut feature list** — https://www.shotcut.org/features/ — documents SRT/VTT/ASS/SSA subtitle import, subtitle burn-in, multitrack timelines, filters, frame-accurate seeking and proxy editing. IRHCF should treat subtitles as a first-class timeline asset, preserve authored timing, validate output container/codec compatibility and verify that the produced video is playable rather than checking only that a file exists.
