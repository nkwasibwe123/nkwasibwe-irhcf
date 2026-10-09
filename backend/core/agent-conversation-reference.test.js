"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const serverPath = path.join(__dirname, "..", "server.js");
const serverSource = fs.readFileSync(serverPath, "utf8");

test("agent chat calls the existing conversation helper", () => {
  assert.match(
    serverSource,
    /async function ensureAgentConversation\s*\(/
  );
  assert.match(
    serverSource,
    /await ensureAgentConversation\(\s*userId,\s*sessionId,\s*validatedTask\s*\)/
  );
  assert.doesNotMatch(
    serverSource,
    /await createAgentConversation\s*\(/
  );
});
