# Chat with Friends — implementation roadmap

## Product goal
Build a first-party social and communication workspace inside Nkwasibwe IRHCF. It should use original Nkwasibwe branding and interoperable, documented features rather than copying proprietary source code, logos, or private APIs from other platforms.

## Product areas
- **Private messaging (WhatsApp / Messenger-inspired):** one-to-one and group conversations, durable message history, delivery/read state, typing/presence, attachments, voice notes, audio/video calls, block/report controls, privacy settings.
- **Social feed (Facebook Lite / Instagram / Threads-inspired):** profiles, follow/friend relationships, text/photo/video posts, reactions, comments, shares, replies/threads, mentions, hashtags, saved posts, feed pagination, reporting and moderation.
- **Short video and creator studio (TikTok / Reels / YouTube Shorts-inspired):** upload pipeline, captions, vertical playback, creator profiles, likes/comments, watch history, subscriptions/follows and recommendations with user controls.
- **Video platform (YouTube-inspired):** channels, video upload/transcoding, thumbnails, captions, playlists, search, subscriptions, watch-later, view analytics, rights/report workflow.
- **Professional network (LinkedIn-inspired):** professional profiles, skills, experience, connections, company pages, job listings, applications, posts and messaging.
- **Telegram-inspired messaging:** cloud-synced conversations, group chats, channels, replies, forwards, pinned messages, polls, bot integrations, file sharing, voice notes, search and notification controls. Full Telegram network interoperability requires Telegram's official APIs and user-authorized linking; a first-party IRHCF chat cannot impersonate Telegram or silently access Telegram accounts.
- **Communities and events:** groups, channels, community roles, moderation, events and announcements.
- **Phoenix-inspired browser and downloads:** multi-tab browser, bookmarks/history, private browsing controls, data-saving mode, downloads queue with progress/pause/resume where supported, file manager and previews, video/audio/document downloads from sources that permit them, media player, and a WhatsApp-status saver for status files the user is authorized to access. Respect platform terms, copyright, privacy and DRM; never bypass access controls or scrape private content. YouTube downloads will use permitted official mechanisms only.
- **Notifications and account controls:** in-app notifications, email/push adapters where configured, sessions, export/delete controls, block/report, privacy, age-appropriate safety and abuse rate limits.

## Engineering sequence (deliver and verify one layer at a time)
1. **Foundation:** navigation entry, data model, API contracts, authenticated ownership checks, migrations, tests and product acceptance checklist.
2. **Accounts and social graph:** profile, follow/friend requests, blocks and privacy rules.
3. **Posts and feed:** create/read/edit/delete owned posts, media metadata, comments/reactions, pagination and reports.
4. **Direct and group messaging:** durable conversations/messages, unread counts, attachment metadata and delivery semantics.
5. **Realtime:** WebSocket/SSE transport, presence/typing, reconnection and durable catch-up. Do not fake realtime with static labels.
6. **Browser + download manager:** browser shell, permission-safe status import, supported-media detection, resumable downloads where servers support range requests, progress/error states, file management and offline playback. Do not bypass DRM, login walls or site restrictions.
7. **Media pipeline:** upload validation, object storage, thumbnails/transcoding, quotas and cleanup. Free Render ephemeral disk is not durable media storage.
8. **Video and creator features:** channels, subscriptions, playlists, history, short-video feed and captions.
9. **Professional network:** work profiles, jobs and applications.
10. **Safety and operations:** moderation queue, abuse controls, audit events, backup/restore, observability, accessibility and mobile testing.
11. **Release gates:** automated unit/integration tests, migration checks, authorization tests, dependency/security scan, deployment health, and real Android browser end-to-end checks before describing each feature as live.

## Non-negotiable constraints
- Prefer open-source and self-hosted components; no paid media/API provider should be called without explicit configuration and clear cost disclosure.
- Never store plaintext passwords, session secrets or provider tokens in social records.
- Every private resource must enforce ownership and block/privacy checks server-side.
- Uploads must be size/type checked, safely named, and scanned where practical.
- Use pagination and rate limits; do not load entire feeds/messages at once.
- User content must not be exposed publicly by default.
- Use original branding; integrate external platforms only through documented APIs and user-authorized OAuth.
- Never claim an app is equivalent to WhatsApp, Facebook, YouTube, LinkedIn, Instagram, TikTok, Threads or Phoenix merely because the navigation exists.

## Current status
- The IRHCF main dashboard exists and the backend has PostgreSQL schema initialization, authenticated routes, task orchestration and media modules.
- This roadmap is a plan, not evidence that the social features above already work.
- The first implementation PR adds a discoverable workspace entry and this acceptance roadmap. Persistent social APIs, realtime delivery, media storage, and production end-to-end tests remain subsequent work.
