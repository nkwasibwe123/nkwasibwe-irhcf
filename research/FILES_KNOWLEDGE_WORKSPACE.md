# Files & Knowledge Workspace — Research Record

Status: researched baseline. Search/indexing, extraction and storage must be evaluated separately; a file being uploaded does not mean its contents are indexed or searchable yet.

## Sources reviewed

1. OpenAI File Search — upload files to vector stores, wait for indexing completion, perform semantic/keyword retrieval, filter by metadata and return source references: https://developers.openai.com/api/docs/guides/tools-file-search
2. OpenAI Retrieval guide — vector stores, automatic chunking/embedding/indexing, hybrid ranking and storage pricing: https://developers.openai.com/api/docs/guides/retrieval
3. Microsoft Graph driveItem content — authenticated download, least-privilege permissions, eTag handling and temporary preauthenticated URLs: https://learn.microsoft.com/en-us/graph/api/driveitem-get-content?view=graph-rest-1.0
4. Mozilla Readability — article extraction and metadata; extracted HTML is not automatically sanitized: https://github.com/mozilla/readability
5. Telegram Bot API getFile — provider-specific file IDs, download URL lifetime and size limits: https://core.telegram.org/bots/api
6. OWASP File Upload Cheat Sheet — server-side validation, storage separation, size limits and safe file handling: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html

## Synthesis for Nkwasibwe

- Separate upload, durable storage, text/media extraction, indexing, retrieval, preview, sharing and deletion into distinct lifecycle states.
- Store ownership, MIME type, size, checksum, detected file type, created/updated timestamps, retention deadline, indexing status and extraction errors as metadata.
- Use server-generated storage keys; do not trust client paths, filenames or MIME declarations. Detect actual file type and bound bytes, pages, image dimensions, archive expansion and processing time.
- Enforce account and sharing permissions on every preview, download, search result and extracted chunk. A vector-store hit must still be checked against the file's current ACL before showing evidence.
- Keep raw uploads separate from sanitized preview content. Never render untrusted HTML directly; sanitize extracted HTML and use a safe content-security policy.
- Track index status explicitly: uploaded, scanning, extracting, indexing, ready, failed or deleted. Do not show a file as searchable until indexing actually completes.
- Keep provenance from extracted chunks to the source file, page/section, extraction version and checksum so answers can cite where evidence came from.
- Allow users to search their own files, filter by folder/tag/type/date and compare documents without exposing other users' files.
- For connected cloud providers, use OAuth with least privilege, secure token storage, disconnect/revocation and provider-specific permission scopes.
- Use eTags/checksums to detect changes and avoid duplicate indexing. When a file changes or is deleted, invalidate stale chunks and cached answers.
- Make retention, quota, deletion and recovery behavior visible. Deleting a file should also remove derived indexes and previews according to the retention policy.
- Treat OCR, PDF parsing and archive extraction as resource-intensive and untrusted. Apply page/size/time limits and record partial extraction clearly.
- Track storage/indexing cost and provider limits; prefer local parsing/search where feasible and disclose when hosted indexing can incur charges.

## Acceptance criteria

1. Upload validates size, MIME and actual file signature; unsupported or malformed files fail with a stable error code.
2. Every file, preview, extracted chunk and download is scoped to the owner or an explicit share permission.
3. Indexing state is persisted and searchable only after verified completion.
4. Search results expose source filename and location/page, with citation links back to the source file.
5. Updated files invalidate stale index entries; deleted files and their derived chunks are removed.
6. Preview/download uses safe headers and never renders untrusted HTML without sanitization.
7. Tests cover cross-account access, MIME spoofing, oversized files, corrupt PDFs, archive bombs, parser timeout, duplicate uploads, indexing failure, stale cache and deletion propagation.
8. Connected cloud files honor provider permissions and token revocation.
9. Retention/quota limits and any hosted indexing costs are visible to the user.
