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

## 2. Product hierarchy

The hierarchy can grow deeper when justified, but every level needs a clear parent, purpose, owner and acceptance tests.

- **Level 0 — Nkwasibwe IRHCF (main-main platform):** identity, shared navigation, global search, account, permissions, notifications, usage/cost, help and platform health.
- **Level 1 — Main feature domains:** major user goals and workspaces.
- **Level 2 — Features:** distinct user-facing capabilities inside a domain.
- **Level 3 — Sub-features:** focused workflows that complete part of a feature.
- **Level 4 — Sub-sub-features/actions:** specific operations, controls, formats or settings.
- **Level 5+ — Implementation details:** only when necessary; keep technical internals out of ordinary navigation.

Every node should have a stable ID, label, parent ID, owner/module, permissions, route, dependencies, research record, test suite, status and analytics/error events. Use consistent labels in navigation, page title, activity history, help and permissions.

## 3. Main feature map (initial taxonomy, not a completion claim)

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

## 4. Dashboard structure — order without clutter

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

## 5. Shared feature contract

Every feature defines its inputs and validation; execution API/service, task ID, provider/local engine, timeout and cancellation; output artifacts, preview, download/export and retention; timestamped progress events distinguishing active/waiting/retrying/blocked; stable error codes and safe next steps; authentication/authorization/account ownership/rate limits/audit; automated and end-to-end tests; provider cost/quota and fallback behavior; five-source research; and a release/rollback plan.

## 6. Research baseline for dashboard and product architecture

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

## 7. Feature research record — Software & Website Factory (initial research)

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

## 8. Feature research record — Nkwasibwe Market (initial research)

**Status: researched baseline; code and deployed payment flows still require separate verification.**

### Sources reviewed (six distinct official documentation/product sources)

1. Stripe Connect marketplace overview: seller onboarding and verification, payouts, fees, balances and reporting: https://stripe.com/connect/marketplaces
2. Stripe API idempotency guidance: retry payment-related API requests without accidentally creating duplicate operations: https://docs.stripe.com/api/errors
3. Adyen for Platforms overview: onboard and verify sellers, split funds, manage payouts, risk and reconciliation: https://docs.adyen.com/adyen-for-platforms-model
4. Adyen payment flow guide: split sale, platform commission, payment fees and seller proceeds; balance accounts and settlement timing: https://docs.adyen.com/platforms/quickstart-guide/payments/
5. PayPal seller onboarding overview: seller onboarding before/after payment, risk/compliance checks and limitations by onboarding mode: https://developer.paypal.com/platforms/seller-onboarding
6. PayPal checkout webhook guidance: distinguish approval, pending, completed, denied and reversed states; do not fulfill pending payments: https://developer.paypal.com/payment-methods/webhooks/
7. PayPal multiseller payments guide: one buyer checkout can settle as separate transactions to multiple merchants: https://developer.paypal.com/platforms/checkout/standard/customize/multiseller-payments
8. WooCommerce Marketplace vendor product management: vendor dashboard, sales/earnings/refund reporting and quality updates: https://developer.woocommerce.com/docs/woo-marketplace/managing-products/
9. WooCommerce Marketplace submission requirements: functional, UX, security and compatibility review before launch: https://developer.woocommerce.com/docs/woo-marketplace/getting-started

### Comparison and Nkwasibwe synthesis

| Pattern | Evidence from sources | Nkwasibwe design implication |
|---|---|---|
| Seller onboarding and eligibility | Stripe, Adyen and PayPal require onboarding/verification appropriate to the payment model | Keep seller application separate from seller approval and payment-provider verification; show each status distinctly |
| Hosted/provider-managed checkout | Stripe Connect and PayPal/Adyen provide provider-managed payment flows | Keep card/bank credentials with the provider; Nkwasibwe stores references and status only |
| Reliable retries | Stripe idempotency documentation | Every external money-moving request must use a stable idempotency key and persist provider references |
| Payment state versus order state | PayPal webhook events distinguish pending, completed, denied and reversed | Never ship, grant downloads or mark an order paid based only on a browser redirect or a pending event |
| Multi-seller accounting | Adyen splits funds; PayPal multiseller checkout may create separate merchant transactions | Derive seller allocations from server-owned order items and a ledger, not browser-supplied seller IDs |
| Payout safety and reconciliation | Stripe/Adyen support payout controls, reporting and reconciliation | Keep payout eligibility, reserved balance, paid balance, refunds and reconciliation auditable per seller and currency |
| Vendor quality and operations | WooCommerce uses vendor dashboards, analytics, updates and review | Seller workspace should include product lifecycle, inventory, orders, fulfillment, analytics and support/moderation |

