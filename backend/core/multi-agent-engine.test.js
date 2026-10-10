"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  selectSpecialists,
  buildSpecialistMessages,
  runSpecialistTeam,
  formatSpecialistBriefs
} = require("./multi-agent-engine");
const { buildCapabilityExpansionPlan } = require("../capabilities/discovery");
const {
  VIDEO_EFFECT_PRESETS,
  normalizeVideoEditRequest,
  generateImage,
  generateMusic,
  processAudio,
  generateVideo,
  editVideo
} = require("../media/provider-contract");

test("specialist selection is bounded and prioritizes requirements, security and testing", () => {
  const team = { specialists: [
    { id: "render" }, { id: "verification" }, { id: "testing" },
    { id: "security" }, { id: "requirements" }, { id: "research" }
  ] };
  assert.deepEqual(selectSpecialists(team, 4).map(item => item.id),
    ["requirements", "security", "testing", "verification"]);
  assert.equal(selectSpecialists(team, 99).length, 6);
  const mediaTeam = { specialists: [
    { id: "requirements" }, { id: "security" }, { id: "testing" },
    { id: "verification" }, { id: "research" }, { id: "media" }, { id: "backend" }
  ] };
  assert.deepEqual(selectSpecialists(mediaTeam, 5, "Create a music video").map(item => item.id),
    ["requirements", "security", "testing", "media", "research"]);
});

test("specialist prompt safely bounds task and context", () => {
  const messages = buildSpecialistMessages("x".repeat(20000),
    { id: "security", description: "y".repeat(2000) }, "z".repeat(5000));
  assert.equal(messages.length, 2);
  assert.match(messages[0].content, /SPECIALTY: security/);
  assert.ok(messages[0].content.length < 1500);
  assert.ok(messages[1].content.length < 6000);
});

test("specialist execution aggregates successful and failed agents", async () => {
  let calls = 0;
  const result = await runSpecialistTeam({
    task: "Build and test a small website",
    team: { teamTypes: ["software"], supervisors: ["software_supervisor"],
      specialists: [
        { id: "requirements", description: "Define acceptance criteria." },
        { id: "testing", description: "Test the result." }
      ] },
    executionEngine: { async execute(request) {
      calls++;
      assert.equal(request.action, "generate_text");
      assert.equal(request.authorized, false);
      if (calls === 2) throw new Error("provider unavailable");
      return { provider: "test-provider", model: "test-model",
        result: { output_text: "Acceptance criteria: responsive layout." } };
    } },
    userId: "user-test",
    maxSpecialists: 2
  });
  assert.equal(result.completed, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.results[0].brief, "Acceptance criteria: responsive layout.");
  assert.equal(result.results[1].error, "provider unavailable");
  assert.match(formatSpecialistBriefs(result), /SPECIALIST: requirements/);
});

test("specialists execute concurrently and results retain selected order", async () => {
  const started = [];
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  const team = { specialists: [
    { id: "requirements", description: "Requirements" },
    { id: "testing", description: "Testing" },
    { id: "security", description: "Security" }
  ] };
  const pending = runSpecialistTeam({ task: "review", team, maxSpecialists: 3,
    executionEngine: { async execute(request) {
      const id = request.metadata.specialist;
      started.push(id);
      if (started.length === 3) release();
      await barrier;
      return { provider: "test-provider", model: "test-model",
        result: { output_text: "brief:" + id } };
    } }
  });
  const result = await pending;
  assert.deepEqual(started, ["requirements", "security", "testing"]);
  assert.deepEqual(result.results.map(item => item.specialist),
    ["requirements", "security", "testing"]);
  assert.equal(result.completed, 3);
  assert.equal(result.failed, 0);
});

