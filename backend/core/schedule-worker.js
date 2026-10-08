"use strict";

function localClock(timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour}:${map.minute}`
  };
}

class ScheduleWorker {
  constructor({ pool, taskEngine, pollIntervalMs = 30000 } = {}) {
    if (!pool || !taskEngine) {
      throw new Error("ScheduleWorker requires pool and task engine.");
    }
    this.pool = pool;
    this.taskEngine = taskEngine;
    this.pollIntervalMs = Math.max(5000, Number(pollIntervalMs) || 30000);
    this.timer = null;
    this.running = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.tick().catch(() => {});
    this.timer = setInterval(() => {
      this.tick().catch(() => {});
    }, this.pollIntervalMs);
  }

  stop() {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick() {
    if (!this.running) return;

    const result = await this.pool.query(
      `SELECT *
       FROM scheduled_jobs
       WHERE status = 'active'
       ORDER BY id
       LIMIT 100`
    );

    for (const job of result.rows) {
      await this.tryRun(job);
    }
  }

  async tryRun(job) {
    const times = Array.isArray(job.times) ? job.times : [];
    const clock = localClock(job.timezone || "UTC");

    if (!times.includes(clock.time)) return;

    const runKey = `${clock.date} ${clock.time}`;

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const locked = await client.query(
        `SELECT *
         FROM scheduled_jobs
         WHERE id = $1
           AND status = 'active'
         FOR UPDATE`,
        [job.id]
      );

      if (!locked.rows.length) {
        await client.query("ROLLBACK");
        return;
      }

      const current = locked.rows[0];
      let previousKey = "";
      if (current.last_run_at) {
        const previousParts = new Intl.DateTimeFormat("en-CA", {
          timeZone: current.timezone || "UTC",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23"
        }).formatToParts(new Date(current.last_run_at));

        const previousMap = Object.fromEntries(
          previousParts.map((part) => [part.type, part.value])
        );

        previousKey =
          `${previousMap.year}-${previousMap.month}-${previousMap.day} ${previousMap.hour}:${previousMap.minute}`;
      }

      if (previousKey === runKey) {
        await client.query("COMMIT");
        return;
      }

      const task = await this.taskEngine.createTask({
        userId: current.user_id,
        task: current.task_template,
        metadata: {
          scheduleId: current.id,
          scheduleName: current.name,
          scheduledRunKey: runKey
        }
      });

      await client.query(
        `UPDATE scheduled_jobs
         SET last_run_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [current.id]
      );

      await client.query("COMMIT");

      return task;
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch {}
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = { ScheduleWorker, localClock };
