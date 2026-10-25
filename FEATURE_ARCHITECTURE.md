# Nkwasibwe IRHCF — Feature Architecture & Dashboard Information Architecture

**Status:** architecture baseline proposed for implementation. This document is not proof that listed capabilities are implemented or production-ready.

## 1. Mandatory feature-research rule

Before implementing or declaring any feature complete, research at least five distinct, relevant websites/products that provide the same or adjacent capability. A search-result count is not enough: inspect each source and record its capabilities, workflow, limits, privacy/security model and evidence URL.

Each feature needs a research record with:
1. User problem and acceptance criteria.
2. At least five distinct sources; prefer official product/help/API documentation plus independent UX/security references where relevant.
3. Comparison matrix: capabilities, workflow, inputs/outputs, permissions, failure states, cost/quotas, mobile behavior and export/integration.
4. Nkwasibwe-specific synthesis: patterns to adopt, improvements to make and things not to copy.
5. Implementation plan, dependencies and test cases.
6. Tests for normal use, invalid input, missing permission, provider outage/quota, retry/cancel, account isolation, mobile layout and accessibility.
7. Evidence-backed status: planned, researching, building, testing, blocked, verified or failed.

Do not copy source code, proprietary design, branding or protected assets. Learn from public capabilities and build an original Nkwasibwe experience. If fewer than five meaningful sources can be found, document the gap and do not mark research complete.

## 2. Research record index

Use these feature-specific records as the starting point for the five-source research gate. Each record defines a synthesis and acceptance criteria; it does not prove implementation or production readiness.

- Software & Website Factory: the feature research section in this document.
- Agents & Automation: research/AGENT_ORCHESTRATION_RESEARCH.md
- Nkwasibwe Market (canonical deep dive): research/MARKETPLACE_FEATURE_RESEARCH.md; `MARKETPLACE_RESEARCH.md` remains supplementary baseline/codebase notes.
- Chat with Friends / Social Integrations (canonical deep dive): research/SOCIAL_FEATURE_RESEARCH.md; `SOCIAL_COMMUNITY_RESEARCH.md` remains supplementary native-social/API baseline.
- Media Studio: research/MEDIA_STUDIO_RESEARCH.md
- Research & Search: research/RESEARCH_SEARCH_WORKSPACE.md
- Chat & Personal Assistant: research/CHAT_ASSISTANT_RESEARCH.md
- Files & Knowledge: research/FILES_KNOWLEDGE_WORKSPACE.md
- Download Manager / Media Saver: research/DOWNLOAD_MANAGER_RESEARCH.md
- Account, Settings & Platform Operations: research/ACCOUNT_SETTINGS_OPERATIONS_RESEARCH.md

Before implementation, refresh sources for current product/API availability and record the retrieval date, especially for provider-backed features. If a provider or endpoint has been retired, the feature must be gated or migrated rather than advertised as available.

## 3. Product hierarchy

The hierarchy can grow deeper when justified, but every level needs a clear parent, purpose, owner and acceptance tests.

- **Level 0 — Nkwasibwe IRHCF (main-main platform):** identity, shared navigation, global search, account, permissions, notifications, usage/cost, help and platform health.
- **Level 1 — Main feature domains:** major user goals and workspaces.
- **Level 2 — Features:** distinct user-facing capabilities inside a domain.
- **Level 3 — Sub-features:** focused workflows that complete part of a feature.
- **Level 4 — Sub-sub-features/actions:** specific operations, controls, formats or settings.
- **Level 5+ — Implementation details:** only when necessary; keep technical internals out of ordinary navigation.

Every node should have a stable ID, label, parent ID, owner/module, permissions, route, dependencies, research record, test suite, status and analytics/error events. Use consistent labels in navigation, page title, activity history, help and permissions.

## 4. Main feature map (initial taxonomy, not a completion claim)

### A. Chat & Personal Assistant
- Conversations: new, history, rename, search, archive/delete.
- Messages: separate user/assistant/system activity; edit/resend; feedback; citations.
- Attachments: upload, preview, inspect, download, remove; file-type and size validation.
- Voice: record, transcribe, speak response, live voice when configured.
- Memory/context: user controls, source visibility, privacy and retention.

