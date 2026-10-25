# Chat with Friends & Social Integrations — Deep Research Record

Status: researched baseline. This document is not a claim that every integration is implemented or approved for production. Each provider must be enabled only for the scopes, policies, and capabilities it actually grants.

## Official sources reviewed

1. WhatsApp Business Platform developer hub — https://whatsappbusiness.com/developers/developer-hub/
   - Business messaging, opt-in, templates, webhooks, policy, rate limits, and pricing.
2. Meta WhatsApp messages API collection — https://www.postman.com/meta/whatsapp-business-platform/folder/o48mro7/messages
   - Supported text/media/template messages and provider message IDs/delivery events.
3. Telegram Bot API — https://core.telegram.org/bots/api
   - Bot identity, HTTPS methods, supported message/file operations, and API limits.
4. TikTok Content Posting API — https://developers.tiktok.com/docs/en/content-posting-api-get-started
   - Authorized posting, scopes, media URL constraints, app audit and visibility requirements.
5. YouTube Data API — https://developers.google.com/youtube/v3/docs/
   - Public metadata vs OAuth-authorized channel actions, resource model and quota.
6. LinkedIn API access — https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access
   - OAuth 2.0, explicit permissions and partner approval for restricted capabilities.
7. LinkedIn Posts API — https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-09
   - Create/retrieve text, image, video and document posts with member/organization scopes.

## Comparison and design decisions

| Provider/product pattern | Capability and constraint | Nkwasibwe implementation rule |
|---|---|---|
| First-party private messaging | WhatsApp Business APIs are business messaging, not an unrestricted personal WhatsApp client | Label the integration as WhatsApp Business; require opt-in and enforce templates/policy where required |
| Bot messaging | Telegram Bot API is for bots and cannot reproduce every feature of the Telegram consumer client | Expose bot-authorized operations only; never claim full-client parity |
| Social publishing | TikTok requires authorized scopes, media constraints and app audit for some public posting | Show connected-account status, permissions, upload progress, provider job ID, final URL and provider-reported result |
| Video/channel management | YouTube separates public data access from private or modifying OAuth actions and applies quota | Separate public search/metadata from channel-authorized actions; enforce quota budgets and clear errors |
| Professional publishing | LinkedIn permissions and partner approval restrict some actions | Use least-privilege OAuth; clearly show unavailable and approval-required actions |
| Delivery/read status | APIs may expose message IDs and webhook-driven delivery states | Display queued/sent/delivered/read/failed only when supported by provider evidence |
| Policy and rate differences | Every provider has different consent, scope, quota, review and content rules | Use provider adapters and a capability matrix, not one fake universal integration |

## Feature hierarchy

### Main feature: Chat with Friends

- **Identity and profile**
  - Profile name, avatar, bio, presence only when available, privacy and account controls.
- **Friends and relationships**
  - Search, friend requests, accept/decline, mutual-friend discovery, block, report and privacy rules.
- **Messaging**
  - One-to-one and group conversations, text, supported attachments, reply, forward, edit/delete policy, reactions, search, unread counts and delivery receipts.
- **Safety and trust**
  - Rate limits, spam prevention, block enforcement, report queue, moderation, abuse review and account controls.
- **Voice/video calls**
  - Signaling, permissions, mute/camera, reconnect, network changes, call history and failure recovery. Keep marked unavailable until realtime media transport is deployed and tested.
- **Feed and community**
  - Posts, supported media, comments, reactions, shares, bookmarks, audience visibility, reporting and pagination.
- **Profile documents and creator workspace**
  - Explicit document privacy, ownership, upload validation, versioning and download controls.

### Main feature: Connected Social Accounts

- **Account connection**
  - OAuth state/CSRF protection, least-privilege scopes, secure token storage, refresh/expiry, revocation and disconnect.
- **Provider capability matrix**
  - Supported, unavailable, permission-required, review-required, quota-blocked and temporarily-failed actions.
- **Content workflow**
  - Draft, preview, explicit publish confirmation, media validation, upload progress, provider job ID, result URL and detailed failure state.
- **Webhook/event processing**
  - Signature validation, event deduplication, replay handling, out-of-order events, audit history and provider-specific retry policies.
- **Cost and quota controls**
  - Per-provider request budgets, rate-limit backoff, user-visible quota errors and no silent paid-provider fallback.

### Main feature: Phoenix-style downloads

- URL validation, allowlist/supported-provider adapters, redirect limits and SSRF protection.
- Respect copyright, platform terms, authentication and access controls; never bypass DRM, paywalls or private access.
- File type/signature checks, byte/duration limits, safe filenames, malware scanning where available and retention cleanup.
- Real queue state: queued, fetching, validating, succeeded, failed, cancelled; show source, format/quality, file size and a working download link.
- Never claim success unless a downloadable artifact exists and has been verified.

## Cross-cutting acceptance criteria

1. Private messages, friend lists, contacts and attachments are scoped to authenticated participants; cross-account access tests must fail.
2. Blocked users cannot message or interact in ways prohibited by the selected privacy policy.
3. Send/retry operations are idempotent where supported; retries do not silently duplicate messages or posts.
4. Delivery/read states come from server/provider receipts, never fabricated by the client.
5. Uploads validate size, MIME and byte signature; downloads enforce SSRF-safe URL validation, redirect, size and time limits.
6. Every provider exposes an explicit capability/permission/quota status; unsupported operations fail clearly rather than appearing to work.
7. OAuth includes state validation, least privilege, secure token storage, refresh/expiry handling and disconnect/revocation.
8. Webhook signatures and event IDs are verified/deduplicated; out-of-order events cannot regress final state incorrectly.
9. Feed pagination, search, comments, reactions and moderation cover empty, malformed, abusive and high-volume cases.
10. Calls remain labelled unavailable until signaling, media transport, permission UX, reconnection and mobile/network end-to-end tests pass.
11. Third-party integrations pass sandbox/test-account workflows before production access is enabled.
12. Interface labels follow the selected UI language; chat replies follow the user's message language unless explicitly overridden.
13. Each feature has its own focused dashboard and activity list; general chat is not cluttered with unrelated service status cards.

## Required evidence before marking any provider feature complete

- Exact API/official source references and current permissions.
- Backend route, authenticated ownership check, rate limit and data retention policy.
- Unit and account-isolation tests, including invalid input, retries, timeouts and provider rejection.
- A real sandbox or test-account end-to-end result, with request/job ID and output evidence.
- Mobile layout/permission checks and a visible unavailable state for capabilities not granted.
