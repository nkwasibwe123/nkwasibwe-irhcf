# Chat & Personal Assistant — Research Record

Status: researched baseline. Provider documentation describes capabilities, but availability, latency, cost, regional access and data-retention terms must be verified for the actual account and configuration.

## Sources reviewed

1. OpenAI Responses API overview — stateful interactions, text/image inputs, tools, file/web search and function calling: https://developers.openai.com/api/reference/responses/overview
2. OpenAI Realtime conversations — streaming sessions, conversation state and out-of-band responses: https://developers.openai.com/api/docs/guides/realtime-conversations
3. Anthropic API overview — Messages API, authentication, SDKs, rate limits and platform access: https://platform.claude.com/docs/en/api/overview
4. Anthropic streaming guide — server-sent events, incremental text/tool events and recovery after interrupted streams: https://platform.claude.com/docs/en/build-with-claude/streaming
5. Google Gemini API documentation — text, image, audio/video, tools, structured outputs and managed agent capabilities: https://ai.google.dev/gemini-api/docs
6. Gemini function-calling guide — structured tool arguments, application-side execution, conversation history and signature handling: https://ai.google.dev/gemini-api/docs/generate-content/function-calling
7. Mistral Agents & Conversations — persistent conversation objects, history, entries and access ownership: https://docs.mistral.ai/studio/agents/agents-api
8. Mistral function calling — JSON-schema tool definitions, application-side execution and bounded parallel tool calls: https://docs.mistral.ai/studio/agents/agent-tools/function-calling
9. OWASP LLM Prompt Injection Prevention — least-privilege tools, input separation, output validation, human approval and security testing: https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html

## Synthesis for Nkwasibwe

- Separate conversation storage from model-provider calls. Persist user messages, assistant messages, tool calls, tool results, attachments, timestamps and error states as distinct records.
- Keep conversation ownership server-enforced. Every read, edit, rename, archive, delete, export and attachment request must verify that the authenticated user owns the conversation.
- Use a provider adapter interface for message creation, streaming, tool calls, image/audio input and usage metadata. Do not couple the UI to one provider's event format.
- Normalize streaming into a stable internal event schema such as message-start, text-delta, tool-start, tool-result, message-complete, interrupted and failed. Reconcile partial output when a stream disconnects.
- Preserve provider-specific continuation fields and tool-call IDs when needed. Do not fabricate a completed answer from a partial stream.
- Execute tools in application code only after validating tool names and arguments against a strict schema and checking authorization. A model-generated tool call is a request, not permission to perform the action.
- Require explicit confirmation for deployment, publishing, payments, destructive changes or external side effects. Use idempotency for actions that may be retried.
- Keep provider secrets server-side; never return API keys or raw credentials to the browser or log them in errors.
- Use context selection and truncation with clear rules. Keep conversation summaries separate from verbatim history and show the user when context is summarized or omitted.
- Detect the user's message language separately from the interface language. Interface labels follow selected settings; response language follows the actual message unless the user explicitly overrides it.
- Handle provider rate limits, missing credentials, unavailable models, content restrictions and timeouts with stable error codes and user-readable recovery steps. Do not retry exhausted quotas indefinitely.
- Treat external pages, uploaded documents and retrieved memory as untrusted content, not as higher-priority instructions. Apply least privilege and validate outputs before rendering HTML or executing tool results.
- Keep reasoning/internal orchestration separate from user-visible activity. Show only observed task states and useful progress, not simulated “thinking” or invented agent activity.
- Record usage and cost metadata when available; let users choose a lower-cost/local path where possible and disclose when an operation may incur provider charges.

## Acceptance criteria

1. User and assistant messages remain distinct and conversation history survives refresh and restart.
2. Every conversation, message, attachment and export operation is isolated to its authenticated owner.
3. Provider streaming renders incrementally and handles completion, interruption, cancellation, retries and errors without duplicate messages.
4. Tool calls validate schema, allowlist, user authorization and approval requirements before execution.
5. Provider adapters normalize results and preserve required provider continuation/tool-call metadata.
6. UI language and response language follow the separate rules described above.
7. Missing API key, rate limit, quota exhaustion, unsupported model and provider outage each produce a truthful status and safe next step.
8. Attachments show actual previews when supported, validate size/type, and are retrievable only by their owner.
9. External content cannot override application instructions or grant itself access to tools or private data.
10. Tests cover stream disconnects, partial responses, duplicate tool events, invalid tool arguments, unauthorized conversations, prompt injection, output sanitization, language switching and provider failure.

## Additional official source reviewed — 2026-10-25

- **Cohere Chat API** — https://docs.cohere.com/docs/chat-api — documents role-based multi-turn conversations and a conversational generation API. Related tool-use guidance covers function calls, multi-step tool execution and citation-bearing results. IRHCF should preserve structured user/assistant/tool roles, stream partial output safely, validate tool arguments, and keep provider/model differences behind a common adapter.
