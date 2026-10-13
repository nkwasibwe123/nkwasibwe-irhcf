# Nkwasibwe IRHCF — Capability Coverage and Factory Readiness

Updated: 2026-10-13

## Mission

Build Nkwasibwe IRHCF as the orchestration and engineering core for the future **Nkwasibwe as Right Hand of God** factory. The goal is to route tasks to suitable providers and tools, execute real work, verify artifacts, learn from failures, and safely expand its own capabilities.

This document is a coverage baseline, not a claim that every capability is already implemented.

## Current verified repository/deployment snapshot

- Repository: https://github.com/nkwasibwe123/nkwasibwe-irhcf
- Web frontend: https://nkwasibwe-irhcf-web.onrender.com
- Backend: https://nkwasibwe-irhcf.onrender.com
- Image service: https://nkwasibwe-irhcf-image-service.onrender.com
- Render service inventory on 2026-10-13 showed frontend and backend on `main`; image service on `feat/irhcf-self-hosted-image-service`.
- Latest backend deployment observed: commit `395841cd2c9a4a66d823239e89a6f06f9d94653e`, “Fix task engine agent step SQL parameter mismatch”, status `live`.
- Existing source includes provider routing, text-provider adapters for OpenAI/Gemini/Groq, capability registry/discovery, guarded capability lifecycle, self-improvement proposals, task engine, web research, audio/video editing and local transcription modules.
- A live deploy or successful syntax/test run is not proof that each user-facing end-to-end workflow works. Verify actual outputs for each capability.

## Capability coverage: required integrations and honest status

Status meanings:
- **Foundation present**: source modules exist; end-to-end production behavior still needs a smoke test.
- **Integration required**: connect a provider/tool, credentials, routes, UI, durable artifacts and verification.
- **External dependency**: requires the relevant provider account, permissions, quota, hardware or paid plan.
- **Not equivalent**: Nkwasibwe can orchestrate an integration but must not claim to reproduce a proprietary platform's entire internal capability.

| Domain | Target capability | Existing evidence | Required acceptance check |
|---|---|---|---|
| AI chat and reasoning | OpenAI/ChatGPT, Gemini, Groq-compatible providers; provider fallback; multilingual conversation | Provider router and text adapter modules exist | Real provider call, timeout/error handling, language preservation, grounded answer and correct fallback |
| Web research | Search, open sources, summarize, cite evidence, compare options | Research/search modules exist | Live search request produces source URLs, evidence and citations; no fabricated sources |
| Software development | Understand repo, plan, edit files, run tests in isolated runner, inspect diffs, create patch/PR | Capability lifecycle and sandbox modules exist | A safe test task creates a real artifact, test logs and diff; production deploy requires approval |
| Self-improvement | Detect failure, classify cause, research, propose patch, sandbox, benchmark, regression/security checks, request promotion | Guarded proposals and worker routes exist | Injected failure becomes a persisted proposal with evidence; no silent production mutation |
| Image | Background removal, crop/resize/rotate, color/light correction, blur and supported edits | Self-hosted image service branch exists | Upload real image; verify returned bytes differ as expected; ensure frontend displays returned artifact; test 4xx/5xx paths |
| Generative image editing | Generate or replace scenes/backgrounds, object edits, text-to-image | Requires a configured image model/provider | Test with provider key and explicit model; no claim of generative editing when only classical image processing ran |
| Video | Trim, merge, resize, effects, captions/subtitles, audio mix and export | Video editor/FFmpeg modules and related branches exist | Upload sample clip; render valid output; inspect duration, codec, subtitle timing and downloadable artifact |
| Audio and transcription | Transcribe, edit, clean/convert audio, speech in/out; Kinyarwanda tests | Local transcriber/audio modules exist | Real Kinyarwanda samples; verify transcript quality, model/binary availability, output file and failure reporting |
| Documents and knowledge | Parse, summarize, transform and create office files | Must be verified by routes/UI | Upload PDF/DOCX/XLSX; return usable file with correct content and download path |
| Google ecosystem | Google Search/Programmable Search where eligible, Gemini, Drive, Docs, Sheets, Gmail, Calendar, YouTube, OAuth | Google OAuth and YouTube-related modules exist; breadth is not established | Each integration separately lists OAuth scopes, account consent, configured credentials, API quota, working route and end-to-end test |
| Cloud and deployment | Render services, logs, deploy status, health checks, metrics, environment configuration; Google Cloud integrations as configured | Render services are connected; cloud scope is not yet comprehensive | Authenticated operational adapters, least privilege, audit trail, health verification and rollback strategy |
| Media production | Editing workflows inspired by CapCut/YouCut: timeline, transitions, titles, audio, export presets | Some FFmpeg editing modules exist; feature parity is not established | Acceptance tests per operation, browser/mobile UI test and export playback test |
| Factory operations | Task queue, job status, artifact library, cost/quota tracking, team workflows, observability | Task engine and action-center foundations exist | Long-running job survives restart, progress is truthful, artifacts persist, retry/idempotency work and costs are visible |

