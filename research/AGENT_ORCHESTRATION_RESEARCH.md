# Agents & Automation — Research Record

Status: researched baseline. Runtime and production scale are not verified by this document.

## Sources reviewed

1. OpenAI Agents SDK — runtime, tools, state, sandboxing and multi-step work: https://developers.openai.com/api/docs/guides/agents/sdk
2. OpenAI agent definitions — specialist responsibilities, tools and structured outputs: https://developers.openai.com/api/docs/guides/agents/define-agents
3. OpenAI orchestration and handoffs — manager-owned work versus specialist handoffs: https://developers.openai.com/api/docs/guides/agents/orchestration
4. OpenAI guardrails and human review — input/output validation and approval gates: https://developers.openai.com/api/docs/guides/agents/guardrails-approvals
5. OpenAI integrations and observability — traces for model/tool calls, handoffs and guardrails: https://developers.openai.com/api/docs/guides/agents/integrations-observability
6. Temporal durable execution — persisted workflow history and recovery after failure: https://docs.temporal.io/temporal
7. BullMQ concurrency — concurrency differs from CPU parallelism and should be tuned to workload: https://docs.bullmq.io/guide/parallelism-and-concurrency
8. BullMQ retries — bounded attempts and explicit backoff: https://docs.bullmq.io/guide/retrying-failing-jobs
9. CrewAI agent concepts — separate roles, tasks, teams and process management: https://docs.crewai.com/core-concepts/Agents
10. Microsoft AutoGen repository — states maintenance mode and recommends Microsoft Agent Framework for new projects: https://github.com/microsoft/autogen

## Synthesis for Nkwasibwe

- One orchestrator owns the overall goal, acceptance criteria and user-facing result. Specialists return typed results; they should not compete to answer the user.
- Every agent has a stable ID, narrow responsibility, allowed tools, input/output schema, budget/time limits, retry policy and artifact ownership.
- Use dependency-aware task graphs. Independent research and checks may run concurrently; dependent stages wait for prerequisites. Avoid parallel writes to the same file without a merge strategy.
- Agent count is not a quality metric. Raise concurrency only when compute, database capacity, provider quotas and isolation support it.
- Persist task state, attempts, worker lease, phase, timestamps, error codes and artifact references. Recover expired leases and close orphaned run records.
- Progress events must reflect actual state transitions or observed tool results. Never infer “thinking/coding/done” from elapsed time.
- Bound retries and use backoff. A repair is successful only after the previously failing verification passes.
- Require explicit approval before deployment, external publishing, financial actions, destructive changes or other irreversible operations.
- Run untrusted code in a sandbox with allowlists, timeouts, resource limits, secret isolation and cleanup. Never execute user code inside the public web request process.
- Record useful traces while redacting secrets and unnecessary personal data. Use idempotency for retried external operations.
- Treat provider quotas, missing credentials, timeouts, cancellation and sandbox unavailability as explicit blocked/failed states, never as fabricated progress.

## Acceptance criteria

1. Each task has a stable ID, owner, goal, expected deliverables and acceptance checks.
2. The orchestrator records why a specialist is assigned and what it returns.
3. Parallel work declares dependencies and avoids conflicting artifact writes.
4. State survives refresh and worker restart; stale leases recover safely.
5. Every progress event includes a timestamp and actual state evidence.
6. Retries are bounded; repair claims require successful re-verification.
7. Sensitive actions pause for approval; retried external actions are idempotent where applicable.
8. Tests cover concurrency, cancellation, stale recovery, duplicate delivery, failed repair, tool timeout, account isolation and truthful activity rendering.
9. Completion requires the configured verifier and expected artifacts; agent self-report alone is insufficient.

## Additional official source reviewed — 2026-10-25

- **LangGraph reference** — https://langchain-ai.github.io/langgraph/reference/ — documents long-running, stateful agent orchestration, durable execution, streaming, persistence and human-in-the-loop controls. IRHCF should use explicit checkpoints, resumable state and approval gates for long-running multi-agent tasks rather than launching unbounded parallel agents.
