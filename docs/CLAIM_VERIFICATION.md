# IRHCF Claim Verification

## Purpose

The claim-verification stage reviews individual factual claims in an AI answer against supplied source excerpts. It is model-assisted evidence assessment, not a guarantee that a source or claim is true.

## Verdicts

- `supported`: at least one supplied excerpt explicitly supports the claim, and no supplied excerpt is assessed as contradicting it.
- `contradicted`: at least one supplied excerpt explicitly conflicts with the claim, and the model has not also identified a supporting excerpt.
- `insufficient_evidence`: supplied excerpts do not establish the claim, source relationships are missing or invalid, or the sources contain conflicting directions.

If an excerpt both supports and contradicts the same claim across different sources, the engine preserves both per-source assessments and downgrades the overall claim status to `insufficient_evidence`, adding `CONFLICTING_SOURCE_EVIDENCE`. This means more evidence or human review is needed; it does not mean the claim is false.

## Evidence requirements

A URL or source ID is provenance, not proof. The verifier requires source-specific excerpts and an explicit relationship (`supports`, `contradicts`, or `context_only`) before accepting a support/contradiction verdict. URLs must be HTTP(S), must not contain embedded credentials, and are normalized without fragments. Source references are limited to the supplied source set.

Gemini grounding currently supplies source URLs but not necessarily page-specific excerpts. Those URLs can establish research provenance, but the claim verifier must not pretend a general research summary is an excerpt from every listed page. The live flow therefore assesses only source-specific excerpts supplied by IRHCF Search or other eligible evidence adapters.

## Live answer flow

For tasks marked as requiring current/external research, `backend/server.js`:
1. gathers live research and supplementary IRHCF Search evidence;
2. generates the initial answer;
3. asks the configured AI provider to assess atomic claims against eligible excerpts;
4. validates source IDs, per-source relationships, and statuses in `claim-verification-engine.js`;
5. requests a corrected answer when contradictions or insufficient evidence are found;
6. includes `agent.claimVerification` in the response metadata.

If the assessment call fails or no eligible excerpts exist, the response metadata records that the claim review was not completed. The application must not present that case as a successful verification.

## Tests

The unit tests in `backend/core/claim-verification-engine.test.js` cover atomic-claim instructions, source validation, missing evidence, source conflicts, status downgrades, and correction instructions. Run the repository test suite with `npm test` in an environment with the project dependencies installed. A successful commit does not itself prove the tests or production deployment succeeded.
