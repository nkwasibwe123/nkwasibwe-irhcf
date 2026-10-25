"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const { createTaskRouter } = require("./task-engine");

async function withServer(app, callback) {
  const server = await new Promise(resolve => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    await callback("http://127.0.0.1:" + server.address().port);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

function makeApp({ ownerId = 7 } = {}) {
  const calls = [];
  const engine = {
    pool: {
      async query(sql, params) {
        calls.push({ sql, params });
        if (sql.includes("FROM task_runs")) return { rows: [{ id: 4, run_number: 2, status: "started" }] };
        if (sql.includes("FROM agent_runs")) return { rows: [{ id: 9, goal: "Build website", status: "executing", error: "Bearer secret123" }] };
        if (sql.includes("FROM agent_steps")) return { rows: [{ id: 12, agent_run_id: 9, step_number: 1, phase: "EXECUTE", description: "Generating files", status: "running" }] };
        throw new Error("Unexpected SQL: " + sql);
      }
    },
    async getTask(id, userId) {
      return Number(id) === 12 && Number(userId) === ownerId
        ? { id: 12, user_id: ownerId, status: "RUNNING", progress: 45, progress_message: "Generating files", updated_at: "2026-10-25T09:00:00Z" }
        : null;
    }
  };
  const app = express();
  app.use("/api/tasks", createTaskRouter({
    engine,
    authenticateToken: (req, res, next) => { req.user = { id: 7 }; next(); }
  }));
  return { app, calls };
}

test("task activity returns current progress and bounded agent timeline without raw payloads", async () => {
  const { app, calls } = makeApp();
  await withServer(app, async base => {
    const response = await fetch(base + "/api/tasks/12/activity");
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.activity.taskId, 12);
    assert.equal(body.activity.progress, 45);
    assert.equal(body.activity.agents[0].steps[0].description, "Generating files");
    assert.equal(body.activity.agents[0].error, "Bearer [redacted]");
    assert.equal(JSON.stringify(body).includes("secret123"), false);
    assert.equal(JSON.stringify(body).includes("input"), false);
    assert.ok(calls.some(call => call.sql.includes("a.user_id=$2") && call.params[1] === 7));
    assert.ok(calls.some(call => call.sql.includes("WHERE task_id=$1") && call.params[0] === 12));
  });
});

test("task activity hides tasks owned by another account before querying activity tables", async () => {
  const { app, calls } = makeApp({ ownerId: 99 });
  await withServer(app, async base => {
    const response = await fetch(base + "/api/tasks/12/activity");
    assert.equal(response.status, 404);
    assert.equal((await response.json()).code, "TASK_NOT_FOUND");
    assert.equal(calls.length, 0);
  });
});

test("task activity validates IDs and reports unavailable activity storage safely", async () => {
  const { app } = makeApp();
  await withServer(app, async base => {
    const invalid = await fetch(base + "/api/tasks/0/activity");
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).code, "TASK_ID_INVALID");
  });
});


test("task progress workspace renders the server-backed activity panel without fake activity", () => {
  const root = path.join(__dirname, "..", "..");
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
  assert.match(app, /async function refreshTaskAgentActivity\(taskId\)/);
  assert.match(app, /API_ENDPOINTS\.tasks \+ "\/" \+ id \+ "\/activity"/);
  assert.match(app, /void refreshTaskAgentActivity\(task\.id\)/);
  assert.match(html, /id="taskAgentActivity"/);
  assert.match(css, /\.task-agent-activity/);
  assert.match(app, /Nta agent step irabikwa kuri iyi task/);
});
