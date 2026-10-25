"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("main dashboard links to Chat with Friends", () => {
  const html = read("index.html");
  assert.match(html, /href="friends\.html"/);
  assert.match(html, /Chat with Friends/);
});

test("social workspace exposes the requested social navigation areas", () => {
  const html = read("friends.html");
  for (const label of ["Home feed", "Messages", "Watch & videos", "Short videos", "Stories", "Communities", "Work & jobs", "My profile"]) {
    assert.ok(html.includes(label), "missing navigation label: " + label);
  }
});

test("local prototype clearly distinguishes local-only posts from real publishing", () => {
  const html = read("friends.html");
  const js = read("friends.js");
  assert.match(html, /stored on this device only/i);
  assert.match(js, /Saved on this device only/);
  assert.match(js, /not yet published to other people/i);
  assert.match(js, /account-backed social API/i);
});

test("local post rendering uses textContent for user-provided post text", () => {
  const js = read("friends.js");
  assert.match(js, /text\.textContent = post\.text/);
  assert.doesNotMatch(js, /innerHTML\s*=\s*post\.text/);
});

test("image previews are bounded before being persisted in local storage", () => {
  const js = read("friends.js");
  assert.match(js, /file\.size <= 700000/);
  assert.match(js, /posts\.slice\(0,30\)/);
});