### Current-repository observations and explicit limits

The existing commerce implementation already has product/catalog search, categories/sorting, seller applications and approval, seller-owned product access, wishlists, reviews, addresses, carts/orders, stock reservations, refunds, seller ledger and payout requests. Its documented payout flow currently records an externally performed transfer reference and **does not send money automatically**. The existing status endpoint distinguishes checkout configuration, webhook configuration and manual payouts. These are repository observations, not proof of live end-to-end payment success.

Do not claim the marketplace is production-ready until the actual configured provider's signed webhook verification, duplicate-event handling, payment/order amount-currency-reference matching, refund lifecycle, concurrency-safe inventory, account isolation, payout ledger and live/sandbox end-to-end checkout have all been tested. Confirm provider availability and local legal/compliance requirements for Rwanda before enabling real money movement.

### Acceptance criteria for Nkwasibwe Market

1. A buyer sees only active products and accurate currency/price/stock; search, category, sorting and product details work on mobile.
2. Seller application, approval, suspension and seller ownership checks are enforced on the server for every seller route.
3. Checkout prices and seller allocations are recomputed from database records inside a transaction; browser totals and seller IDs are never trusted.
4. Inventory reservations are atomic under concurrent checkouts, expire safely, and cannot be released twice.
5. Payment callbacks are authenticated using the provider's documented signature/verification mechanism, and events are idempotent.
6. An order becomes paid only after verified provider evidence matches the order reference, amount and currency; pending/failed/reversed states never trigger fulfillment.
7. Refunds create auditable order, provider and seller-ledger changes; repeated events do not double-reverse balances.
8. Seller available balance is calculated by currency after refunds, completed payouts and pending/approved payout reservations; concurrent payout requests cannot overspend it.
9. Buyer order/address/cart data and seller products/orders/earnings are scoped to the authenticated account; cross-account tests must fail.
10. Provider outages, missing credentials, invalid signatures, duplicate callbacks, amount mismatch, expired checkout, insufficient stock and payout failures produce safe, traceable errors.
11. Live payment and automatic payout are labelled unavailable unless a real provider integration is configured and verified. Do not store raw card or bank credentials.
12. Automated tests and a provider sandbox walkthrough pass before enabling production money movement.

## 9. Feature research record — Chat with Friends & Social Integrations (initial research)

**Status: researched baseline; actual messaging, realtime calling and third-party API access require separate code and provider verification.**

### Sources reviewed (seven distinct official product/API sources)

1. WhatsApp Business Platform developer hub: direct integration, API reference, webhooks, policy, opt-in, rate limits and pricing: https://whatsappbusiness.com/developers/developer-hub/
2. Meta WhatsApp messages API collection: send text/media/templates, message IDs, read state and delivery status via webhooks: https://www.postman.com/meta/whatsapp-business-platform/folder/o48mro7/messages
3. Telegram Bot API: HTTPS methods, message/file handling, bot identity and API limits: https://core.telegram.org/bots/api
4. TikTok Content Posting API: authorized direct posting, verified-domain media URLs, scopes and app audit requirements: https://developers.tiktok.com/docs/en/content-posting-api-get-started
5. YouTube Data API: OAuth/API-key access, channel/video/playlist/comment resources and permission requirements: https://developers.google.com/youtube/v3/docs/
6. LinkedIn API access: OAuth 2.0, explicit permissions and partner approval for restricted features: https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access
7. LinkedIn Posts API: create/retrieve text, image, video and document posts with member/organization scopes: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-09

### Comparison and Nkwasibwe synthesis

