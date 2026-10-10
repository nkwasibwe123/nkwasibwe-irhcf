# Nkwasibwe IRHCF — implementation roadmap

This is a tracked engineering plan, not a claim that these features are already complete. Update each item only after code and tests verify it.

## Current baseline checked
- Existing browser UI: HTML/CSS/JavaScript chat and capability dashboard.
- Existing Node.js/Express backend, task APIs, agent-team and media-related modules are present.
- The dashboard currently advertises several provider-backed features; availability depends on server configuration, provider credentials, quotas and deployment health.
- The repository is public. Do not commit API keys, tokens, passwords, or other secrets.

## Milestone 1 — reliability and honest live progress
- [ ] Run the repository test suite and record failures before changing behavior.
- [ ] Trace a user message end-to-end: UI → API → agent/task orchestration → response.
- [ ] Add an activity timeline based on real backend events (planning, tool call, code generation, tests, waiting for provider, completion/error).
- [ ] Clearly distinguish actual progress, estimates, waiting for credentials/provider, and errors; never fabricate agent counts or completion percentages.
- [ ] Keep user and assistant messages visually separate; support attachment previews and responsive chat layout.

## Milestone 2 — task execution and agent coordination
- [ ] Define task states, durable progress events, cancellation, retries, timeout and recovery.
- [ ] Route tasks to specialist agents by capability; use bounded concurrency, shared task IDs, scoped outputs and conflict-safe file ownership.
- [ ] Scale concurrency to available compute/provider limits rather than promising a fixed 50/200 agents or instant completion.
- [ ] Require tests and a review step before presenting generated software as verified.

## Milestone 3 — software builder
- [ ] Build projects in isolated workspaces with explicit file manifests.
- [ ] Run syntax checks, automated tests and build checks; report exact failures and artifacts.
- [ ] Provide diffs and require confirmation before deployment or destructive changes.
- [ ] Add project preview/export and deployment adapters only after end-to-end verification.

## Milestone 4 — media generation
- [ ] Verify each image, video, music, voice and transcription provider adapter independently.
- [ ] Show provider, resolution/quality, queue state, estimated wait where available, and actionable credential/quota errors.
- [ ] Do not claim HD video or music generation works until a real provider request succeeds and output is validated.

## Milestone 5 — search, settings and platform capabilities
- [ ] Implement source-backed search and clear source attribution.
- [ ] Expand settings for model/provider selection, privacy, data retention, accessibility and usage/cost limits.
- [ ] Add capability discovery only for tools that are actually installed, authorized and tested.
- [ ] Add observability, security checks, rate limits, dependency review and regression tests.

## Completion criteria
A milestone is complete only when its code is committed, relevant automated tests pass, manual end-to-end checks pass where required, and limitations are visible to the user. A commit or a passing syntax check alone does not mean the full platform is complete.
