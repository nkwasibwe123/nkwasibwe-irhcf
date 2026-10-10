# IRHCF Media Provider Setup

This document describes the real media endpoints currently wired into the backend. Provider API keys must be configured as backend environment variables; never put them in `app.js`, `index.html`, or a committed `.env` file.

## Required backend environment variables

- `DATABASE_URL` — PostgreSQL connection string. Required for authentication, conversations, and ownership-safe video job tracking.
- `JWT_SECRET` — a long, random secret used to verify user sessions.
- `OPENAI_API_KEY` — used for image generation, text-to-speech, audio transcription, and Sora video generation. The OpenAI project must have access to the relevant endpoints/models and sufficient billing/credits.
- `GEMINI_API_KEY` — used for Gemini Google Search grounding when IRHCF detects a request that needs current or externally changing information.
- `ELEVENLABS_API_KEY` — used for Music v2.5 song generation. The ElevenLabs account must have access to the Music API and sufficient credits.

Configure these in the backend host's environment/secrets settings, then restart or redeploy the backend. Do not commit actual secret values.

## Live web research

- Current-information requests in chat use Gemini Google Search grounding when `GEMINI_API_KEY` is configured.
- The backend keeps grounded source titles and HTTP(S) URLs with the research context; duplicate URLs and non-web URLs are discarded.
- Research is only marked as performed when the provider returns answer text and at least one grounded source URL.
- A configured key does not guarantee provider availability, quota, model access, or search grounding support. Check `GET /api/health` → `researchProviders.googleSearchGrounding` for configuration presence, then test a real current-information request to verify operation.

## Connected capabilities

| Capability | Endpoint | Output / limit |
| --- | --- | --- |
| Image generation | `POST /api/media/image` | PNG image, prompt up to 4,000 characters |
| Voice-over / spoken audio | `POST /api/media/speech` | MP3 speech from text, up to 4,000 characters |
| Audio transcription | `POST /api/media/transcribe` | Editable transcript; supported audio files up to 6 MB |
| HD video generation | `POST /api/media/video` | Sora 720p clip, 4/8/12 seconds, with an optional JPEG/PNG/WEBP reference photo; returns a job ID |
| Video job status | `GET /api/media/video/:videoId` | Current provider status/progress; user ownership is checked |
| Download generated video | `GET /api/media/video/:videoId/content` | Streams the completed MP4; user ownership is checked |
| Song generation | `POST /api/media/music` | MP3 song, default 3 minutes, maximum 5 minutes per request |

All media endpoints require a valid IRHCF bearer token. The UI should report provider errors rather than pretending a file was generated.

## Important operating notes

- Video and song generation can incur provider charges. The UI asks for confirmation before starting those jobs, but provider billing and model access are still controlled by the external provider account.
- Sora availability depends on OpenAI API access and credits. If the project cannot access the video endpoint/model, the API returns a clear error.
- Song generation uses ElevenLabs Music v2.5. Without `ELEVENLABS_API_KEY`, the endpoint returns `MUSIC_PROVIDER_UNAVAILABLE`.
- Audio transcription accepts MP3, WAV, M4A, OGG, FLAC, WEBM, MP4, MPEG, and MPGA file extensions, up to 6 MB decoded size.
- Generated image, speech, and song assets are delivered to the browser. Download important results because browser object URLs are temporary and these outputs are not yet stored in permanent media storage.
- Video job metadata is stored in PostgreSQL per user. The video bytes are streamed from the provider when downloaded; they are not copied into the database.
- A successful JavaScript syntax/architecture workflow does not prove that provider credentials, account billing, database connectivity, or a live Render deployment are healthy. Those require runtime checks against the configured deployment.