## Required execution contract

For every requested capability, IRHCF should:

1. Parse the user's intent, language, output format and constraints.
2. Check a registry of available tools, configured providers, credentials, quota and health.
3. If unsupported, state the precise missing dependency and create a capability-expansion task rather than pretending it succeeded.
4. Research official documentation and compare safe implementation options.
5. Build in an isolated workspace; never execute arbitrary downloaded code directly in production.
6. Run unit, integration, security and regression checks relevant to the change.
7. Execute the real task and validate the resulting artifact, not just a success message.
8. Store the artifact, logs, evidence, provider/model, cost estimate and verification result.
9. If verification fails, classify the cause, retry only within bounded limits, and create a self-improvement proposal.
10. Require explicit approval for external side effects, spending, credential/scope changes and production promotion.

## Free-first and paid-ready architecture

- Prefer open-source/local tools where quality, compute and licensing permit (for example FFmpeg and local transcription).
- Use provider adapters so OpenAI, Gemini, Groq and future providers can be configured independently.
- Keep secrets in server-side environment/secret storage; never ship keys to frontend code or logs.
- Distinguish free local operations from API-backed operations that may cost money.
- When a provider key, quota, paid plan, GPU, OAuth consent or user permission is missing, show the exact requirement. Do not simulate success.
- Record usage and cost estimates before enabling paid execution. Add per-user/project budgets and explicit approval for chargeable work.

## Delivery sequence

### P0 — Verify current production paths
- Check backend, frontend and image-service health and recent deployment state.
- Exercise chat, image edit, video/audio, transcription, web research and self-improvement status endpoints.
- Fix the first reproducible runtime/test failure, then add a regression test.
- Confirm frontend-to-backend-to-provider routing and verify actual returned files.

### P1 — Capability registry and diagnostics
- Expose a single authenticated capability/status endpoint listing capability, implementation status, provider, dependencies, health, limits, cost class and last verified time.
- Add a diagnostic action that reports why a requested task cannot run.
- Ensure UI labels distinguish available, degraded, needs credentials, unsupported and unverified.

### P2 — Reliable task execution
- Standardize task input/output schemas, durable artifact storage, progress events, bounded retries, idempotency and cancellation.
- Attach evidence and downloadable deliverables to each task.
- Add end-to-end tests for each high-priority user journey.

### P3 — Autonomous but guarded engineering
- Convert unsupported requests and runtime failures into research/build/test proposals.
- Use isolated workspaces and least-privilege credentials.
- Permit automatic patch generation and tests; keep production deployment, irreversible actions and paid operations behind explicit approval.
- Compare candidate results to baselines and retain an audit log.

### P4 — Google and media ecosystem integrations
- Add integrations one at a time using official APIs/SDKs and documented OAuth scopes.
- Build adapters for Google services only where APIs and permissions permit; do not promise “all Google” access by default.
- Expand media timeline/render functions based on testable feature requirements rather than marketing labels.

### P5 — Factory readiness
- Add durable job queues, worker health, artifact retention, monitoring, budgets, access control, audit records, backups and rollback drills.
- Run load and recovery tests before factory hardware is purchased or connected.

## Definition of done

A feature is **done** only when its real route is connected to the UI, configured dependencies are checked, an end-to-end test produces a valid artifact or verifiable action, failures are surfaced honestly, regression tests pass, and deployment health is confirmed. Source files, green syntax checks, or a successful deploy alone do not meet this bar.
