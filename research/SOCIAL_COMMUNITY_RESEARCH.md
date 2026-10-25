# Chat with Friends / Social & Communication — Research Record

Status: researched baseline. Native Nkwasibwe social functionality and third-party integrations are separate workstreams; live external integrations require provider approval, credentials, OAuth consent and end-to-end tests.

## Sources reviewed

1. Meta Messenger Platform documentation — page-based messaging, recipient identifiers, structured messages and webhooks: https://developers.facebook.com/docs/messenger-platform/
2. TikTok Content Posting API — video/photo publishing requires registered app, approved scopes, user authorization and (for public visibility) a compliant audited client: https://developers.tiktok.com/docs/en/content-posting-api-get-started
3. TikTok upload workflow — upload-as-draft is distinct from direct posting and can require the user to complete the flow inside TikTok: https://developers.tiktok.com/docs/en/content-posting-api-get-started-upload-content
4. Telegram Bot API — HTTPS API, webhook or polling updates, supported message/media operations and update identifiers useful for deduplication: https://core.telegram.org/bots/api
5. LinkedIn Posts API — publishing and reading depend on scopes, organization roles, approved restricted permissions and versioned API headers: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-09
6. YouTube Data API — OAuth/API-key access, video/channel/playlist/comment resources and permission requirements for modifying private user data: https://developers.google.com/youtube/v3/docs/
7. YouTube Data API video resource — visibility of statistics differs by field and authorization context; API access does not imply access to every user-only feature: https://developers.google.com/youtube/data/reference/rest/v3/videos

## Synthesis for Nkwasibwe

- Build first-party Nkwasibwe social features on Nkwasibwe-owned data and APIs: profiles, privacy, friend requests, blocks/reports, one-to-one/group conversations, feed, comments, reactions, saved posts, media attachments and notifications.
- Keep external account connections under a separate “Connected platforms” workspace. A linked provider account is not the same as a Nkwasibwe account or native friend relationship.
- Use documented provider APIs and OAuth with least-privilege scopes. Do not scrape private pages, ask for third-party passwords, bypass rate limits, or claim support for endpoints not approved for the app.
- Show a capability matrix per connected platform: read profile, read posts, publish, comments, media upload, inbox messaging, analytics, and which scopes/review/regions are required. Disabled or unavailable functions must be clearly labelled.
- Distinguish “upload draft” from “published”; show provider publish IDs and query final status before declaring success.
- Use webhook signature verification where provided, stable provider event IDs, deduplication, idempotent processing, retry/backoff and replay protection.
- Keep external tokens encrypted at rest, scoped to the owner, refresh/revoke safely, and never expose tokens to frontend JavaScript or logs.
- For native messaging, enforce conversation membership and block/report rules server-side on every read and write. Do not rely on frontend visibility to authorize access.
- Model message delivery as sent/accepted/delivered/read/failed only when the relevant infrastructure/provider confirms that state. Do not fabricate online presence or read receipts.
- Real voice/video calls need realtime signaling, TURN/STUN, permission handling, call lifecycle and mobile network testing; a button alone is not a calling feature.
- Add abuse controls: spam throttles, reporting/blocking, attachment scanning/limits, moderation hooks and safe handling of links/media.
- Respect each platform's policies, review gates, rate limits, privacy rules and user consent. API access is narrower than the consumer app; do not promise exact feature parity with Messenger, WhatsApp, Instagram, TikTok, Telegram, LinkedIn or YouTube.

## Acceptance criteria

1. Every private message, group, attachment, reaction and notification is checked against the authenticated user's membership/ownership on the server.
2. Blocking prevents new messages and defined interactions; reporting creates an auditable moderation record.
3. Feed pagination is stable; edits/deletes and reactions are idempotent; concurrent duplicate actions do not create duplicate rows.
4. Uploads enforce MIME/type, size, ownership, retention and safe download headers.
5. Message delivery/read status is derived from actual persisted events or provider receipts.
6. External OAuth uses state/PKCE as appropriate, least privilege, secure token storage, revocation and account disconnect.
7. Each provider capability has explicit scope/approval prerequisites and truthful unsupported/unavailable states.
8. Publishing distinguishes draft/uploaded/processing/published/failed; retries do not publish duplicates.
9. Webhooks are authenticated, deduplicated and safe under repeated/out-of-order events.
10. Tests cover cross-account access, non-member access, blocked users, webhook replay, expired/revoked tokens, rate limits, upload abuse, duplicate reactions and failed external publication.
11. Any voice/video call is verified end-to-end across supported mobile browsers/devices before being marked available.
