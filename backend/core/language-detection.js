"use strict";

/**
 * Detect the language used in a user task.
 *
 * This deliberately uses lightweight lexical signals rather than a remote
 * service, so chat can continue when no language-detection provider exists.
 * Supported return codes match the language-specific response handling in
 * backend/server.js: rw (Kinyarwanda), fr (French), and en (English/default).
 */
function detectAgentLanguage(input) {
  const text = String(input ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "en";

  const scores = {
    rw: [
      " muraho ", " amakuru ", " uraho ", " ndashaka ", " ndakwinginze ", " umfasha ", " ndifuza ",
      " mbwira ", " mfasha ", " urakoze ", " yego ", " oya ", " gute ",
      " iki ", " iki? ", " iki ", " ikihe ", " gute ", " kubera iki ",
      " ese ", " nkeneye ", " nshaka ", " ndifuza ", " kinyarwanda ",
      " ikinyarwanda ", " gukora ", " ikibazo ", " igisubizo ",
      " urubuga ", " konti ", " amafaranga ", " ndabinginze ", " byagenda ",
      " tubikore ", " birakora ", " birakunze ", " heza ", " ndi "
    ],
    fr: [
      " bonjour ", " salut ", " merci ", " s'il vous plaît ", " svp ",
      " comment ", " pourquoi ", " pouvez-vous ", " aide-moi ", " aidez-moi ",
      " je veux ", " je voudrais ", " j'ai besoin ", " est-ce que ",
      " qu'est-ce que ", " où ", " quand ", " avec ", " pour ", " dans ",
      " français ", " créer ", " corriger ", " problème ", " réponse ",
      " veuillez ", " faites ", " expliquez ", " aujourd'hui ", " demain "
    ],
    en: [
      " hello ", " hi ", " please ", " thank you ", " can you ", " could you ",
      " help me ", " i need ", " i want ", " how do ", " what is ", " why ",
      " where ", " when ", " explain ", " create ", " build ", " fix ",
      " problem ", " answer ", " english ", " tell me ", " do this ", " make "
    ]
  };

  const padded = ` ${text} `;
  const count = (words) => words.reduce(
    (total, word) => total + (padded.includes(word) ? 1 : 0),
    0
  );

  const ranked = Object.entries(scores)
    .map(([language, words]) => ({ language, score: count(words) }))
    .sort((a, b) => b.score - a.score);

  // Return English when the text is too short or has no reliable signals.
  if (ranked[0].score === 0) return "en";
  if (ranked[0].score === ranked[1].score) return "en";
  return ranked[0].language;
}

module.exports = { detectAgentLanguage };
