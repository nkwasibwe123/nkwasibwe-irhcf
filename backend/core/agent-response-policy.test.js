"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  taskNeedsLiveResearch,
  performLiveResearch,
  buildResponseQualityInstruction,
  applyResponseQuality,
  verifyAgentResponse
} = require("./agent-response-policy");

test("ordinary greetings and general questions do not require live research", () => {
  assert.equal(taskNeedsLiveResearch("Hi"), false);
  assert.equal(taskNeedsLiveResearch("How are you?"), false);
  assert.equal(taskNeedsLiveResearch("Explain what a website is"), false);
  assert.equal(taskNeedsLiveResearch("Muraho, umeze ute?"), false);
});

test("current-information requests require live research", () => {
  assert.equal(taskNeedsLiveResearch("Who is the current president of Rwanda?"), true);
  assert.equal(taskNeedsLiveResearch("What is the USD to RWF exchange rate today?"), true);
  assert.equal(taskNeedsLiveResearch("Mbwira amakuru agezweho"), true);
  assert.equal(taskNeedsLiveResearch("Quel est le taux de change actuel ?"), true);
});

test("research failure is explicit and never claims a search was performed", async () => {
  const result = await performLiveResearch("latest news", "rw");
  assert.equal(result.required, true);
  assert.equal(result.performed, false);
  assert.equal(result.reason, "LIVE_RESEARCH_PROVIDER_UNAVAILABLE");
  assert.deepEqual(result.sources, []);
  assert.match(result.answer, /Ntabwo nshoboye/);
});

test("live research uses grounded provider results and preserves source URLs", async () => {
  const result = await performLiveResearch(
    "Who is the current president of Rwanda?",
    "en",
    async ({ task, language }) => {
      assert.match(task, /current president/);
      assert.equal(language, "en");
      return {
        choices: [{ message: { content: "The grounded result says the office holder is X." } }],
        __geminiGroundingMetadata: {
          groundingChunks: [
            { web: { uri: "https://www.gov.rw/", title: "Government of Rwanda" } },
            { web: { uri: "https://www.gov.rw/", title: "Duplicate source" } },
            { web: { uri: "javascript:alert(1)", title: "Unsafe URL" } },
            { web: { uri: "https://www.reuters.com/world/", title: "Reuters" } }
          ]
        }
      };
    }
  );

  assert.equal(result.performed, true);
  assert.equal(result.reason, "GEMINI_GOOGLE_SEARCH_GROUNDING");
  assert.equal(result.sources.length, 2);
  assert.equal(result.sources[0].url, "https://www.gov.rw/");
  assert.match(result.context, /GROUNDED SOURCES/);
  assert.match(result.context, /Reuters/);
});

test("live research refuses to claim success without grounded source URLs", async () => {
  const result = await performLiveResearch(
    "latest news",
    "rw",
    async () => ({
      choices: [{ message: { content: "An unsupported answer." } }],
      __geminiGroundingMetadata: { groundingChunks: [] }
    })
  );

  assert.equal(result.performed, false);
  assert.equal(result.reason, "LIVE_RESEARCH_NO_GROUNDED_SOURCES");
  assert.deepEqual(result.sources, []);
  assert.match(result.answer, /Ntabwo nshoboye/);
});

test("response quality instruction includes language and truthfulness rules", () => {
  const instruction = buildResponseQualityInstruction("rw", "Mfasha");
  assert.match(instruction, /Kinyarwanda/);
  assert.match(instruction, /Do not invent facts/);
  assert.match(instruction, /CURRENT TASK: Mfasha/);
});

test("helpers safely handle empty or non-string inputs", () => {
  assert.equal(taskNeedsLiveResearch(null), false);
  assert.equal(buildResponseQualityInstruction("en", null).includes("CURRENT TASK: "), true);
});


test("response quality gate preserves valid text and detects the task language", () => {
  const result = applyResponseQuality("  Hello! How can I help you today?  ", "Hi");
  assert.equal(result.answer, "Hello! How can I help you today?");
  assert.equal(result.language, "en");
  assert.equal(result.passed, true);
  assert.deepEqual(result.issues, []);
});

test("response quality gate supplies a safe fallback for empty output", () => {
  const result = applyResponseQuality(null, "Muraho");
  assert.equal(typeof result.answer, "string");
  assert.ok(result.answer.length > 0);
  assert.equal(result.passed, false);
  assert.deepEqual(result.issues, ["EMPTY_AI_RESPONSE"]);
});


test("response verifier accepts a non-empty AI answer", () => {
  const result = verifyAgentResponse("Hi", "Hello! How can I help you today?", "en");
  assert.equal(result.valid, true);
  assert.deepEqual(result.issues, []);
  assert.equal(result.language, "en");
});

test("response verifier reports an empty answer", () => {
  const result = verifyAgentResponse("Hi", "   ", "en");
  assert.equal(result.valid, false);
  assert.deepEqual(result.issues, ["EMPTY_RESPONSE"]);
});
