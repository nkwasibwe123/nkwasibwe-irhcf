# Chat with Friends — product and engineering roadmap

## Product promise

Chat with Friends is a first-party Nkwasibwe IRHCF social workspace, not a set of external-app wrappers. The initial frontend foundation is intentionally honest: its local post preview is browser-only and is not a real multi-user social network. No messaging, media publishing, payments, recommendations, or notifications may be labelled live until a secured backend, persistence, and end-to-end tests prove they work.

## Feature domains

### Messaging (WhatsApp / Messenger-inspired)
- Account-to-account one-to-one and group conversations; membership and invite controls.
- Durable messages, delivery/read state, typing/presence where privacy allows, reply/thread, reactions, edits/deletes, search, attachments, voice notes, audio/video calling, mute/block/report, message requests and spam controls.
- WebSocket/SSE delivery with reconnect and idempotency; offline queue, retry, pagination and per-user authorization.
- End-to-end encryption is a separate security project requiring a reviewed protocol and key lifecycle. Do not claim encryption until independently verified.

### Social feed (Facebook Lite / Threads-inspired)
- Profiles, friend/follow requests, feed posts, text/photo/video/link attachments, reactions, comments, reposts/quotes, sharing, bookmarks, mentions, hashtags, topics, polls, notifications, search, privacy/audience selection and reporting.
- Low-data mode: responsive/mobile-first UI, image resizing, lazy loading, pagination, accessible controls and graceful offline/read-only behavior.
- Feed ranking must be transparent, bounded and adjustable; no engagement manipulation or unreviewed user profiling.

### Creator media (YouTube / Instagram / TikTok-inspired)
- Channels/creator profiles, upload and resumable upload, transcoding and thumbnails, captions/subtitles, accessible player, playlists, subscriptions, watch history, likes, comments, vertical short clips, story expiry, drafts, creator analytics and rights/reporting workflows.
- Media needs object storage, metadata records, FFmpeg workers, quotas, content-type validation, size/duration limits, malware scanning where appropriate, and cleanup jobs. Browser local storage is not a media platform.
- Avoid copying proprietary branding, code, exact layouts, or protected assets; implement common user-facing capabilities with Nkwasibwe's own design.

### Professional network (LinkedIn-inspired)
- Professional profile, skills, education/experience, company pages, job posts, applications, connections, recommendations, professional feed, privacy controls and anti-fraud/reporting tools.

### Communities
- Public/private groups, membership and moderator roles, group posts, events, pinned announcements, rules, invite links with expiry, and moderation/audit trail.

### Phoenix / IRHCF media and agent capabilities
- Connect the existing Image Studio, Media Studio, FFmpeg video editing, local Whisper.cpp transcription, Music Studio, AI chat and task/activity tracking as optional creation tools within a post or creator workflow.
- Keep the user's existing requirement for local-first/free processing where possible. Never silently spend paid-provider credits. Show provider, limits, estimated cost and consent before a paid operation.
- A created/edited asset must be a real downloadable artifact with verifiable status, not a fake success message. Tasks should expose queued/running/succeeded/failed state, error details, retries and output links in the relevant workspace—not clutter general chat.
- Phoenix-specific capabilities not present in the repository or explicit product records must be inventoried before implementation; do not invent that an undocumented Phoenix feature is already supported.

## Cross-cutting production requirements
- Authentication and account recovery; role-based access; server-side ownership checks on every object; rate limiting; abuse/spam protection; CSRF/CORS policy; input validation; safe upload handling; secret management; audit logs; data export/deletion; consent and privacy settings; retention policy; accessibility; mobile performance; localization; backups and migrations.
- Durable PostgreSQL data model for users, profiles, friendships/follows, posts, media, reactions, comments, conversations, participants, messages, groups, memberships, notifications, reports and moderation actions.
- Real-time transport, object storage, media processing workers, push notifications, observability, migration/rollback plan and deployment verification.
- Automated unit/integration/security tests, two-user end-to-end tests, upload/download tests, mobile viewport tests, failure/retry tests, and production health checks.

## Delivery gates

1. Navigation/UI foundation — started; local post preview only.
2. Schema, migrations and authenticated APIs — not complete.
3. Two-account feed, friend/follow graph, comments/reactions — not complete.
4. Durable one-to-one/group messaging and realtime reconnect — not complete.
5. Safe media storage and Phoenix/IRHCF creation integration — not complete.
6. Video processing, captions, stories and creator workflows — not complete.
7. Communities, professional profiles and jobs — not complete.
8. Moderation, privacy, security, accessibility and low-data mode — not complete.
9. End-to-end tests and live deployment validation — not complete.

A feature is complete only after its API, data persistence, authorization, failure handling, tests and deployed behavior have all been verified.
