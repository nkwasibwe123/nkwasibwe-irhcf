"use strict";

/**
 * NKWASIBWE IRHCF
 * PERSISTENT TASK ENGINE + WORKER
 *
 * Responsibilities:
 * - Persist long-running tasks in PostgreSQL.
 * - Use the tasks table itself as the durable queue.
 * - Claim work safely with row locks.
 * - Persist progress/checkpoints.
 * - Create task runs and agent runs.
 * - Execute through an injected orchestrator/executor.
 * - Verify results before completion.
 * - Retry/repair through explicit lifecycle states.
 *
 * This module never executes arbitrary code by itself.
 * Side effects are delegated to approved callbacks.
 */

const crypto = require("crypto");
const express = require("express");

const TASK_STATES = Object.freeze({
  PLANNED: "PLANNED",
  RUNNING: "RUNNING",
  PAUSED: "PAUSED",
  WAITING_FOR_TOOL: "WAITING_FOR_TOOL",
  WAITING_FOR_USER: "WAITING_FOR_USER",
  REPAIRING: "REPAIRING",
  VERIFYING: "VERIFYING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED"
});

const TERMINAL_STATES = new Set([
  TASK_STATES.COMPLETED,
  TASK_STATES.FAILED
]);

const DEFAULTS = Object.freeze({
  pollIntervalMs: 2000,
  maxConcurrency: 2,
  maxAttempts: 3,
  lockTimeoutMs: 10 * 60 * 1000,
  progressMessageMax: 1000,
  checkpointMaxBytes: 50000
});

function safeText(value, max = 5000) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, max);
}

function safeJson(value, fallback = {}) {
  try {
    return JSON.parse(
      JSON.stringify(value ?? fallback)
    );
  } catch {
    return fallback;
  }
}

function normalizePriority(value) {
  const n = Number(value);
  return Number.isFinite(n)
    ? Math.min(100, Math.max(0, Math.trunc(n)))
    : 1;
}

function normalizeStatus(value) {
  const status = safeText(value, 40).toUpperCase();
  return Object.values(TASK_STATES).includes(status)
    ? status
    : TASK_STATES.PLANNED;
}

function createWorkerId() {
  return `irhcf-worker-${process.pid}-${crypto.randomBytes(6).toString("hex")}`;
}

function nowIso() {
  return new Date().toISOString();
}

class TaskEngine {
  constructor(options = {}) {
    if (!options.pool) {
      throw new Error("TaskEngine requires a PostgreSQL pool.");
    }

    this.pool = options.pool;
    this.executor =
      typeof options.executor === "function"
        ? options.executor
        : null;
    this.verifier =
      typeof options.verifier === "function"
        ? options.verifier
        : null;
    this.repairer =
      typeof options.repairer === "function"
        ? options.repairer
        : null;

    this.pollIntervalMs =
      Number(options.pollIntervalMs) > 0
        ? Number(options.pollIntervalMs)
        : DEFAULTS.pollIntervalMs;

    this.maxConcurrency =
      Number(options.maxConcurrency) > 0
        ? Math.min(16, Math.trunc(options.maxConcurrency))
        : DEFAULTS.maxConcurrency;

    this.defaultMaxAttempts =
      Number(options.maxAttempts) > 0
        ? Math.min(20, Math.trunc(options.maxAttempts))
        : DEFAULTS.maxAttempts;

    this.lockTimeoutMs =
      Number(options.lockTimeoutMs) > 0
        ? Number(options.lockTimeoutMs)
        : DEFAULTS.lockTimeoutMs;

    this.workerId = options.workerId || createWorkerId();
    this.running = false;
    this.activeRuns = 0;
    this.timer = null;
  }

  async createTask({
    userId,
    task,
    sessionId = null,
    priority = 1,
    metadata = {},
    maxAttempts = this.defaultMaxAttempts
  }) {
    const cleanTask = safeText(task, 100000);

    if (!userId) {
      throw new Error("Authenticated user is required.");
    }

    if (!cleanTask) {
      throw new Error("Task text is required.");
    }

    const attemptsLimit = Math.min(
      20,
      Math.max(1, Math.trunc(Number(maxAttempts) || this.defaultMaxAttempts))
    );

    const result = await this.pool.query(
      `INSERT INTO tasks
        (
          user_id,
          task,
          status,
          priority,
          attempts,
          max_attempts,
          session_id,
          progress,
          checkpoint,
          metadata,
          next_run_at,
          created_at,
          updated_at
        )
       VALUES
        (
          $1,
          $2,
          $3,
          $4,
          0,
          $5,
          $6,
          0,
          '{}'::jsonb,
          $7,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
       RETURNING *`,
      [
        userId,
        cleanTask,
        TASK_STATES.PLANNED,
        normalizePriority(priority),
        attemptsLimit,
        sessionId ? safeText(sessionId, 255) : null,
        safeJson(metadata)
      ]
    );

    return result.rows[0];
  }

