"use strict";

/**
 * Extract assistant text from the response shapes used by supported AI providers.
 * Returns null for an absent/empty response instead of leaking provider objects
 * into the user-visible answer.
 */
function extractAIResponse(data) {
  if (data === null || data === undefined) return null;

  let response =
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.text ??
    data?.output_text ??
    data?.response ??
    data?.reply ??
    data?.result ??
    data?.answer ??
    data?.output ??
    data?.message?.content ??
    data?.data?.choices?.[0]?.message?.content ??
    data?.data?.output_text ??
    data?.data?.response ??
    data?.data?.reply ??
    data?.data?.result ??
    data?.data?.answer ??
    data?.data?.output ??
    data?.data?.message?.content ??
    data?.message;

  if (response === null || response === undefined) return null;

  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof response === "string") {
      const cleaned = response.trim();
      if (!cleaned) return null;

      const looksLikeJson =
        (cleaned.startsWith("{") && cleaned.endsWith("}")) ||
        (cleaned.startsWith("[") && cleaned.endsWith("]"));

      if (looksLikeJson) {
        try {
          const parsed = JSON.parse(cleaned);
          if (parsed && typeof parsed === "object") {
            if (Array.isArray(parsed)) {
              response = parsed;
              continue;
            }
            const nested =
              parsed.content ??
              parsed.text ??
              parsed.answer ??
              parsed.response ??
              parsed.output_text ??
              parsed.message?.content ??
              parsed.message;
            if (nested !== null && nested !== undefined) {
              response = nested;
              continue;
            }
          }
        } catch (_) {
          // Ordinary text that happens to start with a brace is still text.
        }
      }
      return cleaned;
    }

    if (Array.isArray(response)) {
      const parts = response
        .map((part) => {
          if (typeof part === "string") return part;
          if (typeof part?.text === "string") return part.text;
          if (typeof part?.content === "string") return part.content;
          if (typeof part?.text?.value === "string") return part.text.value;
          return "";
        })
        .filter(Boolean);
      return parts.join("\n").trim() || null;
    }

    if (typeof response === "object") {
      response =
        response.content ??
        response.text ??
        response.answer ??
        response.response ??
        response.output_text ??
        response.message?.content ??
        response.message ??
        null;
      if (response === null || response === undefined) return null;
      continue;
    }

    return String(response).trim() || null;
  }

  return typeof response === "string" ? response.trim() || null : null;
}

module.exports = { extractAIResponse };
