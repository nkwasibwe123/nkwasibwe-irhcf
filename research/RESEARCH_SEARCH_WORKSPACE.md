# Research & Search Workspace — Research Record

Status: researched baseline. Provider availability, quotas and cost must be checked against the actual account configuration; public documentation does not guarantee access to a paid API.

## Sources reviewed

1. OpenAI Web Search guide — live search, query planning, domain filters, citation annotations, source lists and longer research workflows: https://developers.openai.com/api/docs/guides/tools-web-search
2. OpenAI tool integration guide — tool invocation, function calling, remote MCP integrations and structured tool outputs: https://developers.openai.com/api/docs/guides/tools
3. Brave Search API documentation — independent search index, freshness, snippets, news/images/local enrichments and LLM-context endpoint: https://api-dashboard.search.brave.com/app/documentation/web-search
4. Brave Search API pricing page — explicit request pricing, free monthly credits and throughput limits that must be surfaced to avoid surprise costs: https://brave.com/search/api/
5. Tavily Search API documentation — AI-oriented search results, search depth, domain filters, time range, raw content and usage information: https://help.tavily.com/articles/4840311948-tavily-search-api
6. Exa Search API reference — semantic retrieval, ranking, domain/category filters, freshness controls and optional content extraction: https://github.com/exa-labs/agent-skills/blob/main/skills/exa-search/SKILL.md
7. Google Search Central — crawling, indexing and result serving are distinct stages; indexing and result placement are not guaranteed: https://developers.google.com/search/docs/fundamentals/how-search-works
8. Mozilla Readability — article extraction, metadata and content parsing, with an explicit warning that extraction is not a sanitizer: https://github.com/mozilla/readability

## Synthesis for Nkwasibwe

- Separate query planning, provider search, page fetching, article extraction, source evaluation, claim verification, synthesis and final citation rendering into distinct steps.
- For a complex request, create multiple narrow sub-queries, inspect relevant pages, and continue searching only while important evidence gaps remain.
- Treat search snippets as discovery hints, not as complete evidence. Open the source page where possible and store the exact title, canonical URL, publication/update date, access time and extracted evidence used.
- Keep a provider adapter registry. Select only configured/healthy providers, use bounded timeouts and retries, and switch providers on transient outages. Do not claim that a provider is free or available merely because its public docs exist.
- Show provider quota/cost before paid operations where possible. Avoid retrying exhausted-credit responses; mark the task blocked and explain the requirement.
- Deduplicate URLs after canonicalization, but preserve the actual source URL and avoid collapsing materially different editions or dates.
- Rank by relevance, freshness, source authority and directness of evidence; do not let one search provider's ranking alone determine truth.
- Distinguish primary sources, independent reporting, opinion, commercial pages and user-generated content. Cross-check important or contested claims with independent sources.
- Preserve citations through summarization. Every factual claim that relies on web research should map to one or more inspected source IDs; never invent citations or fabricate a source URL.
- Use source-specific extraction with strict size/time limits. Treat fetched HTML and extracted text as untrusted input; sanitize rendered HTML, strip active content and protect against prompt injection embedded in pages.
- Protect against SSRF: block loopback, link-local, private-network and cloud metadata addresses; revalidate redirects and DNS/IP resolution; restrict protocols and bound response size.
- Store source provenance and evidence snippets so users can inspect why a conclusion was reached and regenerate a report after source changes.
- Support freshness controls such as “today/this week/this year,” but display source publication date separately from retrieval time.
- Make research outputs reproducible: question, scope, search queries, sources inspected, exclusions, conflicting evidence, uncertainty, conclusions and downloadable report should be recorded.
- A long-running research job should persist checkpoints and source references so it can resume after worker restart without fabricating progress.

## Acceptance criteria

1. Each research task records the user's question, scope, query plan, provider choices, source IDs and evidence gaps.
2. Search results display title, clickable URL, source date when available, snippet and provider/retrieval time.
3. Complex research inspects at least five distinct relevant sources and records why each source is useful; source count alone does not prove quality.
4. Important claims are supported by inspected sources, and conflicts or uncertainty are surfaced rather than hidden.
5. Every citation points to a real source record used in the response; no synthetic URLs or broken citation markers.
6. Provider outage, missing credentials, rate limit and quota exhaustion produce explicit states with safe fallback behavior.
7. Provider cost/credit use is observable; quota-exhausted requests are not retried indefinitely.
8. HTML extraction is bounded and sanitized; malicious page instructions cannot override the task or system policy.
9. SSRF tests cover localhost, private IP ranges, IPv6 loopback, cloud metadata hosts, DNS rebinding and redirects to blocked addresses.
10. Tests cover duplicate/canonical URLs, stale pages, conflicting claims, invalid dates, empty extraction, citation integrity, timeouts and resumed research jobs.
11. The user can export a report with source links, methodology, evidence, limitations and retrieval dates.

## Additional official source reviewed — 2026-10-25

- **Exa Search API reference** — https://docs.exa.ai/reference/search — provides an additional search-provider pattern for semantic retrieval. IRHCF should keep provider adapters interchangeable, store query and retrieval timestamps, deduplicate by canonical URL, and distinguish retrieved evidence from verified facts. Provider-specific ranking or excerpts must not silently replace source-level provenance.