  async getTask(taskId, userId) {
    const result = await this.pool.query(
      `SELECT *
       FROM tasks
       WHERE id = $1
         AND user_id = $2
       LIMIT 1`,
      [taskId, userId]
    );

    return result.rows[0] || null;
  }

  async listTasks(userId, {
    status = null,
    limit = 50,
    offset = 0
  } = {}) {
    const safeLimit = Math.min(
      100,
      Math.max(1, Math.trunc(Number(limit) || 50))
    );
    const safeOffset = Math.max(
      0,
      Math.trunc(Number(offset) || 0)
    );

    const params = [userId];
    let where = "user_id = $1";

    if (status) {
      params.push(normalizeStatus(status));
      where += ` AND status = $${params.length}`;
    }

    params.push(safeLimit, safeOffset);

    const result = await this.pool.query(
      `SELECT *
       FROM tasks
       WHERE ${where}
       ORDER BY priority DESC, created_at ASC
       LIMIT $${params.length - 1}
       OFFSET $${params.length}`,
      params
    );

    return result.rows;
  }

  async updateProgress(taskId, {
    progress = null,
    message = "",
    checkpoint = {},
    status = null
  } = {}) {
    const boundedProgress =
      progress === null || progress === undefined
        ? null
        : Math.min(100, Math.max(0, Number(progress) || 0));

    const cleanMessage = safeText(
      message,
      DEFAULTS.progressMessageMax
    );

    const cleanCheckpoint = safeJson(checkpoint);
    const checkpointBytes =
      Buffer.byteLength(
        JSON.stringify(cleanCheckpoint),
        "utf8"
      );

    if (checkpointBytes > DEFAULTS.checkpointMaxBytes) {
      throw new Error("Task checkpoint is too large.");
    }

    const result = await this.pool.query(
      `UPDATE tasks
       SET
         progress = COALESCE($2, progress),
         progress_message = CASE
           WHEN $3 = '' THEN progress_message
           ELSE $3
         END,
         checkpoint = CASE
           WHEN $4::jsonb = '{}'::jsonb
             THEN checkpoint
           ELSE $4::jsonb
         END,
         status = COALESCE($5, status),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [
        taskId,
        boundedProgress,
        cleanMessage,
        cleanCheckpoint,
        status ? normalizeStatus(status) : null
      ]
    );

    return result.rows[0] || null;
  }

  async pauseTask(taskId, userId) {
    return this.transitionOwnedTask(
      taskId,
      userId,
      TASK_STATES.PAUSED,
      "Task paused by user."
    );
  }

  async resumeTask(taskId, userId) {
    return this.transitionOwnedTask(
      taskId,
      userId,
      TASK_STATES.PLANNED,
      "Task resumed."
    );
  }

  async cancelTask(taskId, userId) {
    return this.transitionOwnedTask(
      taskId,
      userId,
      TASK_STATES.FAILED,
      "Task cancelled by user.",
      { cancelled: true }
    );
  }

  async transitionOwnedTask(
    taskId,
    userId,
    status,
    message,
    metadata = {}
  ) {
    const result = await this.pool.query(
      `UPDATE tasks
       SET
         status = $3,
         progress_message = $4,
         metadata = COALESCE(metadata, '{}'::jsonb) || $5::jsonb,
         updated_at = CURRENT_TIMESTAMP,
         completed_at = CASE
           WHEN $3 IN ('COMPLETED', 'FAILED')
             THEN CURRENT_TIMESTAMP
           ELSE completed_at
         END
       WHERE id = $1
         AND user_id = $2
         AND status NOT IN ('COMPLETED', 'FAILED')
       RETURNING *`,
      [
        taskId,
        userId,
        status,
        safeText(message, DEFAULTS.progressMessageMax),
        safeJson(metadata)
      ]
    );

    return result.rows[0] || null;
  }

  async claimNextTask() {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `SELECT *
         FROM tasks
         WHERE status = $1
           AND (next_run_at IS NULL OR next_run_at <= CURRENT_TIMESTAMP)
         ORDER BY priority DESC, created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1`,
        [TASK_STATES.PLANNED]
      );

      if (!result.rows.length) {
        await client.query("COMMIT");
        return null;
      }

      const task = result.rows[0];

      const updated = await client.query(
        `UPDATE tasks
         SET
           status = $2,
           worker_id = $3,
           locked_at = CURRENT_TIMESTAMP,
           started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
           attempts = attempts + 1,
           progress_message = $4,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [
          task.id,
          TASK_STATES.RUNNING,
          this.workerId,
          "Worker claimed task."
        ]
      );

      await client.query("COMMIT");
      return updated.rows[0] || null;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      throw error;
    } finally {
      client.release();
    }
  }

  async createTaskRun(task) {
    const result = await this.pool.query(
      `INSERT INTO task_runs
        (
          task_id,
          run_number,
          status,
          input,
          started_at
        )
       VALUES
        (
          $1,
          $2,
          'started',
          $3::jsonb,
          CURRENT_TIMESTAMP
        )
       RETURNING *`,
      [
        task.id,
        Number(task.attempts) || 1,
        safeJson({
          task: task.task,
          sessionId: task.session_id,
          checkpoint: task.checkpoint || {}
        })
      ]
    );

    return result.rows[0];
  }

  async createAgentRun(task, taskRun) {
    const result = await this.pool.query(
      `INSERT INTO agent_runs
        (
          user_id,
          task_id,
          goal,
          status,
          plan,
          metadata,
          started_at
        )
       VALUES
        (
          $1,
          $2,
          $3,
          'running',
          '[]'::jsonb,
          $4::jsonb,
          CURRENT_TIMESTAMP
        )
       RETURNING *`,
      [
        task.user_id,
        task.id,
        task.task,
        safeJson({
          taskRunId: taskRun.id,
          workerId: this.workerId
        })
      ]
    );

    return result.rows[0];
  }

  async createAgentStep(agentRun, phase, description) {
    const result = await this.pool.query(
      `SELECT COALESCE(MAX(step_number), 0) + 1 AS next_step
       FROM agent_steps
       WHERE agent_run_id = $1`,
      [agentRun.id]
    );

    const stepNumber =
      Number(result.rows[0]?.next_step) || 1;

    const inserted = await this.pool.query(
      `INSERT INTO agent_steps
        (
          agent_run_id,
          step_number,
          phase,
          description,
          status,
          started_at
        )
       VALUES
        (
          $1,
          $2,
          $3,
          $4,
          'running',
          CURRENT_TIMESTAMP
        )
       RETURNING *`,
      [
        agentRun.id,
        stepNumber,
        safeText(description, 1000)
      ]
    );

    return inserted.rows[0];
  }

  async finishAgentStep(stepId, status, output = {}, error = null) {
    await this.pool.query(
      `UPDATE agent_steps
       SET
         status = $2,
         output = $3::jsonb,
         error = $4,
         completed_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [
        stepId,
        safeText(status, 40).toLowerCase(),
        safeJson(output),
        error ? safeText(error, 2000) : null
      ]
    );
  }

  async finishTaskRun(taskRunId, status, output = {}, error = null) {
    await this.pool.query(
      `UPDATE task_runs
       SET
         status = $2,
         output = $3::jsonb,
         error = $4,
         completed_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [
        taskRunId,
        safeText(status, 40).toLowerCase(),
        safeJson(output),
        error ? safeText(error, 4000) : null
      ]
    );
  }

  async finishAgentRun(agentRunId, status, result = null, error = null) {
    await this.pool.query(
      `UPDATE agent_runs
       SET
         status = $2,
         result = $3,
         error = $4,
         completed_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [
        agentRunId,
        safeText(status, 40).toLowerCase(),
        result === null ? null : safeText(result, 50000),
        error ? safeText(error, 4000) : null
      ]
    );
  }

  async executeClaimedTask(task) {
    let taskRun = null;
    let agentRun = null;
    let executionStep = null;

    try {
      taskRun = await this.createTaskRun(task);
      agentRun = await this.createAgentRun(task, taskRun);

      executionStep = await this.createAgentStep(
        agentRun,
        "EXECUTE",
        "Execute the task through the approved IRHCF orchestrator."
      );

      await this.updateProgress(task.id, {
        progress: 15,
        message: "Task execution started.",
        checkpoint: {
          phase: "EXECUTE",
          workerId: this.workerId
        }
      });

      if (!this.executor) {
        const error = new Error(
          "No task executor is configured."
        );
        error.code = "TASK_EXECUTOR_UNAVAILABLE";
        throw error;
      }

      const executionResult = await this.executor({
        task: task.task,
        userId: task.user_id,
        sessionId: task.session_id,
        taskId: task.id,
        taskRunId: taskRun.id,
        checkpoint: task.checkpoint || {},
        updateProgress: async (update) =>
          this.updateProgress(task.id, update)
      });

      await this.finishAgentStep(
        executionStep.id,
        "completed",
        executionResult || {}
      );

      await this.updateProgress(task.id, {
        progress: 70,
        message: "Execution finished; verifying result.",
        checkpoint: {
          phase: "VERIFY",
          execution: safeJson(executionResult)
        }
      });

      await this.pool.query(
        `UPDATE tasks
         SET status = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [task.id, TASK_STATES.VERIFYING]
      );

      const verifyStep = await this.createAgentStep(
        agentRun,
        "VERIFY",
        "Verify the produced result before completion."
      );

      let verification = {
        verified: true,
        reason: "No custom verifier configured."
      };

      if (this.verifier) {
        verification = await this.verifier({
          task,
          result: executionResult
        });
      }

      if (!verification?.verified) {
        const verificationError = new Error(
          safeText(
            verification?.reason ||
              "Task verification failed.",
            2000
          )
        );
        verificationError.code = "TASK_VERIFICATION_FAILED";

        await this.finishAgentStep(
          verifyStep.id,
          "failed",
          verification || {},
          verificationError.message
        );

        throw verificationError;
      }

      await this.finishAgentStep(
        verifyStep.id,
        "completed",
        verification
      );

      await this.finishTaskRun(
        taskRun.id,
        "completed",
        {
          result: executionResult,
          verification
        }
      );

      await this.finishAgentRun(
        agentRun.id,
        "completed",
        typeof executionResult === "string"
          ? executionResult
          : JSON.stringify(executionResult)
      );

      const completed = await this.pool.query(
        `UPDATE tasks
         SET
           status = $2,
           progress = 100,
           progress_message = $3,
           result = $4,
           error = NULL,
           worker_id = NULL,
           locked_at = NULL,
           completed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [
          task.id,
          TASK_STATES.COMPLETED,
          "Task completed and verified.",
          safeText(
            typeof executionResult === "string"
              ? executionResult
              : JSON.stringify(executionResult),
            50000
          )
        ]
      );

      return completed.rows[0] || null;
    } catch (error) {
      const message = safeText(
        error?.message || String(error),
        4000
      );

      if (executionStep) {
        await this.finishAgentStep(
          executionStep.id,
          "failed",
          {},
          message
        ).catch(() => {});
      }

      if (taskRun) {
        await this.finishTaskRun(
          taskRun.id,
          "failed",
          {},
          message
        ).catch(() => {});
      }

      if (agentRun) {
        await this.finishAgentRun(
          agentRun.id,
          "failed",
          null,
          message
        ).catch(() => {});
      }

      return this.handleTaskFailure(task, message);
    }
  }

  async handleTaskFailure(task, message) {
    const attempts = Number(task.attempts) || 0;
    const maxAttempts =
      Number(task.max_attempts) || this.defaultMaxAttempts;

    if (attempts < maxAttempts) {
      await this.pool.query(
        `UPDATE tasks
         SET
           status = $2,
           progress_message = $3,
           error = $4,
           worker_id = NULL,
           locked_at = NULL,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [
          task.id,
          TASK_STATES.REPAIRING,
          "Repair/retry cycle started.",
          message
        ]
      );

      try {
        const repairResult = this.repairer
          ? await this.repairer({
              task,
              error: message,
              attempt: attempts
            })
          : {
              repaired: false,
              strategy: "controlled_retry",
              reason: "No specialized repairer is registered; retrying through the same verified executor."
            };

        await this.pool.query(
          `UPDATE tasks
           SET
             status = $2,
             checkpoint = COALESCE(checkpoint, '{}'::jsonb) || $3::jsonb,
             progress_message = $4,
             worker_id = NULL,
             locked_at = NULL,
             next_run_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [
            task.id,
            repairResult?.waitForUser
              ? TASK_STATES.WAITING_FOR_USER
              : TASK_STATES.PLANNED,
            safeJson({
              repair: repairResult || {},
              repairedAt: nowIso()
            }),
            repairResult?.waitForUser
              ? "Waiting for user input."
              : "Repair/retry completed; task queued for retest."
          ]
        );

        return this.getTask(task.id, task.user_id);
      } catch (repairError) {
        message = safeText(
          repairError?.message || String(repairError),
          4000
        );
      }
    }

    const failed = await this.pool.query(
      `UPDATE tasks
       SET
         status = $2,
         error = $3,
         worker_id = NULL,
         locked_at = NULL,
         completed_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [
        task.id,
        TASK_STATES.FAILED,
        message
      ]
    );

    return failed.rows[0] || null;
  }

  async recoverStaleTasks() {
    const result = await this.pool.query(
      `UPDATE tasks
       SET
         status = $1,
         worker_id = NULL,
         locked_at = NULL,
         progress_message = 'Recovered stale worker lease; queued for retry.',
         next_run_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
       WHERE status = $2
         AND locked_at IS NOT NULL
         AND locked_at < CURRENT_TIMESTAMP - ($3 * INTERVAL '1 millisecond')
       RETURNING id`,
      [
        TASK_STATES.PLANNED,
        TASK_STATES.RUNNING,
        this.lockTimeoutMs
      ]
    );

    return result.rowCount;
  }

  async tick() {
    if (!this.running) {
      return;
    }

    await this.recoverStaleTasks();

    while (
      this.activeRuns < this.maxConcurrency
    ) {
      const task = await this.claimNextTask();

      if (!task) {
        break;
      }

      this.activeRuns += 1;

      this.executeClaimedTask(task)
        .catch((error) => {
          console.error(
            "[TASK ENGINE] Worker execution failure:",
            error
          );
        })
        .finally(() => {
          this.activeRuns -= 1;
        });
    }
  }

  start() {
    if (this.running) {
      return this;
    }

    this.running = true;

    this.timer = setInterval(
      () => {
        this.tick().catch((error) => {
          console.error(
            "[TASK ENGINE] Worker tick failure:",
            error
          );
        });
      },
      this.pollIntervalMs
    );

    if (typeof this.timer.unref === "function") {
      this.timer.unref();
    }

    this.tick().catch((error) => {
      console.error(
        "[TASK ENGINE] Initial worker tick failure:",
        error
      );
    });

    console.log(
      `[TASK ENGINE] Worker started: ${this.workerId}`
    );

    return this;
  }

  stop() {
    this.running = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    console.log(
      `[TASK ENGINE] Worker stopped: ${this.workerId}`
    );
  }

  getRuntimeState() {
    return {
      workerId: this.workerId,
      running: this.running,
      activeRuns: this.activeRuns,
      maxConcurrency: this.maxConcurrency,
      pollIntervalMs: this.pollIntervalMs
    };
  }
}

