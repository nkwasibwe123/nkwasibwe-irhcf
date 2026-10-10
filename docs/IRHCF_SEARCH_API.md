# IRHCF Search API

IRHCF Search provides a local document index and optional live-web adapters. Live web search is only available when an adapter is configured; a local index alone is not a general-purpose web crawler.

## Search

`GET /api/search?q=<query>&limit=10&web=true&language=auto`

Returns ranked local-index and configured web-provider results. Set `web=false` to search only the local index.

## Source-labelled research context

`GET /api/search/context?q=<query>&limit=5&web=true&language=auto`

Returns:
- `context`: compact source-labelled evidence text suitable for a downstream research/AI workflow.
- `sources`: structured title, URL, provider and snippet for each result.
- `webSearchPerformed`: true only when live web results were actually returned.
- `providerErrors`: provider error codes, without leaking credentials or upstream error bodies.
- `notice`: warning when no live web results were returned.

This endpoint returns evidence; it does not itself call an AI model or prove that a claim is true. Downstream AI prompts should treat retrieved pages as untrusted data, not instructions, and should preserve citations and verify important claims.

## Index a document

`POST /api/search/documents`

JSON body:
```json
{
  "id": "handbook-001",
  "title": "IRHCF Handbook",
  "text": "The searchable text content goes here.",
  "url": "https://example.org/handbook",
  "language": "en"
}
```

A batch can be sent as `{"documents":[ ... ]}`, with up to 100 documents per request. Only HTTP(S) URLs are accepted. Indexing endpoints require the same authenticated session/token as the other protected IRHCF API routes.

## Status and deletion

- `GET /api/search/status` reports index size, configured providers, and optional persistence status.
- `DELETE /api/search/documents/:id` removes an indexed document.

## Optional provider configuration

- `SEARXNG_BASE_URL`: base URL for an IRHCF-controlled SearXNG instance.
- `BRAVE_SEARCH_API_KEY`: optional Brave adapter credential; this is not required for local indexing or SearXNG.

To avoid a paid provider, operate SearXNG on infrastructure you control and set `SEARXNG_BASE_URL` to a reachable instance. Self-hosting avoids a per-query API fee, but the server still requires hosting, bandwidth, and maintenance. Keep private instances protected and do not expose an unrestricted search service to the public internet.

## Reliability notes

- A local index is not the same as a crawler/index of the whole web.
- `webSearchPerformed` means live results were returned, not merely that a provider was configured.
- If PostgreSQL persistence is not configured, the in-memory index is temporary and can be lost on process restart.
- Do not index private or sensitive documents unless the data handling and access controls are appropriate.