### B. Research & Search
- Web search: query planning, source discovery/inspection, citations and freshness.
- Research workspace: question, source library, evidence table, synthesis and report export.
- Knowledge: document search, summaries, compare documents and file-grounded Q&A.
- Quality: conflicting-source checks, credibility, dates, uncertainty and citation validation.

### C. Software & Website Factory
- Project setup: requirements, stack choice, file manifest and project workspace.
- Build: websites, web apps, mobile/desktop apps, APIs, scripts and database-backed systems.
- Quality: syntax, unit/integration tests, build, accessibility, security and dependency checks.
- Repair: capture errors, diagnose, bounded patch, rerun failing tests and regression checks.
- Delivery: preview, source bundle, README, version/diff, download and deployment with approval.
- Runtime: isolated execution, resource/time limits, allowlists, logs and cleanup.

### D. Agents & Automation
- Lifecycle: understand, plan, execute, test, repair, verify and deliver.
- Specialists: research, coding, UI, media, QA, security, documentation and release.
- Coordination: task IDs, bounded concurrency, ownership, dependency graph and shared artifacts.
- Operations: progress events, pause/cancel, retry, recovery, timeout and audit trail.
- Scale concurrency to actual compute/provider quotas; never invent agent counts or progress.

### E. Media Studio
- Images: generate, edit, replace/remove background, resize, effects, preview and export.
- Video: import, trim, join, crop, subtitles, audio track, transitions, render and export.
- HD video: provider/codec/resolution checks, queue state, duration/size limits and output validation.
- Audio: record, clean/process, convert, trim, mix, voice-over and export.
- Music: composition request, genre/mood/tempo, provider and usage metadata.
- Transcription: upload, language detection, timestamps, transcript editing and export.
- Shared controls: input preview, real task progress, quality/format selection, quota errors and download.

### F. Chat with Friends / Community
- Identity/profile and privacy controls.
- Friends, requests, blocks and reports.
- One-to-one/group messages, delivery/read states, attachments and search.
- Feed, posts, comments, reactions, sharing and saved items.
- Voice/video calling only when realtime infrastructure is integrated and tested.
- Creator/public pages and discovery with abuse prevention.
- Third-party integrations only through documented APIs and user-authorized OAuth. Navigation alone does not mean equivalent functionality.

### G. Nkwasibwe Market
- Discovery: categories, search, filters, product detail, seller pages and favourites.
- Buyer: cart, checkout, orders, delivery addresses, returns and refunds.
- Seller: onboarding, products, inventory, orders, fulfillment and analytics.
- Payments: provider checkout, signed webhooks, idempotency, currency/minor units and refund ledger.
- Payouts: verified seller identity, available-balance guard and audit trail.
- Isolation: buyer/seller records, orders, addresses, balances and payment status scoped server-side to the authenticated account. Never store raw card details.
- Admin operations: permissions, disputes, fraud signals, moderation and reporting.

### H. Files & Knowledge Workspace
- File browser, folders/tags, preview, search, versions, sharing permissions and export/download.
- Document tools: extract, summarize, compare, transform and generate.
- Retention, deletion, quotas, access logs and safe file validation.

### I. Profile, Settings & Trust
- Account/profile, sign-in/security, sessions and recovery.
- Language: interface labels follow selected UI language; assistant replies follow message language unless the user explicitly chooses a response-language override.
- Privacy/memory/data retention, accessibility and notifications.
- Providers/models: configured/available status, limits, safe fallbacks and costs.
- Usage, billing, plan and consent where relevant.

### J. Platform Operations (admin-only where appropriate)
- Health/deploy status, logs, metrics, queues and provider availability.
- Task failures, retry controls, audit events, rate limits and security alerts.
- Feature flags, rollout status, backups, migration and incident recovery.
- Never expose secrets or another user's private information.

## 5. Dashboard structure — order without clutter

