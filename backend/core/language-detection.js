"use strict";

/**
 * Lightweight offline language detector for chat response routing.
 * Script detection is preferred for languages with distinctive scripts;
 * common-word scoring handles Kinyarwanda, English, French, Kiswahili and
 * other common Latin-script languages. Short/ambiguous inputs use English
 * as a neutral fallback; the model is also instructed to mirror the user's
 * actual message language rather than the interface locale.
 */
function detectAgentLanguage(input) {
  const userText = String(input ?? "").replace(
    /\s*\[Response language preference:[\s\S]*?\]\s*/gi,
    " "
  ).normalize("NFKC").trim();
  if (!userText) return "en";

  const scriptChecks = [
    ["zh", /[\u3400-\u4dbf\u4e00-\u9fff]/u],
    ["ja", /[\u3040-\u30ff]/u],
    ["ko", /[\uac00-\ud7af]/u],
    ["ar", /[\u0600-\u06ff\u0750-\u077f]/u],
    ["hi", /[\u0900-\u097f]/u],
    ["ru", /[\u0400-\u04ff]/u]
  ];
  for (const [language, pattern] of scriptChecks) {
    if (pattern.test(userText)) return language;
  }

  const text = " " + userText.toLowerCase()
    .replace(/[^\p{L}\p{N}'’\s]/gu, " ")
    .replace(/\s+/g, " ").trim() + " ";
  const lexicons = {
    rw: [" muraho ", " amakuru ", " ndashaka ", " ndakwinginze ", " umfasha ", " ndifuza ", " mbwira ", " mfasha ", " urakoze ", " yego ", " oya ", " gute ", " kubera iki ", " ese ", " nkeneye ", " nshaka ", " ikinyarwanda ", " gukora ", " ikibazo ", " igisubizo ", " urubuga ", " amafaranga ", " tubikore ", " birakora ", " ndi ", " nsubiza ", " unsobanurire ", " nyereka ", " ndagusaba ", " ndimo ", " ushobora ", " ni gute ", " ndashaka ko "],
    fr: [" bonjour ", " salut ", " merci ", " s il vous plaît ", " comment ", " pourquoi ", " pouvez-vous ", " aide-moi ", " aidez-moi ", " je veux ", " je voudrais ", " j ai besoin ", " est-ce que ", " qu est-ce que ", " où ", " quand ", " avec ", " pour ", " français ", " créer ", " corriger ", " problème ", " réponse ", " veuillez ", " expliquez ", " aujourd hui "],
    en: [" hello ", " hi ", " please ", " thank you ", " can you ", " could you ", " help me ", " i need ", " i want ", " how do ", " what is ", " why ", " where ", " when ", " explain ", " create ", " build ", " fix ", " problem ", " answer ", " tell me ", " do this ", " make ", " write ", " ask "],
    sw: [" habari ", " tafadhali ", " asante ", " naomba ", " ninataka ", " nataka ", " nisaidie ", " unaweza ", " kwa nini ", " jinsi ya ", " niambie ", " swahili ", " kiswahili ", " tafadhali nisaidie "],
    es: [" hola ", " gracias ", " por favor ", " quiero ", " necesito ", " puedes ", " cómo ", " qué ", " dónde ", " cuándo ", " ayuda ", " crear ", " explicar ", " español "],
    pt: [" olá ", " obrigado ", " obrigada ", " por favor ", " quero ", " preciso ", " você ", " como ", " porque ", " ajuda ", " português "],
    de: [" hallo ", " danke ", " bitte ", " ich möchte ", " ich brauche ", " kannst du ", " wie ", " warum ", " hilfe ", " deutsch "],
    it: [" ciao ", " grazie ", " per favore ", " vorrei ", " ho bisogno ", " puoi ", " come ", " perché ", " aiuto ", " italiano "],
    nl: [" hallo ", " bedankt ", " alsjeblieft ", " ik wil ", " ik heb nodig ", " help me ", " waarom ", " nederlands "],
    pl: [" cześć ", " dziękuję ", " proszę ", " chcę ", " potrzebuję ", " pomóż mi ", " dlaczego ", " polski "],
    tr: [" merhaba ", " teşekkürler ", " lütfen ", " istiyorum ", " bana yardım ", " nasıl ", " neden ", " türkçe "]
  };
  const ranked = Object.entries(lexicons).map(([language, words]) => ({
    language, score: words.reduce((n, word) => n + (text.includes(word) ? 1 : 0), 0)
  })).sort((a, b) => b.score - a.score);
  if (!ranked[0] || ranked[0].score === 0) return "en";
  if (ranked[0].score === ranked[1].score) return "en";
  return ranked[0].language;
}

module.exports = { detectAgentLanguage };
