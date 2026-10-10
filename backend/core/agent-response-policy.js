"use strict";

const LIVE_RESEARCH_PATTERNS = [
  /\b(current|currently|latest|recent|today|tonight|this week|this month|this year|right now|as of now|up to date|breaking news|live score|exchange rate|currency rate|weather forecast|price of|prices of|cost of|president of|prime minister of|minister of|election results|exam results|official results|new law|latest law|law in force|current law|current regulations|market price|stock price|who won|who is the current)\b/i,
  /\b(amakuru agezweho|amakuru mashya|uyu munsi|ubu|muri iki gihe|igiciro|ibiciro|igiciro cy|igiciro cya|ivunjisha|ivunjisha ry|ifaranga|amafaranga y'ivunjisha|itegeko rishya|amategeko mashya|amategeko ariho|amatora|ibyavuye mu matora|ibisubizo by'ibizamini|ibiciro by'isoko|uwatsinze|ubu ni nde|minisitiri wa|perezida wa)\b/i,
  /\b(aujourd'hui|actuellement|dernières nouvelles|dernières informations|en ce moment|récemment|taux de change|cours de change|prix actuel|prix de|météo|résultats des élections|résultats d'examen|loi actuelle|loi récente|qui est le président actuel|qui a gagné)\b/i
];

function taskNeedsLiveResearch(task) {
  const text = String(task ?? "").replace(/\s+/g, " ").trim();
  if (!text) return false;
  return LIVE_RESEARCH_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Performs grounded live research through an injected, configured provider.
 * The provider is expected to return answer text plus Gemini grounding
 * metadata. No search is claimed unless the response includes source URLs.
 */
async function performLiveResearch(task, language = "en", researchProvider = null) {
  const unavailableMessages = {
    rw: "Ntabwo nshoboye kugenzura amakuru agezweho kuko nta search provider iboneka ubu. Sinshaka kuguha amakuru nshingiye ku gukeka.",
    fr: "Je ne peux pas vérifier les informations actuelles car aucun fournisseur de recherche n'est disponible pour le moment. Je préfère ne pas deviner.",
    en: "I cannot verify current information because no live-search provider is available right now. I will not guess or present unverified information as fact."
  };

  const unavailable = (reason = "LIVE_RESEARCH_PROVIDER_UNAVAILABLE") => ({
    required: true,
    performed: false,
    reason,
    sources: [],
    context: "",
    answer: unavailableMessages[language] || unavailableMessages.en
  });

  if (typeof researchProvider !== "function") {
    return unavailable();
  }

  try {
    const response = await researchProvider({ task, language });
    const answer = String(
      response?.choices?.[0]?.message?.content || ""
    ).trim();
    const grounding = response?.__geminiGroundingMetadata || {};
    const chunks = Array.isArray(grounding.groundingChunks)
      ? grounding.groundingChunks
      : [];

    const seenUrls = new Set();
    const sources = chunks.map((chunk) => {
      const web = chunk?.web || {};
      const url = normalizeSourceUrl(web.uri);
      if (!url || seenUrls.has(url)) return null;
      seenUrls.add(url);
      let publisher = "";
      try {
        publisher = new URL(url).hostname.replace(/^www\./, "");
      } catch {}
      return {
        title: normalizeText(web.title || publisher || url, 300),
        url,
        publisher,
        type: "search_result",
        publishedAt: null,
        retrievedAt: new Date().toISOString()
      };
    }).filter(Boolean);

    if (!answer || !sources.length) {
      return unavailable("LIVE_RESEARCH_NO_GROUNDED_SOURCES");
    }

    const sourceList = sources.map((source, index) =>
      `[${index + 1}] ${source.title} — ${source.url}`
    ).join("\n");

    return {
      required: true,
      performed: true,
      reason: "GEMINI_GOOGLE_SEARCH_GROUNDING",
      sources,
      context: [
        "LIVE WEB RESEARCH RESULT",
        answer,
        "",
        "GROUNDED SOURCES",
        sourceList,
        "",
        "Treat the sources as evidence and cross-check important claims."
      ].join("\n"),
      answer
    };
  } catch (error) {
    return unavailable(
      error?.code || "LIVE_RESEARCH_PROVIDER_ERROR"
    );
  }
}

function normalizeSourceUrl(value) {
  const raw = normalizeText(value, 1000);
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function buildResponseQualityInstruction(language = "en", task = "") {
  const languageNames = {
    rw: "Kinyarwanda",
    fr: "French",
    en: "English"
  };
  const requestedLanguage = languageNames[language] || "the language used by the user";

  return [
    "RESPONSE QUALITY AND HONESTY POLICY",
    "- Answer the user's actual request directly and keep the response relevant.",
    "- Use clear, natural language and practical steps when useful.",
    `- Respond in ${requestedLanguage}, unless the user explicitly requests another language.`,
    "- Do not claim to have browsed, tested, deployed, uploaded, sent, or changed anything unless that action actually occurred.",
    "- Do not invent facts, sources, tool results, or capabilities. State uncertainty and limitations clearly.",
    "- For current or externally changing facts, rely only on verified research evidence. If evidence is unavailable, say so rather than guessing.",
    "- If the request is ambiguous, ask one concise clarifying question instead of making a risky assumption.",
    "- Preserve user data and prioritize safe, reversible actions.",
    `CURRENT TASK: ${String(task ?? "").replace(/\s+/g, " ").trim().slice(0, 1200)}`
  ].join("\n");
}

/**
 * Apply a minimal, deterministic response-quality gate before verification.
 * The AI response must be non-empty plain text; never leak provider objects.
 */
function verifyAgentResponse(task, answer, language = "en") {
  const normalizedAnswer = typeof answer === "string" ? answer.trim() : "";
  const issues = [];

  if (!normalizedAnswer) {
    issues.push("EMPTY_RESPONSE");
  }

  return {
    valid: issues.length === 0,
    task: String(task ?? "").trim(),
    language: ["rw", "fr", "en"].includes(language) ? language : "en",
    issues
  };
}

function applyResponseQuality(rawAnswer, task) {
  const language = require("./language-detection").detectAgentLanguage(task);
  const answer = typeof rawAnswer === "string" ? rawAnswer.trim() : "";

  if (answer) {
    return { answer, language, passed: true, issues: [] };
  }

  const fallbackMessages = {
    rw: "Mbabarira, sinashoboye gutanga igisubizo kuri ubu. Ongera ugerageze.",
    fr: "Désolé, je n’ai pas pu générer une réponse pour le moment. Veuillez réessayer.",
    en: "Sorry, I couldn't generate a response just now. Please try again."
  };

  return {
    answer: fallbackMessages[language] || fallbackMessages.en,
    language,
    passed: false,
    issues: ["EMPTY_AI_RESPONSE"]
  };
}

module.exports = {
  taskNeedsLiveResearch,
  performLiveResearch,
  buildResponseQualityInstruction,
  applyResponseQuality,
  verifyAgentResponse
};