### Main Dashboard (Level 0)
Show only global search/command entry, main workspaces, recent and pinned workspaces, a compact attention area for genuine blocked/failed tasks, plus account/notifications/settings access. Do not place every sub-feature, agent card, activity stream, media tool or configuration panel on the main dashboard.

### Workspace dashboard (Level 1)
After opening a domain, show its title and purpose, primary actions, relevant recent items, domain-specific tabs/status and contextual help/settings.

### Feature page (Level 2+)
Show only controls and activity relevant to the selected feature. Task-based features use consistent activity views: Recent, Running, Succeeded and Failed, plus search/filter and a detail view. Do not inject service activity cards into general chat. General chat should show user messages, assistant responses and concise task updates only when the user starts a task there.

### Navigation rules
- One primary destination per concept; no duplicate cards leading to unrelated pages.
- Breadcrumbs/back action make the parent level obvious.
- Advanced controls live under the relevant feature's tabs, details or settings.
- Keep chat-first UI clean; open dashboards on user request or when the selected task needs them.
- On mobile, use collapsible navigation, responsive cards, touch-friendly controls and no horizontal page overflow.
- Empty/loading/error/blocked states explain what is happening and what action is available.
- Use actual API/events for status; never fabricate percentages, agents, ETAs, success or provider availability.

## 6. Shared feature contract

Every feature defines its inputs and validation; execution API/service, task ID, provider/local engine, timeout and cancellation; output artifacts, preview, download/export and retention; timestamped progress events distinguishing active/waiting/retrying/blocked; stable error codes and safe next steps; authentication/authorization/account ownership/rate limits/audit; automated and end-to-end tests; provider cost/quota and fallback behavior; five-source research; and a release/rollback plan.

## 7. Research baseline for dashboard and product architecture

These sources informed the initial baseline. They do not replace per-feature research before implementation.

1. OpenAI ChatGPT overview — chat, work deliverables, coding, voice and tools: https://chatgpt.com/overview/
2. Notion product features — docs, databases, search, dashboards, version history and agents: https://www.notion.com/product/features
3. Anthropic Claude product overview — long-running work, parallel tasks, artifacts, permissions and connectors: https://claude.com/product/overview
4. Claude Platform feature overview — model capabilities, tools, orchestration, context and files: https://platform.claude.com/docs/en/build-with-claude/overview
5. Canva in ChatGPT — design generation, preview and conversational edits: https://chatgpt.com/apps/canva/
6. SaaSUI navigation patterns — sidebar/top-bar choice based on information architecture: https://www.saasui.design/blog/saas-navigation-ux-patterns
7. Studio Techelix dashboard playbook — information hierarchy, progressive disclosure and actionable states: https://studio.techelix.co/blog/the-b2b-saas-dashboard-design-playbook-turning-data-density-into-clarity
8. Bokaap dashboard guidance — user tasks and primary/supporting/detail levels: https://bokaap.design/insights/b2b-saas-dashboard-design-how-to-make-complex-data-easier-to-use/
9. WebMash Labs dashboard guidance — role-based visibility and progressive disclosure: https://www.webmashlabs.com/blog/saas-dashboard-ux-design-best-practices
10. Cluma information architecture — navigation trees, feature states, permissions and depth: https://www.cluma.design/blog-posts/information-architecture-for-saas-products

## 8. Feature research record — Software & Website Factory (initial research)

**Status: researched baseline; implementation still requires code-level and deployed verification.**

### Sources reviewed (six distinct product/documentation sources)

