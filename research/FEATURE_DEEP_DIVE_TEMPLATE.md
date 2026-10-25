# Feature Deep-Dive Template

Use this before implementation and update it as the feature changes. A feature is not complete merely because a UI button or API route exists.

## 1. Identity and hierarchy
- Platform / main domain:
- Main feature:
- Sub-features:
- Sub-sub-features/actions:
- Owner/roles:
- Route/API:
- Parent dashboard and feature dashboard:
- Dependencies and downstream features:

## 2. Research requirement (minimum six distinct relevant source sites)
Record at least six current sources from distinct websites/products. Count distinct sites, not the number of URLs on one provider's documentation domain. Prefer official documentation for API and permission claims. Do not copy feature names without testing feasibility.

| Source/product | Exact page or evidence | Capability pattern | Limitations/cost/permissions | What IRHCF adopts or rejects |
|---|---|---|---|---|
| Source 1 | URL | | | |
| Source 2 | URL | | | |
| Source 3 | URL | | | |
| Source 4 | URL | | | |
| Source 5 | URL | | | |
| Source 6 | URL | | | |

Add more sources where the feature spans multiple products, regions, provider APIs or safety/legal constraints.

## 3. Synthesis and product contract
- User problem and primary workflow:
- What competitors do well:
- What they do poorly or cannot do:
- IRHCF differentiator:
- Capabilities supported natively:
- Capabilities requiring external provider approval:
- Explicitly unavailable or out-of-scope behavior:
- Cost/quota and free/self-hosted fallback:
- Privacy, legal and abuse constraints:

## 4. Deep hierarchy and dashboard placement
Define the hierarchy explicitly: platform → main domain → main feature → sub-feature → sub-sub-feature → action.
For each leaf action, record its route, permission, inputs, outputs, state machine, dependencies, dashboard location and failure behavior.
Keep the main dashboard focused on workspaces, global search, pinned/recent items and genuine attention items. Put detailed controls and activity tabs inside the relevant workspace.

## 5. Data and security
- Authenticated owner/participant:
- Server-side ownership enforcement:
- Roles and permissions:
- Input/schema/file validation:
- Rate limiting and abuse controls:
- Idempotency, deduplication and concurrency:
- Data retention/deletion/export:
- Audit logging and secrets:
- SSRF/CSRF/XSS/upload risks where relevant:

## 6. State machine and failure handling
Define real states, allowed transitions, terminal states and retry policy. Do not fake progress. Every failed action must show a useful error, preserve logs, and expose repair/retry only when safe.

## 7. Tests and evidence
- Unit tests:
- Integration tests:
- Account-isolation/authorization tests:
- Concurrency/idempotency/replay tests:
- Accessibility/mobile tests:
- Provider sandbox/live smoke tests:
- Actual output/artifact verification:
- Known limitations and evidence links:

## 8. Definition of done
- [ ] At least six distinct websites/products researched and recorded.
- [ ] Feature hierarchy, route and dashboard location are defined.
- [ ] All visible actions work or are clearly disabled with a reason.
- [ ] Backend ownership, authorization, validation and rate limits are tested.
- [ ] Failure/retry, concurrency and data-retention paths are tested.
- [ ] Real output/state evidence is available; no fake completion.
- [ ] Mobile, accessibility and language behavior are checked.
- [ ] Costs, provider permissions, quotas and unsupported actions are disclosed.
- [ ] CI passes and the deployed end-to-end workflow is verified where applicable.
