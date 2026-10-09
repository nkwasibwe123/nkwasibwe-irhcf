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
 * This deployment currently has no wired live-search adapter in the
 * research execution path. Report that limitation explicitly instead of
 * pretending to have searched or generating unverified current facts.
 */
async function performLiveResearch(task, language = "en") {
  const messages = {
    rw: "Ntabwo nshoboye kugenzura amakuru agezweho kuri ubu kuko uburyo bwo gushakisha amakuru kuri internet butarashyirwa mu mikorere ya IRHCF. Sinshaka kuguha amakuru nshingiye ku gukeka. Gerageza nyuma cyangwa unyohereze isoko y'amakuru ushaka ko nishingiraho.",
    fr: "Je ne peux pas vérifier les informations actuelles pour le moment, car la recherche Web en direct n'est pas encore connectée à IRHCF. Je préfère ne pas présenter une supposition comme un fait. Réessayez plus tard ou fournissez une source à vérifier.",
    en: "I cannot verify current information right now because live web search is not yet connected to IRHCF's research execution path. I will not present a guess as a verified fact. Please try again later or provide a source to check."
  };

  return {
    required: true,
    performed: false,
    reason: "LIVE_RESEARCH_PROVIDER_UNAVAILABLE",
    sources: [],
    context: "",
    answer: messages[language] || messages.en
  };
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
  applyResponseQuality
};