1. Cursor Agent documentation: searches a codebase, edits multiple files, runs terminal commands, writes tests and repairs errors: https://prod.cursor.com/help/ai-features/agent
2. Cursor Agent overview: project-level coordinator can plan a feature or migration and delegate work; agents combine instructions, tools and a model: https://cursor.com/docs/agent/overview
3. Cursor terminal integration: execution modes, allowlists/sandboxing and approval controls for commands: https://prod.cursor.com/help/ai-features/terminal
4. Lovable AI App Builder: prompt-to-app workflow, screens, database/logic, auth/hosting, iterative editing, integrations and security scanning: https://lovable.dev/build/app-builder
5. Vercel v0 documentation: full-stack app creation, connected project, environment variables and deployment workflow: https://vercel.com/docs/v0
6. v0 full-stack apps guide: incremental UI → data layer → auth/CRUD/realtime → optimization workflow, with databases and integrations: https://v0.dev/docs/full-stack-apps
7. v0 FAQ: GitHub import, branching/commits/PRs, editor/preview, project organization and existing-codebase workflow: https://v0.app/docs/faqs
8. OpenAI ChatGPT overview: coding tasks progress from understanding and planning through writing, testing, reviewing and shipping: https://chatgpt.com/overview/
9. GitHub Codespaces documentation: repository-scoped cloud development environments and development-container setup: https://docs.github.com/en/codespaces

### Synthesis for Nkwasibwe

- Accept a plain-language goal, inspect the existing repository and constraints before writing files; avoid replacing working code blindly.
- Produce an explicit plan, file manifest and task ID before execution. Delegate independent tasks only when file ownership and dependencies are clear.
- Build in small verifiable steps: UI/structure, data/API, auth and account ownership, then integrations and polish.
- Run real syntax/tests/build commands in an isolated, resource-limited workspace. Record command output and exact failing tests; use a bounded repair loop and rerun the failed checks.
- Show a reviewable diff, changed-file list, preview and downloadable source bundle. Keep deployment a distinct, permission-gated stage.
- Apply command allowlists/sandboxing, secrets isolation, dependency/security checks, timeouts, cancellation and resource limits. Never run arbitrary user code inside the public web process.
- Store task state and activity events durably; the UI must render backend events rather than simulate progress.
- Treat provider quotas, missing credentials, sandbox unavailability and build failures as explicit blocked states, not success.
- Keep user-owned project files and outputs isolated by authenticated account and project; verify authorization server-side.
- A generated file set is not a verified app: require project-specific tests, build/preview checks and downloadable artifacts before reporting completion.

### Acceptance criteria for this feature

1. Requirements and constraints are captured before edits; the planned files and acceptance tests are visible.
2. Every generated project includes only the files needed for its requested stack, plus setup/use documentation where appropriate.
3. A task run persists status, timestamps, logs, artifact manifest and structured errors across refresh/restart.
4. Tests/build run in an isolated runner with explicit allowlist and timeout; arbitrary shell commands are not run on the main backend.
5. Failed checks trigger bounded repair, followed by a repeat of the failing check; unresolved errors remain visible.
6. User can inspect/download actual generated files; no missing placeholder files are reported as delivered.
7. Preview/deploy occurs only after verification and required user approval.
8. Tests cover invalid project input, runner unavailable, timeout, dependency failure, missing env vars, cross-account access, retry/cancel and mobile status visibility.

## 9. Definition of done

A feature is verified only when its five-source research record is complete, code is merged through review, automated tests pass, the real deployed end-to-end workflow succeeds where applicable, security/account isolation/mobile/failure paths are checked, promised outputs are real and downloadable, UI status matches backend state, and limitations/provider requirements/costs are visible.


## 10. Feature research record — Nkwasibwe Market

The six-source comparison, deep marketplace hierarchy, payment/ledger state machines, security invariants, and release acceptance gates are maintained in [research/MARKETPLACE_FEATURE_RESEARCH.md](research/MARKETPLACE_FEATURE_RESEARCH.md). Use [research/FEATURE_DEEP_DIVE_TEMPLATE.md](research/FEATURE_DEEP_DIVE_TEMPLATE.md) before changing or claiming completion of each Market sub-feature.

## 11. Feature research record — Chat with Friends & Social Integrations

The seven-source comparison, provider capability matrix, detailed feature hierarchy, and completion evidence requirements are maintained in [research/SOCIAL_FEATURE_RESEARCH.md](research/SOCIAL_FEATURE_RESEARCH.md). Use [research/FEATURE_DEEP_DIVE_TEMPLATE.md](research/FEATURE_DEEP_DIVE_TEMPLATE.md) for every additional main feature before implementation or completion claims.
