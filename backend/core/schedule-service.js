"use strict";

function clean(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function validateTimes(times) {
  if (!Array.isArray(times) || !times.length) {
    throw new Error("At least one schedule time is required.");
  }

  return times.map((time) => {
    const value = clean(time, 5);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      throw new Error("Schedule times must use HH:MM.");
    }
    return value;
  });
}

async function createRecurringSchedule(pool, {
  userId,
  name,
  frequency = "daily",
  timezone = "Africa/Kigali",
  times,
  taskTemplate,
  metadata = {}
} = {}) {
  if (!pool) throw new Error("Database pool is required.");
  if (!userId) throw new Error("Authenticated user is required.");
  if (!name) throw new Error("Schedule name is required.");
  if (!taskTemplate) throw new Error("Task template is required.");

  const normalizedFrequency = clean(frequency, 20).toLowerCase();
  if (!["daily", "weekly", "monthly"].includes(normalizedFrequency)) {
    throw new Error("Unsupported recurring frequency.");
  }

  const normalizedTimes = validateTimes(times);

  const result = await pool.query(
    `INSERT INTO scheduled_jobs
      (user_id, name, frequency, timezone, times, task_template, metadata, status)
     VALUES
      ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, 'active')
     RETURNING *`,
    [
      userId,
      clean(name, 200),
      normalizedFrequency,
      clean(timezone, 100),
      JSON.stringify(normalizedTimes),
      clean(taskTemplate, 100000),
      JSON.stringify(metadata)
    ]
  );

  return result.rows[0];
}

async function listSchedules(pool, userId) {
  const result = await pool.query(
    `SELECT *
     FROM scheduled_jobs
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

async function pauseSchedule(pool, userId, scheduleId) {
  const result = await pool.query(
    `UPDATE scheduled_jobs
     SET status = 'paused', updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [scheduleId, userId]
  );
  return result.rows[0] || null;
}

async function resumeSchedule(pool, userId, scheduleId) {
  const result = await pool.query(
    `UPDATE scheduled_jobs
     SET status = 'active', updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [scheduleId, userId]
  );
  return result.rows[0] || null;
}

module.exports = {
  createRecurringSchedule,
  listSchedules,
  pauseSchedule,
  resumeSchedule,
  validateTimes
};
