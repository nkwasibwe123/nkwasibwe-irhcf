# Nkwasibwe IRHCF — self-hosted web search (no paid search API)

IRHCF Search can use a SearXNG instance that you operate yourself. This avoids a per-query Brave API bill, but it does not mean hosting is cost-free: you still need a machine with storage, memory, and internet access. You can start on a computer you control before deciding whether to host it publicly.

## 1. Start a private SearXNG instance

Use the official SearXNG container setup guide:
https://docs.searxng.org/admin/installation-docker.html

Use Docker Compose as described in that guide. Keep the instance private while testing; do not expose port 8080 directly to the public internet. Generate a strong unique SearXNG secret key and configure rate limiting before any shared/public deployment.

SearXNG must allow JSON search responses. In its settings, ensure `search.formats` includes `json`. Confirm locally that this request returns JSON before connecting IRHCF:

```text
http://127.0.0.1:8080/search?q=test&format=json
```

## 2. Configure IRHCF backend

Set the following server-side environment variable for the IRHCF backend:

```text
SEARXNG_BASE_URL=http://127.0.0.1:8080
```

This example works only if IRHCF and SearXNG can reach each other at that address. If they run in separate containers, use the SearXNG service name on a shared private Docker network. If IRHCF is hosted on a different platform, `127.0.0.1` points to the IRHCF container itself, not your personal computer; configure a reachable private endpoint instead.

Do not set `BRAVE_SEARCH_API_KEY` if you want to avoid using the paid Brave API. The self-hosted adapter is selected from `SEARXNG_BASE_URL`.

## 3. Check the integration

After deploying the backend, authenticate and request:

- `GET /api/search/status` — reports configured providers.
- `GET /api/search?q=your%20query` — runs a search.

These IRHCF endpoints require the existing authentication token. The self-hosted provider returns normalized titles, HTTP(S) URLs, and snippets. Results depend on which upstream search engines SearXNG can access; it is a metasearch engine, not a complete independent index like Google.

## Important limits

- No Brave API subscription is required for this path.
- A public or always-on deployment may still cost money for compute, storage, domain, and bandwidth. To avoid hosting bills, test on your own computer, understanding that search is available only while it is running.
- Respect upstream search engines' terms, robots rules, copyright, and rate limits. Do not crawl sites aggressively.
- This document describes configuration; it does not claim that SearXNG has already been deployed or that the live endpoint has been tested.
