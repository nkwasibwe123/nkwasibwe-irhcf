"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildProjectPlan,
  shouldBecomeLongRunning
} = require("./project-autopilot");

test("a greeting does not become a persistent task", () => {
  const plan = buildProjectPlan({ idea: "Hi" });
  assert.equal(plan.phases.length, 11);
  assert.equal(shouldBecomeLongRunning(plan), false);
});

test("a simple question mentioning a website stays a normal chat task", () => {
  const plan = buildProjectPlan({ idea: "What is a website?" });
  assert.equal(plan.type, "website");
  assert.equal(shouldBecomeLongRunning(plan), false);
});

test("an explicit website build request becomes a persistent task", () => {
  const plan = buildProjectPlan({
    idea: "Build a website for my shop with login, an admin dashboard, a database, testing, and deployment."
  });
  assert.equal(shouldBecomeLongRunning(plan), true);
});

test("the fixed lifecycle phase count alone never triggers persistence", () => {
  assert.equal(
    shouldBecomeLongRunning({
      type: "general",
      idea: "Umezute se",
      phases: Array.from({ length: 11 }, (_, index) => ({ order: index + 1 }))
    }),
    false
  );
});

test("an explicit automation workflow can become a persistent task", () => {
  const plan = buildProjectPlan({
    idea: "Automate my business workflow to schedule reports every day."
  });
  assert.equal(shouldBecomeLongRunning(plan), true);
});
