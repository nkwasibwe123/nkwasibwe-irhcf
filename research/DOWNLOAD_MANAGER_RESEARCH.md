# Download Manager / Media Saver — Research Record

Status: researched baseline. This feature must distinguish direct file downloads, user-provided files and officially authorized platform integrations from restricted or DRM-protected content.

## Sources reviewed

1. Android DownloadManager — system-managed downloads, network constraints, notifications, destination handling and completion status: https://developer.android.com/reference/android/app/DownloadManager
2. Chrome Downloads API — download creation, progress state, pause/resume, interruption reasons and download history: https://developer.chrome.com/docs/extensions/reference/api/downloads
3. yt-dlp project documentation — supported public media sources, format selection, output templates, network retries and external downloader options: https://github.com/yt-dlp/yt-dlp
4. Telegram Bot API — file IDs, file retrieval, download URL lifetime and provider-specific size limits: https://core.telegram.org/bots/api
5. FFmpeg documentation — media probing, remuxing, transcoding, format selection and stream processing: https://ffmpeg.org/ffmpeg.html
6. OWASP File Upload Cheat Sheet — validating downloaded files, limiting size and storing untrusted content safely: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html

## Synthesis for Nkwasibwe

- Separate download creation, URL validation, transfer, resume/retry, integrity verification, media metadata, optional conversion and final delivery into distinct states.
- Support direct links and user-authorized/public content where access is permitted. Use official APIs and OAuth for connected platforms; do not bypass DRM, paywalls, authentication, or technical access controls.
- Validate the initial URL and every redirect. Allow only approved schemes and public destinations; block local/private-network destinations and cloud metadata endpoints.
- Send network requests with bounded connect/read timeouts, maximum bytes, redirect limits and per-user concurrency limits.
- Persist the task ID, user ownership, source URL, content length, received bytes, ETag/Last-Modified, retry count, last error and destination artifact reference.
- Resume only when the server supports byte ranges and validators match; otherwise restart safely. Use idempotent task creation to prevent duplicate downloads after refresh/retry.
- Verify final byte count and checksums where available; inspect actual file signatures rather than trusting the URL extension or response MIME.
- Keep filenames safe: remove path separators/control characters, normalize extensions and generate a unique storage name. Never use the URL path directly as a filesystem path.
- Provide truthful progress from bytes received and known content length; if length is unknown, show indeterminate progress rather than a fabricated percentage.
- Support pause/resume/cancel, interrupted-state explanations, retryable vs permanent errors, and cleanup of partial files after retention expiry.
- If media conversion is requested, run FFmpeg with argument arrays, resource limits and a timeout; do not interpolate untrusted input into a shell command.
- Display format/quality options only when the source actually exposes them. Provider restrictions, cookies/login requirements and unsupported sites should be explicit, not silently worked around.
- Protect against duplicate or malicious content with file-type validation, size limits, optional scanning and safe preview/download headers.
- Show provider-specific terms and rights reminders; do not promise access to every social app or every video URL.

## Acceptance criteria

1. Download tasks persist and survive refresh; each task is isolated to the authenticated user.
2. URL validation blocks unsupported schemes, unsafe destinations and redirects to blocked destinations.
3. Progress reflects real transferred bytes; pause, resume, cancel and retry state is accurate.
4. Interrupted downloads resume only when range/validator support is confirmed; integrity is checked before success.
5. Output names and paths cannot traverse directories; file type and size are verified.
6. Conversion runs in a bounded process and the converted output is validated before delivery.
7. Tests cover expired URLs, redirects, no content length, range mismatch, repeated requests, timeout, cancellation, malformed content, oversized downloads and cross-account access.
8. Platform integrations use documented/authorized APIs and do not bypass DRM or access controls.