test("empty or explicitly unverified specialist output is not counted as completed", async () => {
  let index = 0;
  const result = await runSpecialistTeam({
    task: "review",
    team: { specialists: [
      { id: "requirements", description: "Requirements" },
      { id: "testing", description: "Testing" }
    ] },
    maxSpecialists: 2,
    executionEngine: { async execute() {
      index++;
      if (index === 1) return { provider: "test-provider", result: { output_text: "   " } };
      return { provider: "test-provider",
        verification: { verified: false, reason: "Output did not pass verification." },
        result: { output_text: "Looks good." } };
    } }
  });
  assert.equal(result.completed, 0);
  assert.equal(result.failed, 2);
  assert.match(result.results[0].error, /empty brief/);
  assert.match(result.results[1].error, /did not pass verification/);
});

test("missing specialist execution adapter fails clearly", async () => {
  await assert.rejects(runSpecialistTeam({ task: "test", team: {}, executionEngine: null }),
    /central execution engine/);
});

test("capability expansion plan requires gated promotion", () => {
  const plan = buildCapabilityExpansionPlan({
    requestedCapability: "publish videos",
    reason: "User requested scheduled video publishing",
    externalAction: true
  });
  assert.equal(plan.capability, "publish_videos");
  assert.equal(plan.risk, "high");
  assert.equal(plan.productionPromotion.allowed, false);
  assert.ok(plan.stages.some(stage => stage.stage === "SANDBOX"));
  assert.ok(plan.stages.some(stage => stage.stage === "SECURITY_REVIEW"));
});

test("media contracts reject missing real providers instead of pretending success", async () => {
  for (const call of [
    () => generateImage(null, {}),
    () => generateMusic(null, {}),
    () => processAudio(null, {}),
    () => generateVideo(null, {}),
    () => editVideo(null, {})
  ]) await assert.rejects(call, error => error && error.code === "MEDIA_PROVIDER_UNAVAILABLE");
});

test("video studio exposes an explicit safe allowlist of effects", () => {
  assert.deepEqual(Object.keys(VIDEO_EFFECT_PRESETS), [
    "none", "cinematic", "vintage", "monochrome", "warm", "cool",
    "vivid", "blur", "sharpen", "fade-in", "fade-out"
  ]);
  const request = normalizeVideoEditRequest({
    inputAssetId: "asset-123", effect: "cinematic",
    startSeconds: 2, endSeconds: 12, outputFormat: "mp4",
    subtitles: "Hello IRHCF"
  });
  assert.equal(request.effectPreset.label, "Cinematic grade");
  assert.equal(request.startSeconds, 2);
  assert.equal(request.endSeconds, 12);
  assert.equal(request.outputFormat, "mp4");
  assert.equal(request.subtitles, "Hello IRHCF");
});

test("video studio rejects invalid effects, trims, formats and oversized subtitles", () => {
  assert.throws(() => normalizeVideoEditRequest({ effect: "arbitrary-filter;delete" }),
    error => error.code === "VIDEO_EFFECT_UNSUPPORTED");
  assert.throws(() => normalizeVideoEditRequest({ startSeconds: -1 }),
    error => error.code === "VIDEO_TRIM_INVALID");
  assert.throws(() => normalizeVideoEditRequest({ startSeconds: 8, endSeconds: 7 }),
    error => error.code === "VIDEO_TRIM_INVALID");
  assert.throws(() => normalizeVideoEditRequest({ outputFormat: "exe" }),
    error => error.code === "VIDEO_FORMAT_UNSUPPORTED");
  assert.throws(() => normalizeVideoEditRequest({ subtitles: "x".repeat(20001) }),
    error => error.code === "VIDEO_SUBTITLES_TOO_LONG");
});

test("video edit passes normalized effect settings to a configured provider", async () => {
  let received;
  const result = await editVideo({ async editVideo(request) {
    received = request;
    return { jobId: "edit-123", status: "queued" };
  } }, { effect: "vintage", startSeconds: 1, endSeconds: 5 });
  assert.equal(received.effect, "vintage");
  assert.equal(received.effectPreset.filter, "vintage");
  assert.equal(result.jobId, "edit-123");
});
