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

test("research failure is explicit when no web-search client is configured", async () => {
  const result = await performLiveResearch("latest news", "rw");
  assert.equal(result.required, true);
  assert.equal(result.performed, false);
  assert.equal(result.reason, "LIVE_RESEARCH_PROVIDER_UNAVAILABLE");
  assert.deepEqual(result.sources, []);
  assert.match(result.answer, /Ntabwo nshoboye/);
});

test("live research calls OpenAI web search and returns verified source URLs", async () => {
  let request;
  const fakeClient = {
    responses: {
      create: async (options) => {
        request = options;
        return {
          output_text: "Rwanda's official website reports a current update.",
          output: [{
            type: "message",
            content: [{
              type: "output_text",
              text: "Rwanda's official website reports a current update.",
              annotations: [{
                type: "url_citation",
                title: "Official Rwanda website",
                url: "https://www.gov.rw/"
              }]
            }]
          }]
        };
      }
    }
  };

  const result = await performLiveResearch("latest news in Rwanda", "en", {
    openai: fakeClient,
    model: "gpt-4o-mini"
  });

  assert.equal(request.model, "gpt-4o-mini");
  assert.deepEqual(request.tools, [{ type: "web_search_preview", search_context_size: "medium" }]);
  assert.equal(request.tool_choice, "required");
  assert.equal(result.performed, true);
  assert.equal(result.reason, "OPENAI_WEB_SEARCH_COMPLETED");
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].url, "https://www.gov.rw/");
  assert.match(result.context, /Retrieved sources/);
});

test("live research refuses to claim success without source citations", async () => {
  const result = await performLiveResearch("latest news", "en", {
    openai: { responses: { create: async () => ({ output_text: "An uncited answer." }) } }
  });
  assert.equal(result.performed, false);
  assert.equal(result.reason, "LIVE_RESEARCH_NO_VERIFIABLE_SOURCES");
  assert.deepEqual(result.sources, []);
});

test("live research handles provider errors without inventing results", async () => {
  const result = await performLiveResearch("latest news", "fr", {
    openai: { responses: { create: async () => { throw new Error("provider failed"); } } }
  });
  assert.equal(result.performed, false);
  assert.equal(result.reason, "LIVE_RESEARCH_REQUEST_FAILED");
  assert.match(result.answer, /Je ne peux pas vérifier/);
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