| Product/API pattern | Constraint or capability | Nkwasibwe design implication |
|---|---|---|
| First-party messaging APIs | WhatsApp Business APIs are business messaging, with opt-in, templates/policies, webhooks and rate limits | Do not describe this as a replacement for personal WhatsApp; implement only supported business flows with consent |
| Bot-based messaging | Telegram Bot API is for bots, not an unrestricted clone of the full Telegram client | Label Telegram bot integration honestly; use official user-authorized capabilities only where available |
| Content publishing | TikTok posting requires approved scopes, authorized users, media constraints and app audit for public visibility | Show connected-account status, required permissions, upload progress and provider-reported publish status |
| Video/channel management | YouTube uses API resources and OAuth for private or modifying actions | Separate public search/metadata from actions requiring channel authorization; apply quota budgets |
| Professional social publishing | LinkedIn posting depends on OAuth permissions and may require partner approval | Display permission gaps clearly and never promise posting features the connected app cannot access |
| Delivery status | Messaging APIs expose IDs and webhook/event states | Persist provider message IDs and event history; show queued/sent/delivered/read/failed only when supported evidence exists |
| Platform-specific policy | APIs have different eligibility, rate, consent and content rules | Use an adapter per provider with a shared UI, rather than pretending all networks expose identical functionality |

### Product hierarchy

- **Chat with Friends**
  - Identity and profile: profile visibility, online state only if supported, avatar and privacy.
  - Friends: search, requests, accept/decline, block, report and mutual-privacy rules.
  - Messaging: one-to-one/group threads, attachments, reply/forward, reactions, edit/delete policy, search, unread state and message delivery receipts.
  - Safety: spam/rate limits, report queue, block enforcement, moderation and account controls.
  - Calls: voice/video call signaling, permission handling, reconnect, network failure, mute/camera controls and call history; do not expose as working until realtime media infrastructure is integrated and tested.
  - Feed: posts, media, comments, reactions, shares, bookmarks, visibility and reporting.
- **Connected Social Accounts**
  - OAuth consent and least-privilege scopes.
  - Token storage/refresh/revocation and account disconnect.
  - Per-provider capabilities and quota/permission diagnostics.
  - Drafts, preview, explicit publish confirmation, provider job ID, result URL and error details.
  - Webhook verification, deduplication and event audit.
- **Phoenix-style downloads**
  - Accept only supported/publicly accessible URLs and user-provided files within lawful/platform-permitted limits.
  - Validate scheme/host, avoid SSRF to internal IPs, limit redirects, size, duration and concurrency, and scan/validate file types.
  - Respect copyright, access controls, rate limits and platform terms; do not bypass DRM, paywalls, private access or technical protections.
  - Show source, quality/format choices, queue status, cancellation, storage retention and real downloadable output.

### Acceptance criteria

1. Private messages, friend lists, contacts and attachments are always scoped to authenticated participants; cross-account access tests must fail.
2. Blocked users cannot message, call or interact in ways prohibited by the selected privacy policy.
3. Message send/retry is idempotent where supported; failures are traceable and do not silently duplicate messages.
4. Delivery/read indicators are based on server/provider receipts, never fabricated by the client.
5. Uploads validate file size, MIME and byte signature; downloads enforce SSRF-safe URL validation, redirect/size/time limits and retention cleanup.
6. Each social provider has an explicit capability matrix showing supported, unavailable, permission-required and quota-blocked actions.
7. OAuth uses state/CSRF protection, least-privilege scopes, secure token storage, expiry/refresh handling and disconnect/revocation.
8. Webhook signatures and event IDs are verified/deduplicated; out-of-order events cannot regress a final state incorrectly.
9. Feed pagination, search, comments, reactions and moderation are tested for empty, malformed, abusive and high-volume cases.
10. Calls remain labelled unavailable until signaling, media transport, permission UX, reconnection and mobile/network end-to-end tests pass.
11. Every third-party integration is tested in its sandbox/test account, and real production access is enabled only after the provider grants necessary permissions.
12. UI language follows the selected interface setting while message replies respect the user's message language unless they explicitly override it.

## 10. Definition of done

A feature is verified only when its five-source research record is complete, code is merged through review, automated tests pass, the real deployed end-to-end workflow succeeds where applicable, security/account isolation/mobile/failure paths are checked, promised outputs are real and downloadable, UI status matches backend state, and limitations/provider requirements/costs are visible.