function createTaskRouter({
  engine,
  authenticateToken
}) {
  if (!engine) {
    throw new Error("createTaskRouter requires an engine.");
  }

  if (typeof authenticateToken !== "function") {
    throw new Error(
      "createTaskRouter requires authenticateToken."
    );
  }

  const router = express.Router();

  router.post("/", authenticateToken, async (req, res) => {
    try {
      const created = await engine.createTask({
        userId: req.user.id,
        task: req.body?.task || req.body?.message,
        sessionId: req.body?.sessionId || null,
        priority: req.body?.priority,
        metadata: req.body?.metadata,
        maxAttempts: req.body?.maxAttempts
      });

      return res.status(201).json({
        success: true,
        task: created
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: safeText(error?.message || String(error), 1000),
        code: error?.code || "TASK_CREATE_FAILED"
      });
    }
  });

  router.get("/", authenticateToken, async (req, res) => {
    try {
      const tasks = await engine.listTasks(
        req.user.id,
        {
          status: req.query?.status,
          limit: req.query?.limit,
          offset: req.query?.offset
        }
      );

      return res.json({
        success: true,
        tasks
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Could not load tasks.",
        code: "TASK_LIST_FAILED"
      });
    }
  });

  router.get("/:id", authenticateToken, async (req, res) => {
    const taskId = Number(req.params.id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid task id.",
        code: "TASK_ID_INVALID"
      });
    }

    const task = await engine.getTask(
      taskId,
      req.user.id
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        error: "Task not found.",
        code: "TASK_NOT_FOUND"
      });
    }

    return res.json({
      success: true,
      task
    });
  });

  router.post("/:id/pause", authenticateToken, async (req, res) => {
    const task = await engine.pauseTask(
      Number(req.params.id),
      req.user.id
    );

    return res.json({
      success: Boolean(task),
      task: task || null
    });
  });

  router.post("/:id/resume", authenticateToken, async (req, res) => {
    const task = await engine.resumeTask(
      Number(req.params.id),
      req.user.id
    );

    return res.json({
      success: Boolean(task),
      task: task || null
    });
  });

  router.post("/:id/cancel", authenticateToken, async (req, res) => {
    const task = await engine.cancelTask(
      Number(req.params.id),
      req.user.id
    );

    return res.json({
      success: Boolean(task),
      task: task || null
    });
  });

  return router;
}

module.exports = {
  TaskEngine,
  TASK_STATES,
  createTaskRouter
};
